import axios from 'axios';
import type { UsageRecord, TeamMember } from '../../src/types/index.js';

// Note: Weavy.ai (the AI design workflow platform) does NOT have a public API yet.
// Their knowledge center states: "Weavy doesn't offer API integration for any of its plans.
// This is a feature they're actively working on."
//
// Weavy.ai uses a credit-based system. The Team plan ($48/user/month) includes a
// Credits Management system where admins can set monthly credit allocations per user
// and track usage in real time — but only through the web UI.
//
// This service attempts to call a hypothetical usage API endpoint.
// For production use, consider:
// 1. Manual data entry/import from the Weavy.ai dashboard
// 2. Waiting for their API to become available
// 3. Using webhook-based tracking if/when supported

export async function fetchWeavyUsage(
  startDate: string,
  endDate: string,
  members: TeamMember[]
): Promise<UsageRecord[]> {
  const apiKey = process.env.WEAVY_API_KEY;
  const envUrl = process.env.WEAVY_ENVIRONMENT_URL;

  if (!apiKey || !envUrl) {
    console.warn('Weavy API key or environment URL not configured');
    return [];
  }

  const baseUrl = envUrl.replace(/\/$/, '');

  try {
    // Attempt to fetch usage data.
    // As of current version, Weavy.ai does not expose a usage API.
    // This tries a hypothetical endpoint that may become available.
    const response = await axios.get(`${baseUrl}/api/usage`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      params: {
        start: startDate,
        end: endDate,
      },
    });

    const records: UsageRecord[] = [];
    const data = response.data?.data || [];

    // Group by date and user
    const dailyUsage: Record<string, { credits: number; count: number }> = {};

    for (const entry of data) {
      const date =
        typeof entry.timestamp === 'string'
          ? entry.timestamp.split('T')[0]
          : startDate;
      if (!dailyUsage[date]) {
        dailyUsage[date] = { credits: 0, count: 0 };
      }
      dailyUsage[date].credits += entry.credits_used || 1;
      dailyUsage[date].count += 1;
    }

    // Weavy.ai pricing is per-user subscription; estimate per-credit cost
    // Team plan: $48/user/month with credits management
    const costPerCredit = 0.01;

    for (const [date, usage] of Object.entries(dailyUsage)) {
      const share = 1 / members.length;

      for (const member of members) {
        records.push({
          service: 'weavy',
          memberId: member.id,
          date,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: Math.round(usage.credits * share),
          cost: usage.credits * costPerCredit * share,
          requestCount: Math.round(usage.count * share),
          model: 'weavy-ai',
        });
      }
    }

    return records;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      console.warn(
        'Weavy.ai usage API not available yet. ' +
          'Track usage via the Weavy.ai dashboard Credits Management system.'
      );
    } else if (axios.isAxiosError(error)) {
      console.error(
        'Weavy API error:',
        error.response?.status,
        error.response?.data
      );
    } else {
      console.error('Weavy fetch error:', error);
    }
    return [];
  }
}
