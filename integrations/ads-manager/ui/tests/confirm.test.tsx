// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { type Confirm, ConfirmProvider, type ConfirmRequest, useConfirm } from '../src/app/confirm';

const A: ConfirmRequest = { title: '첫 요청', body: '첫 요청 내용', confirmLabel: '게시' };
const B: ConfirmRequest = { title: '둘째 요청', body: '둘째 요청 내용', confirmLabel: '제거', danger: true };

function Capture({ onReady }: { onReady: (confirm: Confirm) => void }) {
  const confirm = useConfirm();

  useEffect(() => onReady(confirm), [confirm, onReady]);
  return null;
}

function setup() {
  let confirm: Confirm | null = null;
  const view = render(
    <ConfirmProvider>
      <Capture
        onReady={(next) => {
          confirm = next;
        }}
      />
    </ConfirmProvider>
  );
  const ask = (request: ConfirmRequest) => {
    if (!confirm) throw new Error('not mounted');

    return confirm(request);
  };

  return { view, ask };
}

interface Settlement {
  settled: boolean;
  value?: boolean;
}

/** Records whether a promise has settled, without awaiting it. */
function track(promise: Promise<boolean>): Settlement {
  const state: Settlement = { settled: false };

  void promise.then((value) => {
    state.settled = true;
    state.value = value;
  });
  return state;
}

afterEach(cleanup);

describe('ConfirmProvider', () => {
  it('keeps an accepted choice when a new request arrives before the close event', async () => {
    const { ask } = setup();
    let first!: Promise<boolean>;
    let second!: Promise<boolean>;

    act(() => {
      first = ask(A);
    });

    const accept = within(screen.getByRole('dialog', { name: '첫 요청' })).getByRole('button', { name: '게시' });

    // The click and the next request land in one batch, so the first dialog never fires `close`.
    act(() => {
      accept.click();
      second = ask(B);
    });

    await expect(first).resolves.toBe(true);

    const next = screen.getByRole('dialog', { name: '둘째 요청' });

    fireEvent.click(within(next).getAllByRole('button', { name: '취소' }).at(-1)!);
    await expect(second).resolves.toBe(false);
  });

  it('ignores a late close event from an earlier dialog', async () => {
    const { ask } = setup();
    let first!: Promise<boolean>;
    let second!: Promise<boolean>;

    act(() => {
      first = ask(A);
    });

    const earlier = screen.getByRole('dialog', { name: '첫 요청' });

    act(() => {
      second = ask(B);
    });

    const pending = track(second);

    // A request replaced before any choice counts as cancelled.
    await expect(first).resolves.toBe(false);

    act(() => {
      earlier.dispatchEvent(new Event('close'));
    });
    await Promise.resolve();

    expect(pending.settled).toBe(false);

    const next = screen.getByRole('dialog', { name: '둘째 요청' });

    fireEvent.click(within(next).getByRole('button', { name: '제거' }));
    await expect(second).resolves.toBe(true);
  });

  it('cancels a pending request when the provider unmounts', async () => {
    const { view, ask } = setup();
    let first!: Promise<boolean>;

    act(() => {
      first = ask(A);
    });
    expect(screen.getByRole('dialog', { name: '첫 요청' })).toBeTruthy();

    view.unmount();

    await expect(first).resolves.toBe(false);
  });
});
