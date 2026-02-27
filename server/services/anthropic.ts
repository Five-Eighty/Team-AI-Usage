import axios from 'axios';
import type { UsageRecord, TeamMember } from '../../src/types/index.js';

const BASE_URL = 'https://api.anthropic.com/v1';

interface UsageBucket {
  starting_at: string;
  uncached_input_tokens: number;
  output_tokens: number;
  cache_creation?: {
    ephemeral_5m_input_tokens: number;
    ephemeral_1h_input_tokens: number;
  };
  cache_read?: number;
  web_search_requests?: number;
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
    // Fetch token usage and costs in parallel
    const [usageResponse, costResponse] = await Promise.all([
      axios.get<MessageUsageResponse>(
        `${BASE_URL}/organizations/usage_report/messages`,
        {
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          params: {
            starting_at: `${startDate}T00:00:00Z`,
            ending_at: `${endDate}T23:59:59Z`,
            bucket_width: '1d',
            'group_by[]': ['api_key_id', 'model'],
          },
        }
      ),
      axios.get<CostReportResponse>(
        `${BASE_URL}/organizations/cost_report`,
        {
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          params: {
            starting_at: `${startDate}T00:00:00Z`,
            ending_at: `${endDate}T23:59:59Z`,
            bucket_width: '1d',
          },
        }
      ),
    ]);

    const records: UsageRecord[] = [];
    const usageBuckets = usageResponse.data.data || [];
    const costBuckets = costResponse.data.data || [];

    // Build a daily cost map
    const dailyCosts: Record<string, number> = {};
    for (const bucket of costBuckets) {
      const date = bucket.starting_at.split('T')[0];
      // amount is in cents as decimal string
      dailyCosts[date] = (dailyCosts[date] || 0) + parseFloat(bucket.amount) / 100;
    }

    // Aggregate usage by day
    const dailyUsage: Record<
      string,
      { input: number; output: number; model: string }
    > = {};

    for (const bucket of usageBuckets) {
      const date = bucket.starting_at.split('T')[0];
      if (!dailyUsage[date]) {
        dailyUsage[date] = { input: 0, output: 0, model: bucket.model || 'claude-sonnet-4-20250514' };
      }
      dailyUsage[date].input += bucket.uncached_input_tokens + (bucket.cache_read || 0);
      dailyUsage[date].output += bucket.output_tokens;
    }

    // Distribute across team members
    for (const [date, usage] of Object.entries(dailyUsage)) {
      const share = 1 / members.length;
      const dayCost = dailyCosts[date] || 0;

      for (const member of members) {
        const inputTokens = Math.round(usage.input * share);
        const outputTokens = Math.round(usage.output * share);

        records.push({
          service: 'claude',
          memberId: member.id,
          date,
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
          cost: dayCost * share,
          requestCount: 0,
          model: usage.model,
        });
      }
    }

    return records;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const detail = JSON.stringify(error.response?.data) || error.message;
      throw new Error(`Anthropic API error (HTTP ${status}): ${detail}`);
    }
    throw new Error(`Anthropic fetch error: ${error instanceof Error ? error.message : String(error)}`);
  }
}
