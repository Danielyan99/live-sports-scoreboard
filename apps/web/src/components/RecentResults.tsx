import { LEAGUES, type LeagueCode, type LeagueResults, type MatchResult, type Team } from '@scoreboard/shared';
import { useMatchStore } from '../state/matchStore';
import { LeagueDot } from './LeagueFilter';
import { TeamBadge } from './TeamBadge';

/**
 * The latest real matchday per league. The free data tier has final and half-time
 * scores only, so these rows are not links to a detail page.
 */
export function RecentResults({ leagues }: { leagues: LeagueCode[] }) {
  const results = useMatchStore((s) => s.results);
  const visible = results.filter((r) => leagues.includes(r.league) && r.results.length > 0);
  if (visible.length === 0) return null;

  return (
    <section aria-labelledby="recent-results" className="space-y-3">
      <h2 id="recent-results" className="px-1 pt-2 text-sm font-semibold">
        Recent results
      </h2>
      {visible.map((league) => (
        <LeagueResultsCard key={league.league} league={league} />
      ))}
    </section>
  );
}

function LeagueResultsCard({ league }: { league: LeagueResults }) {
  return (
    <div>
      <h3 className="mb-2 flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wider text-ink-muted">
        <LeagueDot league={league.league} />
        {LEAGUES[league.league].name}
        <span className="font-normal normal-case tracking-normal text-ink-faint">· Matchday {league.matchday}</span>
      </h3>
      <ul className="divide-y divide-pitch-800 overflow-hidden rounded-xl border border-pitch-800 bg-pitch-900">
        {league.results.map((result) => (
          <ResultRow key={result.id} result={result} />
        ))}
      </ul>
    </div>
  );
}

function ResultRow({ result }: { result: MatchResult }) {
  const { home, away } = result.score;
  const kickoff = new Date(result.kickoff);
  const details = [
    kickoff.toLocaleString([], {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }),
    result.halfTime && `Half-time ${result.halfTime.home}–${result.halfTime.away}`,
    result.referee && `Referee: ${result.referee}`,
  ].filter(Boolean);

  return (
    <li
      className="grid grid-cols-[3.25rem_1fr_auto_1fr_3.25rem] items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4"
      title={details.join(' · ')}
      aria-label={`${result.home.name} ${home}, ${result.away.name} ${away}. ${details.join('. ')}`}
    >
      <span className="text-xs leading-tight text-ink-muted">
        <span className="block">{kickoff.toLocaleDateString([], { weekday: 'short' })}</span>
        <span className="block text-ink-faint">
          {kickoff.toLocaleDateString([], { day: 'numeric', month: 'short' })}
        </span>
      </span>

      <ResultTeam team={result.home} align="right" outcome={outcome(home, away)} />

      <span className="tabular flex min-w-[4.25rem] items-center justify-center gap-1.5 rounded-md bg-pitch-850 px-2 py-1 font-mono text-base font-bold leading-none">
        <span className={home < away ? 'text-ink-muted' : ''}>{home}</span>
        <span className="text-ink-faint">–</span>
        <span className={away < home ? 'text-ink-muted' : ''}>{away}</span>
      </span>

      <ResultTeam team={result.away} align="left" outcome={outcome(away, home)} />

      <span className="tabular text-right font-mono text-[11px] text-ink-faint">
        {result.halfTime ? `HT ${result.halfTime.home}–${result.halfTime.away}` : 'FT'}
      </span>
    </li>
  );
}

type Outcome = 'win' | 'draw' | 'loss';

function outcome(goalsFor: number, goalsAgainst: number): Outcome {
  return goalsFor > goalsAgainst ? 'win' : goalsFor === goalsAgainst ? 'draw' : 'loss';
}

function ResultTeam({ team, align, outcome }: { team: Team; align: 'left' | 'right'; outcome: Outcome }) {
  const tone = outcome === 'win' ? 'font-semibold text-ink' : outcome === 'loss' ? 'text-ink-muted' : 'text-ink/90';
  return (
    <span
      className={`flex min-w-0 items-center gap-2 text-sm ${align === 'right' ? 'flex-row-reverse text-right' : ''} ${tone}`}
    >
      <TeamBadge team={team} />
      <span className="truncate">
        <span className="sm:hidden">{team.tla}</span>
        <span className="hidden sm:inline">{team.shortName}</span>
      </span>
    </span>
  );
}
