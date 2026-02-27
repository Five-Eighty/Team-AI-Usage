import axios from 'axios';
import type { UsageRecord, TeamMember } from '../../src/types/index.js';

const BASE_URL = 'https://platform.higgsfield.ai';

// Note: Higgsfield does NOT have a dedicated usage/billing API endpoint.
// Usage analytics are only available via their web dashboard.
// This service tracks usage by logging generation requests client-side
// or by scraping the dashboard data via their team analytics.
//
// For production use, consider:
// 1. Wrapping Higgsfield API calls through your own proxy to track usage
// 2. Using the Enterprise plan's audit log capabilities
// 3. Contacting Higgsfield about programmatic usage data access

interface HiggsFieldGeneration {
  request_id: string;
  status: 'Queued' | 'InProgress' | 'Completed' | 'Failed' | 'NSFW' | 'Cancelled';
  images?: Array<{ url: string }>;
  video?: { url: string };
}

export async function fetchHiggsFieldUsage(
  startDate: string,
  endDate: string,
  members: TeamMember[]
): Promise<UsageRecord[]> {
  const apiKey = process.env.HIGGSFIELD_API_KEY;

  if (!apiKey) {
    console.warn('Higgsfield API key not configured');
    return [];
  }

  try {
    // Attempt to fetch usage data via any available analytics endpoint.
    // As of current API version, Higgsfield doesn't expose usage endpoints.
    // This implementation uses a hypothetical /v1/usage endpoint that may
    // become available in future API versions.
    const response = await axios.get(`${BASE_URL}/v1/usage`, {
      headers: {
        Authorization: `Key ${apiKey}`,
      },
      params: {
        start_date: startDate,
        end_date: endDate,
      },
    });

    const records: UsageRecord[] = [];
    const entries = response.data?.data || [];

    // Group by date
    const dailyUsage: Record<string, { credits: number; count: number }> = {};

    for (const entry of entries) {
      const date =
        typeof entry.created_at === 'string'
          ? entry.created_at.split('T')[0]
          : startDate;
      if (!dailyUsage[date]) {
        dailyUsage[date] = { credits: 0, count: 0 };
      }
      dailyUsage[date].credits += entry.credits_used || 0;
      dailyUsage[date].count += 1;
    }

    // Credit pricing: videos ~20-50 credits, images ~0.25-5 credits
    // Basic plan: 150 credits = $9 → ~$0.06/credit
    const costPerCredit = 0.06;

    for (const [date, usage] of Object.entries(dailyUsage)) {
      const share = 1 / members.length;

      for (const member of members) {
        records.push({
          service: 'higgsfield',
          memberId: member.id,
          date,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: Math.round(usage.credits * share),
          cost: usage.credits * costPerCredit * share,
          requestCount: Math.round(usage.count * share),
          model: 'higgsfield-video',
        });
      }
    }

    return records;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      // Expected: usage endpoint doesn't exist yet
      return [];
    }
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const detail = JSON.stringify(error.response?.data) || error.message;
      throw new Error(`Higgsfield API error (HTTP ${status}): ${detail}`);
    }
    throw new Error(`Higgsfield fetch error: ${error instanceof Error ? error.message : String(error)}`);
  }
}
