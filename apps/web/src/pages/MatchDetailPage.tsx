import { LEAGUES, type Match, type Team } from '@scoreboard/shared';
import { motion } from 'motion/react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { LeagueDot } from '../components/LeagueFilter';
import { LiveTable } from '../components/LiveTable';
import { MomentumChart } from '../components/MomentumChart';
import { MatchClock, ScoreDigit } from '../components/Score';
import { StatsPanel } from '../components/StatsPanel';
import { TeamBadge } from '../components/TeamBadge';
import { Timeline } from '../components/Timeline';
import { useFlash } from '../hooks/useFlash';
import { formatKickoff } from '../lib/format';
import { useWatchMatch } from '../socket/useLiveFeed';
import { useMatchStore } from '../state/matchStore';

type Tab = 'timeline' | 'stats';

export function MatchDetailPage() {
  const { matchId } = useParams();
  useWatchMatch(matchId);

  const match = useMatchStore((s) => (matchId ? s.matches[matchId] : undefined));
  const missing = useMatchStore((s) => (matchId ? s.missing[matchId] === true : false));
  // Return to the list with the league filter the visitor came from.
  const backTo = useMatchStore((s) => (s.leagues.length === 1 ? `/?league=${s.leagues[0]}` : '/'));

  return (
    <div className="space-y-4">
      <Link to={backTo} className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
          <path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        All matches
      </Link>

      {match ? (
        <MatchDetail match={match} />
      ) : missing ? (
        <p className="rounded-xl border border-pitch-800 bg-pitch-900 px-4 py-10 text-center text-sm text-ink-muted">
          This match is no longer being tracked. Demo fixtures rotate out a few minutes after full-time.
        </p>
      ) : (
        <div className="h-48 animate-pulse rounded-xl border border-pitch-800 bg-pitch-900" aria-busy />
      )}
    </div>
  );
}

function MatchDetail({ match }: { match: Match }) {
  const [tab, setTab] = useState<Tab>('timeline');
  const home = useFlash(match.score.home);
  const away = useFlash(match.score.away);
  const showScore = match.status !== 'SCHEDULED';

  return (
    <>
      <section className="relative overflow-hidden rounded-xl border border-pitch-800 bg-pitch-900 px-4 pb-6 pt-4">
        {home.key + away.key > 0 && (
          <motion.span
            key={`${home.key}-${away.key}`}
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-flash"
            initial={{ opacity: 0.14 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 3, ease: 'easeOut' }}
          />
        )}
        <div className="relative mb-5 flex items-center justify-between text-xs text-ink-muted">
          <span className="flex items-center gap-2">
            <LeagueDot league={match.league} />
            {LEAGUES[match.league].name}
          </span>
          <span>{match.source === 'demo' ? 'Simulated' : `Kick-off ${formatKickoff(match.kickoff)}`}</span>
        </div>

        <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <TeamColumn team={match.home} />
          <div className="flex flex-col items-center gap-2">
            {showScore ? (
              <div
                className="flex items-center gap-3 text-5xl leading-none sm:text-6xl"
                aria-live="polite"
                aria-label={`Score ${match.score.home} to ${match.score.away}`}
              >
                <ScoreDigit value={match.score.home} highlight={home.active} />
                <span className="text-3xl text-ink-faint">–</span>
                <ScoreDigit value={match.score.away} highlight={away.active} />
              </div>
            ) : (
              <span className="font-mono text-3xl font-bold text-ink-muted">{formatKickoff(match.kickoff)}</span>
            )}
            <MatchClock match={match} className="text-sm" />
          </div>
          <TeamColumn team={match.away} />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-6">
        <div className="space-y-4">
          <MomentumChart match={match} />

          <section className="overflow-hidden rounded-xl border border-pitch-800 bg-pitch-900">
            <div role="tablist" aria-label="Match details" className="flex border-b border-pitch-800">
              {(['timeline', 'stats'] as const).map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  className={`relative flex-1 py-3 text-sm font-medium capitalize transition-colors ${
                    tab === t ? 'text-ink' : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  {t}
                  {tab === t && (
                    <motion.span
                      layoutId="tab-underline"
                      className="absolute inset-x-6 bottom-0 h-0.5 rounded-full bg-live"
                    />
                  )}
                </button>
              ))}
            </div>
            <div role="tabpanel">{tab === 'timeline' ? <Timeline match={match} /> : <StatsPanel match={match} />}</div>
          </section>
        </div>

        <aside aria-label="League table" className="lg:sticky lg:top-20">
          <LiveTable leagues={[match.league]} />
        </aside>
      </div>
    </>
  );
}

function TeamColumn({ team }: { team: Team }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-2 text-center">
      <TeamBadge team={team} size="lg" />
      <span className="w-full truncate text-sm font-semibold sm:text-base">{team.shortName}</span>
    </div>
  );
}
