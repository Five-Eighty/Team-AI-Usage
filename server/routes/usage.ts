import { Router } from 'express';
import type { Request, Response } from 'express';
import { fetchAnthropicUsage } from '../services/anthropic.js';
import { fetchOpenAIUsage } from '../services/openai.js';
import { fetchGeminiUsage } from '../services/gemini.js';
import { fetchHiggsFieldUsage } from '../services/higgsfield.js';
import { fetchWeavyUsage } from '../services/weavy.js';
import { teamMembers } from '../config.js';
import type {
  UsageRecord,
  AIService,
  MemberUsageSummary,
  ServiceUsageSummary,
  DailyUsage,
  DashboardData,
} from '../../src/types/index.js';

const router = Router();

const EMPTY_SERVICE_SUMMARY: ServiceUsageSummary = {
  service: 'claude',
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
  cost: 0,
  requestCount: 0,
};

function createServiceSummaries(): Record<AIService, ServiceUsageSummary> {
  return {
    claude: { ...EMPTY_SERVICE_SUMMARY, service: 'claude' },
    chatgpt: { ...EMPTY_SERVICE_SUMMARY, service: 'chatgpt' },
    gemini: { ...EMPTY_SERVICE_SUMMARY, service: 'gemini' },
    higgsfield: { ...EMPTY_SERVICE_SUMMARY, service: 'higgsfield' },
    weavy: { ...EMPTY_SERVICE_SUMMARY, service: 'weavy' },
  };
}

function aggregateRecords(records: UsageRecord[]): DashboardData {
  const memberMap = new Map<string, MemberUsageSummary>();
  const dailyMap = new Map<string, DailyUsage>();
  const overallByService = createServiceSummaries();

  // Initialize member summaries
  for (const member of teamMembers) {
    memberMap.set(member.id, {
      member,
      totalCost: 0,
      totalTokens: 0,
      totalRequests: 0,
      byService: createServiceSummaries(),
    });
  }

  let totalCost = 0;
  let totalTokens = 0;
  let totalRequests = 0;
  let minDate = '';
  let maxDate = '';

  for (const record of records) {
    // Sanitize: NaN becomes null in JSON, crashing the frontend
    const cost = record.cost || 0;
    const inputTokens = record.inputTokens || 0;
    const outputTokens = record.outputTokens || 0;
    const totalTokensRec = record.totalTokens || 0;
    const requestCount = record.requestCount || 0;

    // Update member summary
    const memberSummary = memberMap.get(record.memberId);
    if (memberSummary) {
      memberSummary.totalCost += cost;
      memberSummary.totalTokens += totalTokensRec;
      memberSummary.totalRequests += requestCount;

      const svc = memberSummary.byService[record.service];
      svc.inputTokens += inputTokens;
      svc.outputTokens += outputTokens;
      svc.totalTokens += totalTokensRec;
      svc.cost += cost;
      svc.requestCount += requestCount;
    }

    // Update daily usage
    if (!dailyMap.has(record.date)) {
      dailyMap.set(record.date, {
        date: record.date,
        claude: 0,
        chatgpt: 0,
        gemini: 0,
        higgsfield: 0,
        weavy: 0,
        total: 0,
      });
    }
    const daily = dailyMap.get(record.date)!;
    daily[record.service] += cost;
    daily.total += cost;

    // Update overall service totals
    const overall = overallByService[record.service];
    overall.inputTokens += inputTokens;
    overall.outputTokens += outputTokens;
    overall.totalTokens += totalTokensRec;
    overall.cost += cost;
    overall.requestCount += requestCount;

    // Track totals
    totalCost += cost;
    totalTokens += totalTokensRec;
    totalRequests += requestCount;

    // Track date range
    if (!minDate || record.date < minDate) minDate = record.date;
    if (!maxDate || record.date > maxDate) maxDate = record.date;
  }

  // Sort daily usage by date
  const dailyUsage = Array.from(dailyMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  return {
    members: Array.from(memberMap.values()),
    dailyUsage,
    totalCost,
    totalTokens,
    totalRequests,
    byService: overallByService,
    dateRange: {
      startDate: minDate || new Date().toISOString().split('T')[0],
      endDate: maxDate || new Date().toISOString().split('T')[0],
    },
  };
}

// Generate sample data when no API keys are configured
function generateSampleRecords(startDate: string, endDate: string): UsageRecord[] {
  const records: UsageRecord[] = [];
  const services: Array<{ service: AIService; model: string; costRange: [number, number]; tokenRange: [number, number] }> = [
    { service: 'claude', model: 'claude-sonnet-4-20250514', costRange: [0.50, 4.00], tokenRange: [5000, 80000] },
    { service: 'chatgpt', model: 'gpt-4o', costRange: [0.30, 3.00], tokenRange: [4000, 60000] },
    { service: 'gemini', model: 'gemini-2.0-flash', costRange: [0.10, 1.50], tokenRange: [3000, 40000] },
  ];

  // Deterministic pseudo-random based on member id + date
  function seededRandom(seed: string): number {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
    }
    return (Math.abs(hash) % 1000) / 1000;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const date = d.toISOString().split('T')[0];
    // Skip weekends
    if (d.getDay() === 0 || d.getDay() === 6) continue;

    for (const member of teamMembers) {
      for (const svc of services) {
        const r = seededRandom(`${member.id}-${date}-${svc.service}`);
        // Not every member uses every service every day
        if (r < 0.3) continue;

        const costFactor = seededRandom(`cost-${member.id}-${date}-${svc.service}`);
        const cost = svc.costRange[0] + costFactor * (svc.costRange[1] - svc.costRange[0]);

        const tokenFactor = seededRandom(`tok-${member.id}-${date}-${svc.service}`);
        const totalTokens = Math.round(svc.tokenRange[0] + tokenFactor * (svc.tokenRange[1] - svc.tokenRange[0]));
        const inputTokens = Math.round(totalTokens * 0.7);
        const outputTokens = totalTokens - inputTokens;

        records.push({
          service: svc.service,
          memberId: member.id,
          date,
          inputTokens,
          outputTokens,
          totalTokens,
          cost: Math.round(cost * 10000) / 10000,
          requestCount: Math.round(1 + seededRandom(`req-${member.id}-${date}-${svc.service}`) * 20),
          model: svc.model,
        });
      }
    }
  }

  return records;
}

