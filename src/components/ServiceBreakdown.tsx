import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type { AIService, ServiceUsageSummary } from '../types/index.js';
import { SERVICE_COLORS, SERVICE_LABELS } from '../types/index.js';

interface ServiceBreakdownProps {
  byService: Record<AIService, ServiceUsageSummary>;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

export function ServiceBreakdown({ byService }: ServiceBreakdownProps) {
  const costData = Object.entries(byService)
    .filter(([, v]) => v.cost > 0)
    .map(([key, value]) => ({
      name: SERVICE_LABELS[key as AIService],
      value: parseFloat(value.cost.toFixed(4)),
      color: SERVICE_COLORS[key as AIService],
    }));

  const tokenData = Object.entries(byService)
    .filter(([, v]) => v.totalTokens > 0)
    .map(([key, value]) => ({
      name: SERVICE_LABELS[key as AIService],
      value: value.totalTokens,
      color: SERVICE_COLORS[key as AIService],
    }));

  const hasData = costData.length > 0 || tokenData.length > 0;

  return (
    <div className="chart-card">
      <h3>Service Breakdown</h3>
      {!hasData ? (
        <div className="empty-state">
          <p>No usage data available for this period.</p>
          <p className="text-muted">Configure your API keys and select a date range with activity.</p>
        </div>
      ) : (
        <div className="pie-charts">
          <div className="pie-section">
            <h4>By Cost</h4>
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
          <div className="pie-section">
            <h4>By Tokens</h4>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={tokenData}
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
                  {tokenData.map((entry, index) => (
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
                  formatter={(value: number | undefined) => [
                    formatNumber(value ?? 0),
                    'Tokens',
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      <div className="service-table">
        <table>
          <thead>
            <tr>
              <th>Service</th>
              <th>Input Tokens</th>
              <th>Output Tokens</th>
              <th>Total Tokens</th>
              <th>Requests</th>
              <th>Cost</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(byService).map(([key, value]) => (
              <tr key={key}>
                <td>
                  <span
                    className="service-dot"
                    style={{ backgroundColor: SERVICE_COLORS[key as AIService] }}
                  />
                  {SERVICE_LABELS[key as AIService]}
                </td>
                <td>{formatNumber(value.inputTokens)}</td>
                <td>{formatNumber(value.outputTokens)}</td>
                <td>{formatNumber(value.totalTokens)}</td>
                <td>{formatNumber(value.requestCount)}</td>
                <td>${value.cost.toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
