import {
  createContext,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useContext,
  useId,
} from 'react';

import { cx } from './cx';

interface FieldControl {
  id: string;
  describedBy: string | undefined;
  invalid: boolean;
}

const FieldContext = createContext<FieldControl | null>(null);

/** Ids of text that describes every control inside, such as a `DisabledReason` sentence. */
export const DescribedByContext = createContext<string | undefined>(undefined);

export interface FieldProps {
  label: ReactNode;
  /** Placed right after the label, outside it, such as a `HelpLink`. Never part of the control's name or description. */
  labelAside?: ReactNode;
  /** Format hints or current values, linked with `aria-describedby`. */
  help?: ReactNode;
  /** Blocking validation error: what is wrong and how to fix it. Sets `aria-invalid`. */
  error?: ReactNode;
  /** Non-blocking review warning. Ignored while `error` is set. */
  warning?: ReactNode;
  /** Control id; generated when omitted. */
  id?: string | undefined;
  className?: string | undefined;
  /** One `Input`, `Select`, `Textarea` or `FileInput`. */
  children: ReactNode;
}

/** Id of the `Field` label, for controls that need it in `aria-labelledby`. */
export function fieldLabelId(controlId: string): string {
  return `${controlId}-label`;
}

function present(node: ReactNode): boolean {
  return node !== undefined && node !== null && node !== false && node !== '';
}

/** Label, control, help and error in one `sa-field`; the control picks up its id and descriptions. */
export function Field({ label, labelAside, help, error, warning, id, className, children }: FieldProps) {
  const autoId = useId();
  const controlId = id ?? autoId;
  const helpId = `${controlId}-help`;
  const errorId = `${controlId}-error`;
  const warningId = `${controlId}-warning`;

  const hasError = present(error);
  const hasWarning = !hasError && present(warning);
  const describedBy = cx(hasError && errorId, hasWarning && warningId, present(help) && helpId) || undefined;

  const labelElement = (
    <label className="sa-label" id={fieldLabelId(controlId)} htmlFor={controlId}>
      {label}
    </label>
  );

  return (
    <div className={cx('sa-field', hasError && 'is-error', hasWarning && 'is-warn', className)}>
      {present(labelAside) ? (
        <div className="sa-field-head">
          {labelElement}
          {labelAside}
        </div>
      ) : (
        labelElement
      )}
      <FieldContext value={{ id: controlId, describedBy, invalid: hasError }}>{children}</FieldContext>
      {present(help) && (
        <span className="sa-help" id={helpId}>
          {help}
        </span>
      )}
      {hasWarning && (
        <span className="sa-help" id={warningId}>
          {warning}
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

interface ControlA11y {
  id?: string | undefined;
  'aria-describedby'?: string | undefined;
  'aria-invalid'?: InputHTMLAttributes<HTMLInputElement>['aria-invalid'];
}

/** Field id, descriptions and invalid state for a custom control inside `Field`. */
export function useFieldControl(props: ControlA11y): ControlA11y {
  const field = useContext(FieldContext);
  const outer = useContext(DescribedByContext);

  return {
    id: props.id ?? field?.id,
    'aria-describedby': cx(props['aria-describedby'], field?.describedBy, outer) || undefined,
    'aria-invalid': field?.invalid ? true : props['aria-invalid'],
  };
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Numbers and dates: Inter with tabular digits. */
  numeric?: boolean | undefined;
}

export function Input({ numeric, className, ...rest }: InputProps) {
  const a11y = useFieldControl(rest);

  return <input {...rest} {...a11y} className={cx('sa-input', numeric && 'is-num', className)} />;
}

export type FileInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

export function FileInput({ className, ...rest }: FileInputProps) {
  const a11y = useFieldControl(rest);

  return <input {...rest} {...a11y} type="file" className={cx('sa-input', className)} />;
}

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ className, children, ...rest }: SelectProps) {
  const a11y = useFieldControl(rest);

  return (
    <select {...rest} {...a11y} className={cx('sa-input', className)}>
      {children}
    </select>
  );
}

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({ className, rows = 3, ...rest }: TextareaProps) {
  const a11y = useFieldControl(rest);

  return <textarea {...rest} {...a11y} rows={rows} className={cx('sa-input', className)} />;
}
