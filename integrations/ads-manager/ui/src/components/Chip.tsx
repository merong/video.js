import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';

import { cx } from './cx';

function Count({ value }: { value: number | undefined }) {
  if (value === undefined) return null;

  return <b>{value}</b>;
}

export interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  pressed: boolean;
  count?: number | undefined;
}

/** Toggle chip for filters, weekdays and single choices (`aria-pressed`). */
export function Chip({ pressed, count, className, children, ...rest }: ChipProps) {
  return (
    <button {...rest} type="button" className={cx('sa-chip', className)} aria-pressed={pressed}>
      {children}
      <Count value={count} />
    </button>
  );
}

export interface ChipGroupProps {
  /** Group name read by screen readers. */
  label: string;
  /** Square one-letter chips such as weekdays. */
  days?: boolean | undefined;
  className?: string | undefined;
  children: ReactNode;
}

export function ChipGroup({ label, days, className, children }: ChipGroupProps) {
  return (
    <div className={cx('sa-chips', days && 'is-days', className)} role="group" aria-label={label}>
      {children}
    </div>
  );
}

export interface ChipLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  current?: boolean | undefined;
  count?: number | undefined;
}

/** Link chip for status tabs that change the address (`aria-current="page"`). */
export function ChipLink({ current, count, className, children, ...rest }: ChipLinkProps) {
  return (
    <a {...rest} className={cx('sa-chip', className)} aria-current={current ? 'page' : undefined}>
      {children}
      <Count value={count} />
    </a>
  );
}

export interface ChipNavProps {
  label: string;
  className?: string | undefined;
  children: ReactNode;
}

export function ChipNav({ label, className, children }: ChipNavProps) {
  return (
    <nav className={cx('sa-chips', className)} aria-label={label}>
      {children}
    </nav>
  );
}
