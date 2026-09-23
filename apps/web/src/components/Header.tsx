import { Link, NavLink } from 'react-router';
import { SITE } from '../config';
import { useAlertStore } from '../state/alertStore';
import { useMatchStore } from '../state/matchStore';
import { ConnectionPill } from './ConnectionPill';

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors ${
    isActive ? 'bg-pitch-800 text-ink' : 'text-ink-muted hover:text-ink'
  }`;

export function Header() {
  const source = useMatchStore((s) => s.source);

  return (
    <header className="sticky top-0 z-30 border-b border-pitch-800 bg-pitch-950/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-4">
        <div className="flex min-w-0 items-center gap-4">
          <Link to="/" className="flex shrink-0 items-center gap-2.5 whitespace-nowrap font-semibold tracking-tight">
            <Logo />
            <span className="hidden min-[400px]:inline">
              Pitchside <span className="text-live">Live</span>
            </span>
          </Link>
          <nav aria-label="Main" className="flex items-center gap-1">
            <NavLink to="/" end className={navClass}>
              Scores
            </NavLink>
            <NavLink to="/how-it-works" className={navClass}>
              <span className="sm:hidden">About</span>
              <span className="hidden sm:inline">How it works</span>
            </NavLink>
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {source === 'demo' && (
            <span
              className="whitespace-nowrap rounded-full border border-pitch-700 bg-pitch-850 px-2 py-1 text-xs font-medium text-ink-muted sm:px-2.5"
              title="No real Premier League or La Liga match is in play, so a simulated feed runs through the same real-time pipeline."
            >
              Demo<span className="hidden sm:inline"> feed</span>
            </span>
          )}
          <AlertToggle />
          {SITE.githubUrl && (
            <a
              href={SITE.githubUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="Source code on GitHub"
              className="hidden rounded-md p-1.5 text-ink-muted transition-colors hover:text-ink sm:block"
            >
              <GitHubIcon />
            </a>
          )}
          <ConnectionPill />
        </div>
      </div>
    </header>
  );
}

function AlertToggle() {
  const enabled = useAlertStore((s) => s.enabled);
  const toggle = useAlertStore((s) => s.toggle);
  return (
    <button
      onClick={toggle}
      aria-pressed={enabled}
      aria-label={enabled ? 'Goal alerts on' : 'Goal alerts off'}
      title={enabled ? 'Goal alerts on' : 'Goal alerts off'}
      className={`rounded-md p-1.5 transition-colors ${enabled ? 'text-ink' : 'text-ink-faint'} hover:bg-pitch-800`}
    >
      <svg viewBox="0 0 20 20" className="h-4.5 w-4.5" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6">
        <path
          d="M10 3a4.5 4.5 0 0 0-4.5 4.5c0 3.5-1.5 5-1.5 5h12s-1.5-1.5-1.5-5A4.5 4.5 0 0 0 10 3Z"
          strokeLinejoin="round"
        />
        <path d="M8.3 15.5a1.8 1.8 0 0 0 3.4 0" strokeLinecap="round" />
        {!enabled && <path d="M3.5 3.5l13 13" strokeLinecap="round" />}
      </svg>
    </button>
  );
}

function Logo() {
  return (
    <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden>
      <rect width="32" height="32" rx="7" className="fill-pitch-800" />
      <circle cx="16" cy="16" r="8.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="16" cy="16" r="3" className="fill-live" />
    </svg>
  );
}

export function GitHubIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}
