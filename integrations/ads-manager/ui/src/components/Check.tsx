import { type InputHTMLAttributes, type ReactNode, useId } from 'react';

import { cx } from './cx';

export interface CheckProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  type?: 'checkbox' | 'radio' | undefined;
  label: ReactNode;
}

/** A checkbox or radio with its label (`sa-check`). */
export function Check({ type = 'checkbox', label, className, ...rest }: CheckProps) {
  return (
    <label className={cx('sa-check', className)}>
      <input {...rest} type={type} />
      {label}
    </label>
  );
}

export interface FieldsetProps {
  legend: ReactNode;
  /** Placed right after the legend, outside it, such as a `HelpLink`. Never part of the group name or description. */
  legendAside?: ReactNode;
  help?: ReactNode;
  className?: string | undefined;
  /** `Check` items; they sit in one `sa-row`. */
  children: ReactNode;
}

/** Names a group of `Check` items with `fieldset` and `legend`. */
export function Fieldset({ legend, legendAside, help, className, children }: FieldsetProps) {
  const helpId = useId();
  const hasHelp = help !== undefined && help !== null && help !== false;
  const hasAside = legendAside !== undefined && legendAside !== null && legendAside !== false;

  return (
    <fieldset
      className={cx('sa-fieldset', hasAside && 'has-aside', className)}
      aria-describedby={hasHelp ? helpId : undefined}
    >
      {/* The legend stays the first child so it keeps naming the group; the aside follows it as a sibling. */}
      <legend className="sa-label">{legend}</legend>
      {hasAside && <span className="sa-fieldset-aside">{legendAside}</span>}
      <div className="sa-row">{children}</div>
      {hasHelp && (
        <span className="sa-help" id={helpId}>
          {help}
        </span>
      )}
    </fieldset>
  );
}
