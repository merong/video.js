import { type FormEventHandler, type ReactNode, useId } from 'react';

import { cx } from './cx';

export interface CardProps {
  /** Card title (`h2.sa-card-title`); also names the section. */
  title?: ReactNode;
  /** Right side of the title row. */
  actions?: ReactNode;
  /** No padding; for tables and toolbars that run edge to edge. */
  flush?: boolean | undefined;
  /** Dense density; only for table cards. */
  dense?: boolean | undefined;
  /** Accessible name when there is no visible title. */
  label?: string | undefined;
  className?: string | undefined;
  children: ReactNode;
}

export function Card({ title, actions, flush, dense, label, className, children }: CardProps) {
  const titleId = useId();
  const hasTitle = title !== undefined;

  return (
    <section
      className={cx('sa-card', flush && 'is-flush', dense && 'sa-dense', className)}
      aria-labelledby={hasTitle ? titleId : undefined}
      aria-label={hasTitle ? undefined : label}
    >
      {hasTitle &&
        (flush ? (
          <div className="sa-toolbar">
            <h2 className="sa-card-title" id={titleId}>
              {title}
            </h2>
            {actions !== undefined && <span className="sa-spacer" />}
            {actions}
          </div>
        ) : (
          <div className="sa-card-h">
            <h2 className="sa-card-title" id={titleId}>
              {title}
            </h2>
            {actions}
          </div>
        ))}
      {children}
    </section>
  );
}

export interface PanelProps {
  title: ReactNode;
  description?: ReactNode;
  /** Buttons in the bottom row (`sa-panel-f`), right-aligned. */
  footer?: ReactNode;
  /** Renders a `form` instead of a `section`. */
  onSubmit?: FormEventHandler<HTMLFormElement> | undefined;
  className?: string | undefined;
  children: ReactNode;
}

/** Card with a header, body and button row. Becomes a form when `onSubmit` is set. */
export function Panel({ title, description, footer, onSubmit, className, children }: PanelProps) {
  const titleId = useId();
  const body = (
    <>
      <div className="sa-panel-h">
        <h2 className="sa-card-title" id={titleId}>
          {title}
        </h2>
        {description !== undefined && <p className="sa-small">{description}</p>}
      </div>
      {children}
      {footer !== undefined && <div className="sa-panel-f">{footer}</div>}
    </>
  );
  const classes = cx('sa-card sa-panel', className);

  if (onSubmit) {
    return (
      <form className={classes} aria-labelledby={titleId} onSubmit={onSubmit}>
        {body}
      </form>
    );
  }

  return (
    <section className={classes} aria-labelledby={titleId}>
      {body}
    </section>
  );
}
