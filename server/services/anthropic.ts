import axios from 'axios';
import type { UsageRecord, TeamMember } from '../../src/types/index.js';

const BASE_URL = 'https://api.anthropic.com/v1';

// --- Admin API types ---

interface ApiKeyEntry {
  id: string;
  name: string;
  created_by: { id: string; type: string };
  status: string;
  workspace_id?: string;
}

interface OrgUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface ListResponse<T> {
  data: T[];
  has_more: boolean;
  first_id?: string;
  last_id?: string;
}

// --- Usage API types ---

interface UsageBucket {
  starting_at: string;
  uncached_input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  cache_read?: number;
  api_key_id?: string;
  model?: string;
  workspace_id?: string;
}

interface MessageUsageResponse {
  data: UsageBucket[];
  has_more: boolean;
  next_page?: string;
}

interface CostBucket {
  starting_at: string;
  amount: string;
  currency: string;
  cost_type: string;
  description: string;
  model?: string;
  workspace_id?: string;
}

interface CostReportResponse {
  data: CostBucket[];
  has_more: boolean;
  next_page?: string;
}

// Custom params serializer for array query params like group_by[]
function serializeParams(params: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const v of value) {
        parts.push(`${key}=${encodeURIComponent(String(v))}`);
      }
    } else if (value !== undefined && value !== null) {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts.join('&');
}

/**
 * Match an Anthropic org user to a team member by name or email.
 * Returns the matched member, or undefined if no match.
 */
function matchUserToMember(
  user: { name: string; email: string },
  members: TeamMember[]
): TeamMember | undefined {
  // Try exact email match first (if emails are populated)
  if (user.email) {
    const byEmail = members.find(
      (m) => m.email && m.email.toLowerCase() === user.email.toLowerCase()
    );
    if (byEmail) return byEmail;
  }

  // Try name match (case-insensitive, handles "First Last" matching)
  const normalizedApiName = user.name.toLowerCase().trim();
  return members.find((m) => {
    const normalizedMemberName = m.name.toLowerCase().trim();
    return (
      normalizedMemberName === normalizedApiName ||
      normalizedApiName.includes(normalizedMemberName) ||
      normalizedMemberName.includes(normalizedApiName)
    );
  });
}

/**
 * Fetch all org API keys and users to build a mapping:
 * api_key_id -> { userName, userEmail, teamMember }
 */
async function buildApiKeyUserMap(
  apiKey: string,
  members: TeamMember[]
): Promise<Map<string, TeamMember>> {
  const headers = {
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  };

  // Fetch org users and API keys in parallel
  const [usersRes, keysRes] = await Promise.all([
    axios.get<ListResponse<OrgUser>>(`${BASE_URL}/organizations/users`, {
      headers,
      params: { limit: 100 },
    }),
    axios.get<ListResponse<ApiKeyEntry>>(`${BASE_URL}/organizations/api_keys`, {
      headers,
      params: { limit: 100, status: 'active' },
    }),
  ]);

  const orgUsers = usersRes.data?.data || [];
  const apiKeys = keysRes.data?.data || [];

  console.log(`Anthropic: found ${orgUsers.length} org users, ${apiKeys.length} API keys`);

  // Build userId -> OrgUser map
  const userById = new Map<string, OrgUser>();
  for (const user of orgUsers) {
    userById.set(user.id, user);
  }

  // Build apiKeyId -> TeamMember map
  const keyToMember = new Map<string, TeamMember>();
  for (const key of apiKeys) {
    const creatorId = key.created_by?.id;
    if (!creatorId) continue;

    const orgUser = userById.get(creatorId);
    if (!orgUser) continue;

    const member = matchUserToMember(orgUser, members);
    if (member) {
      keyToMember.set(key.id, member);
    }
  }

  console.log(`Anthropic: mapped ${keyToMember.size} API keys to team members`);
  return keyToMember;
}

