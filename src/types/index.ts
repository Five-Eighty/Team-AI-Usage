export type AIService = 'claude' | 'chatgpt' | 'gemini' | 'higgsfield' | 'weavy';

export type UsageUnit = 'tokens' | 'credits';

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
}

export interface UsageRecord {
  service: AIService;
  memberId: string;
  date: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
  requestCount: number;
  model?: string;
  credits?: number; // for credit-based services (Higgsfield, Weavy)
}

export interface MemberUsageSummary {
  member: TeamMember;
  totalCost: number;
  totalTokens: number;   // sum of token-based services only
  totalCredits: number;   // sum of credit-based services only
  totalRequests: number;
  byService: Record<AIService, ServiceUsageSummary>;
}

export interface ServiceUsageSummary {
  service: AIService;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
  requestCount: number;
  credits: number;
}

export interface DailyUsage {
  date: string;
  claude: number;
  chatgpt: number;
  gemini: number;
  higgsfield: number;
  weavy: number;
  total: number;
}

export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface DashboardData {
  members: MemberUsageSummary[];
  dailyUsage: DailyUsage[];
  totalCost: number;
  totalTokens: number;    // token-based services only
  totalCredits: number;   // credit-based services only
  totalRequests: number;
  byService: Record<AIService, ServiceUsageSummary>;
  dateRange: DateRange;
}

export const SERVICE_COLORS: Record<AIService, string> = {
  claude: '#D97706',
  chatgpt: '#10A37F',
  gemini: '#4285F4',
  higgsfield: '#8B5CF6',
  weavy: '#EC4899',
};

export const SERVICE_LABELS: Record<AIService, string> = {
  claude: 'Claude',
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
  higgsfield: 'Higgsfield',
  weavy: 'Weavy',
};

/** Metadata about each service's measurement system */
export interface ServiceMeta {
  label: string;
  color: string;
  unit: UsageUnit;
  unitLabel: string;     // "tokens" or "credits"
  unitLabelSingular: string;
}

export const SERVICE_META: Record<AIService, ServiceMeta> = {
  claude: {
    label: 'Claude',
    color: '#D97706',
    unit: 'tokens',
    unitLabel: 'tokens',
    unitLabelSingular: 'token',
  },
  chatgpt: {
    label: 'ChatGPT',
    color: '#10A37F',
    unit: 'tokens',
    unitLabel: 'tokens',
    unitLabelSingular: 'token',
  },
  gemini: {
    label: 'Gemini',
    color: '#4285F4',
    unit: 'tokens',
    unitLabel: 'tokens',
    unitLabelSingular: 'token',
  },
  higgsfield: {
    label: 'Higgsfield',
    color: '#8B5CF6',
    unit: 'credits',
    unitLabel: 'credits',
    unitLabelSingular: 'credit',
  },
  weavy: {
    label: 'Weavy',
    color: '#EC4899',
    unit: 'credits',
    unitLabel: 'credits',
    unitLabelSingular: 'credit',
  },
};

export const TOKEN_SERVICES: AIService[] = ['claude', 'chatgpt', 'gemini'];
export const CREDIT_SERVICES: AIService[] = ['higgsfield', 'weavy'];
