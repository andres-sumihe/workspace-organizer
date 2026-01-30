// API requests should use relative URLs in both:
// 1. Electron production (app:// protocol) - handled by custom protocol handler
// 2. Development with Vite - handled by Vite's proxy configuration
// Only use absolute URLs when VITE_API_URL is explicitly set.

const resolveApiBaseUrl = () => {
  // Check for environment variable override first
  const envValue = (import.meta as { env?: Record<string, unknown> }).env?.VITE_API_URL;
  if (typeof envValue === 'string' && envValue.trim().length > 0) {
    return envValue.trim();
  }

  // Use relative URLs by default
  // - In Electron production: custom protocol handler intercepts /api/* requests
  // - In Vite development: proxy configuration routes /api/* to backend server
  return '';
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
    const payload = (await response.clone().json()) as { error?: { message?: string }; code?: string; message?: string };
    if (payload?.error?.message) {
      return { message: payload.error.message, code: payload.code };
    }
    if (payload?.message) {
      return { message: payload.message, code: payload.code };
    }
  } catch {
    // ignore – fallback to status text below
  }

  return { message: response.statusText || `Request failed with status ${response.status}`, code: undefined };
};

const getAuthToken = (): string | null => {
  return localStorage.getItem('auth_access_token');
};

const clearAuthTokens = () => {
  localStorage.removeItem('auth_access_token');
  localStorage.removeItem('auth_refresh_token');
};

/** Event emitter for auth-related events */
type AuthEventListener = (event: { type: 'session_expired' | 'unauthorized'; message: string }) => void;
const authEventListeners: AuthEventListener[] = [];

export const onAuthError = (listener: AuthEventListener) => {
  authEventListeners.push(listener);
  return () => {
    const index = authEventListeners.indexOf(listener);
    if (index > -1) authEventListeners.splice(index, 1);
  };
};

const emitAuthError = (type: 'session_expired' | 'unauthorized', message: string) => {
  authEventListeners.forEach(listener => listener({ type, message }));
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
    const { message, code } = await parseErrorBody(response);
    
    // Handle authentication errors globally
    if (response.status === 401) {
      if (code === 'SESSION_EXPIRED' || code === 'TOKEN_EXPIRED') {
        clearAuthTokens();
        emitAuthError('session_expired', message);
      } else {
        emitAuthError('unauthorized', message);
      }
    }
    
    throw new ApiError(message, response.status);
  }

  // Handle 204 No Content responses (common for DELETE)
  if (response.status === 204) {
    return undefined as TResponse;
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
