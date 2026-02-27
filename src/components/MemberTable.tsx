import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { MemberUsageSummary, AIService } from '../types/index.js';
import { SERVICE_COLORS, SERVICE_LABELS } from '../types/index.js';

interface MemberTableProps {
  members: MemberUsageSummary[];
}

function formatNumber(n: number): string {
  const v = n || 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toFixed(0);
}

function MemberRow({ summary }: { summary: MemberUsageSummary }) {
  const [expanded, setExpanded] = useState(false);

  const chartData = (Object.keys(SERVICE_COLORS) as AIService[])
    .map((service) => ({
      name: SERVICE_LABELS[service],
      cost: parseFloat((summary.byService[service].cost || 0).toFixed(4)),
      tokens: summary.byService[service].totalTokens,
      color: SERVICE_COLORS[service],
    }))
    .filter((d) => d.cost > 0 || d.tokens > 0);

  const initials = summary.member.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  return (
    <>
      <tr
        className="member-row"
        onClick={() => setExpanded(!expanded)}
      >
        <td>
          <div className="member-info">
            <button className="expand-btn">
              {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
            <div className="avatar">{initials}</div>
            <div>
              <span className="member-name">{summary.member.name}</span>
              <span className="member-role">{summary.member.role}</span>
            </div>
          </div>
        </td>
        <td>{formatNumber(summary.totalTokens)}</td>
        <td>{formatNumber(summary.totalRequests)}</td>
        <td className="cost-cell">${(summary.totalCost || 0).toFixed(4)}</td>
      </tr>
      {expanded && (
        <tr className="member-detail">
          <td colSpan={4}>
            <div className="member-detail-content">
              <div className="member-chart">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData} layout="vertical">
                    <XAxis
                      type="number"
                      stroke="#9CA3AF"
                      fontSize={12}
                      tickFormatter={(v: number) => `$${(v || 0).toFixed(2)}`}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      stroke="#9CA3AF"
                      fontSize={12}
                      width={90}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1F2937',
                        border: '1px solid #374151',
                        borderRadius: '8px',
                        color: '#F9FAFB',
                      }}
                      formatter={(value: number | undefined) => [`$${(value ?? 0).toFixed(4)}`, 'Cost']}
                    />
                    <Bar dataKey="cost" radius={[0, 4, 4, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell
                          key={index}
                          fill={entry.color}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="member-services">
                {(Object.keys(SERVICE_COLORS) as AIService[]).map((service) => {
                  const svc = summary.byService[service];
                  if (svc.cost === 0 && svc.totalTokens === 0) return null;
                  return (
                    <div key={service} className="service-detail">
                      <span
                        className="service-dot"
                        style={{ backgroundColor: SERVICE_COLORS[service] }}
                      />
                      <span className="service-name">
                        {SERVICE_LABELS[service]}
                      </span>
                      <span className="service-stat">
                        {formatNumber(svc.totalTokens)} tokens
                      </span>
                      <span className="service-stat">
                        ${(svc.cost || 0).toFixed(4)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function MemberTable({ members }: MemberTableProps) {
  const sorted = [...members].sort((a, b) => b.totalCost - a.totalCost);

  return (
    <div className="chart-card">
      <h3>Usage by Team Member</h3>
      <table className="member-table">
        <thead>
          <tr>
            <th>Member</th>
            <th>Tokens</th>
            <th>Requests</th>
            <th>Cost</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((summary) => (
            <MemberRow key={summary.member.id} summary={summary} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
