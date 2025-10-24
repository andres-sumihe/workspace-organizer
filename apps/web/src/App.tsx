import { useEffect, useState } from 'react';

type HealthResponse = {
  status: string;
  timestamp: string;
};

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export default function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`${API_BASE_URL}/api/health`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Request failed with status ${res.status}`);
        }

        return res.json();
      })
      .then((data: HealthResponse) => {
        setHealth(data);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setError(err.message);
        }
      });

    return () => controller.abort();
  }, []);

  return (
    <div className="app">
      <header className="app__header">
        <h1>Workspace Organizer</h1>
        <p className="app__subtitle">General-purpose dashboard scaffold ready for feature development.</p>
      </header>
      <main className="app__content">
        {health ? (
          <div className="status status--up">
            <strong>API status:</strong> {health.status} at {new Date(health.timestamp).toLocaleString()}
          </div>
        ) : (
          <div className="status status--down">
            <strong>API status:</strong> {error ?? 'Connecting...'}
          </div>
        )}
      </main>
    </div>
  );
}
