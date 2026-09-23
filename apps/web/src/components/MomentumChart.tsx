import { countedGoals, type Match } from '@scoreboard/shared';
import { motion } from 'motion/react';

const WIDTH = 600;
const HEIGHT = 120;
const MID = HEIGHT / 2;
const MAX_BAR = MID - 10;
const HOME_COLOR = 'var(--color-live)';
const AWAY_COLOR = '#38bdf8';

/**
 * Attack momentum per minute: bars above the line are home pressure, below are
 * away. New minutes arrive as tiny append-only patches and grow in place.
 */
export function MomentumChart({ match }: { match: Match }) {
  const values = match.momentum ?? [];
  if (values.length === 0) return null;

  const minutes = Math.max(90, values.length);
  const step = WIDTH / minutes;
  const barWidth = Math.max(1, step - 1.5);
  const goals = countedGoals(match.events);

  return (
    <section aria-labelledby="momentum" className="rounded-xl border border-pitch-800 bg-pitch-900 px-4 pb-3 pt-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 id="momentum" className="text-sm font-semibold">
          Momentum
        </h2>
        <span className="flex items-center gap-3 text-[11px] text-ink-muted">
          <Legend color={HOME_COLOR} label={match.home.shortName} />
          <Legend color={AWAY_COLOR} label={match.away.shortName} />
        </span>
      </div>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Attack momentum over ${values.length} minutes. Bars above the line favour ${match.home.shortName}, below favour ${match.away.shortName}.`}
      >
        <line x1={0} x2={WIDTH} y1={MID} y2={MID} stroke="var(--color-pitch-700)" strokeWidth={1} />
        <line
          x1={45 * step}
          x2={45 * step}
          y1={4}
          y2={HEIGHT - 4}
          stroke="var(--color-pitch-700)"
          strokeDasharray="3 4"
          strokeWidth={1}
        />

        {values.map((value, i) => {
          // Square-root scale lifts small swings so the chart reads well at a glance.
          const h = Math.sqrt(Math.abs(value) / 100) * MAX_BAR;
          return (
            <motion.rect
              key={i}
              x={i * step}
              width={barWidth}
              rx={Math.min(1.5, barWidth / 2)}
              fill={value >= 0 ? HOME_COLOR : AWAY_COLOR}
              fillOpacity={0.8}
              initial={{ height: 0, y: MID }}
              animate={{ height: h, y: value >= 0 ? MID - h : MID }}
              transition={{ type: 'spring', stiffness: 200, damping: 24 }}
            />
          );
        })}

        {goals.map((goal) => {
          const x = Math.min(goal.minute, minutes - 0.5) * step - step / 2;
          const y = goal.team === 'home' ? 6 : HEIGHT - 6;
          return (
            <motion.circle
              key={goal.id}
              cx={x}
              cy={y}
              r={4}
              fill="var(--color-flash)"
              stroke="var(--color-pitch-900)"
              strokeWidth={1.5}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
            >
              <title>{`Goal ${goal.minute}'${goal.player ? ` · ${goal.player}` : ''}`}</title>
            </motion.circle>
          );
        })}
      </svg>

      <div className="tabular mt-1 flex justify-between font-mono text-[10px] text-ink-faint" aria-hidden>
        <span>0'</span>
        <span>HT</span>
        <span>90'</span>
      </div>
    </section>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
