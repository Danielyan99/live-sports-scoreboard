import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { formatBytes } from '../lib/format';
import { useMatchStore, type WireEntry } from '../state/matchStore';

const EVENT_TONE: Record<string, string> = {
  'match:patch': 'text-live',
  'match:added': 'text-sky-300',
  'match:removed': 'text-card-red',
  snapshot: 'text-league-pl',
  'feed:mode': 'text-flash',
  tables: 'text-league-pd',
  results: 'text-league-pd',
};

/**
 * A live view of the socket traffic, so visitors can see the server pushing
 * small diffs rather than the client re-fetching everything.
 */
export function WireInspector({ defaultOpen = 'never' }: { defaultOpen?: 'never' | 'desktop' | 'always' }) {
  const [open, setOpen] = useState(
    () => defaultOpen === 'always' || (defaultOpen === 'desktop' && window.matchMedia?.('(min-width: 1024px)').matches),
  );
  const wire = useMatchStore((s) => s.wire);
  const totals = useMatchStore((s) => s.wireTotals);

  const patches = wire.filter((e) => e.event === 'match:patch');
  const avgPatch = patches.length ? Math.round(patches.reduce((sum, e) => sum + e.bytes, 0) / patches.length) : 0;

  return (
    <section className="@container rounded-xl border border-pitch-800 bg-pitch-900">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span>
          <span className="block text-sm font-semibold">Socket inspector</span>
          <span className="block text-xs text-ink-muted">
            {totals.messages} messages · {formatBytes(totals.bytes)}
            {avgPatch > 0 && <> · avg patch {formatBytes(avgPatch)}</>}
          </span>
        </span>
        <svg
          viewBox="0 0 16 16"
          className={`h-4 w-4 shrink-0 text-ink-muted transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        >
          <path d="M3 6l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <ol
          className="max-h-72 overflow-y-auto border-t border-pitch-800 font-mono text-[11px]"
          aria-label="Recent socket messages"
        >
          <AnimatePresence initial={false}>
            {wire.map((entry) => (
              <WireRow key={entry.id} entry={entry} />
            ))}
          </AnimatePresence>
          {wire.length === 0 && <li className="px-4 py-3 text-ink-faint">No messages yet.</li>}
        </ol>
      )}
    </section>
  );
}

function WireRow({ entry }: { entry: WireEntry }) {
  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, backgroundColor: 'rgba(52,211,153,0.12)' }}
      animate={{ opacity: 1, backgroundColor: 'rgba(52,211,153,0)' }}
      transition={{ duration: 1.2 }}
      className="grid grid-cols-[1rem_7rem_1fr_3rem] items-baseline gap-2 border-b border-pitch-850 px-4 py-1.5 @md:grid-cols-[4.5rem_1rem_7.5rem_1fr_3.5rem]"
      title={new Date(entry.at).toLocaleTimeString([], { hour12: false })}
    >
      <span className="hidden text-ink-faint @md:inline">
        {new Date(entry.at).toLocaleTimeString([], { hour12: false })}
      </span>
      <span
        className={entry.direction === 'in' ? 'text-ink-muted' : 'text-sky-300'}
        title={entry.direction === 'in' ? 'server → client' : 'client → server'}
      >
        {entry.direction === 'in' ? '↓' : '↑'}
      </span>
      <span className={EVENT_TONE[entry.event] ?? 'text-sky-300'}>{entry.event}</span>
      <span className="truncate text-ink-muted" title={entry.summary}>
        {entry.summary}
      </span>
      <span className="text-right text-ink-faint">{formatBytes(entry.bytes)}</span>
    </motion.li>
  );
}
