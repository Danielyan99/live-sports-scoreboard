export interface AppConfig {
  port: number;
  footballDataToken: string | undefined;
  mongoUri: string | undefined;
  corsOrigins: string[];
  pollIntervalMs: number;
  /** How often to check the real API for live matches while running the demo feed. */
  probeIntervalMs: number;
  simTickMs: number;
  /** How often to refresh the latest matchday's results. They only change after a match ends. */
  resultsRefreshMs: number;
  forceDemo: boolean;
}

function int(value: string | undefined, fallback: number, min: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < min) throw new Error(`Config value ${value} is below the minimum of ${min}`);
  return parsed;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    port: int(env.PORT, 3000, 1),
    footballDataToken: env.FOOTBALL_DATA_TOKEN?.trim() || undefined,
    mongoUri: env.MONGO_URI?.trim() || undefined,
    corsOrigins: (env.CORS_ORIGIN ?? 'http://localhost:5173')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    // football-data.org free tier allows 10 requests/minute; never go faster than one every 7s.
    pollIntervalMs: int(env.POLL_INTERVAL_MS, 15_000, 7_000),
    probeIntervalMs: int(env.PROBE_INTERVAL_MS, 60_000, 7_000),
    simTickMs: int(env.SIM_TICK_MS, 3_000, 250),
    resultsRefreshMs: int(env.RESULTS_REFRESH_MS, 30 * 60_000, 5 * 60_000),
    forceDemo: env.FORCE_DEMO === 'true',
  };
}

export const APP_CONFIG = Symbol('APP_CONFIG');
