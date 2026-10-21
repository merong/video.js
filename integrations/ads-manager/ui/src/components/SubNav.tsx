import type { MouseEvent } from 'react';

import { cx } from './cx';
import { isPlainClick } from './TopNav';

export interface SubNavItem {
  id: string;
  label: string;
  href: string;
  /** Marks the current screen with `aria-current="page"`. */
  current?: boolean | undefined;
}

export interface SubNavProps {
  /** Name of the link group, e.g. "플레이어 화면". */
  label: string;
  items: readonly SubNavItem[];
  /** Called on plain left clicks so a client router can take over; call `event.preventDefault()` there. */
  onNavigate?: ((item: SubNavItem, event: MouseEvent<HTMLAnchorElement>) => void) | undefined;
  className?: string | undefined;
}

/** Links between the screens of one menu. Plain links with `aria-current`, not ARIA tabs. */
export function SubNav({ label, items, onNavigate, className }: SubNavProps) {
  return (
    <nav className={cx('sa-subnav', className)} aria-label={label}>
      {items.map((item) => (
        <a
          key={item.id}
          href={item.href}
          aria-current={item.current ? 'page' : undefined}
          onClick={
            onNavigate &&
            ((event) => {
              if (isPlainClick(event)) onNavigate(item, event);
            })
          }
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}
