import { AnimatePresence, motion } from 'motion/react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAlertStore, type GoalAlert } from '../state/alertStore';
import { LeagueDot } from './LeagueFilter';

const VISIBLE_MS = 6000;

/** Pop-up alerts for goals and VAR decisions, bottom-right on desktop and bottom-centre on phones. */
export function GoalToaster() {
  const alerts = useAlertStore((s) => s.alerts);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-3 bottom-3 z-40 flex flex-col-reverse items-center gap-2 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:items-end"
    >
      <AnimatePresence initial={false}>
        {alerts.map((alert) => (
          <Toast key={alert.id} alert={alert} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function Toast({ alert }: { alert: GoalAlert }) {
  const dismiss = useAlertStore((s) => s.dismiss);
  const navigate = useNavigate();
  const goal = alert.kind === 'goal';

  useEffect(() => {
    const timer = setTimeout(() => dismiss(alert.id), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [alert.id, dismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 40, transition: { duration: 0.2 } }}
      transition={{ type: 'spring', stiffness: 420, damping: 30 }}
      className="pointer-events-auto w-full max-w-sm"
    >
      <div
        className={`relative flex items-stretch overflow-hidden rounded-xl border bg-pitch-900/95 shadow-2xl shadow-black/50 backdrop-blur ${
          goal ? 'border-flash/40' : 'border-sky-400/40'
        }`}
      >
        <button
          onClick={() => {
            dismiss(alert.id);
            navigate(`/match/${alert.matchId}`);
          }}
          className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left"
        >
          <span
            aria-hidden
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base ${
              goal ? 'bg-flash/15' : 'bg-sky-400/15 font-mono text-[10px] font-bold text-sky-300'
            }`}
          >
            {goal ? '⚽' : 'VAR'}
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider">
              <LeagueDot league={alert.league} />
              <span className={goal ? 'text-flash' : 'text-sky-300'}>{goal ? 'Goal' : 'VAR · No goal'}</span>
              <span className="tabular font-mono font-medium text-ink-muted">{alert.minute}'</span>
            </span>
            <span className="block truncate text-sm font-semibold text-ink">{alert.scoreline}</span>
            <span className="block truncate text-xs text-ink-muted">{alert.detail}</span>
          </span>
        </button>
        <button
          onClick={() => dismiss(alert.id)}
          aria-label="Dismiss"
          className="px-3 text-ink-faint transition-colors hover:text-ink"
        >
          ×
        </button>
        <motion.span
          aria-hidden
          className={`absolute bottom-0 left-0 h-0.5 ${goal ? 'bg-flash/60' : 'bg-sky-400/60'}`}
          initial={{ width: '100%' }}
          animate={{ width: '0%' }}
          transition={{ duration: VISIBLE_MS / 1000, ease: 'linear' }}
        />
      </div>
    </motion.div>
  );
}
