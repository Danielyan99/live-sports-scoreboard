import { isInPlay, isLeagueCode, LEAGUE_CODES, LEAGUES, type LeagueCode, type Match } from '@scoreboard/shared';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { useShallow } from 'zustand/react/shallow';
import { IntroBanner } from '../components/IntroBanner';
import { LeagueDot, LeagueFilter } from '../components/LeagueFilter';
import { LiveTable } from '../components/LiveTable';
import { MatchRow } from '../components/MatchRow';
import { RecentResults } from '../components/RecentResults';
import { WireInspector } from '../components/WireInspector';
import { sortMatches } from '../lib/format';
import { useMatchStore } from '../state/matchStore';

export function MatchListPage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('league');
  const filter: LeagueCode | 'ALL' = isLeagueCode(raw) ? raw : 'ALL';

  // The URL is the source of truth for the filter; the store mirrors it so the
  // socket subscribes only to the rooms we are showing.
  useEffect(() => {
    const leagues = filter === 'ALL' ? [...LEAGUE_CODES] : [filter];
    const current = useMatchStore.getState().leagues;
    if (current.join() !== leagues.join()) useMatchStore.getState().setLeagues(leagues);
  }, [filter]);

  const leagues = useMatchStore((s) => s.leagues);
  const listLoaded = useMatchStore((s) => s.listLoaded);
  const stale = useMatchStore((s) => s.connection === 'reconnecting');
  const matches = useMatchStore(useShallow((s) => Object.values(s.matches)));

  const groups = useMemo(
    () =>
      leagues
        .map((league) => ({ league, matches: sortMatches(matches.filter((m) => m.league === league)) }))
        .filter((g) => g.matches.length > 0),
    [leagues, matches],
  );

  const counts = useMemo(() => {
    const inPlay = (list: Match[]) => list.filter(isInPlay).length;
    const byLeague = Object.fromEntries(
      LEAGUE_CODES.map((code) => [
        code,
        leagues.includes(code) ? inPlay(matches.filter((m) => m.league === code)) : undefined,
      ]),
    ) as Record<LeagueCode, number | undefined>;
    return { ALL: filter === 'ALL' ? inPlay(matches) : undefined, ...byLeague };
  }, [matches, leagues, filter]);

  const onFilterChange = (value: LeagueCode | 'ALL') =>
    setParams(value === 'ALL' ? {} : { league: value }, { replace: true });

  // DOM order is main → sidebar → results, so on phones the live table sits right
  // under the matches. On desktop the sidebar moves to a sticky right column.
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:grid-rows-[auto_1fr] lg:items-start lg:gap-6">
      <div className="space-y-5 lg:col-start-1 lg:row-start-1">
        <IntroBanner />
        <LeagueFilter value={filter} onChange={onFilterChange} counts={counts} />

        {stale && listLoaded && (
          <p role="status" className="rounded-lg border border-flash/25 bg-flash/10 px-3 py-2 text-xs text-flash">
            Connection lost. Showing the last known scores; they will catch up automatically on reconnect.
          </p>
        )}

        <div className={`space-y-5 transition-opacity duration-500 ${stale ? 'opacity-55' : ''}`}>
          {!listLoaded ? (
            <ListSkeleton />
          ) : groups.length === 0 ? (
            <p className="rounded-xl border border-pitch-800 bg-pitch-900 px-4 py-10 text-center text-sm text-ink-muted">
              No matches today. New fixtures appear here automatically.
            </p>
          ) : (
            groups.map(({ league, matches }) => (
              <section key={league} aria-labelledby={`league-${league}`}>
                <h2
                  id={`league-${league}`}
                  className="mb-2 flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wider text-ink-muted"
                >
                  <LeagueDot league={league} />
                  {LEAGUES[league].name}
                  <span className="font-normal normal-case tracking-normal text-ink-faint">
                    · {LEAGUES[league].country}
                  </span>
                </h2>
                <ul className="divide-y divide-pitch-800 overflow-hidden rounded-xl border border-pitch-800 bg-pitch-900">
                  <AnimatePresence initial={false}>
                    {matches.map((match) => (
                      <motion.li
                        key={match.id}
                        layout="position"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.35, ease: 'easeOut' }}
                      >
                        <MatchRow match={match} />
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              </section>
            ))
          )}
        </div>
      </div>

      <aside
        aria-label="Live table and socket traffic"
        className="space-y-5 lg:sticky lg:top-20 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pb-2 lg:[scrollbar-width:thin]"
      >
        <LiveTable leagues={leagues} />
        <WireInspector defaultOpen="desktop" />
      </aside>

      <div className="lg:col-start-1 lg:row-start-2">
        <RecentResults leagues={leagues} />
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div
      className="divide-y divide-pitch-800 overflow-hidden rounded-xl border border-pitch-800 bg-pitch-900"
      aria-busy
    >
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
          <span className="h-3 w-8 animate-pulse rounded bg-pitch-800" />
          <span className="h-3 flex-1 animate-pulse rounded bg-pitch-800" />
          <span className="h-6 w-16 animate-pulse rounded bg-pitch-800" />
          <span className="h-3 flex-1 animate-pulse rounded bg-pitch-800" />
        </div>
      ))}
    </div>
  );
}
