import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';

import { Button, Dialog } from '../components';

export interface ConfirmRequest {
  title: string;
  body: string;
  /** The action's name, e.g. "게시" or "버리기"; never a generic "확인". */
  confirmLabel: string;
  /** Destructive or input-discarding actions use the danger button. */
  danger?: boolean;
}

export type Confirm = (request: ConfirmRequest) => Promise<boolean>;

interface Shown {
  id: number;
  request: ConfirmRequest;
}

interface Pending {
  id: number;
  resolve: (confirmed: boolean) => void;
  /** Set by the footer buttons; Esc and the header "닫기" button leave it `null`, which means cancel. */
  decision: boolean | null;
}

const ConfirmContext = createContext<Confirm | null>(null);

/**
 * Owns the one confirmation dialog of the app. Each request renders its own `Dialog` (keyed by request id), so a late
 * `close` event from an earlier dialog cannot settle a newer request. A request settles from its dialog's `onClose`,
 * after focus has returned to the button that opened it. A newer request settles the older one with the choice already
 * made (or cancel), and unmounting cancels whatever is pending.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState<Shown | null>(null);
  const [open, setOpen] = useState(false);
  const pending = useRef<Pending | null>(null);
  const lastId = useRef(0);

  useEffect(
    () => () => {
      const entry = pending.current;

      pending.current = null;
      entry?.resolve(false);
    },
    []
  );

  const confirm = useCallback<Confirm>((request) => {
    const previous = pending.current;

    previous?.resolve(previous.decision ?? false);

    lastId.current += 1;
    const id = lastId.current;

    return new Promise<boolean>((resolve) => {
      pending.current = { id, resolve, decision: null };
      setShown({ id, request });
      setOpen(true);
    });
  }, []);

  const decide = (id: number, accept: boolean) => {
    const entry = pending.current;
    if (entry?.id !== id) return;

    entry.decision = accept;
    setOpen(false);
  };

  const closed = (id: number) => {
    const entry = pending.current;
    if (entry?.id !== id) return;

    pending.current = null;
    setOpen(false);
    entry.resolve(entry.decision ?? false);
  };

  return (
    <ConfirmContext value={confirm}>
      {children}
      {shown ? (
        <Dialog
          key={shown.id}
          open={open}
          onClose={() => closed(shown.id)}
          title={shown.request.title}
          footer={
            <>
              <Button onClick={() => decide(shown.id, false)}>취소</Button>
              <Button variant={shown.request.danger ? 'danger' : 'primary'} onClick={() => decide(shown.id, true)}>
                {shown.request.confirmLabel}
              </Button>
            </>
          }
        >
          <p className="sa-body">{shown.request.body}</p>
        </Dialog>
      ) : null}
    </ConfirmContext>
  );
}

export function useConfirm(): Confirm {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error('useConfirm must be used inside ConfirmProvider.');

  return confirm;
}
