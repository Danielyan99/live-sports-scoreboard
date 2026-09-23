import type { Match, TeamStats } from '@scoreboard/shared';
import { motion } from 'motion/react';
import { useFlash } from '../hooks/useFlash';

const ROWS: { key: keyof TeamStats; label: string; suffix?: string }[] = [
  { key: 'possession', label: 'Possession', suffix: '%' },
  { key: 'shots', label: 'Shots' },
  { key: 'shotsOnTarget', label: 'On target' },
  { key: 'corners', label: 'Corners' },
  { key: 'fouls', label: 'Fouls' },
];

export function StatsPanel({ match }: { match: Match }) {
  if (!match.stats) {
    return (
      <p className="px-4 py-8 text-center text-sm text-ink-muted">
        Detailed stats aren’t available for this match.
        <span className="mt-1 block text-xs text-ink-faint">
          The free football-data.org tier provides scores and status only.
        </span>
      </p>
    );
  }

  return (
    <div className="space-y-4 px-4 py-4">
      {ROWS.map((row) => (
        <StatRow
          key={row.key}
          label={row.label}
          suffix={row.suffix}
          home={match.stats!.home[row.key]}
          away={match.stats!.away[row.key]}
        />
      ))}
    </div>
  );
}

function StatRow({ label, home, away, suffix = '' }: { label: string; home: number; away: number; suffix?: string }) {
  const total = home + away;
  const homeShare = total === 0 ? 50 : (home / total) * 100;
  const homeFlash = useFlash(home, 1500);
  const awayFlash = useFlash(away, 1500);

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-sm">
        <span
          className={`tabular font-mono font-semibold transition-colors duration-500 ${homeFlash.active ? 'text-flash' : ''}`}
        >
          {home}
          {suffix}
        </span>
        <span className="text-xs text-ink-muted">{label}</span>
        <span
          className={`tabular font-mono font-semibold transition-colors duration-500 ${awayFlash.active ? 'text-flash' : ''}`}
        >
          {away}
          {suffix}
        </span>
      </div>
      <div className="flex h-1.5 gap-1" aria-hidden>
        <div className="flex flex-1 justify-end overflow-hidden rounded-full bg-pitch-800">
          <motion.div
            className="h-full rounded-full bg-live"
            initial={false}
            animate={{ width: `${homeShare}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          />
        </div>
        <div className="flex flex-1 overflow-hidden rounded-full bg-pitch-800">
          <motion.div
            className="h-full rounded-full bg-sky-400"
            initial={false}
            animate={{ width: `${100 - homeShare}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          />
        </div>
      </div>
    </div>
  );
}
