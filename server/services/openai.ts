import axios from 'axios';
import type { UsageRecord, TeamMember } from '../../src/types/index.js';

const BASE_URL = 'https://api.openai.com/v1';

interface UsageResult {
  object: string;
  input_tokens: number;
  output_tokens: number;
  input_cached_tokens?: number;
  input_audio_tokens?: number;
  output_audio_tokens?: number;
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
    const startTimestamp = Math.floor(new Date(startDate).getTime() / 1000);
    const endTimestamp = Math.floor(new Date(endDate).getTime() / 1000);

    // Fetch completions usage grouped by user_id and model
    const response = await axios.get<UsageResponse>(
      `${BASE_URL}/organization/usage/completions`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          ...(orgId && { 'OpenAI-Organization': orgId }),
        },
        params: {
          start_time: startTimestamp,
          end_time: endTimestamp,
          bucket_width: '1d',
          'group_by[]': ['user_id', 'model'],
        },
      }
    );

    const records: UsageRecord[] = [];
    const buckets = response.data.data || [];

    for (const bucket of buckets) {
      const bucketDate = new Date(bucket.start_time * 1000)
        .toISOString()
        .split('T')[0];

      for (const result of bucket.results) {
        // Match user_id to a team member
        const matchedMember = result.user_id
          ? members.find(
              (m) => m.id === result.user_id || m.email === result.user_id
            )
          : undefined;

        const targetMembers = matchedMember ? [matchedMember] : members;
        const share = 1 / targetMembers.length;

        for (const member of targetMembers) {
          const inputTokens = Math.round(result.input_tokens * share);
          const outputTokens = Math.round(result.output_tokens * share);
          const model = result.model || 'gpt-4o';

          records.push({
            service: 'chatgpt',
            memberId: member.id,
            date: bucketDate,
            inputTokens,
            outputTokens,
            totalTokens: inputTokens + outputTokens,
            cost: estimateCost(model, inputTokens, outputTokens),
            requestCount: Math.round(result.num_model_requests * share),
            model,
          });
        }
      }
    }

    return records;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const detail = JSON.stringify(error.response?.data) || error.message;
      throw new Error(`OpenAI API error (HTTP ${status}): ${detail}`);
    }
    throw new Error(`OpenAI fetch error: ${error instanceof Error ? error.message : String(error)}`);
  }
}
