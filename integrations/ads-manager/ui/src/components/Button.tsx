import {
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type SyntheticEvent,
  useId,
} from 'react';

import { cx } from './cx';

export type ButtonVariant = 'default' | 'primary' | 'accent' | 'danger';
export type ButtonSize = 'md' | 'sm';

const VARIANT_CLASS = {
  default: undefined,
  primary: 'is-primary',
  accent: 'is-lime',
  danger: 'is-danger',
} satisfies Record<ButtonVariant, string | undefined>;

function buttonClass(variant: ButtonVariant, size: ButtonSize, className: string | undefined): string {
  return cx('sa-btn', VARIANT_CLASS[variant], size === 'sm' && 'is-sm', className);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** `accent` is the lime button; keep one per screen. */
  variant?: ButtonVariant | undefined;
  size?: ButtonSize | undefined;
  /** Leading `sa-ico` SVG. */
  icon?: ReactNode;
  /** Disables the button and shows why beside it. */
  disabledReason?: ReactNode;
}

export function Button({
  variant = 'default',
  size = 'md',
  icon,
  disabledReason,
  disabled,
  className,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  const reasonId = useId();
  const hasReason = disabledReason !== undefined && disabledReason !== null && disabledReason !== false;

  const button = (
    <button
      {...rest}
      type={type}
      className={buttonClass(variant, size, className)}
      disabled={hasReason || disabled}
      aria-describedby={cx(rest['aria-describedby'], hasReason && reasonId) || undefined}
    >
      {icon}
      {children}
    </button>
  );

  if (!hasReason) return button;

  return (
    <span className="sa-btn-why">
      {button}
      <span className="sa-help" id={reasonId}>
        {disabledReason}
      </span>
    </span>
  );
}

export interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: ButtonVariant | undefined;
  size?: ButtonSize | undefined;
  icon?: ReactNode;
}

/** Swallows presses on a blocked link button; Space would otherwise scroll the page. */
function ignorePress(event: SyntheticEvent) {
  event.preventDefault();
}

function ignoreKeyPress(event: KeyboardEvent<HTMLAnchorElement>) {
  if (event.key === 'Enter' || event.key === ' ') event.preventDefault();
}

/**
 * A link styled as `sa-btn`, for navigation such as 사이트 보기 or pagination.
 *
 * With `aria-disabled="true"` it stays focusable so its reason (`aria-describedby`) can be read, but it has no `href`
 * and ignores presses. The same element is kept when it is blocked or freed, so focus stays on it.
 */
export function ButtonLink({ variant = 'default', size = 'md', icon, className, children, ...rest }: ButtonLinkProps) {
  const blocked = rest['aria-disabled'] === true || rest['aria-disabled'] === 'true';

  if (blocked) {
    return (
      <a
        {...rest}
        href={undefined}
        target={undefined}
        rel={undefined}
        download={undefined}
        role="link"
        tabIndex={0}
        aria-disabled="true"
        className={buttonClass(variant, size, className)}
        onClick={ignorePress}
        onKeyDown={ignoreKeyPress}
      >
        {icon}
        {children}
      </a>
    );
  }

  return (
    <a {...rest} className={buttonClass(variant, size, className)}>
      {icon}
      {children}
    </a>
  );
}
