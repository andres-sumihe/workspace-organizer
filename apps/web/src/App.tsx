import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';

interface HealthResponse {
  status: string;
  timestamp: string;
}

const API_BASE_URL = (() => {
  const rawValue = (import.meta as { env?: Record<string, unknown> }).env?.VITE_API_URL;

  return typeof rawValue === 'string' && rawValue.trim().length > 0
    ? rawValue
    : 'http://localhost:4000';
})();

const isHealthResponse = (value: unknown): value is HealthResponse => {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return typeof candidate.status === 'string' && typeof candidate.timestamp === 'string';
};

export function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const controllerRef = useRef<AbortController | null>(null);

  const fetchHealth = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/health`, { signal: controller.signal });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as unknown;

      if (!isHealthResponse(payload)) {
        throw new Error('Received malformed health payload');
      }

      setHealth(payload);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setHealth(null);
        setError((err as Error).message ?? 'An unexpected error occurred');
      }
    } finally {
      if (controllerRef.current === controller) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void fetchHealth();

    return () => {
      controllerRef.current?.abort();
    };
  }, [fetchHealth]);

  const statusContent = health ? (
    <div className="flex flex-col gap-1">
      <span className="text-xl font-semibold text-emerald-600">{health.status}</span>
      <span className="text-sm text-muted-foreground">
        Last updated {new Date(health.timestamp).toLocaleString()}
      </span>
    </div>
  ) : (
    <div className="flex flex-col gap-1">
      <span className="text-xl font-semibold text-destructive">{error ?? 'Connecting...'}</span>
      <span className="text-sm text-muted-foreground">No healthy response received yet.</span>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-6 py-10">
          <p className="text-sm font-medium text-primary">Workspace Organizer</p>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Operations overview</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Monitor the health of backing services and prepare enriched workspace metadata for the
            dashboard. This scaffold is ready to grow into the full organizer experience.
          </p>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-10">
        <section className="grid gap-6 rounded-xl border border-border bg-card/60 p-6 shadow-sm backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">API health</h2>
              <p className="text-sm text-muted-foreground">
                Status for <code className="rounded bg-muted px-1.5 py-0.5 text-xs">/api/health</code>
                endpoint
              </p>
            </div>

            <Button onClick={() => void fetchHealth()} variant="outline" disabled={isLoading}>
              {isLoading ? 'Refreshing…' : 'Refresh'}
            </Button>
          </div>

          <div className="rounded-lg border border-border bg-muted/40 p-4">
            {statusContent}
          </div>
        </section>
      </main>
    </div>
  );
}
