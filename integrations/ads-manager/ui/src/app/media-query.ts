import { useCallback, useSyncExternalStore } from 'react';

// Environments without matchMedia (jsdom) get `fallback`.
type MatchMedia = Partial<Pick<Window, 'matchMedia'>>;

function mediaList(query: string): MediaQueryList | null {
  // SAFETY: only reads whether the method exists; jsdom ships the property without a function.
  return (window as MatchMedia).matchMedia ? window.matchMedia(query) : null;
}

/** Whether `query` matches now; re-renders when it changes. */
export function useMediaQuery(query: string, fallback: boolean): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = mediaList(query);

      list?.addEventListener('change', onChange);

      return () => list?.removeEventListener('change', onChange);
    },
    [query]
  );

  return useSyncExternalStore(subscribe, () => mediaList(query)?.matches ?? fallback);
}

export type LayoutWidth = 'wide' | 'medium' | 'narrow';

/** The three editor layouts of the A2 canvas: 1280 (three columns), 768 (one column), 390 (phone). */
export function useLayoutWidth(): LayoutWidth {
  const wide = useMediaQuery('(min-width: 1100px)', true);
  const narrow = useMediaQuery('(max-width: 599px)', false);

  if (wide) return 'wide';

  return narrow ? 'narrow' : 'medium';
}
