import { AnimatePresence, motion } from 'motion/react';
import type { Match } from '@scoreboard/shared';
import { formatClock } from '../lib/format';

interface ScoreDigitProps {
  value: number;
  /** True while this side has just scored. */
  highlight?: boolean;
  className?: string;
}

/** A score number that rolls up when it changes (no animation on first render). */
export function ScoreDigit({ value, highlight = false, className = '' }: ScoreDigitProps) {
  return (
    <span
      className={`tabular relative inline-flex justify-center overflow-hidden font-mono font-bold transition-colors duration-700 ${
        highlight ? 'text-flash' : ''
      } ${className}`}
      data-highlight={highlight || undefined}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ y: '-100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** Minute / HT / FT / kickoff time, with a pulsing dot while in play. */
export function MatchClock({ match, className = '' }: { match: Match; className?: string }) {
  const live = match.status === 'LIVE';
  const tone = match.status === 'LIVE' ? 'text-live' : match.status === 'PAUSED' ? 'text-flash' : 'text-ink-muted';

  return (
    <span className={`tabular inline-flex items-center gap-1.5 font-mono text-xs font-medium ${tone} ${className}`}>
      {live && <span className="h-1.5 w-1.5 rounded-full bg-live animate-live-pulse" aria-hidden />}
      <span aria-label={live ? `Minute ${match.minute}` : undefined}>{formatClock(match)}</span>
    </span>
  );
}
