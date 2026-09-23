import { motion } from 'motion/react';
import { useEffect, useState, type ReactNode } from 'react';
import { GitHubIcon } from '../components/Header';
import { WireInspector } from '../components/WireInspector';
import { SITE, sourceUrl } from '../config';
import { formatBytes } from '../lib/format';
import { useMatchStore } from '../state/matchStore';

export function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-10 pb-6">
      <header className="space-y-3 pt-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-live">How it works</p>
        <h1 className="text-2xl font-semibold leading-tight sm:text-3xl">
          One server watches the feed.
          <br className="hidden sm:block" /> Every browser gets only what changed.
        </h1>
        <p className="max-w-2xl text-sm text-ink-muted sm:text-base">
          Instead of each visitor polling an API, the server polls once, compares the new data with what it already has,
          and pushes small patches over a WebSocket to the browsers that are looking at that league or match.
        </p>
      </header>

      <Pipeline />
      <LiveNumbers />
      <Decisions />
      <Stack />

      <section aria-labelledby="wire" className="space-y-3">
        <SectionTitle id="wire">Watch the traffic</SectionTitle>
        <p className="text-sm text-ink-muted">
          Every message this page has sent or received. Patches carry only the fields that changed.
        </p>
        <WireInspector defaultOpen="always" />
      </section>
    </div>
  );
}

// ------------------------------------------------------------------ pipeline

const STEPS = [
  { title: 'Data source', body: 'football-data.org when a real match is on, the match simulator otherwise.' },
  { title: 'Ingestion', body: 'Polls the API every 15 s (within the free limit) or ticks the simulator every 3 s.' },
  { title: 'Diff engine', body: 'Compares with cached state. Bumps a match’s version only when something changed.' },
  { title: 'Socket.io', body: 'Sends each patch only to rooms for that league or match.' },
  { title: 'Your browser', body: 'Applies a patch only if it is the next version, otherwise asks for a resync.' },
];

function Pipeline() {
  const messages = useMatchStore((s) => s.wireTotals.messages);
  const source = useMatchStore((s) => s.source);

  return (
    <section aria-labelledby="pipeline" className="space-y-4">
      <SectionTitle id="pipeline">The pipeline</SectionTitle>
      <ol className="flex flex-col items-stretch lg:flex-row lg:items-stretch">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex flex-col lg:flex-1 lg:flex-row">
            <div className="flex-1 rounded-xl border border-pitch-800 bg-pitch-900 p-4">
              <div className="flex items-center gap-2">
                <span className="tabular flex h-6 w-6 items-center justify-center rounded-full bg-pitch-800 font-mono text-xs text-ink-muted">
                  {i + 1}
                </span>
                <h3 className="text-sm font-semibold">{step.title}</h3>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-ink-muted">
                {i === 0 ? (
                  <>
                    Right now:{' '}
                    <span className="font-semibold text-ink">{source === 'demo' ? 'simulator' : 'real API'}</span>.{' '}
                    {step.body}
                  </>
                ) : (
                  step.body
                )}
              </p>
            </div>
            {i < STEPS.length - 1 && <Connector pulse={messages} delay={i * 0.12} />}
          </li>
        ))}
      </ol>
      <p className="text-xs text-ink-faint">The dots move each time a message reaches this page.</p>
    </section>
  );
}

