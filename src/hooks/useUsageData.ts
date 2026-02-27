import { useState, useEffect, useCallback } from 'react';
import { fetchUsageData } from '../api/client.js';
import type { DashboardData, DateRange } from '../types/index.js';

interface UseUsageDataResult {
  data: DashboardData | null;
  loading: boolean;
  error: string | null;
  warnings: string[];
  sampleData: boolean;
  refresh: () => void;
}

export function useUsageData(dateRange: DateRange): UseUsageDataResult {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [sampleData, setSampleData] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await fetchUsageData(
        dateRange.startDate,
        dateRange.endDate
      );
      setData(result.data);
      setWarnings(result.errors || []);
      setSampleData(result.sampleData || false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to fetch usage data'
      );
    } finally {
      setLoading(false);
    }
  }, [dateRange.startDate, dateRange.endDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return { data, loading, error, warnings, sampleData, refresh: loadData };
}
