import type { ReactNode } from 'react';

export type StepState = 'todo' | 'done' | 'current' | 'error';

export interface Step {
  id: string;
  label: ReactNode;
  state?: StepState | undefined;
}

export interface StepperProps {
  /** List name, e.g. "집행 편집 단계". */
  label: string;
  steps: readonly Step[];
  /** `list`: vertical form steps (`sa-steps`). `flow`: one-line process (`sa-flow`). */
  variant?: 'list' | 'flow' | undefined;
}

const STATE_SUFFIX = {
  todo: '',
  done: ' (완료)',
  current: '',
  error: ' (확인 필요)',
} satisfies Record<StepState, string>;

export function Stepper({ label, steps, variant = 'list' }: StepperProps) {
  return (
    <ol className={variant === 'flow' ? 'sa-flow' : 'sa-steps'} aria-label={label}>
      {steps.map(({ id, label: stepLabel, state = 'todo' }) => (
        <li
          key={id}
          className={state === 'done' ? 'is-done' : state === 'error' ? 'is-error' : undefined}
          aria-current={state === 'current' ? 'step' : undefined}
        >
          {stepLabel}
          {STATE_SUFFIX[state] && <span className="sa-sr">{STATE_SUFFIX[state]}</span>}
        </li>
      ))}
    </ol>
  );
}
