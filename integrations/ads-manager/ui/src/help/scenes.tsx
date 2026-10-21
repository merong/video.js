import type { ReactNode } from 'react';

import { cx } from '../components';

// Building blocks for the help motions (`design/components/HelpMotion`). Markup alone is the
// final key state; the `sa-mo-*` animation classes only play under `prefers-reduced-motion: no-preference`.

/** Reveal slot: appears at 4–12%, 20–28%, 36–44%, 52–60% or 68–76% of the motion. */
export type Step = 1 | 2 | 3 | 4 | 5;

export type BoxTone = 'ad' | 'ink' | 'ghost' | 'off' | 'faint';

function reveal(step: Step | undefined): string | undefined {
  return step === undefined ? undefined : `sa-mo-in${step}`;
}

/** Root of every scene; a looping motion fades it out and in between rounds. */
export function Scene({ children }: { children: ReactNode }) {
  return <div className="sa-mo">{children}</div>;
}

export function Row({ children }: { children: ReactNode }) {
  return <div className="sa-mo-row">{children}</div>;
}

/** Wrapping row of steps joined by arrows. */
export function Flow({ children }: { children: ReactNode }) {
  return <div className="sa-mo-flow">{children}</div>;
}

export function Cap({ step, children }: { step?: Step | undefined; children: ReactNode }) {
  return <span className={cx('sa-mo-cap', reveal(step))}>{children}</span>;
}

export interface BoxProps {
  tone?: BoxTone | undefined;
  step?: Step | undefined;
  /** Static and faded; do not combine with `step`, whose animation owns opacity. */
  dim?: boolean | undefined;
  sub?: ReactNode;
  children: ReactNode;
}

export function Box({ tone, step, dim, sub, children }: BoxProps) {
  return (
    <span className={cx('sa-mo-box', tone && `is-${tone}`, reveal(step), dim && 'sa-mo-dim')}>
      {children}
      {sub !== undefined && <small>{sub}</small>}
    </span>
  );
}

/** Any element, such as a status badge, revealed at `step`. */
export function Item({ step, children }: { step?: Step | undefined; children: ReactNode }) {
  return <span className={cx('sa-mo-item', reveal(step))}>{children}</span>;
}

export function Arrow({ down, step }: { down?: boolean | undefined; step?: Step | undefined }) {
  return (
    <svg className={cx('sa-ico', down && 'sa-mo-down', reveal(step))} viewBox="0 0 16 16" aria-hidden="true">
      <path d={down ? 'M8 3v10M4 9l4 4 4-4' : 'M3 8h10M9 4l4 4-4 4'} />
    </svg>
  );
}

export interface Segment {
  label: ReactNode;
  ad?: boolean | undefined;
  /** Faded to point at the other segments. */
  dim?: boolean | undefined;
}

/** Playback order. Segment bars fill one after another, one slot each (at most five). */
export function Timeline({ segments }: { segments: readonly Segment[] }) {
  return (
    <div className="sa-mo-segs">
      {segments.map(({ label, ad, dim }, index) => (
        <div key={index} className={cx('sa-mo-seg', ad ? 'is-ad' : 'is-content', dim && 'sa-mo-dim')}>
          <span className="sa-mo-bar">
            <i className={`sa-mo-fill${index + 1}`} />
          </span>
          <span className="sa-mo-cap">{label}</span>
        </div>
      ))}
    </div>
  );
}

/** Dark player frame. The bottom bar fills for the first two thirds of the motion. */
export function Screen({ tag, leave, children }: { tag: string; leave?: boolean | undefined; children?: ReactNode }) {
  return (
    <div className={cx('sa-mo-screen', leave && 'sa-mo-leave')}>
      {children}
      <span className="sa-mo-tag">{tag}</span>
      <span className="sa-mo-bar">
        <i className="sa-mo-play" />
      </span>
    </div>
  );
}

/** Skip button: counts 5 → 1 over five seconds of the loop, then turns on. */
export function SkipButton() {
  return (
    <span className="sa-mo-skip">
      <span className="sa-mo-wait">
        <span className="sa-mo-roll sa-mo-count">
          <span>
            {[5, 4, 3, 2, 1].map((n) => (
              <span key={n} className="sa-mo-num">
                {n}
              </span>
            ))}
          </span>
        </span>
        초 후 건너뛰기
      </span>
      <span className="sa-mo-go">광고 건너뛰기</span>
    </span>
  );
}

/** Link button that is on from the start. */
export function ScreenLink({ children }: { children: ReactNode }) {
  return (
    <span className="sa-mo-skip">
      <span className="sa-mo-link">{children}</span>
    </span>
  );
}

/** Flat picture standing in for an image ad or a video frame. `contain` keeps it whole and leaves bands. */
export function Picture({ contain }: { contain?: boolean | undefined }) {
  return (
    <svg
      className="sa-mo-pic"
      viewBox="0 0 160 104"
      preserveAspectRatio={contain ? 'xMidYMid meet' : 'xMidYMid slice'}
      aria-hidden="true"
    >
      <rect className="is-sky" width="160" height="104" />
      <circle className="is-sun" cx="118" cy="34" r="14" />
      <path className="is-hill" d="M0 104V74l38-24 30 20 34-30 58 40v24Z" />
    </svg>
  );
}