// GET /api/usage?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
router.get('/', async (req: Request, res: Response) => {
  try {
    const startDate =
      (req.query.startDate as string) ||
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate =
      (req.query.endDate as string) || new Date().toISOString().split('T')[0];

    // Fetch usage from all services in parallel
    const [claude, chatgpt, gemini, higgsfield, weavy] = await Promise.allSettled([
      fetchAnthropicUsage(startDate, endDate, teamMembers),
      fetchOpenAIUsage(startDate, endDate, teamMembers),
      fetchGeminiUsage(startDate, endDate, teamMembers),
      fetchHiggsFieldUsage(startDate, endDate, teamMembers),
      fetchWeavyUsage(startDate, endDate, teamMembers),
    ]);

    // Collect all successful results
    const allRecords: UsageRecord[] = [];
    const errors: string[] = [];

    for (const [name, result] of [
      ['Claude', claude],
      ['ChatGPT', chatgpt],
      ['Gemini', gemini],
      ['Higgsfield', higgsfield],
      ['Weavy', weavy],
    ] as const) {
      if (result.status === 'fulfilled') {
        allRecords.push(...result.value);
      } else {
        errors.push(`${name}: ${result.reason?.message || 'Unknown error'}`);
      }
    }

    // Warn about unconfigured services (they return [] without throwing)
    const serviceKeyMap: Record<string, string | undefined> = {
      Claude: process.env.ANTHROPIC_ADMIN_API_KEY,
      ChatGPT: process.env.OPENAI_ADMIN_API_KEY,
      Gemini: process.env.GOOGLE_CLOUD_PROJECT_ID,
      Higgsfield: process.env.HIGGSFIELD_API_KEY,
      Weavy: process.env.WEAVY_API_KEY,
    };
    for (const [name, key] of Object.entries(serviceKeyMap)) {
      if (!key) {
        errors.push(`${name}: API key not configured`);
      }
    }

    // Fall back to sample data when no API keys are configured
    const useSampleData = allRecords.length === 0 && !Object.values(serviceKeyMap).some(Boolean);
    const finalRecords = useSampleData
      ? generateSampleRecords(startDate, endDate)
      : allRecords;

    const dashboard = aggregateRecords(finalRecords);

    res.json({
      success: true,
      data: dashboard,
      errors: errors.length > 0 ? errors : undefined,
      sampleData: useSampleData || undefined,
    });
  } catch (error) {
    console.error('Usage endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch usage data',
    });
  }
});

