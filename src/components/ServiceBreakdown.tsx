import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type { AIService, ServiceUsageSummary } from '../types/index.js';
import { SERVICE_COLORS, SERVICE_LABELS, SERVICE_META } from '../types/index.js';

interface ServiceBreakdownProps {
  byService: Record<AIService, ServiceUsageSummary>;
}

function formatNumber(n: number): string {
  const v = n || 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toFixed(0);
}

/** Returns the primary usage amount for a service using its native unit */
function getUsageAmount(service: AIService, data: ServiceUsageSummary): number {
  return SERVICE_META[service].unit === 'tokens' ? data.totalTokens : data.credits;
}

/** Returns the display label for a service's usage */
function getUsageLabel(service: AIService): string {
  return SERVICE_META[service].unitLabel;
}

export function ServiceBreakdown({ byService }: ServiceBreakdownProps) {
  const costData = Object.entries(byService)
    .filter(([, v]) => v.cost > 0)
    .map(([key, value]) => ({
      name: SERVICE_LABELS[key as AIService],
      value: parseFloat((value.cost || 0).toFixed(4)),
      color: SERVICE_COLORS[key as AIService],
    }));

  const hasData = costData.length > 0;

  return (
    <div className="chart-card">
      <h3>Service Breakdown</h3>
      {!hasData ? (
        <div className="empty-state">
          <p>No usage data available for this period.</p>
          <p className="text-muted">Configure your API keys and select a date range with activity.</p>
        </div>
      ) : (
        <div className="pie-single">
          <h4>Cost by Service</h4>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={costData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ name, percent }: { name?: string; percent?: number }) =>
                  `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`
                }
                labelLine={false}
              >
                {costData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#F9FAFB',
                }}
                formatter={(value: number | undefined) => [`$${(value ?? 0).toFixed(4)}`, 'Cost']}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="service-table">
        <table>
          <thead>
            <tr>
              <th>Service</th>
              <th>Usage</th>
              <th>Unit</th>
              <th>Requests</th>
              <th>Cost</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(byService).map(([key, value]) => {
              const service = key as AIService;
              const usage = getUsageAmount(service, value);
              return (
                <tr key={key}>
                  <td>
                    <span
                      className="service-dot"
                      style={{ backgroundColor: SERVICE_COLORS[service] }}
                    />
                    {SERVICE_LABELS[service]}
                  </td>
                  <td>{formatNumber(usage)}</td>
                  <td className="text-muted">{getUsageLabel(service)}</td>
                  <td>{formatNumber(value.requestCount)}</td>
                  <td>${(value.cost || 0).toFixed(4)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
