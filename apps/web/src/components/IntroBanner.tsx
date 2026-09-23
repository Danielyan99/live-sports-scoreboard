import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { Link } from 'react-router';
import { SITE } from '../config';
import { GitHubIcon } from './Header';

const STORAGE_KEY = 'pitchside:intro-dismissed';
const STACK = ['React', 'TypeScript', 'NestJS', 'Socket.io', 'MongoDB', 'Tailwind'];

/** A short, dismissible explanation of what the project demonstrates, for people arriving from a CV. */
export function IntroBanner() {
  const [visible, setVisible] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) !== 'true';
    } catch {
      return true;
    }
  });

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // Storage unavailable; the banner just comes back next visit.
    }
  };

  return (
    <AnimatePresence initial={false}>
      {visible && (
        <motion.section
          aria-labelledby="intro-title"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden"
        >
          <div className="relative overflow-hidden rounded-xl border border-pitch-800 bg-gradient-to-br from-pitch-850 via-pitch-900 to-pitch-900 p-5">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-live/10 blur-3xl"
            />
            <button
              onClick={dismiss}
              aria-label="Hide introduction"
              className="absolute right-3 top-3 rounded-md px-2 py-0.5 text-lg leading-none text-ink-faint hover:bg-pitch-800 hover:text-ink"
            >
              ×
            </button>

            <p className="text-[11px] font-semibold uppercase tracking-wider text-live">
              Portfolio project{SITE.authorName && ` · ${SITE.authorName}`}
            </p>
            <h1 id="intro-title" className="mt-1.5 max-w-xl pr-6 text-lg font-semibold leading-snug sm:text-xl">
              Live football scores, pushed to your browser over WebSockets
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-ink-muted">
              A NestJS server watches a football data feed, works out exactly what changed, and pushes only that to
              every open browser over Socket.io. Nothing on this page polls or refreshes. When no real match is being
              played, a simulator drives the same pipeline, so it&rsquo;s always live.
            </p>

            <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Tech stack">
              {STACK.map((tech) => (
                <li
                  key={tech}
                  className="rounded-full border border-pitch-700 bg-pitch-850 px-2.5 py-0.5 text-xs text-ink/90"
                >
                  {tech}
                </li>
              ))}
            </ul>

            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                to="/how-it-works"
                className="rounded-lg bg-live px-3.5 py-2 text-sm font-semibold text-pitch-950 transition-opacity hover:opacity-90"
              >
                How it works →
              </Link>
              {SITE.githubUrl && (
                <a
                  href={SITE.githubUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-pitch-700 px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:bg-pitch-800"
                >
                  <GitHubIcon className="h-4 w-4" />
                  Source code
                </a>
              )}
              {SITE.portfolioUrl && (
                <a
                  href={SITE.portfolioUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-pitch-700 px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:bg-pitch-800"
                >
                  My CV
                </a>
              )}
            </div>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
