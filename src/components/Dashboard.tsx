import { useState } from 'react';
import { Header } from './Header.js';
import { DateRangePicker } from './DateRangePicker.js';
import { StatsCards } from './StatsCards.js';
import { CostChart } from './CostChart.js';
import { ServiceBreakdown } from './ServiceBreakdown.js';
import { MemberTable } from './MemberTable.js';
import { ServiceStatus } from './ServiceStatus.js';
import { useUsageData } from '../hooks/useUsageData.js';
import type { DateRange } from '../types/index.js';
import { AlertTriangle, Loader, Info } from 'lucide-react';

function getDefaultDateRange(): DateRange {
  const end = new Date();
  const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  };
}

export function Dashboard() {
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultDateRange());
  const { data, loading, error, warnings, sampleData, refresh } = useUsageData(dateRange);

  return (
    <div className="dashboard">
      <Header onRefresh={refresh} loading={loading} />

      <div className="dashboard-controls">
        <DateRangePicker dateRange={dateRange} onChange={setDateRange} />
        <ServiceStatus />
      </div>

      {sampleData && (
        <div className="sample-data-banner">
          <Info size={14} />
          <span>
            Showing sample data — configure API keys in your Railway environment variables to display real usage.
          </span>
        </div>
      )}

      {!sampleData && warnings.length > 0 && (
        <div className="warnings">
          {warnings.map((w, i) => (
            <div key={i} className="warning-item">
              <AlertTriangle size={14} />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="error-banner">
          <p>Failed to load data: {error}</p>
          <p className="text-muted">
            Make sure the backend server is running on port 3001.
          </p>
        </div>
      )}

      {loading && !data && (
        <div className="loading-state">
          <Loader size={32} className="spin" />
          <p>Fetching usage data from all services...</p>
        </div>
      )}

      {data && (
        <>
          <StatsCards data={data} />

          <div className="charts-row">
            <CostChart dailyUsage={data.dailyUsage} />
            <ServiceBreakdown byService={data.byService} />
          </div>

          <MemberTable members={data.members} />
        </>
      )}
    </div>
  );
}
