import { isInPlay } from '@scoreboard/shared';
import { useEffect, useState } from 'react';
import { formatClock } from '../lib/format';
import { useAlertStore } from '../state/alertStore';
import { useMatchStore } from '../state/matchStore';

const APP_NAME = 'Pitchside Live';
const GOAL_FLASH_MS = 5000;

/**
 * Keeps the browser tab title live:
 * - on a match page: "ARS 2–1 CHE · 67'"
 * - on the list: "(5 live) Pitchside Live"
 * - for a few seconds after a goal: "⚽ GOAL! ARS 2–1 CHE", alternating so it catches the eye in a background tab.
 */
export function useLiveTitle(): void {
  const watched = useMatchStore((s) => (s.watchedMatchId ? s.matches[s.watchedMatchId] : undefined));
  const liveCount = useMatchStore((s) => Object.values(s.matches).filter(isInPlay).length);
  const latest = useAlertStore((s) => s.latest);
  const [flashOn, setFlashOn] = useState(false);

  // Blink for a few seconds after each alert.
  useEffect(() => {
    if (!latest) return;
    setFlashOn(true);
    const blink = setInterval(() => setFlashOn((on) => !on), 1000);
    const stop = setTimeout(() => {
      clearInterval(blink);
      setFlashOn(false);
    }, GOAL_FLASH_MS);
    return () => {
      clearInterval(blink);
      clearTimeout(stop);
    };
  }, [latest]);

  const flashing = latest && Date.now() - latest.at < GOAL_FLASH_MS && flashOn;
  const base = watched
    ? `${watched.home.tla} ${watched.score.home}–${watched.score.away} ${watched.away.tla} · ${formatClock(watched)} | ${APP_NAME}`
    : liveCount > 0
      ? `(${liveCount} live) ${APP_NAME}`
      : APP_NAME;

  const title = flashing
    ? latest.kind === 'goal'
      ? `⚽ GOAL! ${latest.short}`
      : `VAR: no goal · ${latest.short}`
    : base;

  useEffect(() => {
    document.title = title;
  }, [title]);
}
