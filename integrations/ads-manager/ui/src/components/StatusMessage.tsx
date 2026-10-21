import type { ReactNode } from 'react';

import { cx } from './cx';

export type StatusTone = 'info' | 'good' | 'warn' | 'bad';

export interface StatusMessageProps {
  /** `bad` is announced at once (`role="alert"`); the rest politely (`role="status"`). */
  tone?: StatusTone | undefined;
  id?: string | undefined;
  className?: string | undefined;
  /** Keep the component mounted and change only this text; empty hides the box but keeps the live region. */
  children?: ReactNode;
}

/** Live result message for saves, approvals and loads. */
export function StatusMessage({ tone = 'info', id, className, children }: StatusMessageProps) {
  const isError = tone === 'bad';

  return (
    <p
      id={id}
      className={cx('sa-status', tone !== 'info' && `is-${tone}`, className)}
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      {children}
    </p>
  );
}
