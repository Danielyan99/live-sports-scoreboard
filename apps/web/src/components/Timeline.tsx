import type { Match, MatchEvent } from '@scoreboard/shared';
import { AnimatePresence, motion } from 'motion/react';
import { useMemo } from 'react';

const LABELS: Record<MatchEvent['type'], string> = {
  GOAL: 'Goal',
  YELLOW: 'Yellow card',
  RED: 'Red card',
  SUB: 'Substitution',
  KICKOFF: 'Kick-off',
  HT: 'Half-time',
  FT: 'Full-time',
  CHANCE: 'Chance',
  VAR: 'VAR decision',
};

/** Newest first. Home events on the left, away on the right, match markers centred. */
export function Timeline({ match }: { match: Match }) {
  const events = [...match.events].reverse();
  // Events are append-only, so a disallowed goal stays; VAR events point back at it.
  const disallowed = useMemo(
    () => new Set(match.events.filter((e) => e.type === 'VAR' && e.refId).map((e) => e.refId)),
    [match.events],
  );

  if (events.length === 0) {
    return <p className="px-4 py-8 text-center text-sm text-ink-muted">Nothing has happened yet.</p>;
  }

  return (
    <ol className="relative px-3 py-3 sm:px-4" aria-label="Match events, newest first">
      <span aria-hidden className="absolute inset-y-3 left-1/2 w-px -translate-x-1/2 bg-pitch-800" />
      <AnimatePresence initial={false}>
        {events.map((event) => (
          <motion.li
            key={event.id}
            layout="position"
            initial={{ opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            className="relative py-1.5"
          >
            {event.team ? (
              <SideEvent event={event} match={match} overturned={disallowed.has(event.id)} />
            ) : (
              <Marker event={event} />
            )}
          </motion.li>
        ))}
      </AnimatePresence>
    </ol>
  );
}

function Marker({ event }: { event: MatchEvent }) {
  const text = event.type === 'KICKOFF' && event.detail ? event.detail : LABELS[event.type];
  return (
    <div className="flex justify-center">
      <span className="relative z-10 rounded-full border border-pitch-700 bg-pitch-850 px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
        {text}
      </span>
    </div>
  );
}

function SideEvent({ event, match, overturned }: { event: MatchEvent; match: Match; overturned: boolean }) {
  const home = event.team === 'home';
  const team = home ? match.home : match.away;
  const { title, subtitle } = describe(event, team.shortName, overturned);
  const emphasis = event.type === 'GOAL' && !overturned;

  return (
    <div className={`flex items-center ${home ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`flex w-[calc(50%-1.25rem)] items-center gap-2.5 ${home ? 'flex-row-reverse text-right' : ''}`}
        aria-label={`${LABELS[event.type]}${overturned ? ' (disallowed)' : ''}, ${team.shortName}, minute ${event.minute}. ${title}. ${subtitle ?? ''}`}
      >
        <span className="tabular w-8 shrink-0 font-mono text-xs text-ink-muted">{event.minute}'</span>
        <EventIcon type={event.type} overturned={overturned} />
        <span className="min-w-0 flex-1">
          <span
            className={`block truncate text-sm ${emphasis ? 'font-semibold text-ink' : 'text-ink/90'} ${
              overturned ? 'text-ink-faint line-through' : ''
            }`}
          >
            {title}
          </span>
          {subtitle && (
            <span className={`block truncate text-xs ${event.type === 'VAR' ? 'text-sky-300' : 'text-ink-faint'}`}>
              {subtitle}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}

function describe(event: MatchEvent, teamName: string, overturned: boolean): { title: string; subtitle?: string } {
  switch (event.type) {
    case 'GOAL': {
      if (overturned) return { title: event.player ?? `${teamName} goal`, subtitle: 'Disallowed by VAR' };
      const parts = [event.detail, event.assist && `assist ${event.assist}`].filter(Boolean);
      return { title: event.player ?? `${teamName} goal`, subtitle: parts.length ? parts.join(' · ') : teamName };
    }
    case 'VAR':
      return { title: 'VAR review', subtitle: event.detail ?? 'Goal disallowed' };
    case 'CHANCE':
      return { title: event.player ?? teamName, subtitle: event.detail };
    default:
      return { title: event.player ?? teamName, subtitle: event.detail };
  }
}

function EventIcon({ type, overturned }: { type: MatchEvent['type']; overturned: boolean }) {
  if (type === 'YELLOW' || type === 'RED') {
    return (
      <span
        aria-hidden
        className={`inline-block h-3.5 w-2.5 shrink-0 rounded-[2px] ${type === 'YELLOW' ? 'bg-card-yellow' : 'bg-card-red'}`}
      />
    );
  }
  if (type === 'VAR') {
    return (
      <span
        aria-hidden
        className="shrink-0 rounded border border-sky-400/40 bg-sky-400/10 px-1 font-mono text-[9px] font-bold text-sky-300"
      >
        VAR
      </span>
    );
  }
  const icon = { GOAL: '⚽', SUB: '⇄', CHANCE: '◎' }[type as string] ?? '';
  const tone = type === 'SUB' ? 'text-live' : type === 'CHANCE' ? 'text-flash' : '';
  return (
    <span
      aria-hidden
      className={`w-4 shrink-0 text-center text-sm ${tone} ${overturned ? 'opacity-40 grayscale' : ''}`}
    >
      {icon}
    </span>
  );
}
