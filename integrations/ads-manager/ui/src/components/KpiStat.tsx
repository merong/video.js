import type { CSSProperties, ReactNode } from 'react';

import { cx } from './cx';

export interface KpiRowProps {
  /** Region name, e.g. "오늘 요약, 어제 같은 시각과 비교". */
  label: string;
  /** 28px figures; only for dashboard and report summary rows. */
  hero?: boolean | undefined;
  /** Number of columns; defaults to the number of children passed as an array. */
  columns?: number | undefined;
  children: ReactNode;
}

/** One card holding `KpiStat` cells side by side. Two columns below 960px. */
export function KpiRow({ label, hero, columns, children }: KpiRowProps) {
  const count = columns ?? (Array.isArray(children) ? children.length : 1);
  // SAFETY: `--n` is a CSS custom property read by `.sa-kpis`; React's CSSProperties type does not list custom properties.
  const style = { '--n': count } as CSSProperties;

  return (
    <section className={cx('sa-card sa-kpis', hero && 'is-hero')} style={style} aria-label={label}>
      {children}
    </section>
  );
}

export interface KpiDelta {
  /** Change with its arrow, e.g. "▲ 4.2%". */
  text: string;
  tone: 'good' | 'bad';
  /** Comparison value, e.g. "어제 30,060". */
  compare?: string | undefined;
}

export interface KpiStatProps {
  label: string;
  value: ReactNode;
  /** Secondary line such as a period; ignored when `delta` is set. */
  note?: ReactNode;
  delta?: KpiDelta | undefined;
}

export function KpiStat({ label, value, note, delta }: KpiStatProps) {
  return (
    <div className="sa-kpi">
      <span className="sa-kpi-label">{label}</span>
      <span className="sa-kpi-value">{value}</span>
      {delta ? (
        <span className={`sa-delta is-${delta.tone}`}>
          {delta.text}
          {delta.compare !== undefined && <em>{delta.compare}</em>}
        </span>
      ) : (
        note !== undefined && <span className="sa-small">{note}</span>
      )}
    </div>
  );
}
