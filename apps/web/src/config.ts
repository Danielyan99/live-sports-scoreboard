/**
 * Personal links shown in the intro, header and "How it works" page.
 * Set them in apps/web/.env (see .env.example); anything left empty is hidden.
 */
export const SITE = {
  authorName: import.meta.env.VITE_AUTHOR_NAME?.trim() || '',
  githubUrl: import.meta.env.VITE_GITHUB_URL?.trim() || '',
  portfolioUrl: import.meta.env.VITE_PORTFOLIO_URL?.trim() || '',
};

/** Link to a file in the repo on GitHub, or null when no repo URL is configured. */
export function sourceUrl(path: string): string | null {
  if (!SITE.githubUrl) return null;
  return `${SITE.githubUrl.replace(/\/$/, '')}/blob/main/${path}`;
}
