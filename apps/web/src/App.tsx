import { useEffect, useState } from "react";
import type { HealthResponse } from "@starforge/shared";
import { fetchHealth } from "./api";

export function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchHealth()
      .then((data) => {
        if (!cancelled) setHealth(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to reach API");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="page">
      <header className="hero">
        <p className="brand">Starforge</p>
        <h1>Reusable website core</h1>
        <p className="lede">
          Auth, users, profiles, and transactional email — a lean toolkit for any product site.
        </p>
      </header>

      <section className="status" aria-live="polite">
        <h2>API health</h2>
        {error && <p className="error">{error}</p>}
        {!error && !health && <p className="muted">Checking…</p>}
        {health && (
          <dl className="health-grid">
            <div>
              <dt>Status</dt>
              <dd data-ok={health.status === "ok"}>{health.status}</dd>
            </div>
            <div>
              <dt>Database</dt>
              <dd data-ok={health.checks.database === "ok"}>{health.checks.database}</dd>
            </div>
            <div>
              <dt>Version</dt>
              <dd>{health.version}</dd>
            </div>
          </dl>
        )}
      </section>
    </div>
  );
}