export async function fetchAnthropicUsage(
  startDate: string,
  endDate: string,
  members: TeamMember[]
): Promise<UsageRecord[]> {
  const apiKey = process.env.ANTHROPIC_ADMIN_API_KEY;

  if (!apiKey) {
    console.warn('Anthropic Admin API key not configured');
    return [];
  }

  try {
    // ending_at should be the next day at midnight (exclusive end)
    const endDateObj = new Date(endDate);
    endDateObj.setDate(endDateObj.getDate() + 1);
    const endingAt = endDateObj.toISOString().split('T')[0] + 'T00:00:00Z';

    const headers = {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    };

    // Step 1: Build API key → team member mapping
    let keyToMember: Map<string, TeamMember>;
    try {
      keyToMember = await buildApiKeyUserMap(apiKey, members);
    } catch (err) {
      console.warn('Anthropic: could not fetch key/user mappings, will distribute equally:', err);
      keyToMember = new Map();
    }

    // Step 2: Fetch usage grouped by api_key_id + model, and costs in parallel
    const [usageResponse, costResponse] = await Promise.all([
      axios.get<MessageUsageResponse>(
        `${BASE_URL}/organizations/usage_report/messages`,
        {
          headers,
          paramsSerializer: serializeParams,
          params: {
            starting_at: `${startDate}T00:00:00Z`,
            ending_at: endingAt,
            bucket_width: '1d',
            limit: 31,
            'group_by[]': ['api_key_id', 'model'],
          },
        }
      ),
      axios.get<CostReportResponse>(
        `${BASE_URL}/organizations/cost_report`,
        {
          headers,
          paramsSerializer: serializeParams,
          params: {
            starting_at: `${startDate}T00:00:00Z`,
            ending_at: endingAt,
            bucket_width: '1d',
            limit: 31,
          },
        }
      ),
    ]);

    const usageBuckets = usageResponse.data?.data || [];
    const costBuckets = costResponse.data?.data || [];

    console.log(`Anthropic: ${usageBuckets.length} usage buckets, ${costBuckets.length} cost buckets`);

    // Build a daily cost map (org-level, we'll split proportionally)
    const dailyCosts: Record<string, number> = {};
    for (const bucket of costBuckets) {
      const date = bucket.starting_at.split('T')[0];
      dailyCosts[date] = (dailyCosts[date] || 0) + (parseFloat(bucket.amount) || 0) / 100;
    }

    // Step 3: Aggregate usage per member per day
    // Key: "memberId|date" -> { input, output, model }
    const memberDayUsage = new Map<
      string,
      { input: number; output: number; model: string }
    >();
    // Also track total tokens per day for cost apportionment
    const dayTotalTokens: Record<string, number> = {};

    for (const bucket of usageBuckets) {
      const date = bucket.starting_at.split('T')[0];
      const cacheRead = (bucket.cache_read_input_tokens || 0) || (bucket.cache_read || 0);
      const input = (bucket.uncached_input_tokens || 0) + cacheRead;
      const output = bucket.output_tokens || 0;
      const totalTokens = input + output;
      const model = bucket.model || 'claude-sonnet-4-20250514';

      dayTotalTokens[date] = (dayTotalTokens[date] || 0) + totalTokens;

      // Map this bucket to a team member via api_key_id
      const member = bucket.api_key_id ? keyToMember.get(bucket.api_key_id) : undefined;

      if (member) {
        // Matched to a specific person
        const key = `${member.id}|${date}`;
        const existing = memberDayUsage.get(key);
        if (existing) {
          existing.input += input;
          existing.output += output;
        } else {
          memberDayUsage.set(key, { input, output, model });
        }
      } else {
        // Can't identify user — distribute equally across all members
        const share = 1 / members.length;
        for (const m of members) {
          const key = `${m.id}|${date}`;
          const existing = memberDayUsage.get(key);
          if (existing) {
            existing.input += Math.round(input * share);
            existing.output += Math.round(output * share);
          } else {
            memberDayUsage.set(key, {
              input: Math.round(input * share),
              output: Math.round(output * share),
              model,
            });
          }
        }
      }
    }

    // Step 4: Build records, apportioning cost by token share
    const records: UsageRecord[] = [];
    for (const [key, usage] of memberDayUsage) {
      const [memberId, date] = key.split('|');
      const memberTokens = usage.input + usage.output;
      const dayTotal = dayTotalTokens[date] || 1;
      const costShare = (dailyCosts[date] || 0) * (memberTokens / dayTotal);

      records.push({
        service: 'claude',
        memberId,
        date,
        inputTokens: usage.input,
        outputTokens: usage.output,
        totalTokens: memberTokens,
        cost: costShare,
        requestCount: 0,
        model: usage.model,
      });
    }

    return records;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const detail = JSON.stringify(error.response?.data) || error.message;
      console.error(`Anthropic API error (HTTP ${status}):`, detail);
      throw new Error(`Anthropic API error (HTTP ${status}): ${detail}`);
    }
    throw new Error(`Anthropic fetch error: ${error instanceof Error ? error.message : String(error)}`);
  }
}
