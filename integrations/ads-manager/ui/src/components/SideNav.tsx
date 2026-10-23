import { type MouseEvent, type ReactNode, useId } from 'react';

import { isPlainClick, type TopNavItem } from './TopNav';

export interface SideNavItem extends TopNavItem {
  /** A 16px `sa-ico` line icon before the label; it is decorative. */
  icon?: ReactNode;
}

export interface SideNavGroup {
  /** Small section label above the group, e.g. "광고". */
  label: string;
  items: readonly SideNavItem[];
}

export interface SideNavProps {
  /** Element id, so a menu button can point at it with `aria-controls`. */
  id?: string | undefined;
  /** Text before the lime tag: "솔애드". Omit to show only `tag` as plain text. */
  brand?: string | undefined;
  /** Lime tag after the brand: "관리자", or "광고 관리" in the GnuBoard popup. */
  tag: string;
  groups: readonly SideNavGroup[];
  /** Name of the menu landmark. */
  navLabel?: string | undefined;
  /** Below the menu, e.g. `Avatar` and the signed-in name. */
  footer?: ReactNode;
  /** Below 960px the side menu is a drawer that shows only while open. */
  open?: boolean | undefined;
  /** Shows the drawer's own close button. */
  onClose?: (() => void) | undefined;
  /** Called on plain left clicks so a client router can take over; call `event.preventDefault()` there. */
  onNavigate?: ((item: SideNavItem, event: MouseEvent<HTMLAnchorElement>) => void) | undefined;
}

/** Left menu of the admin shell (`sa-side`), grouped under section labels. Below 960px it becomes a drawer. */
export function SideNav({
  id,
  brand,
  tag,
  groups,
  navLabel = '주 메뉴',
  footer,
  open = false,
  onClose,
  onNavigate,
}: SideNavProps) {
  const baseId = useId();

  return (
    <div className={open ? 'sa-side is-open' : 'sa-side'} id={id}>
      <div className="sa-side-head">
        {brand ? (
          <span className="sa-logo">
            {brand} <em>{tag}</em>
          </span>
        ) : (
          <span className="sa-logo">{tag}</span>
        )}
        {onClose ? (
          <button type="button" className="sa-side-close" aria-label="메뉴 닫기" onClick={onClose}>
            <svg className="sa-ico" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        ) : null}
      </div>
      <nav className="sa-side-nav" aria-label={navLabel}>
        {groups.map((group, index) => {
          const labelId = `${baseId}-group-${index}`;

          return (
            <div key={group.label} className="sa-side-group">
              <p className="sa-side-label" id={labelId}>
                {group.label}
              </p>
              <ul aria-labelledby={labelId}>
                {group.items.map((item) => (
                  <li key={item.id}>
                    <a
                      href={item.href}
                      aria-current={item.current ? 'page' : undefined}
                      onClick={
                        onNavigate &&
                        ((event) => {
                          if (isPlainClick(event)) onNavigate(item, event);
                        })
                      }
                    >
                      {item.icon}
                      <span>{item.label}</span>
                      {item.count ? (
                        <b>
                          {item.count}
                          <span className="sa-sr">건</span>
                        </b>
                      ) : null}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>
      {footer ? <div className="sa-side-foot">{footer}</div> : null}
    </div>
  );
}
