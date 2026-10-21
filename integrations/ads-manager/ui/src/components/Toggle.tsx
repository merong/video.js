import { type ButtonHTMLAttributes, type ReactNode, useId } from 'react';

import { cx } from './cx';

export interface ToggleProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'type' | 'role' | 'onChange' | 'children'
> {
  checked: boolean;
  onCheckedChange?: ((checked: boolean) => void) | undefined;
  /** Visible label. Without it, pass `aria-label`. */
  label?: ReactNode;
}

/** On/off switch (`role="switch"`). Clicking the label also toggles it. */
export function Toggle({ checked, onCheckedChange, label, className, onClick, id, ...rest }: ToggleProps) {
  const autoId = useId();
  const buttonId = id ?? autoId;
  const labelId = `${buttonId}-label`;

  const toggle = (
    <button
      {...rest}
      id={buttonId}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={label === undefined ? rest['aria-labelledby'] : labelId}
      className={cx('sa-toggle', className)}
      onClick={(event) => {
        onClick?.(event);

        if (!event.defaultPrevented) onCheckedChange?.(!checked);
      }}
    />
  );

  if (label === undefined) return toggle;

  return (
    <span className="sa-row">
      {toggle}
      <label className="sa-body" id={labelId} htmlFor={buttonId}>
        {label}
      </label>
    </span>
  );
}
