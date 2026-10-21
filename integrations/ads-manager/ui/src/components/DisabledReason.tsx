import { type ReactNode, useId } from 'react';

import { cx } from './cx';
import { DescribedByContext } from './Field';

export interface DisabledReasonProps {
  /** What cannot be used, why, and how to change it: "<b>…쓸 수 없어요.</b> …바꾸면 쓸 수 있어요." */
  reason: ReactNode;
  /** `false` shows the content as usual, with no reason. */
  active: boolean;
  className?: string | undefined;
  /** The controls the reason blocks. They stay on screen with their values (decision 27). */
  children: ReactNode;
}

/**
 * Blocks a section or group the current settings cannot use (`sa-off-reason` + `sa-off-body`). The controls inside are
 * disabled through one `fieldset`, keep their values, and each `Field` control is described by the reason.
 */
export function DisabledReason({ reason, active, className, children }: DisabledReasonProps) {
  const reasonId = useId();

  // The same tree either way, so switching keeps the controls' own state.
  return (
    <div className={cx('aa-stack', className)}>
      {active ? (
        <p className="sa-off-reason" id={reasonId}>
          <span>{reason}</span>
        </p>
      ) : null}
      <fieldset
        className={cx('aa-fieldset', active && 'sa-off-body')}
        disabled={active}
        aria-describedby={active ? reasonId : undefined}
      >
        <DescribedByContext value={active ? reasonId : undefined}>{children}</DescribedByContext>
      </fieldset>
    </div>
  );
}
