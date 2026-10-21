import { type ReactNode, useState } from 'react';

import { Input, type InputProps } from '../components';

type NumberInputProps = Omit<InputProps, 'value' | 'onChange' | 'type' | 'numeric'> & {
  value: number | null | undefined;
  /** Receives `NaN` while the text is not a number; validation reports it on save. */
  onValue: (value: number) => void;
};

/**
 * A number input that keeps the typed text, so partial input such as `1.` survives a re-render. The typed text is shown
 * only while it still means the current value; a value changed elsewhere (sorting, reload) replaces it.
 */
export function NumberInput({ value, onValue, ...props }: NumberInputProps) {
  const [text, setText] = useState(() => format(value));
  const shown = Object.is(parse(text), value ?? Number.NaN) ? text : format(value);

  return (
    <Input
      {...props}
      numeric
      type="number"
      value={shown}
      onChange={(event) => {
        setText(event.currentTarget.value);
        onValue(event.currentTarget.valueAsNumber);
      }}
    />
  );
}

function format(value: number | null | undefined): string {
  return value !== null && value !== undefined && Number.isFinite(value) ? String(value) : '';
}

function parse(text: string): number {
  return text.trim() === '' ? Number.NaN : Number(text);
}

export function PlusIcon() {
  return (
    <svg className="sa-ico" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg className="sa-ico" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

export function DownloadIcon() {
  return (
    <svg className="sa-ico" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 2.5v8M4.5 7L8 10.5 11.5 7M3 13.5h10" />
    </svg>
  );
}

/** Page title row (`sa-phead`). The title takes focus after a menu change. */
export function PageHead({
  titleId,
  title,
  badge,
  description,
  actions,
}: {
  titleId: string;
  title: string;
  /** Beside the title, e.g. `MockBadge`. */
  badge?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="sa-phead">
      <div>
        <div className="sa-row">
          <h1 id={titleId} className="sa-page-title" tabIndex={-1}>
            {title}
          </h1>
          {badge}
        </div>
        {description ? <p className="sa-small">{description}</p> : null}
      </div>
      {actions ? <div className="sa-row">{actions}</div> : null}
    </div>
  );
}
