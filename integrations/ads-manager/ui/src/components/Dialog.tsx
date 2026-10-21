import { type FormEvent, type ReactNode, useEffect, useEffectEvent, useId, useRef } from 'react';

import { cx } from './cx';

export interface DialogProps {
  open: boolean;
  /**
   * Called whenever the dialog closes: Esc, the close button, or `open` turning false. Not called when the dialog
   * unmounts while open, since the parent removed it on purpose; focus still returns.
   */
  onClose: () => void;
  title: ReactNode;
  /** One short line beside the title (`span.sa-small`), such as "저장된 값 · 통계에 남기지 않아요". */
  aside?: ReactNode;
  /** Buttons in the bottom row (`sa-dialog-f`). */
  footer?: ReactNode;
  closeLabel?: string | undefined;
  /** Id of a note in the body read with the title when it opens. */
  describedBy?: string | undefined;
  /**
   * The wide variant for a player (`is-wide`): only the body scrolls, the content sits in a `form[method=dialog]` so a
   * footer `button[type=submit]` closes it, and the header close button takes the first focus, so keys do not reach the
   * player.
   */
  wide?: boolean | undefined;
  children: ReactNode;
}

// Environments without the dialog methods (jsdom) still get the same open and close sequence.
type DialogMethods = Partial<Pick<HTMLDialogElement, 'showModal' | 'close'>>;

function openDialog(dialog: HTMLDialogElement): void {
  // SAFETY: only reads whether the method exists; jsdom ships HTMLDialogElement without it.
  if ((dialog as DialogMethods).showModal) dialog.showModal();
  else dialog.setAttribute('open', '');
}

function closeDialog(dialog: HTMLDialogElement): void {
  // SAFETY: only reads whether the method exists; jsdom ships HTMLDialogElement without it.
  if ((dialog as DialogMethods).close) {
    dialog.close();
    return;
  }

  dialog.removeAttribute('open');
  dialog.dispatchEvent(new Event('close'));
}

/** Modal native `dialog`. Focus returns to the element that was focused when it opened. */
export function Dialog({
  open,
  onClose,
  title,
  aside,
  footer,
  closeLabel = '닫기',
  describedBy,
  wide = false,
  children,
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const handleClosed = useEffectEvent(() => onClose());

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      openDialog(dialog);

      if (wide) closeRef.current?.focus();
    } else if (!open && dialog.open) {
      closeDialog(dialog);
    }
  }, [open, wide]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const returnFocus = () => {
      const target = returnFocusRef.current;

      returnFocusRef.current = null;

      if (target?.isConnected) target.focus();
    };

    const handleClose = () => {
      returnFocus();
      handleClosed();
    };

    // Esc fires `cancel`; closing through the same path keeps the fallback (no native Esc) in step.
    const handleCancel = (event: Event) => {
      event.preventDefault();
      closeDialog(dialog);
    };

    dialog.addEventListener('close', handleClose);
    dialog.addEventListener('cancel', handleCancel);

    return () => {
      dialog.removeEventListener('close', handleClose);
      dialog.removeEventListener('cancel', handleCancel);

      // Removed while open: no `close` event fires, so return focus here. A connected node means a StrictMode re-run.
      if (!dialog.isConnected) returnFocus();
    };
  }, []);

  const heading = (
    <h2 className="sa-card-title" id={titleId}>
      {title}
    </h2>
  );

  const content = (
    <>
      <div className="sa-dialog-h">
        {aside === undefined ? (
          heading
        ) : (
          <div className="sa-dialog-title">
            {heading}
            <span className="sa-small">{aside}</span>
          </div>
        )}
        <button
          ref={closeRef}
          type="button"
          className="sa-btn is-sm"
          aria-label={closeLabel}
          onClick={() => dialogRef.current && closeDialog(dialogRef.current)}
        >
          <svg className="sa-ico" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>
      <div className="sa-dialog-b">{children}</div>
      {footer !== undefined && <div className="sa-dialog-f">{footer}</div>}
    </>
  );

  // `method=dialog` would close it natively; the same close path keeps the fallback (no dialog methods) in step.
  const submit = (event: FormEvent) => {
    event.preventDefault();

    if (dialogRef.current) closeDialog(dialogRef.current);
  };

  return (
    <dialog
      ref={dialogRef}
      className={cx('sa-dialog', wide && 'is-wide')}
      aria-labelledby={titleId}
      aria-describedby={describedBy}
    >
      {wide ? (
        <form method="dialog" onSubmit={submit}>
          {content}
        </form>
      ) : (
        content
      )}
    </dialog>
  );
}
