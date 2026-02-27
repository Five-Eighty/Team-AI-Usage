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
import { SERVICE_COLORS, SERVICE_LABELS, SERVICE_META } from '../types/index.js';

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
      color: SERVICE_COLORS[service],
    }))
    .filter((d) => d.cost > 0);

  const initials = summary.member.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  // Build per-service detail with correct unit labels
  const serviceDetails = (Object.keys(SERVICE_COLORS) as AIService[])
    .map((service) => {
      const svc = summary.byService[service];
      const meta = SERVICE_META[service];
      const usage = meta.unit === 'tokens' ? svc.totalTokens : svc.credits;
      return { service, svc, meta, usage };
    })
    .filter(({ svc, usage }) => svc.cost > 0 || usage > 0);

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
        <td>{summary.totalTokens > 0 ? formatNumber(summary.totalTokens) : '—'}</td>
        <td>{summary.totalCredits > 0 ? formatNumber(summary.totalCredits) : '—'}</td>
        <td className="cost-cell">${(summary.totalCost || 0).toFixed(2)}</td>
      </tr>
      {expanded && (
        <tr className="member-detail">
          <td colSpan={4}>
            <div className="member-detail-content">
              <div className="member-chart">
                <ResponsiveContainer width="100%" height={Math.max(160, serviceDetails.length * 40)}>
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
                {serviceDetails.map(({ service, svc, meta, usage }) => (
                  <div key={service} className="service-detail">
                    <span
                      className="service-dot"
                      style={{ backgroundColor: SERVICE_COLORS[service] }}
                    />
                    <span className="service-name">
                      {SERVICE_LABELS[service]}
                    </span>
                    <span className="service-stat">
                      {formatNumber(usage)} {meta.unitLabel}
                    </span>
                    <span className="service-stat">
                      ${(svc.cost || 0).toFixed(4)}
                    </span>
                  </div>
                ))}
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
            <th>Credits</th>
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
