import { useEffect, useState } from 'react';
import { useMatchStore } from '../state/matchStore';

const WAKE_UP_HINT_AFTER_MS = 4000;

export function ConnectionPill() {
  const connection = useMatchStore((s) => s.connection);
  const slowStart = useSlowStart(connection === 'connecting');

  const { dot, text, tone } = {
    live: { dot: 'bg-live animate-live-pulse', text: 'Live', tone: 'text-live border-live/30 bg-live/10' },
    connecting: {
      dot: 'bg-ink-muted animate-live-pulse',
      text: slowStart ? 'Waking server…' : 'Connecting…',
      tone: 'text-ink-muted border-pitch-700 bg-pitch-850',
    },
    reconnecting: {
      dot: 'bg-flash animate-live-pulse',
      text: 'Reconnecting…',
      tone: 'text-flash border-flash/30 bg-flash/10',
    },
  }[connection];

  return (
    <span
      role="status"
      aria-live="polite"
      title={slowStart ? 'The free hosting tier sleeps when idle; the first connection can take ~30s.' : undefined}
      className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${tone}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden />
      {text}
    </span>
  );
}

function useSlowStart(connecting: boolean): boolean {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!connecting) return setSlow(false);
    const timer = setTimeout(() => setSlow(true), WAKE_UP_HINT_AFTER_MS);
    return () => clearTimeout(timer);
  }, [connecting]);
  return slow;
}
