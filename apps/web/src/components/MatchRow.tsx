import type { Match, Team } from '@scoreboard/shared';
import { motion } from 'motion/react';
import { memo } from 'react';
import { Link } from 'react-router';
import { useFlash } from '../hooks/useFlash';
import { MatchClock, ScoreDigit } from './Score';
import { TeamBadge } from './TeamBadge';

/**
 * One dense scoreboard row. When a side scores, its digit rolls, turns amber,
 * and the row gets a fading glow so the change is noticeable without being jarring.
 */
export const MatchRow = memo(function MatchRow({ match }: { match: Match }) {
  const home = useFlash(match.score.home);
  const away = useFlash(match.score.away);
  const scored = home.active || away.active;
  const showScore = match.status !== 'SCHEDULED';

  return (
    <Link
      to={`/match/${match.id}`}
      aria-label={`${match.home.name} ${showScore ? match.score.home : ''} vs ${showScore ? match.score.away : ''} ${match.away.name}`}
      className="group relative grid grid-cols-[3.25rem_1fr_auto_1fr_1rem] items-center gap-2 overflow-hidden px-3 py-3 transition-colors hover:bg-pitch-850 focus-visible:bg-pitch-850 focus-visible:outline-none sm:gap-3 sm:px-4"
      data-testid="match-row"
      data-scored={scored || undefined}
    >
      {home.key + away.key > 0 && (
        <motion.span
          key={`${home.key}-${away.key}`}
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-flash"
          initial={{ opacity: 0.16 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 3, ease: 'easeOut' }}
        />
      )}
      {scored && <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-flash" />}

      <MatchClock match={match} />

      <TeamName team={match.home} align="right" emphasis={home.active} />

      <span
        className={`flex min-w-[4.25rem] items-center justify-center gap-1.5 rounded-md px-2 py-1 text-lg leading-none ${
          showScore ? 'bg-pitch-800' : 'bg-transparent'
        }`}
      >
        {showScore ? (
          <>
            <ScoreDigit value={match.score.home} highlight={home.active} />
            <span className="text-ink-faint">–</span>
            <ScoreDigit value={match.score.away} highlight={away.active} />
          </>
        ) : (
          <span className="text-xs font-medium text-ink-faint">vs</span>
        )}
      </span>

      <TeamName team={match.away} align="left" emphasis={away.active} />

      <svg
        viewBox="0 0 16 16"
        className="h-4 w-4 text-ink-faint transition-transform group-hover:translate-x-0.5"
        aria-hidden
      >
        <path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </Link>
  );
});

function TeamName({ team, align, emphasis }: { team: Team; align: 'left' | 'right'; emphasis: boolean }) {
  return (
    <span
      className={`flex min-w-0 items-center gap-2 text-sm ${align === 'right' ? 'flex-row-reverse text-right' : ''} ${
        emphasis ? 'font-semibold text-ink' : 'text-ink/90'
      }`}
    >
      <TeamBadge team={team} />
      <span className="truncate">
        <span className="sm:hidden">{team.tla}</span>
        <span className="hidden sm:inline">{team.shortName}</span>
      </span>
    </span>
  );
}
