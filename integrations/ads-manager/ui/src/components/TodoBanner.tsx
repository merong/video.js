import type { ReactNode } from 'react';

export interface TodoItem {
  id: string;
  title: string;
  detail?: string | undefined;
  count: number;
  /** Rejected or failed work; red icon and outlined count. */
  bad?: boolean | undefined;
}

export interface TodoBannerProps {
  /** Region name, e.g. "오늘의 할 일". */
  label: string;
  title: ReactNode;
  description?: ReactNode;
  /** One lime button plus optional `sa-banner-link`. */
  actions?: ReactNode;
  items: readonly TodoItem[];
}

function CheckIcon() {
  return (
    <svg className="sa-ico" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 8.5l3.2 3L13 4.5" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg className="sa-ico" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.8v3.8M8 11.1v.1" />
    </svg>
  );
}

/** Dark dashboard banner with the operator's to-do counts. */
export function TodoBanner({ label, title, description, actions, items }: TodoBannerProps) {
  return (
    <section className="sa-banner" aria-label={label}>
      <div className="sa-banner-l">
        <span className="sa-tag is-period">{label}</span>
        <h2 className="sa-banner-title">{title}</h2>
        {description !== undefined && <p>{description}</p>}
        {actions !== undefined && <div className="sa-row">{actions}</div>}
      </div>
      <ul className="sa-todo">
        {items.map((item) => (
          <li key={item.id} className={item.bad ? 'is-bad' : undefined}>
            {item.bad ? <AlertIcon /> : <CheckIcon />}
            <span>
              <b>{item.title}</b>
              {item.detail !== undefined && <small>{item.detail}</small>}
            </span>
            <i>
              {item.count}
              <span className="sa-sr">건</span>
            </i>
          </li>
        ))}
      </ul>
    </section>
  );
}
