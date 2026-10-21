import { useId } from 'react';

import { cx } from './cx';
import { isPlainClick } from './TopNav';

export interface SectionNavItem {
  /** The section element's id; the link points at `#id`. */
  id: string;
  label: string;
  /** Fields to fix in the section; shown as "오류 N" text, never as a color alone. */
  errors?: number | undefined;
  /** The section cannot be used with the current settings (native video); the link stays and says so. */
  off?: boolean | undefined;
}

export interface SectionNavProps {
  items: readonly SectionNavItem[];
  /** The section in view, marked `aria-current="true"` (a place in the page, not a page). */
  current: string;
  /** `column` beside the sections (1280), `row` chips above them (768), `select` at phone width (390). */
  variant: 'column' | 'row' | 'select';
  /** Moves to a section. Links call it on plain left clicks instead of changing the address. */
  onNavigate: (id: string) => void;
  className?: string | undefined;
}

const OFF_TEXT = '쓸 수 없음';

/** Moves between the sections of one long form. Same order and names at every width; only the shape changes. */
export function SectionNav({ items, current, variant, onNavigate, className }: SectionNavProps) {
  const selectId = useId();

  if (variant === 'select') {
    const withErrors = items.filter((item) => item.errors);
    const helpId = `${selectId}-help`;

    return (
      <div className={cx('sa-secjump', className)}>
        <label className="sa-label" htmlFor={selectId}>
          구획으로 이동
        </label>
        <select
          className="sa-input"
          id={selectId}
          value={current}
          aria-describedby={withErrors.length ? helpId : undefined}
          onChange={(event) => onNavigate(event.currentTarget.value)}
        >
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
              {item.errors ? ` · 오류 ${item.errors}` : item.off ? ` · ${OFF_TEXT}` : ''}
            </option>
          ))}
        </select>
        {withErrors.length ? (
          <span className="sa-help" id={helpId}>
            {withErrors.map((item) => `${item.label} 구획에 고칠 칸이 ${item.errors}개 있어요.`).join(' ')}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <nav className={cx('sa-secnav', variant === 'row' && 'is-row', className)} aria-label="편집 구획">
      {variant === 'column' ? <span className="sa-secnav-h">구획으로 이동</span> : null}
      {items.map((item) => (
        <a
          key={item.id}
          href={`#${item.id}`}
          className={item.off ? 'is-off' : undefined}
          aria-current={item.id === current ? 'true' : undefined}
          onClick={(event) => {
            // The admin app routes by hash, so a section link must not change the address.
            if (!isPlainClick(event)) return;

            event.preventDefault();
            onNavigate(item.id);
          }}
        >
          <span>
            {item.label}
            {item.off ? <span className="sa-small"> {OFF_TEXT}</span> : null}
          </span>
          {item.errors ? <span className="sa-secnav-err">오류 {item.errors}</span> : null}
        </a>
      ))}
    </nav>
  );
}
