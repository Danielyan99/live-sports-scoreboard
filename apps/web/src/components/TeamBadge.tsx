import type { Team } from '@scoreboard/shared';
import { useState } from 'react';

const SIZES = { sm: 'h-5 w-5 text-[8px]', lg: 'h-12 w-12 text-xs' } as const;

/** Club crest when the API provides one, otherwise a monogram with a stable per-club hue. */
export function TeamBadge({ team, size = 'sm' }: { team: Team; size?: keyof typeof SIZES }) {
  const [failed, setFailed] = useState(false);

  if (team.crest && !failed) {
    return (
      <img
        src={team.crest}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className={`${SIZES[size]} shrink-0 object-contain`}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={`${SIZES[size]} inline-flex shrink-0 items-center justify-center rounded-full font-bold tracking-tight text-pitch-950`}
      style={{ backgroundColor: `hsl(${hue(team.tla)} 55% 68%)` }}
    >
      {team.tla.slice(0, size === 'sm' ? 1 : 3)}
    </span>
  );
}

function hue(text: string): number {
  let h = 0;
  for (const char of text) h = (h * 31 + char.charCodeAt(0)) % 360;
  return h;
}
