import { LEAGUE_CODES, LEAGUES, type LeagueCode } from '@scoreboard/shared';

interface Props {
  value: LeagueCode | 'ALL';
  onChange(value: LeagueCode | 'ALL'): void;
  counts: Record<LeagueCode | 'ALL', number | undefined>;
}

const SHORT_NAMES: Record<LeagueCode, string> = { PL: 'Premier', PD: 'La Liga' };

const OPTIONS: { value: LeagueCode | 'ALL'; label: string; short: string }[] = [
  { value: 'ALL', label: 'All', short: 'All' },
  ...LEAGUE_CODES.map((code) => ({ value: code, label: LEAGUES[code].name, short: SHORT_NAMES[code] })),
];

export function LeagueFilter({ value, onChange, counts }: Props) {
  return (
    <div role="tablist" aria-label="Filter by league" className="flex gap-1 rounded-lg bg-pitch-900 p-1">
      {OPTIONS.map((option) => {
        const selected = option.value === value;
        const count = counts[option.value];
        return (
          <button
            key={option.value}
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(option.value)}
            className={`flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors sm:flex-none ${
              selected ? 'bg-pitch-700 text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
            }`}
          >
            {option.value !== 'ALL' && <LeagueDot league={option.value} />}
            <span className="sm:hidden">{option.short}</span>
            <span className="hidden sm:inline">{option.label}</span>
            {count !== undefined && count > 0 && (
              <span className="tabular rounded bg-live/15 px-1.5 text-[11px] font-semibold text-live" title="In play">
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function LeagueDot({ league }: { league: LeagueCode }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-2 w-2 rounded-sm ${league === 'PL' ? 'bg-league-pl' : 'bg-league-pd'}`}
    />
  );
}
