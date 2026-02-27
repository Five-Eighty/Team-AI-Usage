import axios from 'axios';
import type { UsageRecord, TeamMember } from '../../src/types/index.js';

const BASE_URL = 'https://api.openai.com/v1';

// --- Admin API types ---

interface OrgUser {
  object: string;
  id: string;
  name: string;
  email: string;
  role: string;
}

interface OrgUserListResponse {
  object: string;
  data: OrgUser[];
  has_more: boolean;
  first_id?: string;
  last_id?: string;
}

// --- Usage API types ---

interface UsageResult {
  object: string;
  input_tokens: number;
  output_tokens: number;
  input_cached_tokens?: number;
  num_model_requests: number;
  project_id?: string;
  user_id?: string;
  api_key_id?: string;
  model?: string;
  batch?: boolean;
}

interface UsageBucket {
  object: string;
  start_time: number;
  end_time: number;
  results: UsageResult[];
}

interface UsageResponse {
  object: string;
  data: UsageBucket[];
  has_more: boolean;
  next_page?: string;
}

// GPT model pricing (per million tokens)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4-turbo': { input: 10, output: 30 },
  'gpt-4': { input: 30, output: 60 },
  'o1': { input: 15, output: 60 },
  'o1-mini': { input: 3, output: 12 },
  'o3-mini': { input: 1.1, output: 4.4 },
};

function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING['gpt-4o'];
  return (
    (inputTokens * pricing.input) / 1_000_000 +
    (outputTokens * pricing.output) / 1_000_000
  );
}

// Custom params serializer for array query params
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
 * Match an OpenAI org user to a team member by name or email.
 */
function matchUserToMember(
  user: { name: string; email: string },
  members: TeamMember[]
): TeamMember | undefined {
  if (user.email) {
    const byEmail = members.find(
      (m) => m.email && m.email.toLowerCase() === user.email.toLowerCase()
    );
    if (byEmail) return byEmail;
  }

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
 * Fetch all org users and build a user_id -> TeamMember map.
 */
async function buildUserMap(
  apiKey: string,
  orgId: string | undefined,
  members: TeamMember[]
): Promise<Map<string, TeamMember>> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
  };
  if (orgId) headers['OpenAI-Organization'] = orgId;

  const response = await axios.get<OrgUserListResponse>(
    `${BASE_URL}/organization/users`,
    { headers, params: { limit: 100 } }
  );

  const orgUsers = response.data?.data || [];
  console.log(`OpenAI: found ${orgUsers.length} org users`);

  const userToMember = new Map<string, TeamMember>();
  for (const user of orgUsers) {
    const member = matchUserToMember(user, members);
    if (member) {
      userToMember.set(user.id, member);
    }
  }

  console.log(`OpenAI: mapped ${userToMember.size} org users to team members`);
  return userToMember;
}

export async function fetchOpenAIUsage(
  startDate: string,
  endDate: string,
  members: TeamMember[]
): Promise<UsageRecord[]> {
  const apiKey = process.env.OPENAI_ADMIN_API_KEY;
  const orgId = process.env.OPENAI_ORGANIZATION_ID;

  if (!apiKey) {
    console.warn('OpenAI Admin API key not configured');
    return [];
  }

  try {
    const startTimestamp = Math.floor(new Date(`${startDate}T00:00:00Z`).getTime() / 1000);
    const endDateObj = new Date(`${endDate}T00:00:00Z`);
    endDateObj.setDate(endDateObj.getDate() + 1);
    const endTimestamp = Math.floor(endDateObj.getTime() / 1000);

    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
    };
    if (orgId) headers['OpenAI-Organization'] = orgId;

    // Step 1: Build user_id -> team member mapping
    let userToMember: Map<string, TeamMember>;
    try {
      userToMember = await buildUserMap(apiKey, orgId, members);
    } catch (err) {
      console.warn('OpenAI: could not fetch org users, will distribute equally:', err);
      userToMember = new Map();
    }

    // Step 2: Fetch usage grouped by user_id + model
    const response = await axios.get<UsageResponse>(
      `${BASE_URL}/organization/usage/completions`,
      {
        headers,
        paramsSerializer: serializeParams,
        params: {
          start_time: startTimestamp,
          end_time: endTimestamp,
          bucket_width: '1d',
          limit: 31,
          'group_by[]': ['user_id', 'model'],
        },
      }
    );

    const records: UsageRecord[] = [];
    const buckets = response.data?.data || [];

    console.log(
      `OpenAI: ${buckets.length} usage buckets, ` +
      `${buckets.reduce((n, b) => n + (b.results?.length || 0), 0)} results`
    );

    for (const bucket of buckets) {
      const bucketDate = new Date(bucket.start_time * 1000)
        .toISOString()
        .split('T')[0];

      for (const result of (bucket.results || [])) {
        const inputTokens = result.input_tokens || 0;
        const outputTokens = result.output_tokens || 0;
        const model = result.model || 'gpt-4o';
        const requestCount = result.num_model_requests || 0;

        // Try to match user_id to a team member
        const matchedMember = result.user_id
          ? userToMember.get(result.user_id)
          : undefined;

        if (matchedMember) {
          // Matched to a specific person
          records.push({
            service: 'chatgpt',
            memberId: matchedMember.id,
            date: bucketDate,
            inputTokens,
            outputTokens,
            totalTokens: inputTokens + outputTokens,
            cost: estimateCost(model, inputTokens, outputTokens),
            requestCount,
            model,
          });
        } else {
          // Can't identify — distribute equally
          const share = 1 / members.length;
          for (const member of members) {
            records.push({
              service: 'chatgpt',
              memberId: member.id,
              date: bucketDate,
              inputTokens: Math.round(inputTokens * share),
              outputTokens: Math.round(outputTokens * share),
              totalTokens: Math.round((inputTokens + outputTokens) * share),
              cost: estimateCost(model, Math.round(inputTokens * share), Math.round(outputTokens * share)),
              requestCount: Math.round(requestCount * share),
              model,
            });
          }
        }
      }
    }

    return records;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const detail = JSON.stringify(error.response?.data) || error.message;
      console.error(`OpenAI API error (HTTP ${status}):`, detail);
      throw new Error(`OpenAI API error (HTTP ${status}): ${detail}`);
    }
    throw new Error(`OpenAI fetch error: ${error instanceof Error ? error.message : String(error)}`);
  }
}
