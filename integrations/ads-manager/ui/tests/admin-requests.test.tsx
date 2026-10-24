import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import type { Bootstrap } from '../src/api/actions';
import { AdminApi } from '../src/api/client';
import { App } from '../src/app/App';
import { period } from '../src/screens/RequestsScreen';

interface Reply {
  status?: number;
  body: unknown;
}

type Handler = (url: URL, init: RequestInit) => Reply;

function bootstrap(canWrite = true): Bootstrap {
  return {
    authenticated: true,
    csrfToken: 'token-1',
    capabilities: {
      host: 'gnuboard',
      manualTargets: false,
      uploads: true,
      loginUrl: '/bbs/login.php',
      adRequests: true,
      logos: true,
    },
    site: { siteId: 'site-1', timeZone: 'Asia/Seoul' },
    playerModuleUrl: '/assets/ads.js',
    limits: { uploadBytes: 8 * 1024 * 1024 },
    user: { displayName: '운영자', canWrite },
  };
}

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- any JSON payload the fake API returns.
const ok = (data: unknown): Reply => ({ body: { ok: true, data } });

const ITEM = {
  boardId: 'ad_request',
  postId: 12,
  title: '가을 행사 광고',
  status: '검토',
  tone: 'pending',
  advertiser: '예시 상점',
  startDate: '2026-11-01',
  endDate: '2026-11-15',
  position: '프리롤',
  impressions: 20000,
  createdAt: '2026-10-20T00:12:00Z',
  comments: 2,
  hasMedia: true,
  secret: false,
  url: '/bbs/board.php?bo_table=ad_request&wr_id=12',
};

const COUNTS = { all: 3, 접수: 1, 검토: 2, '보완 요청': 0, '집행 예정': 0, 집행: 0, 종료: 0, 반려: 0 };

function list(items: readonly object[] = [ITEM], total = items.length) {
  return ok({
    boards: [{ boardId: 'ad_request', name: '광고 요청' }],
    stages: [],
    counts: COUNTS,
    items,
    page: 1,
    perPage: 20,
    total,
    masked: false,
  });
}

function detail(masked: boolean) {
  return ok({
    request: {
      ...ITEM,
      boardName: '광고 요청',
      updatedAt: '2026-10-20T00:12:00Z',
      clickUrl: 'https://shop.test/',
      mediaUrl: null,
      contact: masked ? '010-****-**12' : '010-1234-5612',
      targetBoard: { boardId: 'free', name: '자유게시판' },
      extra: {},
      author: masked
        ? { name: '홍', memberId: null, email: null }
        : { name: '홍길동', memberId: 'hong', email: 'h@x.test' },
      content: '첫 줄\n<b>굵게</b>',
      files: [{ name: 'banner.png', kind: 'image', size: 1000, url: '/data/file/banner.png', media: true }],
      history: [
        { commentId: 1, createdAt: '2026-10-20T01:00:00Z', author: '관리자', status: '검토', content: '검토할게요.' },
        { commentId: 2, createdAt: '2026-10-21T01:00:00Z', author: '관리자', status: null, content: '자료 받았어요.' },
      ],
    },
    masked,
  });
}

