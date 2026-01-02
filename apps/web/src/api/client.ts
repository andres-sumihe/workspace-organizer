// In Electron production builds using custom protocol (app://bundle/),
// API requests should be relative so they get intercepted by the protocol handler.
// In development (Vite dev server), we need absolute URLs to the API server.
const isElectronProduction = () => {
  return typeof window !== 'undefined' && 
         window.location.protocol === 'app:';
};

const resolveApiBaseUrl = () => {
  // In Electron production (app:// protocol), use relative URLs
  // The custom protocol handler will intercept /api/* requests
  if (isElectronProduction()) {
    return ''; // Empty string means relative URLs (/api/...)
  }
  
  // Check for environment variable override
  const envValue = (import.meta as { env?: Record<string, unknown> }).env?.VITE_API_URL;
  if (typeof envValue === 'string' && envValue.trim().length > 0) {
    return envValue.trim();
  }

  // Default to localhost port 4000 for development
  return 'http://127.0.0.1:4000';
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
  // For Electron production (empty base URL), use relative URLs
  // The custom protocol handler will intercept these requests
  const normalizedPath = path.replace(/^\/+/, '');
  
  let url: URL;
  if (API_BASE_URL === '') {
    // Relative URL for Electron production
    // Use window.location.origin as base for URL construction
    url = new URL(`/${normalizedPath}`, window.location.origin);
  } else {
    // Absolute URL for development
    url = new URL(normalizedPath, API_BASE_URL.replace(/\/$/, '') + '/');
  }

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

const parseErrorBody = async (response: Response) => {
  try {
    const payload = (await response.clone().json()) as { error?: { message?: string } };
    if (payload?.error?.message) {
      return payload.error.message;
    }
  } catch {
    // ignore – fallback to status text below
  }

  return response.statusText || `Request failed with status ${response.status}`;
};

const getAuthToken = (): string | null => {
  return localStorage.getItem('auth_access_token');
};

export const apiRequest = async <TResponse>(
  path: string,
  { query, headers, ...init }: RequestOptions = {}
): Promise<TResponse> => {
  const url = buildUrl(path, query);
  const token = getAuthToken();
  
  const response = await fetch(url, {
    ...init,
    cache: init?.cache ?? 'no-store',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  if (!response.ok) {
    const message = await parseErrorBody(response);
    throw new ApiError(message, response.status);
  }

  return (await response.json()) as TResponse;
};

export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string, options?: RequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'DELETE' }),
};
