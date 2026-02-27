export type AIService = 'claude' | 'chatgpt' | 'gemini' | 'higgsfield' | 'weavy';

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
}

export interface MemberUsageSummary {
  member: TeamMember;
  totalCost: number;
  totalTokens: number;
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
  totalTokens: number;
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
