import { type ReactNode, useId } from 'react';

import { cx } from './cx';

export interface SegmentedOption<Value extends string> {
  value: Value;
  /** Mark the built-in default in the text, e.g. "정보만 (기본)"; never by color or weight alone. */
  label: ReactNode;
}

export interface SegmentedProps<Value extends string> {
  label: ReactNode;
  /** Placed right after the label, outside it, such as a `HelpLink`. */
  labelAside?: ReactNode;
  value: Value;
  options: readonly SegmentedOption<Value>[];
  onChange: (value: Value) => void;
  help?: ReactNode;
  /** Blocking error, linked like `Field` errors and set as `aria-invalid` on the group. */
  error?: ReactNode;
  /** Given to the checked radio, so a screen can move focus to the group by id. */
  id?: string | undefined;
  disabled?: boolean | undefined;
  /** Number values (5초, 10초) in Inter. */
  numeric?: boolean | undefined;
  /** Id of a description outside the field, such as the stage's scale note. */
  describedBy?: string | undefined;
}

function present(node: ReactNode): boolean {
  return node !== undefined && node !== null && node !== false && node !== '';
}

/**
 * A few choices as joined buttons (`sa-seg`). Inside it is one native radio group, so Tab lands on the checked value
 * and the arrow keys move and select without any script. Use `Select` for more than five values or long descriptions.
 */
export function Segmented<Value extends string>({
  label,
  labelAside,
  value,
  options,
  onChange,
  help,
  error,
  id,
  disabled,
  numeric,
  describedBy: outside,
}: SegmentedProps<Value>) {
  const baseId = useId();
  const labelId = `${baseId}-label`;
  const helpId = `${baseId}-help`;
  const errorId = `${baseId}-error`;
  const hasError = present(error);
  const describedBy = cx(hasError && errorId, present(help) && helpId, outside) || undefined;

  const labelElement = (
    <span className="sa-label" id={labelId}>
      {label}
    </span>
  );

  return (
    <div className={cx('sa-field', hasError && 'is-error')}>
      {present(labelAside) ? (
        <div className="sa-field-head">
          {labelElement}
          {labelAside}
        </div>
      ) : (
        labelElement
      )}
      <div
        className={cx('sa-seg', numeric && 'is-num')}
        role="radiogroup"
        aria-labelledby={labelId}
        aria-describedby={describedBy}
        aria-invalid={hasError || undefined}
      >
        {options.map((option) => (
          <label key={option.value}>
            <input
              type="radio"
              name={baseId}
              value={option.value}
              id={option.value === value ? id : undefined}
              checked={option.value === value}
              disabled={disabled}
              onChange={() => onChange(option.value)}
            />
            {option.label}
          </label>
        ))}
      </div>
      {present(help) && (
        <span className="sa-help" id={helpId}>
          {help}
        </span>
      )}
      {hasError && (
        <span className="sa-help" id={errorId}>
          {error}
        </span>
      )}
    </div>
  );
}
