const DEFAULT_API_BASE_URL = 'http://localhost:4000';

const resolveApiBaseUrl = () => {
  const envValue = (import.meta as { env?: Record<string, unknown> }).env?.VITE_API_URL;

  if (typeof envValue === 'string' && envValue.trim().length > 0) {
    return envValue;
  }

  if (typeof window !== 'undefined' && typeof window.location?.origin === 'string') {
    return window.location.origin;
  }

  return DEFAULT_API_BASE_URL;
};

const API_BASE_URL = resolveApiBaseUrl();

interface RequestOptions extends globalThis.RequestInit {
  query?: Record<string, string | number | boolean | undefined>;
}

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

const buildUrl = (path: string, query?: RequestOptions['query']) => {
  const url = new URL(path.replace(/^\/+/, ''), API_BASE_URL.replace(/\/$/, '') + '/');

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined) {
        continue;
      }
      url.searchParams.set(key, String(value));
    }
  }

  return url;
};

export const apiRequest = async <TResponse>(
  path: string,
  { query, headers, ...init }: RequestOptions = {}
): Promise<TResponse> => {
  const url = buildUrl(path, query);
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...headers,
    },
  });

  if (!response.ok) {
    throw new ApiError(`Request failed with status ${response.status}`, response.status);
  }

  return (await response.json()) as TResponse;
};