// GET /api/usage/members
router.get('/members', (_req: Request, res: Response) => {
  res.json({ success: true, data: teamMembers });
});

// GET /api/usage/status — returns which services are configured
router.get('/status', (_req: Request, res: Response) => {
  const services = {
    claude: {
      configured: !!process.env.ANTHROPIC_ADMIN_API_KEY,
      label: 'Claude (Anthropic)',
    },
    chatgpt: {
      configured: !!process.env.OPENAI_ADMIN_API_KEY,
      label: 'ChatGPT (OpenAI)',
    },
    gemini: {
      configured: !!process.env.GOOGLE_CLOUD_PROJECT_ID,
      label: 'Gemini (Google)',
    },
    higgsfield: {
      configured: !!process.env.HIGGSFIELD_API_KEY,
      label: 'Higgsfield',
      note: 'Usage API not yet available — dashboard tracking only',
    },
    weavy: {
      configured: !!(process.env.WEAVY_API_KEY && process.env.WEAVY_ENVIRONMENT_URL),
      label: 'Weavy.ai',
      note: 'API not yet available — dashboard tracking only',
    },
  };

  res.json({ success: true, data: services });
});

// GET /api/usage/diagnose — test each API connection and report results
router.get('/diagnose', async (_req: Request, res: Response) => {
  const results: Record<string, { ok: boolean; records?: number; error?: string; keyPrefix?: string }> = {};

  const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const endDate = new Date().toISOString().split('T')[0];

  const tests: Array<{ name: string; keyVar: string; fn: () => Promise<UsageRecord[]> }> = [
    { name: 'claude', keyVar: 'ANTHROPIC_ADMIN_API_KEY', fn: () => fetchAnthropicUsage(startDate, endDate, teamMembers) },
    { name: 'chatgpt', keyVar: 'OPENAI_ADMIN_API_KEY', fn: () => fetchOpenAIUsage(startDate, endDate, teamMembers) },
    { name: 'gemini', keyVar: 'GOOGLE_CLOUD_PROJECT_ID', fn: () => fetchGeminiUsage(startDate, endDate, teamMembers) },
    { name: 'higgsfield', keyVar: 'HIGGSFIELD_API_KEY', fn: () => fetchHiggsFieldUsage(startDate, endDate, teamMembers) },
    { name: 'weavy', keyVar: 'WEAVY_API_KEY', fn: () => fetchWeavyUsage(startDate, endDate, teamMembers) },
  ];

  for (const test of tests) {
    const keyValue = process.env[test.keyVar];
    const keyPrefix = keyValue ? `${keyValue.substring(0, 8)}...` : '(not set)';

    try {
      const records = await test.fn();
      results[test.name] = { ok: true, records: records.length, keyPrefix };
    } catch (error) {
      results[test.name] = {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        keyPrefix,
      };
    }
  }

  // List all env var names that look API/config related (no values for security)
  const allEnvNames = Object.keys(process.env)
    .filter((k) => !k.startsWith('npm_') && !k.startsWith('__'))
    .sort();

  const expectedVars = [
    'ANTHROPIC_ADMIN_API_KEY',
    'ANTHROPIC_ORGANIZATION_ID',
    'OPENAI_ADMIN_API_KEY',
    'OPENAI_ORGANIZATION_ID',
    'GOOGLE_CLOUD_PROJECT_ID',
    'GOOGLE_APPLICATION_CREDENTIALS',
    'HIGGSFIELD_API_KEY',
    'WEAVY_API_KEY',
    'WEAVY_ENVIRONMENT_URL',
  ];
  const envCheck: Record<string, boolean> = {};
  for (const v of expectedVars) {
    envCheck[v] = !!process.env[v];
  }

  res.json({ success: true, data: results, envVarNames: allEnvNames, envCheck });
});

export default router;
