import type { ReactNode } from 'react';

import { cx } from './cx';

export interface DisclosureProps {
  /** What is inside, e.g. "예전 정적 코드 보기"; never only "더 보기". */
  summary: ReactNode;
  /** Starts open, e.g. when the folded content has an error to show. */
  open?: boolean | undefined;
  className?: string | undefined;
  children: ReactNode;
}

/** Folds rarely needed content in a native `details`; the browser handles Enter, Space and the open state. */
export function Disclosure({ summary, open, className, children }: DisclosureProps) {
  return (
    <details className={cx('sa-disclosure', className)} open={open}>
      <summary>{summary}</summary>
      <div className="sa-disclosure-b">{children}</div>
    </details>
  );
}
