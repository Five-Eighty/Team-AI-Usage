import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { DailyUsage } from '../types/index.js';
import { SERVICE_COLORS, SERVICE_LABELS } from '../types/index.js';

interface CostChartProps {
  dailyUsage: DailyUsage[];
}

function formatDate(date: string): string {
  const d = new Date(date + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function CostChart({ dailyUsage }: CostChartProps) {
  const data = dailyUsage.map((d) => ({
    ...d,
    date: formatDate(d.date),
  }));

  return (
    <div className="chart-card">
      <h3>Daily Cost by Service</h3>
      <ResponsiveContainer width="100%" height={350}>
        <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="date" stroke="#9CA3AF" fontSize={12} />
          <YAxis
            stroke="#9CA3AF"
            fontSize={12}
            tickFormatter={(v: number) => `$${(v || 0).toFixed(2)}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1F2937',
              border: '1px solid #374151',
              borderRadius: '8px',
              color: '#F9FAFB',
            }}
            formatter={(value: number | undefined, name: string | undefined) => [
              `$${(value ?? 0).toFixed(4)}`,
              SERVICE_LABELS[(name ?? '') as keyof typeof SERVICE_LABELS] || name || '',
            ]}
          />
          <Legend
            formatter={(value: string) =>
              SERVICE_LABELS[value as keyof typeof SERVICE_LABELS] || value
            }
          />
          <Area
            type="monotone"
            dataKey="claude"
            stackId="1"
            stroke={SERVICE_COLORS.claude}
            fill={SERVICE_COLORS.claude}
            fillOpacity={0.6}
          />
          <Area
            type="monotone"
            dataKey="chatgpt"
            stackId="1"
            stroke={SERVICE_COLORS.chatgpt}
            fill={SERVICE_COLORS.chatgpt}
            fillOpacity={0.6}
          />
          <Area
            type="monotone"
            dataKey="gemini"
            stackId="1"
            stroke={SERVICE_COLORS.gemini}
            fill={SERVICE_COLORS.gemini}
            fillOpacity={0.6}
          />
          <Area
            type="monotone"
            dataKey="higgsfield"
            stackId="1"
            stroke={SERVICE_COLORS.higgsfield}
            fill={SERVICE_COLORS.higgsfield}
            fillOpacity={0.6}
          />
          <Area
            type="monotone"
            dataKey="weavy"
            stackId="1"
            stroke={SERVICE_COLORS.weavy}
            fill={SERVICE_COLORS.weavy}
            fillOpacity={0.6}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
