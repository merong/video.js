import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import type { Bootstrap } from '../src/api/actions';
import { AdminApi } from '../src/api/client';
import { App } from '../src/app/App';

interface Reply {
  status?: number;
  body: unknown;
}

type Handler = (url: URL, init: RequestInit) => Reply;

function bootstrap(installed: boolean): Bootstrap {
  return {
    authenticated: true,
    csrfToken: 'token-1',
    capabilities: { host: 'standalone', manualTargets: true, uploads: true, loginUrl: null, lms: { installed } },
    site: { siteId: 'site-1', timeZone: 'Asia/Seoul' },
    playerModuleUrl: '/assets/ads.js',
    limits: { uploadBytes: 8 * 1024 * 1024 },
    user: { displayName: '운영자' },
  };
}

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- any JSON payload the fake API returns.
const ok = (data: unknown): Reply => ({ body: { ok: true, data } });

const page = (rows: readonly object[], total = rows.length, number = 1) =>
  ok({ rows, total, page: number, pageSize: 50 });

function serve(handlers: Record<string, Handler>, installed = true) {
  const fetch = vi.fn(async (input: string, init: RequestInit = {}) => {
    const url = new URL(input);
    const action = url.searchParams.get('action') ?? '';
    const handler = new Map<string, Handler>(
      Object.entries({ bootstrap: () => ok(bootstrap(installed)), creatives: () => ok({ items: [] }), ...handlers })
    ).get(action);
    if (!handler) throw new Error(`unexpected action ${action}`);

    const { status = 200, body } = handler(url, init);

    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  });

  vi.stubGlobal('fetch', fetch);
  return fetch;
}

function calls(fetch: ReturnType<typeof serve>, action: string): URL[] {
  return fetch.mock.calls.map(([input]) => new URL(input)).filter((url) => url.searchParams.get('action') === action);
}

// The default 1s wait is too short for the first render while every test file runs at once.
const LOAD_WAIT = { timeout: 4000 };

async function open(hash: string) {
  history.replaceState(null, '', `/${hash}`);
  render(<App api={new AdminApi('http://admin.test/ads/api/index.php')} publicBase="/ads/" />);
  await screen.findByRole('heading', { level: 1, name: '강의' }, LOAD_WAIT);
}

const ROW = {
  learner: 'x:student-7',
  videoId: 'lecture-01',
  percent: 42.6,
  completedAt: null,
  activeSeconds: 750,
  position: 754,
  duration: 2700,
  updatedAt: '2026-10-21T17:25:25Z',
};

beforeEach(() => {
  // jsdom has no dialog methods; these follow the browser's open and close.
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  // SAFETY: removes the stubs above; jsdom's prototype has neither method.
  delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).showModal;
  // SAFETY: as above.
  delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).close;
});

describe('LmsScreen', () => {
  it('keeps the menu without the LMS tables and shows the install note on both pages', async () => {
    const fetch = serve({}, false);

    await open('#/lms');

    await waitFor(() => expect(location.hash).toBe('#/lms/progress'));
    expect(screen.getByText(/LMS 표가 아직 없어요\./u)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'LMS 연동 보기' }).getAttribute('href')).toBe('#/lms/settings');
    expect(screen.queryByRole('table')).toBeNull();

    fireEvent.click(screen.getByRole('link', { name: 'LMS 연동' }));
    await screen.findByRole('heading', { level: 2, name: 'LMS 연동' });

    expect(screen.getByText(/LMS 표가 아직 없어요\./u)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /연동 키/u })).toBeNull();
    expect(calls(fetch, 'lms-progress-list')).toHaveLength(0);
  });

  it('tells an empty record apart from an empty filter result', async () => {
    serve({ 'lms-progress-list': () => page([]) });
    await open('#/lms/progress');

    expect(await screen.findByText('아직 학습 기록이 없어요.')).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: '쪽 넘김' })).toBeNull();

    fireEvent.change(screen.getByLabelText('영상 ID'), { target: { value: 'lecture-02' } });
    fireEvent.submit(screen.getByRole('form', { name: '거름' }));

    expect(await screen.findByText('조건에 맞는 기록이 없어요.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '거름 지우기' }));

    expect(await screen.findByText('아직 학습 기록이 없어요.')).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>('영상 ID').value).toBe('');
  });

  it('shows one learner row', async () => {
    serve({ 'lms-progress-list': () => page([ROW]) });
    await open('#/lms/progress');

    const table = await screen.findByRole('table', { name: '학습자별 진도' });
    const [, row] = within(table).getAllByRole('row');
    const cells = within(row!)
      .getAllByRole('cell')
      .map((cell) => cell.textContent);

    expect(cells).toEqual([
      'student-7외부 LMS',
      'lecture-01',
      '42%',
      '학습 중',
      '12분 30초',
      '12:34 / 45:00',
      expect.stringMatching(/전$/u),
    ]);
    expect(within(row!).getByRole('img', { name: '진도율 42%' })).toBeTruthy();
    expect(screen.getByText('기록 1개')).toBeTruthy();
  });

  it('moves between pages of 50', async () => {
    const fetch = serve({
      'lms-progress-list': (url) => {
        const number = Number(url.searchParams.get('page'));

        return page([{ ...ROW, videoId: `lecture-${number}` }], 1234, number);
      },
    });

    await open('#/lms/progress');

    const pager = await screen.findByRole('navigation', { name: '쪽 넘김' });

    expect(within(pager).getByText('기록 1,234개')).toBeTruthy();
    expect(within(pager).getByText('1 / 25쪽').getAttribute('aria-current')).toBe('page');
    expect(within(pager).getByRole('button', { name: '이전' }).matches(':disabled')).toBe(true);

    fireEvent.click(within(pager).getByRole('button', { name: '다음' }));

    expect(await within(pager).findByText('2 / 25쪽')).toBeTruthy();
    expect(screen.getByText('lecture-2')).toBeTruthy();
    expect(calls(fetch, 'lms-progress-list').map((url) => url.searchParams.get('page'))).toEqual(['1', '2']);
  });

  it('asks before replacing the key and shows the new key once', async () => {
    const fetch = serve({
      'lms-settings': () => ok({ installed: true, keySet: true, keyHint: '…dbf9', rotatedAt: '2026-10-21T17:25:25Z' }),
      'lms-key-rotate': () => ok({ key: 'cd'.repeat(32), keyHint: '…cdcd', rotatedAt: '2026-10-22T01:00:00Z' }),
    });

    await open('#/lms/settings');

    expect(await screen.findByText('있어요 (…dbf9)')).toBeTruthy();
    expect(screen.getByText('10월 22일 02:25')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '연동 키 바꾸기' }));

    const dialog = await screen.findByRole('dialog', { name: '연동 키를 바꿀까요?' });

    expect(calls(fetch, 'lms-key-rotate')).toHaveLength(0);

    fireEvent.click(within(dialog).getByRole('button', { name: '바꾸기' }));

    expect(await screen.findByText('cd'.repeat(32))).toBeTruthy();
    expect(screen.getByText('이 키는 지금 한 번만 보여요. 복사해서 LMS 서버에 안전하게 두세요.')).toBeTruthy();
    expect(screen.getByText('있어요 (…cdcd)')).toBeTruthy();
    expect(calls(fetch, 'lms-key-rotate')).toHaveLength(1);
  });
});
