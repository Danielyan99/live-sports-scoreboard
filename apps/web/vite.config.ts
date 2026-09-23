/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';

const TITLE = 'Pitchside Live · Real-time football scoreboard';
const DESCRIPTION =
  'Live Premier League and La Liga scores pushed over WebSockets. A NestJS + Socket.io + React portfolio project with server-side diffing and versioned patches.';

/**
 * Adds Open Graph / Twitter tags for link previews (LinkedIn, Slack, iMessage…).
 * Scrapers need an absolute image URL, so it uses VITE_SITE_URL when set.
 */
function socialMeta(siteUrl: string | undefined): Plugin {
  const base = siteUrl?.replace(/\/$/, '') ?? '';
  const image = `${base}/og-image.png`;
  const tags = [
    ['property', 'og:type', 'website'],
    ['property', 'og:title', TITLE],
    ['property', 'og:description', DESCRIPTION],
    ['property', 'og:image', image],
    ['property', 'og:image:width', '1200'],
    ['property', 'og:image:height', '630'],
    ['property', 'og:image:alt', 'Pitchside Live: a dark scoreboard with live scores and a WebSocket patch message'],
    ...(base ? [['property', 'og:url', base]] : []),
    ['name', 'twitter:card', 'summary_large_image'],
    ['name', 'twitter:title', TITLE],
    ['name', 'twitter:description', DESCRIPTION],
    ['name', 'twitter:image', image],
  ];

  return {
    name: 'social-meta',
    transformIndexHtml: () =>
      tags.map(([attr, key, content]) => ({ tag: 'meta', attrs: { [attr]: key, content }, injectTo: 'head' as const })),
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  return {
    plugins: [react(), tailwindcss(), socialMeta(env.VITE_SITE_URL)],
    server: { port: 5173 },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test-setup.ts'],
      css: false,
    },
  };
});