/** A line between two steps with a dot that travels along it whenever a message arrives. */
function Connector({ pulse, delay }: { pulse: number; delay: number }) {
  const horizontal = useMediaQuery('(min-width: 1024px)');
  const axis = horizontal ? 'left' : 'top';

  return (
    <div
      aria-hidden
      className="relative mx-auto h-8 w-0.5 rounded-full bg-pitch-700 lg:mx-0 lg:my-auto lg:h-0.5 lg:w-6 lg:shrink-0"
    >
      {pulse > 0 && (
        <motion.span
          key={pulse}
          className={`absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-live shadow-[0_0_8px_var(--color-live)] ${
            horizontal ? 'top-1/2' : 'left-1/2'
          }`}
          initial={{ [axis]: '0%', opacity: 0 }}
          animate={{ [axis]: '100%', opacity: [0, 1, 1, 0] }}
          transition={{ duration: 0.5, delay, ease: 'easeInOut' }}
        />
      )}
    </div>
  );
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = () => setMatches(list.matches);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

// ---------------------------------------------------------------- live numbers

function LiveNumbers() {
  const connection = useMatchStore((s) => s.connection);
  const totals = useMatchStore((s) => s.wireTotals);
  const wire = useMatchStore((s) => s.wire);

  const patches = wire.filter((e) => e.event === 'match:patch');
  const avgPatch = patches.length ? patches.reduce((n, e) => n + e.bytes, 0) / patches.length : 0;
  const snapshot = wire.find((e) => e.event === 'snapshot' && e.summary.startsWith('leagues'));
  const saving = avgPatch && snapshot ? Math.round((1 - avgPatch / snapshot.bytes) * 100) : null;

  return (
    <section aria-labelledby="numbers" className="space-y-4">
      <SectionTitle id="numbers">This page, right now</SectionTitle>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Connection"
          value={connection === 'live' ? 'Connected' : connection === 'connecting' ? 'Connecting…' : 'Reconnecting…'}
        />
        <Stat label="Messages received" value={totals.messages.toLocaleString()} />
        <Stat label="Data received" value={formatBytes(totals.bytes)} />
        <Stat
          label="Average update"
          value={avgPatch ? formatBytes(Math.round(avgPatch)) : '—'}
          note={
            saving !== null
              ? `${saving}% smaller than re-sending the list (${formatBytes(snapshot!.bytes)})`
              : undefined
          }
        />
      </dl>
    </section>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl border border-pitch-800 bg-pitch-900 p-4">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="tabular mt-1 font-mono text-lg font-bold">{value}</dd>
      {note && <dd className="mt-1 text-[11px] leading-snug text-live">{note}</dd>}
    </div>
  );
}

// ------------------------------------------------------------------ decisions

const DECISIONS: { title: string; body: string; path: string }[] = [
  {
    title: 'A pure diff engine',
    body: 'One function turns "old state + new data" into added, removed and minimal patches. No I/O, so it is easy to test.',
    path: 'apps/server/src/ingestion/diff-engine.ts',
  },
  {
    title: 'Versioned patches with resync',
    body: 'Every match has a version. The browser applies a patch only if it is exactly the next one, and asks the server to resync just that match if one went missing.',
    path: 'packages/shared/src/patch.ts',
  },
  {
    title: 'Rooms instead of broadcast',
    body: 'Clients join league and match rooms, so filtering to La Liga means Premier League updates are never sent to you.',
    path: 'apps/server/src/realtime/live.gateway.ts',
  },
  {
    title: 'Append-only data sent as deltas',
    body: 'Events and the momentum chart only ever grow, so a patch carries only the new entries, not the whole list.',
    path: 'apps/server/src/ingestion/diff-engine.ts',
  },
  {
    title: 'Live table computed in the browser',
    body: 'The server sends the table only when a match ends. In-play scores are added on the client, so each goal re-ranks the table with no extra traffic.',
    path: 'packages/shared/src/table.ts',
  },
  {
    title: 'Real feed with an automatic fallback',
    body: 'The server checks for real Premier League and La Liga matches, reads the API quota headers, and falls back to the simulator when nothing is on.',
    path: 'apps/server/src/ingestion/ingestion.service.ts',
  },
  {
    title: 'Deterministic simulator',
    body: 'A seeded random generator plays matches with goals, VAR, cards and momentum. The same seed always gives the same match, which keeps tests stable.',
    path: 'apps/server/src/providers/simulator/match-simulator.ts',
  },
  {
    title: 'One typed contract',
    body: 'Socket event names, payload types and the patch logic live in a shared package used by both server and client.',
    path: 'packages/shared/src/socket-contract.ts',
  },
];

function Decisions() {
  return (
    <section aria-labelledby="decisions" className="space-y-4">
      <SectionTitle id="decisions">Engineering decisions</SectionTitle>
      <ul className="grid gap-3 sm:grid-cols-2">
        {DECISIONS.map((d) => {
          const href = sourceUrl(d.path);
          return (
            <li key={d.title} className="flex flex-col rounded-xl border border-pitch-800 bg-pitch-900 p-4">
              <h3 className="text-sm font-semibold">{d.title}</h3>
              <p className="mt-1.5 flex-1 text-xs leading-relaxed text-ink-muted">{d.body}</p>
              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 truncate font-mono text-[11px] text-sky-300 hover:underline"
                >
                  {d.path} ↗
                </a>
              ) : (
                <code className="mt-3 truncate font-mono text-[11px] text-ink-faint">{d.path}</code>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------- stack

const STACK: { group: string; items: string[] }[] = [
  {
    group: 'Frontend',
    items: ['React 19', 'TypeScript', 'Vite', 'Tailwind CSS', 'Motion', 'Zustand', 'socket.io-client'],
  },
  { group: 'Backend', items: ['NestJS 11', 'Socket.io', 'MongoDB + Mongoose', 'RxJS'] },
  { group: 'Quality', items: ['Jest', 'Vitest', 'Testing Library', 'Shared types across server and client'] },
];

function Stack() {
  return (
    <section aria-labelledby="stack" className="space-y-4">
      <SectionTitle id="stack">Tech stack</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-3">
        {STACK.map(({ group, items }) => (
          <div key={group} className="rounded-xl border border-pitch-800 bg-pitch-900 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{group}</h3>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {items.map((item) => (
                <li key={item} className="rounded-full border border-pitch-700 bg-pitch-850 px-2.5 py-0.5 text-xs">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {SITE.githubUrl && (
        <a
          href={SITE.githubUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-pitch-700 px-3.5 py-2 text-sm font-medium hover:bg-pitch-800"
        >
          <GitHubIcon className="h-4 w-4" />
          Read the source on GitHub
        </a>
      )}
    </section>
  );
}

function SectionTitle({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="text-lg font-semibold">
      {children}
    </h2>
  );
}
