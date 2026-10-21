import { type ReactNode, type RefObject, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { Button, cx } from '../components';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

// Environments without matchMedia (jsdom) play the motion with its controls.
type MatchMedia = Partial<Pick<Window, 'matchMedia'>>;

function reducedMotionQuery(): MediaQueryList | null {
  // SAFETY: only reads whether the method exists; jsdom ships the property without a function.
  return (window as MatchMedia).matchMedia ? window.matchMedia(REDUCED_MOTION) : null;
}

function subscribeReducedMotion(onChange: () => void): () => void {
  const query = reducedMotionQuery();

  query?.addEventListener('change', onChange);

  return () => query?.removeEventListener('change', onChange);
}

/** True when the viewer asked for less motion. CSS already stops the motion; this hides the controls. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => reducedMotionQuery()?.matches ?? false,
    () => false
  );
}

/** Pauses motions scrolled out of view. Without IntersectionObserver they just play. */
function useOffscreen(ref: RefObject<HTMLElement | null>): boolean {
  const [offscreen, setOffscreen] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || !('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry) setOffscreen(!entry.isIntersecting);
    });

    observer.observe(node);

    return () => observer.disconnect();
  }, [ref]);

  return offscreen;
}

export interface HelpMotionProps {
  /** One sentence saying what the picture shows; the figure's accessible name. */
  label: string;
  /** Term name, used to name the control group. */
  name: string;
  /** Plays once (5s) instead of looping (8s); only "다시 보기" is offered. */
  once?: boolean | undefined;
  /** From `useReducedMotion`; the picture stays on its final state and the controls go away. */
  reduced: boolean;
  children: ReactNode;
}

/** Motion picture for a help term, with pause and replay controls. */
export function HelpMotion({ label, name, once, reduced, children }: HelpMotionProps) {
  const figureRef = useRef<HTMLElement>(null);
  const offscreen = useOffscreen(figureRef);
  const [paused, setPaused] = useState(false);
  const [round, setRound] = useState(0);

  const replay = () => {
    setPaused(false);
    setRound((value) => value + 1);
  };

  return (
    <figure
      ref={figureRef}
      className={cx('sa-motion', once && 'is-once', paused && 'is-paused', offscreen && 'is-offscreen')}
    >
      {/* A new key remounts the stage, which restarts every CSS animation inside it. */}
      <div key={round} className="sa-motion-stage" role="img" aria-label={label}>
        {children}
      </div>
      {!reduced && (
        <div className="sa-motion-ctrl" role="group" aria-label={`${name} 그림 조작`}>
          {!once && (
            <Button size="sm" aria-pressed={paused} onClick={() => setPaused((value) => !value)}>
              일시정지
            </Button>
          )}
          <Button size="sm" onClick={replay}>
            다시 보기
          </Button>
        </div>
      )}
    </figure>
  );
}
