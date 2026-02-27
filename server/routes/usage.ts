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
import { TOKEN_SERVICES } from '../../src/types/index.js';

const router = Router();

const EMPTY_SERVICE_SUMMARY: ServiceUsageSummary = {
  service: 'claude',
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
  cost: 0,
  requestCount: 0,
  credits: 0,
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

function isTokenService(service: AIService): boolean {
  return TOKEN_SERVICES.includes(service);
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
      totalCredits: 0,
      totalRequests: 0,
      byService: createServiceSummaries(),
    });
  }

  let totalCost = 0;
  let totalTokens = 0;
  let totalCredits = 0;
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
    const credits = record.credits || 0;

    // Update member summary
    const memberSummary = memberMap.get(record.memberId);
    if (memberSummary) {
      memberSummary.totalCost += cost;
      memberSummary.totalRequests += requestCount;

      // Track tokens vs credits separately
      if (isTokenService(record.service)) {
        memberSummary.totalTokens += totalTokensRec;
      } else {
        memberSummary.totalCredits += credits;
      }

      const svc = memberSummary.byService[record.service];
      svc.inputTokens += inputTokens;
      svc.outputTokens += outputTokens;
      svc.totalTokens += totalTokensRec;
      svc.cost += cost;
      svc.requestCount += requestCount;
      svc.credits += credits;
    }

    // Update daily usage (always by cost — cost is universally comparable)
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
    overall.credits += credits;

    // Track totals
    totalCost += cost;
    totalRequests += requestCount;
    if (isTokenService(record.service)) {
      totalTokens += totalTokensRec;
    } else {
      totalCredits += credits;
    }

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
    totalCredits,
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

  // Deterministic pseudo-random based on seed string
  function seededRandom(seed: string): number {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
    }
    return (Math.abs(hash) % 1000) / 1000;
  }

  // Give each member a stable "intensity" per service (0.1–1.0)
  // This creates power-user vs light-user variation
  const memberIntensity: Record<string, Record<string, number>> = {};
  for (const member of teamMembers) {
    memberIntensity[member.id] = {};
    for (const svc of ['claude', 'chatgpt', 'gemini', 'higgsfield', 'weavy']) {
      // Intensity follows a skewed distribution: some heavy users, many light
      const raw = seededRandom(`intensity-${member.id}-${svc}`);
      memberIntensity[member.id][svc] = 0.05 + raw * raw * 0.95; // square for skew
    }
  }

  // Token-based services
  const tokenSvcs: Array<{
    service: AIService; model: string;
    costRange: [number, number]; tokenRange: [number, number];
  }> = [
    { service: 'claude', model: 'claude-sonnet-4-20250514', costRange: [0.50, 8.00], tokenRange: [5000, 150000] },
    { service: 'chatgpt', model: 'gpt-4o', costRange: [0.30, 6.00], tokenRange: [4000, 120000] },
    { service: 'gemini', model: 'gemini-2.0-flash', costRange: [0.10, 3.00], tokenRange: [3000, 80000] },
  ];

  // Credit-based services
  const creditSvcs: Array<{
    service: AIService; model: string;
    costRange: [number, number]; creditRange: [number, number];
  }> = [
    { service: 'higgsfield', model: 'higgsfield-pro', costRange: [0.20, 5.00], creditRange: [5, 80] },
    { service: 'weavy', model: 'weavy-standard', costRange: [0.15, 3.50], creditRange: [3, 50] },
  ];

  const start = new Date(startDate);
  const end = new Date(endDate);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const date = d.toISOString().split('T')[0];
    if (d.getDay() === 0 || d.getDay() === 6) continue;

    for (const member of teamMembers) {
      const intensity = memberIntensity[member.id];

      // Token-based services
      for (const svc of tokenSvcs) {
        const memberWeight = intensity[svc.service];
        // Skip probability based on intensity (light users skip more days)
        const skipThreshold = 0.7 - memberWeight * 0.5; // heavy: skip <20%, light: skip ~65%
        const r = seededRandom(`${member.id}-${date}-${svc.service}`);
        if (r < skipThreshold) continue;

        const dailyRand = seededRandom(`tok-${member.id}-${date}-${svc.service}`);
        const totalTokens = Math.round(
          (svc.tokenRange[0] + dailyRand * (svc.tokenRange[1] - svc.tokenRange[0])) * memberWeight
        );
        const inputTokens = Math.round(totalTokens * (0.6 + seededRandom(`split-${member.id}-${date}`) * 0.2));
        const outputTokens = totalTokens - inputTokens;

        const costRand = seededRandom(`cost-${member.id}-${date}-${svc.service}`);
        const cost = (svc.costRange[0] + costRand * (svc.costRange[1] - svc.costRange[0])) * memberWeight;

        records.push({
          service: svc.service,
          memberId: member.id,
          date,
          inputTokens,
          outputTokens,
          totalTokens,
          cost: Math.round(cost * 10000) / 10000,
          requestCount: Math.round((1 + seededRandom(`req-${member.id}-${date}-${svc.service}`) * 25) * memberWeight),
          model: svc.model,
        });
      }

      // Credit-based services
      for (const svc of creditSvcs) {
        const memberWeight = intensity[svc.service];
        const skipThreshold = 0.75 - memberWeight * 0.5;
        const r = seededRandom(`${member.id}-${date}-${svc.service}`);
        if (r < skipThreshold) continue;

        const costRand = seededRandom(`cost-${member.id}-${date}-${svc.service}`);
        const cost = (svc.costRange[0] + costRand * (svc.costRange[1] - svc.costRange[0])) * memberWeight;

        const creditRand = seededRandom(`cred-${member.id}-${date}-${svc.service}`);
        const credits = Math.round(
          (svc.creditRange[0] + creditRand * (svc.creditRange[1] - svc.creditRange[0])) * memberWeight
        );

        records.push({
          service: svc.service,
          memberId: member.id,
          date,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          cost: Math.round(cost * 10000) / 10000,
          requestCount: Math.round((1 + seededRandom(`req-${member.id}-${date}-${svc.service}`) * 10) * memberWeight),
          model: svc.model,
          credits,
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

    // Fall back to sample data when no real records were returned
    const useSampleData = allRecords.length === 0;
    const finalRecords = useSampleData
      ? generateSampleRecords(startDate, endDate)
      : allRecords;

    if (useSampleData) {
      console.log('No records from any service — using sample data');
    } else {
      console.log(`Aggregating ${allRecords.length} records from live APIs`);
    }

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

  res.json({ success: true, data: results, envCheck });
});

export default router;
