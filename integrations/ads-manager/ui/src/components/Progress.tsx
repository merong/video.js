import type { CSSProperties, ReactNode } from 'react';

import { cx } from './cx';

export interface ProgressProps {
  /** Delivered share, 0–100. */
  value: number;
  /** Expected share at this point in the flight, 0–100. Draws the marker. */
  expected?: number | undefined;
  /** Red bar for behind-pace or under-delivered flights. */
  behind?: boolean | undefined;
  /** Text under the bar; defaults to "64.0% · 기대 65.0%". */
  caption?: ReactNode;
  /** Screen reader text; defaults to the caption wording. */
  label?: string | undefined;
}

function percent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function Progress({ value, expected, behind, caption, label }: ProgressProps) {
  const v = Math.min(100, Math.max(0, value));
  const summary = expected === undefined ? percent(v) : `${percent(v)} · 기대 ${percent(expected)}`;
  // SAFETY: `--v` and `--e` are CSS custom properties read by `.sa-bar`; React's CSSProperties type does not list them.
  const style = { '--v': v, '--e': expected ?? 0 } as CSSProperties;

  return (
    <div className={cx('sa-progress', behind && 'is-behind')}>
      <div className="sa-bar" style={style} role="img" aria-label={label ?? `진도 ${summary}`}>
        <i />
        {expected !== undefined && <b />}
      </div>
      <span className="sa-small">{caption ?? summary}</span>
    </div>
  );
}
