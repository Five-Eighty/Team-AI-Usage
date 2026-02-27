import { DollarSign, Zap, Coins, Users } from 'lucide-react';
import type { DashboardData } from '../types/index.js';

interface StatsCardsProps {
  data: DashboardData;
}

function formatNumber(n: number): string {
  const v = n || 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toFixed(0);
}

function formatCost(n: number): string {
  return `$${(n || 0).toFixed(2)}`;
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
      label: 'API Tokens',
      subtitle: 'Claude, ChatGPT, Gemini',
      value: formatNumber(data.totalTokens),
      icon: Zap,
      color: '#F59E0B',
    },
    {
      label: 'Credits Used',
      subtitle: 'Higgsfield, Weavy',
      value: formatNumber(data.totalCredits),
      icon: Coins,
      color: '#8B5CF6',
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
            {'subtitle' in stat && stat.subtitle && (
              <span className="stat-sublabel">{stat.subtitle}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
