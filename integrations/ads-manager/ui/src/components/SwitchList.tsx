import { type ReactNode, useContext, useId } from 'react';

import { cx } from './cx';
import { DescribedByContext } from './Field';

export interface SwitchItem {
  /** Button id, so a screen can move focus to the switch. */
  id: string;
  name: ReactNode;
  description: ReactNode;
  /** What turns off with it, such as "끄면 단축키 <kbd>c</kbd>도 꺼져요." (`sa-switch-keys`). */
  keys?: ReactNode;
  /** A value used only while the switch is on, such as "건너뛰는 폭"; hidden while off and named by `aria-controls`. */
  sub?: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Short tag after the name, e.g. "자동 재생 때문에 켜짐". */
  badge?: ReactNode;
  /**
   * Why the switch cannot change and how to change it (DisabledReason). The switch is disabled, keeps its value, and
   * the reason replaces the description.
   */
  locked?: ReactNode;
  /** Blocking error under the description; sets `aria-invalid`. */
  error?: ReactNode;
}

export interface SwitchListProps {
  items: readonly SwitchItem[];
  className?: string | undefined;
}

function present(node: ReactNode): boolean {
  return node !== undefined && node !== null && node !== false && node !== '';
}

/**
 * On/off rows (`sa-switches`): the switch is named by its name text and described by its description. Inside an active
 * `DisabledReason` every row is locked and described by the section's reason instead.
 */
export function SwitchList({ items, className }: SwitchListProps) {
  return (
    <ul className={cx('sa-switches', className)}>
      {items.map((item) => (
        <SwitchRow key={item.id} item={item} />
      ))}
    </ul>
  );
}

function SwitchRow({ item }: { item: SwitchItem }) {
  const baseId = useId();
  const nameId = `${baseId}-name`;
  const descId = `${baseId}-desc`;
  const errorId = `${baseId}-error`;
  const keysId = `${baseId}-keys`;
  const subId = `${baseId}-sub`;
  const blockedBy = useContext(DescribedByContext);
  const locked = present(item.locked) || blockedBy !== undefined;
  const hasError = present(item.error);
  const hasKeys = present(item.keys) && !blockedBy;
  const hasSub = present(item.sub);

  return (
    <li className={locked ? 'is-locked' : undefined}>
      <button
        id={item.id}
        className="sa-toggle"
        type="button"
        role="switch"
        aria-checked={item.checked}
        aria-labelledby={nameId}
        aria-describedby={blockedBy ?? cx(descId, hasKeys && keysId, hasError && errorId)}
        aria-invalid={hasError || undefined}
        aria-controls={hasSub ? subId : undefined}
        disabled={locked}
        onClick={() => item.onCheckedChange(!item.checked)}
      />
      <span className="sa-switch-name">
        <span id={nameId}>{item.name}</span>
        {present(item.badge) ? (
          <>
            {' '}
            <span className="sa-badge">{item.badge}</span>
          </>
        ) : null}
      </span>
      {blockedBy ? null : (
        <span className="sa-switch-desc" id={descId}>
          {present(item.locked) ? item.locked : item.description}
        </span>
      )}
      {hasKeys ? (
        <span className="sa-switch-keys" id={keysId}>
          {item.keys}
        </span>
      ) : null}
      {hasSub ? (
        <div className="sa-switch-sub" id={subId} hidden={!item.checked || locked}>
          {item.sub}
        </div>
      ) : null}
      {hasError ? (
        <span className="sa-switch-desc sa-help" id={errorId}>
          {item.error}
        </span>
      ) : null}
    </li>
  );
}