/** Number that goes up by one as each signal arrives (0 → 3). */
export function Tally() {
  return (
    <span className="sa-mo-roll sa-mo-tally">
      <span>
        {[0, 1, 2, 3].map((n) => (
          <span key={n} className="sa-mo-num">
            {n}
          </span>
        ))}
      </span>
    </span>
  );
}

export const TREE_LEVELS = ['사이트', '게시판', '분류', '영상'] as const;

export interface TreeCell {
  label: ReactNode;
  tone?: BoxTone | undefined;
  step?: Step | undefined;
}

/** Schedule levels from site to video: what each level sets, then what it plays. */
export function Tree({ rows }: { rows: readonly { caption: string; cells: readonly TreeCell[] }[] }) {
  return (
    <div className="sa-mo-tree">
      {TREE_LEVELS.map((level) => (
        <span key={level} className="sa-mo-cap">
          {level}
        </span>
      ))}
      {rows.map(({ caption, cells }) => [
        <span key={caption} className="sa-mo-cap sa-mo-span">
          {caption}
        </span>,
        ...cells.map(({ label, tone, step }, index) => (
          <Box key={`${caption}-${index}`} tone={tone} step={step}>
            {label}
          </Box>
        )),
      ])}
    </div>
  );
}

/** Small document card for drafts and versions. */
export function Doc({ label, ad, step }: { label: ReactNode; ad?: boolean | undefined; step?: Step | undefined }) {
  return (
    <span className={cx('sa-mo-doc', ad && 'is-ad', reveal(step))}>
      <i />
      <i />
      <b>{label}</b>
    </span>
  );
}

/** Two cards on top of each other; the first sits behind, faded. */
export function Stack({ children }: { children: ReactNode }) {
  return <span className="sa-mo-stack">{children}</span>;
}

/** Signal lane: source → travelling dots → target. A blocked lane has no dots. */
export function Lane({
  from,
  to,
  blocked,
  focus,
}: {
  from: ReactNode;
  to: ReactNode;
  blocked?: boolean | undefined;
  focus?: boolean | undefined;
}) {
  return (
    <div className={cx('sa-mo-lane', focus ? 'is-focus' : 'sa-mo-dim')}>
      {from}
      <span className="sa-mo-pipe">
        {!blocked && (
          <>
            <i className="sa-mo-dot1" />
            <i className="sa-mo-dot2" />
            <i className="sa-mo-dot3" />
          </>
        )}
      </span>
      {to}
    </div>
  );
}

/** Ten ad starts. `done` fill in at 36–44%; `clicked` get a thick outline. */
export function Pips({
  done = 0,
  clicked = [],
}: {
  done?: number | undefined;
  clicked?: readonly number[] | undefined;
}) {
  return (
    <span className="sa-mo-pips">
      {Array.from({ length: 10 }, (_, index) => (
        <span
          key={index}
          className={cx('sa-mo-pip', index < done && 'is-done', clicked.includes(index) && 'is-click')}
        />
      ))}
    </span>
  );
}

export function Legend({ items }: { items: readonly { pip: 'start' | 'done' | 'click'; label: string }[] }) {
  return (
    <span className="sa-mo-legend">
      {items.map(({ pip, label }) => (
        <span key={label}>
          <span className={cx('sa-mo-pip', pip === 'done' && 'is-done', pip === 'click' && 'is-click')} />
          {label}
        </span>
      ))}
    </span>
  );
}

export function Formula({ step, children }: { step?: Step | undefined; children: ReactNode }) {
  return <span className={cx('sa-mo-formula', reveal(step))}>{children}</span>;
}

export type PlayerLook = 'theme' | 'plain' | 'native' | 'skin-default' | 'skin-neutral';

const PLAYER_CLASS = {
  theme: 'is-theme',
  plain: 'is-plain',
  native: 'is-native',
  'skin-default': 'is-skin-default',
  'skin-neutral': 'is-skin-neutral',
} satisfies Record<PlayerLook, string>;

/** Small player with a control bar. `theme` turns its accent color and corners on at 36–44%. */
export function Player({ look, label, step }: { look: PlayerLook; label: ReactNode; step?: Step | undefined }) {
  return (
    <span className={cx('sa-mo-device', reveal(step))}>
      <span className={cx('sa-mo-player', PLAYER_CLASS[look])}>
        <span className="sa-mo-ctl">
          <span className="sa-mo-knob" />
          <span className="sa-mo-track">
            <i />
          </span>
        </span>
      </span>
      <span className="sa-mo-cap">{label}</span>
    </span>
  );
}

/** Portrait frame showing a landscape picture, kept whole (`contain`) or cropped to fill (`cover`). */
export function Fit({ fit, label }: { fit: 'contain' | 'cover'; label: ReactNode }) {
  return (
    <span className="sa-mo-device">
      <span className="sa-mo-fit">
        <Picture contain={fit === 'contain'} />
      </span>
      <span className="sa-mo-cap">{label}</span>
    </span>
  );
}