function serve(handlers: Record<string, Handler>, canWrite = true) {
  const fetch = vi.fn(async (input: string, init: RequestInit = {}) => {
    const url = new URL(input);
    const action = url.searchParams.get('action') ?? '';
    const handler = new Map<string, Handler>(
      Object.entries({ bootstrap: () => ok(bootstrap(canWrite)), creatives: () => ok({ items: [] }), ...handlers })
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

async function open() {
  history.replaceState(null, '', '/#/requests');
  render(<App api={new AdminApi('http://admin.test/ads/api/index.php')} publicBase="/ads/" />);
  await screen.findByRole('heading', { level: 1, name: '광고 요청' }, LOAD_WAIT);
}

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

describe('RequestsScreen', () => {
  it('lists requests with stage counts and filters by stage and search', async () => {
    const fetch = serve({ 'ad-requests': () => list() });

    await open();

    const table = await screen.findByRole('table', { name: '광고 요청 목록' }, LOAD_WAIT);

    expect(within(table).getByText('가을 행사 광고')).toBeTruthy();
    expect(within(table).getByText('예시 상점')).toBeTruthy();
    expect(within(table).getByText('2026-11-01 – 2026-11-15')).toBeTruthy();
    expect(within(table).getByText('20,000')).toBeTruthy();
    expect(screen.getByRole('button', { name: /^전체\s*3$/u }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByText('목업 · 아직 동작하지 않아요')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /^검토\s*2$/u }));
    await waitFor(() => expect(calls(fetch, 'ad-requests').at(-1)?.searchParams.get('status')).toBe('검토'));

    fireEvent.change(screen.getByRole('searchbox', { name: '제목이나 광고주 검색' }), { target: { value: '가을' } });
    fireEvent.submit(screen.getByRole('search', { name: '광고 요청 검색' }));

    await waitFor(() => expect(calls(fetch, 'ad-requests').at(-1)?.searchParams.get('query')).toBe('가을'));
    expect(calls(fetch, 'ad-requests').at(-1)?.searchParams.get('status')).toBe('검토');
    expect(calls(fetch, 'ad-requests').at(-1)?.searchParams.get('page')).toBe('1');
  });

  it('tells a failed load apart and loads again on request', async () => {
    let fail = true;

    serve({
      'ad-requests': () =>
        fail
          ? { status: 500, body: { ok: false, error: { code: 'server', message: '잠시 뒤 다시 시도해 주세요.' } } }
          : list(),
    });
    await open();

    expect(await screen.findByText('광고 요청을 불러오지 못했어요.', undefined, LOAD_WAIT)).toBeTruthy();

    fail = false;
    fireEvent.click(screen.getByRole('button', { name: '다시 불러오기' }));

    expect(await screen.findByText('가을 행사 광고')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '다시 불러오기' })).toBeNull();
  });

  it('opens a request with its content as text, media, history and the board link', async () => {
    const fetch = serve({ 'ad-requests': () => list(), 'ad-request': () => detail(false) });

    await open();
    fireEvent.click(await screen.findByRole('button', { name: '요청 12 열기' }, LOAD_WAIT));

    const dialog = await screen.findByRole('dialog', { name: '가을 행사 광고' });

    await within(dialog).findByRole('table', { name: '요청서' });
    expect(calls(fetch, 'ad-request')[0]?.searchParams.get('boardId')).toBe('ad_request');
    expect(calls(fetch, 'ad-request')[0]?.searchParams.get('postId')).toBe('12');
    expect(within(dialog).getByText('010-1234-5612')).toBeTruthy();
    expect(within(dialog).getByText('홍길동 (hong)')).toBeTruthy();
    // Plain text: the tag shows as typed and no element is made from it.
    expect(within(dialog).getByText(/<b>굵게<\/b>/u)).toBeTruthy();
    expect(dialog.querySelector('.aa-pre b')?.textContent).not.toBe('굵게');
    expect(within(dialog).getByRole('img', { name: 'banner.png' }).getAttribute('src')).toBe('/data/file/banner.png');

    const log = within(dialog).getByRole('list', { name: '처리 기록 (오래된 순)' });

    expect(
      within(log)
        .getAllByRole('listitem')
        .map((item) => item.textContent)
    ).toEqual([expect.stringContaining('검토할게요.'), expect.stringContaining('자료 받았어요.')]);

    const board = within(dialog).getByRole('link', { name: '게시판에서 열기 (새 창)' });

    expect(board.getAttribute('href')).toBe(ITEM.url);
    expect(board.getAttribute('target')).toBe('_blank');
    expect(board.getAttribute('rel')).toContain('noopener');
    expect(within(dialog).getByText(/상태 바꾸기와 답변은 게시판에서 해요\./u)).toBeTruthy();
    expect(within(dialog).queryByText('읽기 전용 계정이라 연락처를 가렸어요.')).toBeNull();
  });

  it('notes the masked contact for a read-only account', async () => {
    serve({ 'ad-requests': () => list(), 'ad-request': () => detail(true) }, false);

    await open();
    fireEvent.click(await screen.findByRole('button', { name: '요청 12 열기' }, LOAD_WAIT));

    const dialog = await screen.findByRole('dialog', { name: '가을 행사 광고' });

    expect(await within(dialog).findByText('읽기 전용 계정이라 연락처를 가렸어요.')).toBeTruthy();
    expect(within(dialog).getByText('010-****-**12')).toBeTruthy();
    expect(within(dialog).queryByText('h@x.test')).toBeNull();
  });
});

describe('period', () => {
  it('reads either end alone', () => {
    expect(period({ startDate: '2026-11-01', endDate: null })).toBe('2026-11-01부터');
    expect(period({ startDate: null, endDate: '2026-11-15' })).toBe('2026-11-15까지');
    expect(period({ startDate: null, endDate: null })).toBe('—');
  });
});
