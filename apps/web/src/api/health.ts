import { apiRequest } from './client';

export interface HealthPayload {
  status: 'ok' | 'degraded';
  timestamp: string;
  responseTimeMs?: number;
  dependencies?: {
    database?: 'connected' | 'error';
    [key: string]: string | undefined;
  };
}

export const fetchHealth = (signal?: AbortSignal) =>
  apiRequest<HealthPayload>('/api/health', { signal });
