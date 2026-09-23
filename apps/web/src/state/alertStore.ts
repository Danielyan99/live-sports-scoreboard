import type { LeagueCode, Match, MatchEvent } from '@scoreboard/shared';
import { create } from 'zustand';

export interface GoalAlert {
  id: string;
  matchId: string;
  league: LeagueCode;
  kind: 'goal' | 'var';
  minute: number;
  /** e.g. "Arsenal 2–1 Chelsea" */
  scoreline: string;
  side: 'home' | 'away';
  /** e.g. "Calloway · assist Ingram" or "Offside" */
  detail: string;
  /** Short form for the browser tab, e.g. "ARS 2–1 CHE" */
  short: string;
  at: number;
}

const MAX_ALERTS = 3;
const STORAGE_KEY = 'pitchside:alerts-enabled';

interface AlertState {
  enabled: boolean;
  alerts: GoalAlert[];
  /** Most recent alert, kept after the toast closes so the tab title can flash it. */
  latest: GoalAlert | null;
  push(alert: GoalAlert): void;
  dismiss(id: string): void;
  toggle(): void;
}

export const useAlertStore = create<AlertState>()((set) => ({
  enabled: readEnabled(),
  alerts: [],
  latest: null,

  push(alert) {
    set((state) =>
      state.enabled ? { alerts: [alert, ...state.alerts].slice(0, MAX_ALERTS), latest: alert } : { latest: alert },
    );
  },

  dismiss(id) {
    set((state) => ({ alerts: state.alerts.filter((a) => a.id !== id) }));
  },

  toggle() {
    set((state) => {
      const enabled = !state.enabled;
      try {
        localStorage.setItem(STORAGE_KEY, String(enabled));
      } catch {
        // Storage unavailable (private mode); the setting just won't persist.
      }
      return { enabled, alerts: enabled ? state.alerts : [] };
    });
  },
}));

function readEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}

/** Builds an alert for a goal or a VAR decision in a match that was just patched. */
export function alertFor(match: Match, event: MatchEvent): GoalAlert | null {
  if ((event.type !== 'GOAL' && event.type !== 'VAR') || !event.team) return null;

  const scoreline = `${match.home.shortName} ${match.score.home}–${match.score.away} ${match.away.shortName}`;
  const detail =
    event.type === 'VAR'
      ? (event.detail ?? 'Goal disallowed')
      : [
          event.player ?? (event.team === 'home' ? match.home.shortName : match.away.shortName),
          event.assist && `assist ${event.assist}`,
        ]
          .filter(Boolean)
          .join(' · ');

  return {
    id: event.id,
    matchId: match.id,
    league: match.league,
    kind: event.type === 'GOAL' ? 'goal' : 'var',
    minute: event.minute,
    scoreline,
    side: event.team,
    detail,
    short: `${match.home.tla} ${match.score.home}–${match.score.away} ${match.away.tla}`,
    at: Date.now(),
  };
}
