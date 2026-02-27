/**
 * Resolve the HTTP base URL for the API server.
 *
 * Used for direct connections (SSE, WebSocket) that cannot
 * go through Vite's `/api` proxy or Electron's `app://` protocol handler.
 *
 * Resolution order:
 *  1. VITE_API_URL env variable (development override)
 *  2. Electron preload `window.api.getApiBaseUrl()` (production Electron)
 *  3. Derive from current origin (Vite dev server via proxy)
 */

let _cachedBaseUrl: string | null = null;

export async function getApiHttpBaseUrl(): Promise<string> {
  if (_cachedBaseUrl !== null) return _cachedBaseUrl;

  // 1. Explicit env variable
  const envValue = import.meta.env.VITE_API_URL as string | undefined;
  if (typeof envValue === 'string' && envValue.trim().length > 0) {
    _cachedBaseUrl = envValue.trim().replace(/\/+$/, '');
    return _cachedBaseUrl;
  }

  // 2. Electron IPC — ask main process for the real HTTP base URL
  const electronApi = (window as { api?: { getApiBaseUrl?: () => Promise<string> } }).api;
  if (typeof electronApi?.getApiBaseUrl === 'function') {
    try {
      const url = await electronApi.getApiBaseUrl();
      if (url) {
        _cachedBaseUrl = url.replace(/\/+$/, '');
        return _cachedBaseUrl;
      }
    } catch {
      // fall through
    }
  }

  // 3. Vite dev: use window.location.origin (proxy will handle /api)
  _cachedBaseUrl = window.location.origin;
  return _cachedBaseUrl;
}

/**
 * Returns the WebSocket-flavoured URL for the same API server.
 */
export async function getApiWsBaseUrl(): Promise<string> {
  const http = await getApiHttpBaseUrl();
  return http.replace(/^http/, 'ws');
}
