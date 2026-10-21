import type { MouseEvent, ReactNode } from 'react';

export interface TopNavItem {
  id: string;
  label: string;
  href: string;
  /** Marks the current screen with `aria-current="page"`. */
  current?: boolean | undefined;
  /** Waiting count shown as a lime badge; hidden when 0 or omitted. */
  count?: number | undefined;
}

export interface TopNavProps {
  /** Text before the lime tag: "솔애드", or the GnuBoard site name. Omit to show only `tag` as plain text. */
  brand?: string | undefined;
  /** Lime tag after the brand: "관리자", or "광고 관리" in the GnuBoard popup. */
  tag: string;
  items: readonly TopNavItem[];
  /** Name of the menu landmark. */
  navLabel?: string | undefined;
  /** Right-hand actions: search, the screen's lime button, `Avatar`, 창 닫기. */
  actions?: ReactNode;
  /** Called on plain left clicks so a client router can take over; call `event.preventDefault()` there. */
  onNavigate?: ((item: TopNavItem, event: MouseEvent<HTMLAnchorElement>) => void) | undefined;
}

/** Left click without modifier keys; other clicks keep the browser behavior (new tab, new window). */
export function isPlainClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

/** Top menu (`sa-top`). Below 960px the menu moves to a second, scrollable row. */
export function TopNav({ brand, tag, items, navLabel = '주 메뉴', actions, onNavigate }: TopNavProps) {
  return (
    <header className="sa-top">
      {brand ? (
        <span className="sa-logo">
          {brand} <em>{tag}</em>
        </span>
      ) : (
        <span className="sa-logo">{tag}</span>
      )}
      <nav className="sa-nav" aria-label={navLabel}>
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
            {item.count ? (
              <b>
                {item.count}
                <span className="sa-sr">건</span>
              </b>
            ) : null}
          </a>
        ))}
      </nav>
      {actions !== undefined && <div className="sa-top-r">{actions}</div>}
    </header>
  );
}

export interface AvatarProps {
  /** One character shown in the circle. */
  initial: string;
  /** Full name and role read by screen readers, e.g. "admin · 최고관리자". */
  label: string;
}

export function Avatar({ initial, label }: AvatarProps) {
  return (
    <span className="sa-avatar" role="img" aria-label={label}>
      {initial}
    </span>
  );
}
