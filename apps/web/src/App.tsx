import { MotionConfig } from 'motion/react';
import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router';
import { useEffect } from 'react';
import { GoalToaster } from './components/GoalToaster';
import { Header } from './components/Header';
import { SITE } from './config';
import { useLiveTitle } from './hooks/useLiveTitle';
import { HowItWorksPage } from './pages/HowItWorksPage';
import { MatchDetailPage } from './pages/MatchDetailPage';
import { MatchListPage } from './pages/MatchListPage';
import { useLiveFeed } from './socket/useLiveFeed';

export function App() {
  useLiveFeed();
  useLiveTitle();

  return (
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <ScrollToTop />
        <Header />
        <main className="mx-auto max-w-6xl px-4 py-5">
          <Routes>
            <Route path="/" element={<MatchListPage />} />
            <Route path="/match/:matchId" element={<MatchDetailPage />} />
            <Route path="/how-it-works" element={<HowItWorksPage />} />
            <Route path="*" element={<MatchListPage />} />
          </Routes>
        </main>
        <Footer />
        <GoalToaster />
      </BrowserRouter>
    </MotionConfig>
  );
}

function Footer() {
  return (
    <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 pb-8 pt-2 text-xs text-ink-faint">
      <span>
        Real-time demo · NestJS + Socket.io + React
        {SITE.authorName && ` · Built by ${SITE.authorName}`}
      </span>
      <span className="flex gap-3">
        <Link to="/how-it-works" className="hover:text-ink">
          How it works
        </Link>
        {SITE.githubUrl && (
          <a href={SITE.githubUrl} target="_blank" rel="noreferrer" className="hover:text-ink">
            GitHub
          </a>
        )}
        {SITE.portfolioUrl && (
          <a href={SITE.portfolioUrl} target="_blank" rel="noreferrer" className="hover:text-ink">
            CV
          </a>
        )}
        <span>Data: football-data.org · No odds, no predictions</span>
      </span>
    </footer>
  );
}

/** Route changes start at the top of the page, like a normal site. */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
