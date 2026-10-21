import type { ReactNode } from 'react';

import { cx } from './cx';

export interface NoteProps {
  tone?: 'info' | 'warn' | 'bad' | undefined;
  /** Short lead shown in bold before the text. */
  title?: ReactNode;
  className?: string | undefined;
  /** Buttons for a note shown once, such as [재생 테스트 열기][확인했어요] (`has-actions`). */
  actions?: ReactNode;
  children: ReactNode;
}

/** Static guidance inside forms and panels (`role="note"`). Use `StatusMessage` for results. */
export function Note({ tone = 'info', title, className, actions, children }: NoteProps) {
  const hasActions = actions !== undefined && actions !== null && actions !== false;

  return (
    <div className={cx('sa-note', tone !== 'info' && `is-${tone}`, hasActions && 'has-actions', className)} role="note">
      <span>
        {title !== undefined && (
          <>
            <b>{title}</b>
            {' · '}
          </>
        )}
        {children}
      </span>
      {hasActions ? <div className="sa-note-actions">{actions}</div> : null}
    </div>
  );
}
