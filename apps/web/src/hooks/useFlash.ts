import { useEffect, useRef, useState } from 'react';

/**
 * Tracks changes to a value after the first render.
 * `key` increments on every change (use it to restart an animation) and
 * `active` stays true for `holdMs` after the latest change.
 */
export function useFlash<T>(value: T, holdMs = 6000): { key: number; active: boolean } {
  const previous = useRef(value);
  const [key, setKey] = useState(0);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (Object.is(previous.current, value)) return;
    previous.current = value;
    setKey((k) => k + 1);
    setActive(true);
    const timer = setTimeout(() => setActive(false), holdMs);
    return () => clearTimeout(timer);
  }, [value, holdMs]);

  return { key, active };
}
