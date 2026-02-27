import { DollarSign, Zap, Hash, Users } from 'lucide-react';
import type { DashboardData } from '../types/index.js';

interface StatsCardsProps {
  data: DashboardData;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

function formatCost(n: number): string {
  return `$${n.toFixed(2)}`;
}

export function StatsCards({ data }: StatsCardsProps) {
  const stats = [
    {
      label: 'Total Cost',
      value: formatCost(data.totalCost),
      icon: DollarSign,
      color: '#10B981',
    },
    {
      label: 'Total Tokens',
      value: formatNumber(data.totalTokens),
      icon: Zap,
      color: '#F59E0B',
    },
    {
      label: 'Total Requests',
      value: formatNumber(data.totalRequests),
      icon: Hash,
      color: '#6366F1',
    },
    {
      label: 'Team Members',
      value: data.members.length.toString(),
      icon: Users,
      color: '#EC4899',
    },
  ];

  return (
    <div className="stats-grid">
      {stats.map((stat) => (
        <div key={stat.label} className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: `${stat.color}20`, color: stat.color }}>
            <stat.icon size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{stat.value}</span>
            <span className="stat-label">{stat.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
