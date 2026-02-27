import axios from 'axios';
import type { UsageRecord, TeamMember } from '../../src/types/index.js';

const MONITORING_BASE_URL = 'https://monitoring.googleapis.com/v3';

interface TimeSeriesData {
  metric: {
    type: string;
    labels: Record<string, string>;
  };
  resource: {
    type: string;
    labels: Record<string, string>;
  };
  points: Array<{
    interval: {
      startTime: string;
      endTime: string;
    };
    value: {
      int64Value?: string;
      doubleValue?: number;
    };
  }>;
}

interface MonitoringResponse {
  timeSeries: TimeSeriesData[];
  nextPageToken?: string;
}

async function getAccessToken(): Promise<string | null> {
  // Use Application Default Credentials
  // In production, this would use a service account
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credPath) return null;

  try {
    // Use gcloud to get an access token (works with ADC)
    const { execSync } = await import('child_process');
    const token = execSync('gcloud auth application-default print-access-token', {
      encoding: 'utf-8',
    }).trim();
    return token;
  } catch {
    console.warn('Could not get Google Cloud access token');
    return null;
  }
}

export async function fetchGeminiUsage(
  startDate: string,
  endDate: string,
  members: TeamMember[]
): Promise<UsageRecord[]> {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;

  if (!projectId) {
    console.warn('Google Cloud project ID not configured');
    return [];
  }

  const accessToken = await getAccessToken();
  if (!accessToken) {
    console.warn('Google Cloud access token not available');
    return [];
  }

  try {
    // Query Cloud Monitoring for Gemini API request counts
    const response = await axios.get<MonitoringResponse>(
      `${MONITORING_BASE_URL}/projects/${projectId}/timeSeries`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        params: {
          filter:
            'metric.type = "serviceruntime.googleapis.com/api/request_count" AND resource.labels.service = "generativelanguage.googleapis.com"',
          'interval.startTime': new Date(startDate).toISOString(),
          'interval.endTime': new Date(endDate).toISOString(),
          'aggregation.alignmentPeriod': '86400s',
          'aggregation.perSeriesAligner': 'ALIGN_SUM',
        },
      }
    );

    const records: UsageRecord[] = [];
    const timeSeries = response.data.timeSeries || [];

    // Aggregate all time series data
    let totalRequests = 0;
    const dailyRequests: Record<string, number> = {};

    for (const series of timeSeries) {
      for (const point of series.points) {
        const date = point.interval.startTime.split('T')[0];
        const count = parseInt(point.value.int64Value || '0', 10);
        dailyRequests[date] = (dailyRequests[date] || 0) + count;
        totalRequests += count;
      }
    }

    // Estimate tokens and cost per request (average Gemini usage)
    // Gemini 1.5 Pro: $1.25/M input, $5/M output tokens
    const avgInputTokensPerReq = 500;
    const avgOutputTokensPerReq = 200;
    const costPerInputToken = 1.25 / 1_000_000;
    const costPerOutputToken = 5.0 / 1_000_000;

    for (const [date, requestCount] of Object.entries(dailyRequests)) {
      const share = 1 / members.length;

      for (const member of members) {
        const memberRequests = Math.round(requestCount * share);
        const inputTokens = memberRequests * avgInputTokensPerReq;
        const outputTokens = memberRequests * avgOutputTokensPerReq;

        records.push({
          service: 'gemini',
          memberId: member.id,
          date,
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
          cost:
            inputTokens * costPerInputToken +
            outputTokens * costPerOutputToken,
          requestCount: memberRequests,
          model: 'gemini-2.5-pro',
        });
      }
    }

    return records;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const detail = JSON.stringify(error.response?.data) || error.message;
      throw new Error(`Gemini API error (HTTP ${status}): ${detail}`);
    }
    throw new Error(`Gemini fetch error: ${error instanceof Error ? error.message : String(error)}`);
  }
}
