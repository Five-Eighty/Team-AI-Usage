import axios from 'axios';
import type { DashboardData, TeamMember } from '../types/index.js';

const api = axios.create({
  baseURL: '/api',
});

interface ApiResponse<T> {
  success: boolean;
  data: T;
  errors?: string[];
}

export async function fetchUsageData(
  startDate: string,
  endDate: string
): Promise<{ data: DashboardData; errors?: string[] }> {
  const response = await api.get<ApiResponse<DashboardData>>('/usage', {
    params: { startDate, endDate },
  });
  return { data: response.data.data, errors: response.data.errors };
}

export async function fetchMembers(): Promise<TeamMember[]> {
  const response = await api.get<ApiResponse<TeamMember[]>>('/usage/members');
  return response.data.data;
}

interface ServiceStatus {
  configured: boolean;
  label: string;
  note?: string;
}

export async function fetchServiceStatus(): Promise<
  Record<string, ServiceStatus>
> {
  const response = await api.get<ApiResponse<Record<string, ServiceStatus>>>(
    '/usage/status'
  );
  return response.data.data;
}
