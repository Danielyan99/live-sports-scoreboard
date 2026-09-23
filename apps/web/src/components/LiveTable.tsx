import { LEAGUES, liveTable, type LeagueCode, type LiveStandingRow } from '@scoreboard/shared';
import { motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useMatchStore } from '../state/matchStore';
import { LeagueDot } from './LeagueFilter';
import { TeamBadge } from './TeamBadge';

/** Top 4 (Champions League places) and bottom 3 (relegation) get a coloured edge. */
const zone = (position: number, total: number) =>
  position <= 4 ? 'border-l-sky-400' : position > total - 3 ? 'border-l-card-red' : 'border-l-transparent';

/**
 * A league table that re-ranks live. The server sends the table of finished
 * matches only when a match ends; the in-play scores are added on the client,
 * so every goal can move teams up or down instantly with no extra traffic.
 */
export function LiveTable({ leagues }: { leagues: LeagueCode[] }) {
  const tables = useMatchStore((s) => s.tables);
  const available = leagues.filter((code) => tables.some((t) => t.league === code));
  const [picked, setPicked] = useState<LeagueCode | null>(null);
  const league = picked && available.includes(picked) ? picked : available[0];

  if (!league) return null;

  return (
    <section aria-labelledby="live-table" className="overflow-hidden rounded-xl border border-pitch-800 bg-pitch-900">
      <div className="flex items-center justify-between gap-3 border-b border-pitch-800 px-4 py-3">
        <div>
          <h2 id="live-table" className="text-sm font-semibold">
            Live table
          </h2>
          <p className="text-xs text-ink-muted">Re-ranks as goals go in</p>
        </div>
        {available.length > 1 && (
          <div role="tablist" aria-label="Table league" className="flex gap-1 rounded-md bg-pitch-850 p-0.5">
            {available.map((code) => (
              <button
                key={code}
                role="tab"
                aria-selected={code === league}
                onClick={() => setPicked(code)}
                className={`flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium ${
                  code === league ? 'bg-pitch-700 text-ink' : 'text-ink-muted hover:text-ink'
                }`}
              >
                <LeagueDot league={code} />
                {code === 'PL' ? 'PL' : 'LaLiga'}
              </button>
            ))}
          </div>
        )}
      </div>
      <TableBody league={league} />
    </section>
  );
}

function TableBody({ league }: { league: LeagueCode }) {
  const base = useMatchStore((s) => s.tables.find((t) => t.league === league));
  const matches = useMatchStore(useShallow((s) => Object.values(s.matches)));
  const rows = useMemo(() => (base ? liveTable(base, matches) : []), [base, matches]);

  return (
    <div role="table" aria-label={`${LEAGUES[league].name} live table`} className="text-xs">
      <div
        role="row"
        className="grid grid-cols-[1.75rem_1rem_1fr_1.75rem_2.25rem_2.25rem] gap-1 border-b border-pitch-800 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-ink-faint"
      >
        <span role="columnheader" className="text-right">
          #
        </span>
        <span role="columnheader" aria-label="Movement" />
        <span role="columnheader">Team</span>
        <span role="columnheader" className="text-right" title="Played">
          P
        </span>
        <span role="columnheader" className="text-right" title="Goal difference">
          GD
        </span>
        <span role="columnheader" className="text-right" title="Points">
          Pts
        </span>
      </div>
      <div className="relative">
        {rows.map((row) => (
          <TableRow key={row.team.id} row={row} total={rows.length} />
        ))}
      </div>
    </div>
  );
}

function TableRow({ row, total }: { row: LiveStandingRow; total: number }) {
  const moved = row.basePosition - row.position;
  const outcomeTone = {
    W: 'bg-live/15 text-live',
    D: 'bg-pitch-700 text-ink-muted',
    L: 'bg-card-red/15 text-card-red',
  };

  return (
    <motion.div
      layout="position"
      transition={{ type: 'spring', stiffness: 350, damping: 32 }}
      role="row"
      className={`grid grid-cols-[1.75rem_1rem_1fr_1.75rem_2.25rem_2.25rem] items-center gap-1 border-l-2 px-3 py-1.5 ${zone(
        row.position,
        total,
      )} ${row.live ? 'bg-pitch-850' : ''}`}
    >
      <span role="cell" className="tabular text-right font-mono text-ink-muted">
        {row.position}
      </span>
      <span role="cell" className="text-center text-[10px]" aria-label={movementLabel(moved)}>
        {moved > 0 ? <span className="text-live">▲</span> : moved < 0 ? <span className="text-card-red">▼</span> : null}
      </span>
      <span role="cell" className="flex min-w-0 items-center gap-2">
        <TeamBadge team={row.team} />
        <span className={`truncate ${row.live ? 'font-semibold text-ink' : 'text-ink/90'}`}>{row.team.shortName}</span>
        {row.live && (
          <span
            className={`shrink-0 rounded px-1 font-mono text-[10px] font-bold ${outcomeTone[row.live.outcome]}`}
            title="Result if the match ended now"
          >
            {row.live.outcome}
          </span>
        )}
      </span>
      <span role="cell" className="tabular text-right font-mono text-ink-muted">
        {row.played}
      </span>
      <span role="cell" className="tabular text-right font-mono text-ink-muted">
        {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
      </span>
      <span role="cell" className="tabular text-right font-mono font-bold">
        {row.points}
      </span>
    </motion.div>
  );
}

function movementLabel(moved: number): string {
  if (moved > 0) return `Up ${moved}`;
  if (moved < 0) return `Down ${-moved}`;
  return 'No change';
}
