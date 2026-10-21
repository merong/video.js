import { type ReactNode, useEffect, useId, useRef, useState } from 'react';

import { Button } from './Button';
import { cx } from './cx';
import { Field, fieldLabelId, Input, useFieldControl } from './Field';

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const HEX_ALPHA_COLOR = /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i;

export const COLOR_FORMAT_ERROR = '#과 16진수 6자리로 입력해 주세요. 예: #cdf352';
export const ALPHA_COLOR_FORMAT_ERROR =
  '#과 16진수 6자리로 입력해 주세요. 투명도를 넣으려면 8자리로 써요. 예: #cdf352, #00000026';
const ALPHA_PICK_HELP = '색 칸은 투명도를 보이지 못해요. 색 칸에서 고르면 투명도가 빠져요.';

export interface ColorFieldProps {
  label: ReactNode;
  /** Placed after the label, outside it, such as a `HelpLink`. */
  labelAside?: ReactNode;
  /** Lowercase `#rrggbb` (or `#rrggbbaa` with `alpha`), or `null` to use the default. */
  value: string | null;
  /** Gets a lowercase color, or `null` when cleared. Invalid text is never sent; the last valid value stays. */
  onChange: (next: string | null) => void;
  /** The text also takes `#rrggbbaa`. The picker has no alpha, so a picked color is opaque `#rrggbb`. */
  alpha?: boolean | undefined;
  /** Called when the text's format error appears or goes away, so a form can refuse to save meanwhile. */
  onInvalidChange?: ((invalid: boolean) => void) | undefined;
  /** Linked to both the picker and the text. */
  help?: ReactNode;
  /** Error from outside, such as a server field error. Linked to both inputs and sets `aria-invalid` on both. */
  error?: ReactNode;
  /** Non-blocking warning, such as low contrast. Linked to both inputs. */
  warning?: ReactNode;
  /** Shown while the value is `null`. */
  emptyLabel?: ReactNode;
  /** Color the picker opens with while the value is `null`. */
  fallback?: string | undefined;
  /** Id of the text input; generated when omitted. */
  id?: string | undefined;
  disabled?: boolean | undefined;
  /**
   * The value is set elsewhere to draw nothing, such as "테두리 없음": both inputs are disabled, the clear button goes, and
   * the swatch shows the empty hatch while the text keeps the value.
   */
  none?: boolean | undefined;
  className?: string | undefined;
}

interface ColorPickProps {
  value: string;
  labelledBy: string;
  describedBy: string | undefined;
  disabled: boolean | undefined;
  onPick: (next: string) => void;
}

// Lives inside `Field` so it can read the field's descriptions; it must not take the field id, which is the text's.
function ColorPick({ value, labelledBy, describedBy, disabled, onPick }: ColorPickProps) {
  const { 'aria-describedby': fieldDescribedBy, 'aria-invalid': invalid } = useFieldControl({
    'aria-describedby': describedBy,
  });

  return (
    <input
      type="color"
      value={value}
      disabled={disabled}
      aria-labelledby={labelledBy}
      aria-describedby={fieldDescribedBy}
      aria-invalid={invalid}
      onChange={(event) => onPick(event.target.value.toLowerCase())}
    />
  );
}

/** Color picker and `#rrggbb` text under one label. Both follow `value`; `null` means "use the default". */
export function ColorField({
  label,
  labelAside,
  value,
  onChange,
  onInvalidChange,
  help,
  error,
  warning,
  emptyLabel = '기본값 사용',
  fallback = '#000000',
  alpha = false,
  id,
  disabled: blocked,
  none = false,
  className,
}: ColorFieldProps) {
  const autoId = useId();
  const textId = id ?? autoId;
  const pickNameId = `${textId}-pick-name`;
  const clearId = `${textId}-clear`;
  const stateId = `${textId}-state`;
  const formatId = `${textId}-format`;
  const alphaId = `${textId}-alpha`;
  const color = value === null ? null : value.toLowerCase();
  const pattern = alpha ? HEX_ALPHA_COLOR : HEX_COLOR;
  const disabled = blocked || none;

  const [text, setText] = useState(color ?? '');
  const [shown, setShown] = useState(color);
  const [invalid, setInvalid] = useState(false);
  const reported = useRef(false);

  // Follow changes from the picker, the clear button or the screen; a typed valid value comes back here normalized.
  if (shown !== color) {
    setShown(color);
    setText(color ?? '');
    setInvalid(false);
  }

  useEffect(() => {
    if (reported.current === invalid) return;

    reported.current = invalid;
    onInvalidChange?.(invalid);
  }, [invalid, onInvalidChange]);

  function send(next: string | null) {
    if (next !== color) onChange(next);
  }

  function changeText(next: string) {
    const trimmed = next.trim();

    setText(next);

    if (trimmed === '') {
      setInvalid(false);
      send(null);
    } else if (pattern.test(trimmed)) {
      setInvalid(false);
      send(trimmed.toLowerCase());
    }
  }

  /** Shows a format error for text that is not a color; returns whether the text is acceptable. */
  function commitText(): boolean {
    const trimmed = text.trim();
    if (trimmed === '') return true;

    if (pattern.test(trimmed)) {
      setText(trimmed.toLowerCase());
      return true;
    }

    setInvalid(true);
    return false;
  }

  function clear() {
    setText('');
    setInvalid(false);
    send(null);
    // The clear button disappears, so keep focus in the field.
    document.getElementById(textId)?.focus();
  }

  const empty = color === null && text === '';
  // The picker shows an 8-digit color opaque; say so while the alpha is partial (fully clear or solid shows as it is).
  const partialAlpha = color !== null && color.length === 9 && color.slice(7) !== 'ff' && color.slice(7) !== '00';

  return (
    <Field
      label={label}
      labelAside={labelAside}
      help={help}
      error={error}
      warning={warning}
      id={textId}
      className={cx(invalid && 'is-error', className)}
    >
      <div className={cx('sa-color', empty && 'is-empty', none && 'is-none')}>
        <span className="sa-color-swatch">
          <ColorPick
            value={color !== null && pattern.test(color) ? color.slice(0, 7) : fallback}
            labelledBy={`${fieldLabelId(textId)} ${pickNameId}`}
            describedBy={cx(empty && stateId, partialAlpha && alphaId) || undefined}
            disabled={disabled}
            onPick={send}
          />
          <span id={pickNameId} hidden>
            색 고르기
          </span>
        </span>
        <Input
          value={text}
          placeholder="#rrggbb"
          spellCheck={false}
          autoComplete="off"
          disabled={disabled}
          aria-describedby={cx(invalid && formatId, empty && stateId, partialAlpha && alphaId) || undefined}
          aria-invalid={invalid || undefined}
          onChange={(event) => changeText(event.target.value)}
          onBlur={commitText}
          // Enter would submit the last valid color while the text shows an error, so stop it here.
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !commitText()) event.preventDefault();
          }}
        />
        {none ? null : empty ? (
          <span className="sa-color-state" id={stateId}>
            {emptyLabel}
          </span>
        ) : (
          <Button
            size="sm"
            id={clearId}
            disabled={disabled}
            aria-labelledby={`${fieldLabelId(textId)} ${clearId}`}
            onClick={clear}
          >
            지우기
          </Button>
        )}
      </div>
      {partialAlpha && (
        <span className="sa-help" id={alphaId}>
          {ALPHA_PICK_HELP}
        </span>
      )}
      {invalid && (
        <span className="sa-help" id={formatId}>
          {alpha ? ALPHA_COLOR_FORMAT_ERROR : COLOR_FORMAT_ERROR}
        </span>
      )}
    </Field>
  );
}
