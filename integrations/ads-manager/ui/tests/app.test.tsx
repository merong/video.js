// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import type { Bootstrap } from '../src/api/actions';
import { AdminApi, ApiError } from '../src/api/client';
import { App } from '../src/app/App';
import { publicBase, readConfig } from '../src/app/config';
import { defaultRoute, locationFromHash, routeFromHash, routesFor } from '../src/app/routes';
import { describeError } from '../src/app/status';
import { DEFAULT_PLAYER_PRESET } from '../src/player';
import { siteToday } from '../src/screens/StatsScreen';

interface Reply {
  status?: number;
  body: unknown;
  /** Anything but JSON is sent as `String(body)`. */
  contentType?: string;
}

type Handler = (url: URL, init: RequestInit) => Reply | Promise<Reply>;

function bootstrap(host: 'standalone' | 'gnuboard', authenticated = true): Bootstrap {
  return {
    authenticated,
    csrfToken: 'token-1',
    capabilities: {
      host,
      manualTargets: host === 'standalone',
      uploads: true,
      loginUrl: host === 'gnuboard' ? '/bbs/login.php' : null,
      siteUrl: host === 'gnuboard' ? 'https://site.test/' : null,
      adminUrl: host === 'gnuboard' ? 'https://site.test/adm/' : null,
    },
    site: { siteId: 'site-1', timeZone: 'Asia/Seoul' },
    playerModuleUrl: '/assets/ads.js',
    limits: { uploadBytes: 8 * 1024 * 1024 },
    user: { displayName: '운영자' },
  };
}

/** With `rotate`, response n (1-based) carries `X-CSRF-Token: rotated-n`, like GnuBoard's single-use admin tokens. */
function serve(handlers: Record<string, Handler>, { rotate = false } = {}) {
  let responses = 0;
  const fetch = vi.fn(async (input: string, init: RequestInit = {}) => {
    const url = new URL(input);
    const action = url.searchParams.get('action') ?? '';
    const handler = handlers[action];
    if (!handler) throw new Error(`unexpected action ${action}`);

    const { status = 200, body, contentType = 'application/json' } = await handler(url, init);
    const headers = new Headers({ 'Content-Type': contentType });

    responses += 1;

    if (rotate) headers.set('X-CSRF-Token', `rotated-${responses}`);

    const text = contentType === 'application/json' ? JSON.stringify(body) : String(body);

    return new Response(text, { status, headers });
  });

  vi.stubGlobal('fetch', fetch);
  return fetch;
}

function request(fetch: ReturnType<typeof serve>, action: string, nth = 0) {
  const call = fetch.mock.calls.filter(([input]) => new URL(input).searchParams.get('action') === action)[nth];
  if (!call) throw new Error(`no ${action} request #${nth}`);

  const [input, init = {}] = call;

  return {
    url: new URL(input),
    token: new Headers(init.headers).get('X-CSRF-Token'),
    body: init.body ? JSON.parse(String(init.body)) : undefined,
  };
}

function navigate(id: string) {
  act(() => {
    location.hash = `#/${id}`;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}

const ok = (data: unknown) => ({ body: { ok: true, data } });

function actions(fetch: ReturnType<typeof serve>): string[] {
  return fetch.mock.calls.map(([input]) => new URL(input).searchParams.get('action') ?? '');
}

function renderApp() {
  return render(<App api={new AdminApi('http://admin.test/ads/api/index.php')} publicBase="/ads/" />);
}

beforeEach(() => {
  history.replaceState(null, '', '/');
});

afterEach(cleanup);

describe('routesFor', () => {
  it('lists the canvas menus for each host', () => {
    const labels = (host: 'standalone' | 'gnuboard') =>
      routesFor(host)
        .filter((route) => route.nav)
        .map((route) => route.label);

    expect(labels('standalone')).toEqual([
      '대시보드',
      '캠페인',
      '소재',
      '지면 편성',
      '플레이어',
      '강의',
      '승인함',
      '리포트',
      '설정',
    ]);
    expect(labels('gnuboard')).toEqual(['광고 요청', '하우스 광고', '지면 편성', '플레이어 설정', '통계', '설정']);
  });

  it('groups the menus under section labels', () => {
    const groups = (host: 'standalone' | 'gnuboard') => [
      ...new Set(
        routesFor(host)
          .filter((route) => route.nav)
          .map((route) => route.group)
      ),
    ];

    expect(groups('standalone')).toEqual(['개요', '광고', '플레이어', '운영', '시스템']);
    expect(groups('gnuboard')).toEqual(['광고', '플레이어', '분석', '시스템']);
  });

  it('opens the one player setting for old #/players sub pages and has no lectures on gnuboard', () => {
    const routes = routesFor('gnuboard');

    expect(locationFromHash('#/players/setup', routes, defaultRoute('gnuboard'))).toEqual({ id: 'players', path: '' });
    expect(locationFromHash('#/players/edit/p1', routes, defaultRoute('gnuboard'))).toEqual({
      id: 'players',
      path: '',
    });
    expect(routeFromHash('#/lms/progress', routes, defaultRoute('gnuboard'))).toBe('house');
  });

  it('falls back to the default route for an unknown hash', () => {
    const routes = routesFor('gnuboard');

    expect(routeFromHash('#/schedule', routes, defaultRoute('gnuboard'))).toBe('schedule');
    expect(routeFromHash('#/dashboard', routes, defaultRoute('gnuboard'))).toBe('house');
  });
});

describe('publicBase', () => {
  it('keeps the installation prefix', () => {
    expect(publicBase('/ads/api/index.php')).toBe('/ads/');
    expect(publicBase('https://cdn.example/x/api/index.php?debug=1')).toBe('https://cdn.example/x/');
  });
});

describe('readConfig', () => {
  it('accepts the shell config and rejects unsafe API URLs', () => {
    const element = document.createElement('script');

    element.textContent = '{"apiUrl":"/api/index.php","assetUrl":"/assets/admin-app/"}';
    expect(readConfig(element)).toEqual({ apiUrl: '/api/index.php', assetUrl: '/assets/admin-app/' });

    element.textContent = '{"apiUrl":"javascript:alert(1)"}';
    expect(() => readConfig(element)).toThrow();
    expect(() => readConfig(null)).toThrow();
  });
});

describe('describeError', () => {
  it('separates conflicts and authentication failures and appends field messages', () => {
    expect(describeError(new ApiError('stale', 409))).toMatchObject({ conflict: true, auth: false });
    expect(describeError(new ApiError('expired', 401))).toMatchObject({ conflict: false, auth: true });

    const report = describeError(
      new ApiError('입력을 확인해 주세요.', 422, 'VALIDATION', { name: '이름이 필요해요.', n: 1 })
    );

    expect(report.message).toEqual({ text: '입력을 확인해 주세요. 이름이 필요해요.', error: true });
  });

  it('says a field message that repeats the summary only once and keeps it by path', () => {
    const report = describeError(
      new ApiError('영상 ID를 확인해 주세요.', 422, 'validation', {
        'target.id': '영상 ID를 확인해 주세요.',
        name: '이름이 필요해요.',
        label: '이름이 필요해요.',
      })
    );

    expect(report.message.text).toBe('영상 ID를 확인해 주세요. 이름이 필요해요.');
    expect(report.fields).toEqual({
      'target.id': '영상 ID를 확인해 주세요.',
      name: '이름이 필요해요.',
      label: '이름이 필요해요.',
    });
  });
});

describe('siteToday', () => {
  it('uses the site time zone', () => {
    const now = new Date('2026-10-19T16:30:00Z');

    expect(siteToday('Asia/Seoul', now)).toBe('2026-10-20');
    expect(siteToday('UTC', now)).toBe('2026-10-19');
  });
});

describe('App', () => {
  it('shows the standalone login form when signed out', async () => {
    serve({ bootstrap: () => ok(bootstrap('standalone', false)) });
    renderApp();

    expect(await screen.findByRole('heading', { name: '관리자 로그인' })).toBeTruthy();
    expect(screen.getByLabelText('아이디')).toBeTruthy();
    expect(screen.getByLabelText('비밀번호')).toBeTruthy();
  });

  it('says the username or password is wrong for a rejected login (QA B01)', async () => {
    serve({
      bootstrap: () => ok(bootstrap('standalone', false)),
      login: () => ({
        status: 401,
        body: {
          ok: false,
          error: { code: 'invalid_login', message: '아이디 또는 비밀번호를 확인해 주세요.', fields: {} },
        },
      }),
    });
    renderApp();

    fireEvent.change(await screen.findByLabelText('아이디'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: '로그인' }));

    expect(await screen.findByText('아이디나 비밀번호가 맞지 않아요. 다시 입력해 주세요.')).toBeTruthy();
    expect(screen.queryByText(/로그인이 만료됐어요/u)).toBeNull();
    expect(screen.queryByRole('button', { name: '연결 다시 확인' })).toBeNull();
  });

  it('links to the site login on GnuBoard instead of asking for a password', async () => {
    serve({ bootstrap: () => ok(bootstrap('gnuboard', false)) });
    renderApp();

    const link = await screen.findByRole('link', { name: '사이트 관리자 로그인' });

    expect(link.getAttribute('href')).toBe('/bbs/login.php');
    expect(screen.queryByLabelText('비밀번호')).toBeNull();
  });

  it('renders the GnuBoard menu, lands on house ads and keeps mocks off the API', async () => {
    const fetch = serve({ bootstrap: () => ok(bootstrap('gnuboard')), creatives: () => ok({ items: [] }) });

    renderApp();

    const nav = await screen.findByRole('navigation', { name: '광고 관리 메뉴' });

    expect(within(nav).getByRole('link', { name: '하우스 광고' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: '사이트 보기' }).getAttribute('href')).toBe('https://site.test/');
    expect(screen.getByRole('link', { name: '관리자' }).getAttribute('href')).toBe('https://site.test/adm/');
    // Not opened from the site, so the window cannot close itself.
    expect(screen.queryByRole('button', { name: '광고 관리 창 닫기' })).toBeNull();

    location.hash = '#/requests';
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    expect(await screen.findByText('목업 · 아직 동작하지 않아요')).toBeTruthy();
    expect(actions(fetch)).toEqual(['bootstrap', 'creatives']);
  });

  it('opens 집행 만들기 from the top bar as a mock screen without API requests (QA B12)', async () => {
    const fetch = serve({ bootstrap: () => ok(bootstrap('standalone')) });

    history.replaceState(null, '', '/#/dashboard');
    renderApp();
    fireEvent.click(await screen.findByRole('link', { name: '집행 만들기' }));

    const heading = await screen.findByRole('heading', { level: 1, name: '집행 만들기' });

    expect(location.hash).toBe('#/new-line-item');
    expect(screen.getByRole('link', { name: '집행 만들기' }).getAttribute('aria-current')).toBe('page');
    expect(heading.parentElement?.textContent).toContain('목업 · 아직 동작하지 않아요');
    // Give any request an effect would start a chance to show up.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(actions(fetch)).toEqual(['bootstrap']);
  });

  it('groups the GnuBoard side menu under section labels', async () => {
    serve({ bootstrap: () => ok(bootstrap('gnuboard')), creatives: () => ok({ items: [] }) });
    renderApp();

    const nav = await screen.findByRole('navigation', { name: '광고 관리 메뉴' });
    const links = (group: string) =>
      within(within(nav).getByRole('list', { name: group }))
        .getAllByRole('link')
        .map((link) => link.textContent);

    expect(links('광고')).toEqual(['광고 요청', '하우스 광고', '지면 편성']);
    expect(links('플레이어')).toEqual(['플레이어 설정']);
    expect(links('분석')).toEqual(['통계']);
    expect(links('시스템')).toEqual(['설정']);
    expect(nav.querySelectorAll('a > svg[aria-hidden="true"]')).toHaveLength(6);
    // The menu is in the side bar, and wide windows have no menu button.
    expect(within(screen.getByRole('banner')).queryByRole('navigation')).toBeNull();
    expect(screen.queryByRole('button', { name: '메뉴 열기' })).toBeNull();
  });

  it('turns the side menu into a drawer below 960px', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(max-width: 960px)',
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));

    try {
      serve({ bootstrap: () => ok(bootstrap('gnuboard')), creatives: () => ok({ items: [] }) });
      renderApp();

      const button = await screen.findByRole('button', { name: '메뉴 열기' });
      const side = document.getElementById('aa-side');
      if (!side) throw new Error('no side menu');

      const isOpen = () => side.classList.contains('is-open');

      expect(button.getAttribute('aria-controls')).toBe('aa-side');
      expect(button.getAttribute('aria-expanded')).toBe('false');
      expect(isOpen()).toBe(false);

      // Opening focuses the current menu and makes the page behind it inert.
      fireEvent.click(button);

      expect(isOpen()).toBe(true);
      expect(button.getAttribute('aria-expanded')).toBe('true');
      expect(document.activeElement).toBe(within(side).getByRole('link', { name: '하우스 광고' }));
      expect(button.closest('[inert]')).not.toBeNull();

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(isOpen()).toBe(false);
      expect(button.closest('[inert]')).toBeNull();
      expect(document.activeElement).toBe(button);

      fireEvent.click(button);
      fireEvent.click(within(side).getByRole('button', { name: '메뉴 닫기' }));

      expect(isOpen()).toBe(false);
      expect(document.activeElement).toBe(button);

      // Following a menu link closes the drawer.
      fireEvent.click(button);
      fireEvent.click(within(side).getByRole('link', { name: '설정' }));

      expect(isOpen()).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('offers 광고 관리 창 닫기 on GnuBoard only when an opener window exists (QA U06)', async () => {
    const close = vi.spyOn(window, 'close').mockImplementation(() => {});

    vi.stubGlobal('opener', window);

    try {
      serve({ bootstrap: () => ok(bootstrap('gnuboard')), creatives: () => ok({ items: [] }) });
      renderApp();
      fireEvent.click(await screen.findByRole('button', { name: '광고 관리 창 닫기' }));
      expect(close).toHaveBeenCalledTimes(1);

      // A standalone install never closes its own window, opener or not.
      cleanup();
      serve({ bootstrap: () => ok(bootstrap('standalone')), creatives: () => ok({ items: [] }) });
      renderApp();
      expect(await screen.findByRole('button', { name: '로그아웃' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: '광고 관리 창 닫기' })).toBeNull();
    } finally {
      vi.unstubAllGlobals();
      close.mockRestore();
    }
  });

  it('keeps the editor and offers a reload after a 409 on save', async () => {
    const draft = { target: { type: 'site', id: 'site-1' }, mode: 'replace', revision: 2, breaks: [] };
    const fetch = serve({
      bootstrap: () => ok(bootstrap('standalone')),
      creatives: () => ok({ items: [] }),
      'schedule-draft': () => ok({ draft, publishedVersion: 4, resolvedFrom: { type: 'site', id: 'site-1' } }),
      'schedule-save': () => ({ status: 409, body: { ok: false, error: { code: 'CONFLICT', message: 'stale' } } }),
    });

    history.replaceState(null, '', '/#/schedule');
    renderApp();

    fireEvent.click(await screen.findByRole('button', { name: '편성 불러오기' }));
    expect(await screen.findByText('게시 v4')).toBeTruthy();

    const mode = screen.getByLabelText<HTMLSelectElement>('이 대상의 광고');

    fireEvent.change(mode, { target: { value: 'disabled' } });
    fireEvent.click(screen.getByRole('button', { name: '초안 저장' }));

    expect(await screen.findByRole('button', { name: '서버 초안 다시 불러오기' })).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('다른 곳에서 초안이 변경됐어요');
    // The edit that hit the conflict is still on screen and still unsaved.
    expect(mode.value).toBe('disabled');
    expect(screen.getByText('저장하지 않은 변경')).toBeTruthy();

    const save = request(fetch, 'schedule-save');

    expect(save.token).toBe('token-1');
    expect(save.body).toMatchObject({ mode: 'disabled', revision: 2 });
    await waitFor(() => expect(actions(fetch).filter((action) => action === 'schedule-save')).toHaveLength(1));
  });

  async function editLoadedSchedule() {
    const draft = { target: { type: 'site', id: 'site-1' }, mode: 'replace', revision: 2, breaks: [] };
    const fetch = serve({
      bootstrap: () => ok(bootstrap('standalone')),
      creatives: () => ok({ items: [] }),
      'schedule-draft': () => ok({ draft, publishedVersion: 4, resolvedFrom: { type: 'site', id: 'site-1' } }),
    });

    history.replaceState(null, '', '/#/schedule');
    renderApp();

    const load = await screen.findByRole('button', { name: '편성 불러오기' });

    fireEvent.click(load);
    expect(await screen.findByText('게시 v4')).toBeTruthy();

    const mode = screen.getByLabelText<HTMLSelectElement>('이 대상의 광고');

    fireEvent.change(mode, { target: { value: 'disabled' } });
    expect(await screen.findByText('저장하지 않은 변경')).toBeTruthy();

    load.focus();
    fireEvent.click(load);

    const dialog = await screen.findByRole('dialog', { name: '편집 내용을 버릴까요?' });

    return { fetch, load, mode, dialog };
  }

  const draftLoads = (fetch: ReturnType<typeof serve>) =>
    actions(fetch).filter((action) => action === 'schedule-draft').length;

  it('keeps unsaved edits and returns focus when the discard dialog is cancelled', async () => {
    const { fetch, load, mode, dialog } = await editLoadedSchedule();
    const buttons = within(dialog).getAllByRole('button');

    // The dialog's footer is [취소, 불러오기] after the header 닫기 button.
    fireEvent.click(buttons.at(-2)!);

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(load);
    expect(mode.value).toBe('disabled');
    expect(screen.getByText('저장하지 않은 변경')).toBeTruthy();
    expect(draftLoads(fetch)).toBe(1);
  });

  it('treats Esc on the discard dialog as cancel', async () => {
    const { fetch, load, mode, dialog } = await editLoadedSchedule();
    const cancel = new Event('cancel', { cancelable: true });

    // Esc fires `cancel` on a modal dialog.
    dialog.dispatchEvent(cancel);

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(cancel.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(load);
    expect(mode.value).toBe('disabled');
    expect(draftLoads(fetch)).toBe(1);
  });

  it('reloads the draft after the discard dialog is confirmed with the danger action', async () => {
    const { fetch, mode, dialog } = await editLoadedSchedule();
    const reload = within(dialog).getByRole('button', { name: '불러오기' });

    expect(reload.classList.contains('is-danger')).toBe(true);

    fireEvent.click(reload);

    await waitFor(() => expect(draftLoads(fetch)).toBe(2));
    await waitFor(() => expect(mode.value).toBe('replace'));
    expect(screen.queryByText('저장하지 않은 변경')).toBeNull();
  });
});

function adItem(itemId: string) {
  return {
    itemId,
    adId: 'cr-1',
    creativeId: 'cr-1',
    creativeVersion: 1,
    kind: 'video',
    url: '/media/ad.mp4',
    mime: 'video/mp4',
    alt: '',
    clickUrl: null,
    skipAfterSeconds: null,
  };
}

const PRESET_LIST = {
  revision: 1,
  defaultPresetId: 'default',
  presets: [{ ...DEFAULT_PLAYER_PRESET, builtIn: true, createdAt: null, updatedAt: null }],
};

const PRE_DRAFT = {
  target: { type: 'site', id: 'site-1' },
  mode: 'replace',
  revision: 2,
  breaks: [{ breakId: 'break-1', position: 'pre', ads: [adItem('item-1')] }],
};

/** Opens 지면 편성 and loads `draft`; `handlers` add to or replace the defaults. */
async function openSchedule(draft: unknown, handlers: Record<string, Handler> = {}, options = {}) {
  const fetch = serve(
    {
      bootstrap: () => ok(bootstrap('standalone')),
      creatives: () => ok({ items: [] }),
      'schedule-draft': () => ok({ draft, publishedVersion: 4, resolvedFrom: { type: 'site', id: 'site-1' } }),
      'player-presets': () => ok(PRESET_LIST),
      ...handlers,
    },
    options
  );

  history.replaceState(null, '', '/#/schedule');
  renderApp();
  fireEvent.click(await screen.findByRole('button', { name: '편성 불러오기' }));
  expect(await screen.findByText('게시 v4')).toBeTruthy();
  return fetch;
}

describe('App flows', () => {
  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  });

  it('keeps unsaved input across menu changes', async () => {
    serve({ bootstrap: () => ok(bootstrap('standalone')), creatives: () => ok({ items: [] }) });
    renderApp();

    fireEvent.change(await screen.findByLabelText('소재 이름'), { target: { value: '가을 캠페인' } });
    navigate('schedule');
    expect(await screen.findByRole('button', { name: '편성 불러오기' })).toBeTruthy();
    navigate('creatives');

    expect(screen.getByLabelText<HTMLInputElement>('소재 이름').value).toBe('가을 캠페인');
  });

  it('opens the default menu and rewrites an unknown hash', async () => {
    serve({ bootstrap: () => ok(bootstrap('standalone')), creatives: () => ok({ items: [] }) });
    history.replaceState(null, '', '/#/no-such-menu');
    renderApp();

    expect((await screen.findByRole('link', { name: '소재' })).getAttribute('aria-current')).toBe('page');
    // The workspace mounts after the bootstrap fetch, outside act(); it rewrites the hash in a passive effect.
    await waitFor(() => expect(location.hash).toBe('#/creatives'));
  });

  it('asks before signing out with unsaved input, and cancel keeps everything', async () => {
    let signedIn = true;
    const fetch = serve({
      bootstrap: () => ok(bootstrap('standalone', signedIn)),
      creatives: () => ok({ items: [] }),
      logout: () => {
        signedIn = false;
        return ok({});
      },
    });

    renderApp();
    fireEvent.change(await screen.findByLabelText('소재 이름'), { target: { value: '미저장' } });

    const logoutButton = screen.getByRole('button', { name: '로그아웃' });

    logoutButton.focus();
    fireEvent.click(logoutButton);

    const cancelled = await screen.findByRole('dialog', { name: '로그아웃할까요?' });

    fireEvent.click(within(cancelled).getAllByRole('button', { name: '취소' }).at(-1)!);

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(logoutButton);
    expect(actions(fetch)).not.toContain('logout');
    expect(screen.getByLabelText<HTMLInputElement>('소재 이름').value).toBe('미저장');

    fireEvent.click(logoutButton);

    const confirmed = await screen.findByRole('dialog', { name: '로그아웃할까요?' });
    const accept = within(confirmed).getByRole('button', { name: '로그아웃' });

    expect(accept.classList.contains('is-danger')).toBe(true);
    fireEvent.click(accept);

    expect(await screen.findByRole('heading', { name: '관리자 로그인' })).toBeTruthy();
    expect(actions(fetch).filter((action) => action === 'logout')).toHaveLength(1);
  });

  it('disables sign-out while an operation is running', async () => {
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });

    serve({
      bootstrap: () => ok(bootstrap('standalone')),
      creatives: () => ok({ items: [] }),
      'schedule-draft': async () => {
        await held;
        return ok({ draft: PRE_DRAFT, publishedVersion: 4, resolvedFrom: null });
      },
    });
    history.replaceState(null, '', '/#/schedule');
    renderApp();
    fireEvent.click(await screen.findByRole('button', { name: '편성 불러오기' }));

    const logoutButton = await screen.findByRole('button', { name: '로그아웃' });

    await waitFor(() => expect(logoutButton.hasAttribute('disabled')).toBe(true));
    expect(screen.getByText('처리 중인 작업이 끝나면 로그아웃할 수 있어요.')).toBeTruthy();

    release();

    expect(await screen.findByText('게시 v4')).toBeTruthy();
    expect(screen.getByRole('button', { name: '로그아웃' }).hasAttribute('disabled')).toBe(false);
  });

  it('publishes after confirmation and reports a failed reload of the new draft', async () => {
    let loads = 0;
    const fetch = await openSchedule(PRE_DRAFT, {
      'schedule-draft': () => {
        loads += 1;
        return loads === 1
          ? ok({ draft: PRE_DRAFT, publishedVersion: 4, resolvedFrom: null })
          : { status: 500, body: { ok: false, error: { code: 'SERVER', message: '잠시 뒤 다시 시도해 주세요.' } } };
      },
      'schedule-publish': () => ok({ scheduleId: 'sch-1', scheduleVersion: 5 }),
    });

    fireEvent.click(screen.getByRole('button', { name: '저장한 초안 게시' }));

    const dialog = await screen.findByRole('dialog', { name: '초안 r2을 게시할까요?' });
    const publish = within(dialog).getByRole('button', { name: '게시' });

    expect(publish.classList.contains('is-primary')).toBe(true);
    fireEvent.click(publish);

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain(
        '게시 v5은 완료됐지만 최신 초안을 다시 읽지 못했어요. 연결을 확인하고 다시 불러와 주세요.'
      )
    );
    expect(screen.getByText('게시 v5')).toBeTruthy();
    expect(request(fetch, 'schedule-publish').body).toEqual({ target: PRE_DRAFT.target, revision: 2 });
    expect(loads).toBe(2);
  });

  it('saves the statistics CSV as a Blob with a dated file name and revokes its URL', async () => {
    const originals = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };
    const created: Blob[] = [];
    const revoke = vi.fn((_url: string) => {});
    const saved: { href: string | null; download: string }[] = [];

    URL.createObjectURL = (blob: Blob) => {
      created.push(blob);
      return 'blob:stats';
    };
    URL.revokeObjectURL = revoke;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      saved.push({ href: this.getAttribute('href'), download: this.download });
    });

    try {
      const fetch = serve({
        bootstrap: () => ok(bootstrap('gnuboard')),
        creatives: () => ok({ items: [] }),
        'stats-csv': () => ({ body: 'adId,starts\ncr-1,3\n', contentType: 'text/csv' }),
      });

      history.replaceState(null, '', '/#/stats');
      renderApp();
      fireEvent.change(await screen.findByLabelText('시작일'), { target: { value: '2026-10-01' } });
      fireEvent.change(screen.getByLabelText('종료일'), { target: { value: '2026-10-20' } });
      fireEvent.change(screen.getByLabelText('광고 ID'), { target: { value: ' cr-1 ' } });
      fireEvent.click(screen.getByRole('button', { name: '현재 조건 CSV 다운로드' }));

      expect(await screen.findByText(/CSV 다운로드를 요청했어요/)).toBeTruthy();
      expect(created).toHaveLength(1);
      expect(created[0]?.type).toBe('text/csv');
      expect(created[0]?.size).toBe('adId,starts\ncr-1,3\n'.length);
      expect(saved).toEqual([{ href: 'blob:stats', download: 'ads-2026-10-01-2026-10-20.csv' }]);

      const { url } = request(fetch, 'stats-csv');

      expect(Object.fromEntries(url.searchParams)).toEqual({
        action: 'stats-csv',
        from: '2026-10-01',
        to: '2026-10-20',
        adId: 'cr-1',
      });
      // The download needs the URL a moment longer; it is revoked after that.
      await waitFor(() => expect(revoke).toHaveBeenCalledWith('blob:stats'), { timeout: 2000 });
    } finally {
      URL.createObjectURL = originals.create;
      URL.revokeObjectURL = originals.revoke;
    }
  });

  it('sends the editor schedule to schedule-preview and plays it in the preview frame', async () => {
    const fetch = await openSchedule(PRE_DRAFT, {
      'schedule-preview': () =>
        ok({
          schedule: {
            videoId: 'vid-1',
            breaks: [{ breakId: 'break-1', position: 'pre', ads: [{ itemId: 'item-1' }] }],
          },
        }),
    });

    fireEvent.change(screen.getByLabelText('고정 영상 ID'), { target: { value: 'vid-1' } });
    fireEvent.click(screen.getByRole('button', { name: '미리보기 준비' }));

    // SAFETY: the title query returns the preview iframe.
    const frame = (await screen.findByTitle('플레이어 미리보기 화면')) as HTMLIFrameElement;
    const post = vi.spyOn(frame.contentWindow!, 'postMessage');

    expect(request(fetch, 'schedule-preview').body).toEqual({
      ...PRE_DRAFT,
      videoId: 'vid-1',
      boardId: null,
      categoryId: null,
    });
    expect(new URL(frame.src).pathname).toBe('/ads/examples/preview.html');

    fireEvent.load(frame);

    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ads-player-preview',
        preset: expect.objectContaining({ id: 'default' }),
        schedule: { videoId: 'vid-1', breaks: [{ breakId: 'break-1', position: 'pre', ads: [{ itemId: 'item-1' }] }] },
        content: `${location.origin}/ads/demo-media/grok-20261018/content-scene-01.mp4`,
      }),
      location.origin
    );
  });

  it('unmounts the preview frame when its menu is left and asks for a new preview on return', async () => {
    await openSchedule(PRE_DRAFT, {
      'schedule-preview': () => ok({ schedule: { videoId: 'vid-1', breaks: [] } }),
    });

    fireEvent.change(screen.getByLabelText('고정 영상 ID'), { target: { value: 'vid-1' } });
    fireEvent.click(screen.getByRole('button', { name: '미리보기 준비' }));
    expect(await screen.findByTitle('플레이어 미리보기 화면')).toBeTruthy();

    navigate('creatives');
    expect(document.querySelector('iframe')).toBeNull();

    navigate('schedule');
    expect(document.querySelector('iframe')).toBeNull();
    expect(screen.getByText('다른 메뉴로 이동해서 미리보기를 멈췄어요. 다시 준비해 주세요.')).toBeTruthy();
    // The draft being edited stays.
    expect(screen.getByText('게시 v4')).toBeTruthy();
  });

  it('hides manual target IDs and the video-context form when the host lists targets', async () => {
    serve({ bootstrap: () => ok(bootstrap('gnuboard')), creatives: () => ok({ items: [] }) });
    history.replaceState(null, '', '/#/schedule');
    renderApp();

    const type = await screen.findByLabelText('적용 단위');

    for (const value of ['board', 'video']) {
      fireEvent.change(type, { target: { value } });
      expect(screen.queryByLabelText('고정 대상 ID')).toBeNull();
      expect(screen.getByLabelText('대상 검색')).toBeTruthy();
    }

    expect(screen.queryByText('독립 설치 영상의 게시판·분류 연결')).toBeNull();
  });

  it('shows manual target IDs and the video-context form on a standalone install', async () => {
    serve({ bootstrap: () => ok(bootstrap('standalone')), creatives: () => ok({ items: [] }) });
    history.replaceState(null, '', '/#/schedule');
    renderApp();

    fireEvent.change(await screen.findByLabelText('적용 단위'), { target: { value: 'video' } });

    expect(screen.getByLabelText('고정 대상 ID')).toBeTruthy();
    expect(screen.getByText('독립 설치 영상의 게시판·분류 연결')).toBeTruthy();
  });

  it('sends each write with the token from the latest response', async () => {
    const saved = { ...PRE_DRAFT, mode: 'disabled', breaks: [], revision: 3 };
    const fetch = await openSchedule(
      PRE_DRAFT,
      {
        'schedule-save': () => ok({ draft: saved, publishedVersion: 4, resolvedFrom: null }),
        'schedule-publish': () => ok({ scheduleId: 'sch-1', scheduleVersion: 5 }),
      },
      { rotate: true }
    );

    fireEvent.change(screen.getByLabelText('이 대상의 광고'), { target: { value: 'disabled' } });
    fireEvent.click(screen.getByRole('button', { name: '초안 저장' }));
    expect(await screen.findByText('저장된 초안 r3')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '저장한 초안 게시' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: '게시' }));
    await waitFor(() => expect(actions(fetch)).toContain('schedule-publish'));

    const writes = fetch.mock.calls
      .map(([input, init], index) => ({ index, init, action: new URL(input).searchParams.get('action') }))
      .filter(({ init }) => init?.method === 'POST');

    expect(writes.map(({ action }) => action)).toEqual(['schedule-save', 'schedule-publish']);

    // Call n (0-based) must reuse the token that response n issued (`rotated-n`).
    for (const { index, init } of writes) {
      expect(new Headers(init?.headers).get('X-CSRF-Token')).toBe(`rotated-${index}`);
    }
  });

  it('moves focus by server IDs that are not valid in a CSS selector', async () => {
    const draft = {
      ...PRE_DRAFT,
      breaks: [
        { breakId: 'b.1: x', position: 'pre', ads: [adItem('i.1 a'), adItem('i:2 b'), adItem('i#3 c')] },
        { breakId: 'm:2.5 y', position: 'mid', atSeconds: 12, ads: [adItem('i.4 d')] },
      ],
    };

    await openSchedule(draft);
    fireEvent.click(screen.getByRole('button', { name: '3번 광고 위로 이동' }));

    await waitFor(() =>
      expect(document.activeElement?.closest('[data-item-id]')?.getAttribute('data-item-id')).toBe('i#3 c')
    );
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '2번 광고 위로 이동' }));
    expect(screen.getByRole('heading', { name: '지면 편성' })).toBeTruthy();
  });

  // Tab, Shift+Tab and a click all move focus to another control; jsdom has no Tab order, so the tests focus it.
  const MID_DRAFT = {
    ...PRE_DRAFT,
    breaks: [
      { breakId: 'mid-1', position: 'mid', atSeconds: 5, ads: [adItem('item-1')] },
      { breakId: 'mid-2', position: 'mid', atSeconds: 30, ads: [adItem('item-2')] },
    ],
  };

  const breakOf = (element: Element) => element.closest('[data-break-id]')?.getAttribute('data-break-id');

  it.each([
    ['the next field (Tab or a click)', (card: HTMLElement) => within(card).getAllByLabelText('클릭 목적지 URL')[0]!],
    [
      'the previous control (Shift+Tab)',
      (card: HTMLElement) => within(card).getByRole('button', { name: '구간 삭제' }),
    ],
  ])('lets focus leave a mid-roll position for %s', async (_, target) => {
    await openSchedule(MID_DRAFT);

    const at = screen.getAllByLabelText('본편 재생 위치 (초)')[0]!;
    const next = target(at.closest<HTMLElement>('[data-break-id]')!);

    act(() => at.focus());
    act(() => next.focus());
    await act(async () => {});

    expect(document.activeElement).toBe(next);

    if (next instanceof HTMLInputElement) fireEvent.change(next, { target: { value: 'https://example.com/a' } });

    expect(document.activeElement).toBe(next);
    expect(at).toHaveProperty('value', '5');
  });

  it('keeps focus on the control it moved to when the mid-roll card re-sorts', async () => {
    await openSchedule(MID_DRAFT);

    const at = screen.getAllByLabelText('본편 재생 위치 (초)')[0]!;
    const card = at.closest<HTMLElement>('[data-break-id]')!;
    const url = within(card).getAllByLabelText('클릭 목적지 URL')[0]!;

    act(() => at.focus());
    fireEvent.change(at, { target: { value: '40' } });
    act(() => url.focus());
    await act(async () => {});

    // The edited break now follows the one at 30 seconds.
    expect(screen.getAllByLabelText('본편 재생 위치 (초)').map((input) => breakOf(input))).toEqual(['mid-2', 'mid-1']);
    expect(document.activeElement).toBe(url);
    fireEvent.change(url, { target: { value: 'https://example.com/a' } });
    expect(document.activeElement).toBe(url);
    expect(at).toHaveProperty('value', '40');
  });

  it.each(['', '0', '-3'])(
    'marks a mid-roll position of "%s" on its field and sends no save (QA B06)',
    async (value) => {
      const fetch = await openSchedule(MID_DRAFT);
      const at = screen.getAllByLabelText('본편 재생 위치 (초)')[0]!;

      fireEvent.change(at, { target: { value } });
      fireEvent.click(screen.getByRole('button', { name: '초안 저장' }));

      await waitFor(() => expect(document.activeElement).toBe(at));
      expect(screen.getByRole('alert').textContent).toBe('저장하지 못했어요. 표시한 항목을 확인해 주세요.');
      expect(at.getAttribute('aria-invalid')).toBe('true');
      expect(document.getElementById(at.getAttribute('aria-describedby') ?? '')?.textContent).toBe(
        '0.01 이상의 초를 숫자로 입력해 주세요. 예: 30'
      );
      expect(actions(fetch)).not.toContain('schedule-save');

      fireEvent.change(at, { target: { value: '12' } });
      expect(at.getAttribute('aria-invalid')).toBeNull();
      expect(at.getAttribute('aria-describedby')).toBeNull();
    }
  );

  it('marks an empty mid-roll position once focus leaves it (QA B06)', async () => {
    await openSchedule(MID_DRAFT);

    const at = screen.getAllByLabelText('본편 재생 위치 (초)')[0]!;

    act(() => at.focus());
    fireEvent.change(at, { target: { value: '' } });
    expect(at.getAttribute('aria-invalid')).toBeNull();

    act(() => screen.getAllByLabelText('클릭 목적지 URL')[0]!.focus());
    await act(async () => {});

    expect(at.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('0.01 이상의 초를 숫자로 입력해 주세요. 예: 30')).toBeTruthy();
  });

  // The main area is inert while a write runs, and a browser then drops focus to the body. The handlers wait a task, so
  // the inert state renders, and then do the same.
  const dropFocus = async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));

    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  };

  it('returns focus to the publish button after publishing (QA B15)', async () => {
    await openSchedule(PRE_DRAFT, {
      'schedule-publish': async () => {
        await dropFocus();
        return ok({ scheduleId: 'sch-1', scheduleVersion: 5 });
      },
    });

    const publish = screen.getByRole('button', { name: '저장한 초안 게시' });

    act(() => publish.focus());
    fireEvent.click(publish);
    fireEvent.click(
      within(await screen.findByRole('dialog', { name: '초안 r2을 게시할까요?' })).getByRole('button', { name: '게시' })
    );

    expect(await screen.findByText('게시 v5이 적용됐어요. 이미 재생 중인 세션은 기존 편성을 유지해요.')).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: '저장한 초안 게시' })));
  });

  it('moves focus to the page title when the control that started a write is gone', async () => {
    let loads = 0;

    await openSchedule(PRE_DRAFT, {
      'schedule-draft': async () => {
        loads += 1;

        if (loads > 1) await dropFocus();

        return ok({ draft: PRE_DRAFT, publishedVersion: 4, resolvedFrom: null });
      },
      'schedule-save': () => ({ status: 409, body: { ok: false, error: { code: 'CONFLICT', message: 'stale' } } }),
    });
    fireEvent.change(screen.getByLabelText('이 대상의 광고'), { target: { value: 'disabled' } });
    fireEvent.click(screen.getByRole('button', { name: '초안 저장' }));

    const reload = await screen.findByRole('button', { name: '서버 초안 다시 불러오기' });

    act(() => reload.focus());
    fireEvent.click(reload);
    fireEvent.click(
      within(await screen.findByRole('dialog', { name: '편집 내용을 버릴까요?' })).getByRole('button', {
        name: '불러오기',
      })
    );

    expect(await screen.findByText('서버 초안을 다시 불러왔어요.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '서버 초안 다시 불러오기' })).toBeNull();
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: '지면 편성' }))
    );
  });

  const SAVE_FAILURES: [string, Handler, string][] = [
    [
      'a 422',
      () => ({
        status: 422,
        body: {
          ok: false,
          error: { code: 'validation', message: '저장할 수 없는 값이에요.', fields: { url: '주소를 확인해 주세요.' } },
        },
      }),
      '저장할 수 없는 값이에요. 주소를 확인해 주세요.',
    ],
    [
      'a network failure',
      () => {
        throw new TypeError('Failed to fetch');
      },
      '서버에 연결하지 못했어요. 입력은 그대로 남아 있어요.',
    ],
  ];

  const sends = (fetch: ReturnType<typeof serve>, action: string) => actions(fetch).filter((name) => name === action);

  it.each(SAVE_FAILURES)(
    'keeps the schedule input and shows the error after %s on save (QA U04)',
    async (_, reply, text) => {
      const fetch = await openSchedule(PRE_DRAFT, { 'schedule-save': reply });
      const mode = screen.getByLabelText<HTMLSelectElement>('이 대상의 광고');

      fireEvent.change(mode, { target: { value: 'disabled' } });
      fireEvent.click(screen.getByRole('button', { name: '초안 저장' }));

      await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(text));
      expect(mode.value).toBe('disabled');
      expect(screen.getByText('저장하지 않은 변경')).toBeTruthy();
      expect(screen.queryByText(/초안 r\d+을 저장했어요/u)).toBeNull();
      expect(sends(fetch, 'schedule-save')).toHaveLength(1);
    }
  );

  it.each(SAVE_FAILURES)(
    'keeps the creative input and shows the error after %s on URL save (QA U04)',
    async (_, reply, text) => {
      const fetch = serve({
        bootstrap: () => ok(bootstrap('standalone')),
        creatives: () => ok({ items: [] }),
        'creative-save': reply,
      });

      renderApp();

      const name = await screen.findByLabelText<HTMLInputElement>('소재 이름');
      const url = screen.getByLabelText<HTMLInputElement>('소재 URL');

      fireEvent.change(name, { target: { value: '가을 광고' } });
      fireEvent.change(url, { target: { value: '/media/fall.mp4' } });
      fireEvent.click(screen.getByRole('button', { name: '소재 저장' }));

      await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(text));
      expect(name.value).toBe('가을 광고');
      expect(url.value).toBe('/media/fall.mp4');
      expect(screen.queryByText(/소재를 저장했어요/u)).toBeNull();
      expect(sends(fetch, 'creative-save')).toHaveLength(1);
      // A failed save leaves the list as it was.
      expect(sends(fetch, 'creatives')).toHaveLength(1);
    }
  );

  it.each(SAVE_FAILURES)(
    'keeps the chosen file and shows the error after %s on upload (QA U04)',
    async (_, reply, text) => {
      const fetch = serve({
        bootstrap: () => ok(bootstrap('standalone')),
        creatives: () => ok({ items: [] }),
        'creative-upload': reply,
      });
      const file = new File(['ad'], 'fall.mp4', { type: 'video/mp4' });

      renderApp();

      const name = await screen.findByLabelText<HTMLInputElement>('소재 이름');

      fireEvent.change(name, { target: { value: '가을 광고' } });
      fireEvent.change(screen.getByLabelText('등록 방식'), { target: { value: 'upload' } });

      const picker = screen.getByLabelText<HTMLInputElement>('소재 파일');

      fireEvent.change(picker, { target: { files: [file] } });
      // jsdom cannot select a file for the required check; submitting the form skips it.
      fireEvent.submit(picker.form!);

      await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(text));
      expect(name.value).toBe('가을 광고');
      expect(screen.getByLabelText<HTMLInputElement>('소재 파일')).toBe(picker);
      expect(picker.files?.[0]).toBe(file);
      expect(screen.queryByText(/소재를 저장했어요/u)).toBeNull();
      expect(sends(fetch, 'creative-upload')).toHaveLength(1);
      expect(sends(fetch, 'creatives')).toHaveLength(1);
    }
  );

  it('names the saved creative version after the sentence, not before a particle', async () => {
    serve({
      bootstrap: () => ok(bootstrap('standalone')),
      creatives: () => ok({ items: [] }),
      'creative-save': () =>
        ok({
          creative: {
            creativeId: 'cr-2',
            version: 2,
            name: '가을 광고',
            kind: 'video',
            url: '/media/fall.mp4',
            mime: 'video/mp4',
            alt: '',
            source: 'url',
            archived: false,
            createdAt: '2026-10-21T00:00:00Z',
          },
        }),
    });

    renderApp();

    fireEvent.change(await screen.findByLabelText('소재 이름'), { target: { value: '가을 광고' } });
    fireEvent.change(screen.getByLabelText('소재 URL'), { target: { value: '/media/fall.mp4' } });
    fireEvent.click(screen.getByRole('button', { name: '소재 저장' }));

    expect(await screen.findByText('소재를 저장했어요(v2). 편성에서 사용할 버전을 선택해 주세요.')).toBeTruthy();
  });

  it('links GnuBoard site and admin only from safe capability URLs', async () => {
    serve({
      bootstrap: () =>
        ok({
          ...bootstrap('gnuboard'),
          capabilities: { ...bootstrap('gnuboard').capabilities, siteUrl: null, adminUrl: 'javascript:alert(1)' },
        }),
      creatives: () => ok({ items: [] }),
    });
    renderApp();

    expect(await screen.findByRole('navigation', { name: '광고 관리 메뉴' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: '사이트 보기' })).toBeNull();
    expect(screen.queryByRole('link', { name: '관리자' })).toBeNull();
  });

  it('shows a whole first character in the avatar', async () => {
    serve({
      bootstrap: () => ok({ ...bootstrap('standalone'), user: { displayName: '𠀀운영자' } }),
      creatives: () => ok({ items: [] }),
    });
    renderApp();

    expect((await screen.findByRole('img', { name: '𠀀운영자 · 관리자' })).textContent).toBe('𠀀');
  });
});

const BAD_VIDEO_IDS: [string, string][] = [
  ['RLO U+202E', '\u202evid-1'],
  ['C1 NEL U+0085', 'vid\u00851'],
  ['only ideographic spaces', '\u3000\u3000'],
  ['129 characters', 'a'.repeat(129)],
];

/** The error text a control's `aria-describedby` points at. */
function describedError(element: HTMLElement): string {
  const ids = element.getAttribute('aria-describedby')?.split(' ') ?? [];
  const error = ids.find((id) => id.endsWith('-error'));

  return (error && document.getElementById(error)?.textContent) || '';
}

describe('fixed video IDs', () => {
  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  });

  async function chooseVideoTarget(value: string) {
    fireEvent.change(await screen.findByLabelText('적용 단위'), { target: { value: 'video' } });
    fireEvent.change(screen.getByLabelText('고정 대상 ID'), { target: { value } });
    fireEvent.click(screen.getByRole('button', { name: '편성 불러오기' }));
  }

  it.each(BAD_VIDEO_IDS)('blocks a video target ID with %s before loading', async (_name, value) => {
    const fetch = serve({ bootstrap: () => ok(bootstrap('standalone')), creatives: () => ok({ items: [] }) });

    history.replaceState(null, '', '/#/schedule');
    renderApp();
    await chooseVideoTarget(value);

    const field = screen.getByLabelText('고정 대상 ID');

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      '편성을 불러오지 못했어요. 고정 대상 ID를 확인해 주세요.'
    );
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(describedError(field)).toMatch(/영상 ID/u);
    await waitFor(() => expect(document.activeElement).toBe(field));
    expect(actions(fetch)).not.toContain('schedule-draft');

    fireEvent.change(field, { target: { value: 'vid-1' } });
    expect(field.getAttribute('aria-invalid')).toBeNull();
  });

  it('links the server target.id message to the field and says it once', async () => {
    const message = '영상 ID를 확인해 주세요.';
    const fetch = serve({
      bootstrap: () => ok(bootstrap('standalone')),
      creatives: () => ok({ items: [] }),
      'schedule-draft': () => ({
        status: 422,
        body: { ok: false, error: { code: 'validation', message, fields: { 'target.id': message } } },
      }),
    });

    history.replaceState(null, '', '/#/schedule');
    renderApp();
    await chooseVideoTarget('vid-1');

    const field = screen.getByLabelText('고정 대상 ID');

    await waitFor(() => expect(field.getAttribute('aria-invalid')).toBe('true'));
    expect(request(fetch, 'schedule-draft').url.searchParams.get('targetId')).toBe('vid-1');
    expect(describedError(field)).toBe(message);
    expect(screen.getAllByRole('alert').map((alert) => alert.textContent)).toEqual([
      '편성을 불러오지 못했어요. 고정 대상 ID를 확인해 주세요.',
    ]);
    expect(document.body.textContent?.split(message).length).toBe(2);
    await waitFor(() => expect(document.activeElement).toBe(field));
  });

  it.each(BAD_VIDEO_IDS)('blocks the preview and test links for a video ID with %s', async (_name, value) => {
    const fetch = await openSchedule(PRE_DRAFT, {
      'schedule-preview': () => ok({ schedule: { videoId: 'vid-1', breaks: [] } }),
    });
    const field = screen.getByLabelText('고정 영상 ID');

    fireEvent.change(field, { target: { value } });

    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(describedError(field)).toMatch(/영상 ID/u);
    expect(screen.queryByRole('link', { name: /로 재생/u })).toBeNull();
    expect(screen.getByText('고정 영상 ID를 고치면 재생 테스트 링크를 만들어요.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '미리보기 준비' }));

    expect(await screen.findByText('미리보기를 준비하지 못했어요. 고정 영상 ID를 확인해 주세요.')).toBeTruthy();
    expect(document.activeElement).toBe(field);
    expect(actions(fetch)).not.toContain('schedule-preview');

    fireEvent.change(field, { target: { value: 'vid-1' } });
    expect(field.getAttribute('aria-invalid')).toBeNull();
    expect(screen.getAllByRole('link', { name: /로 재생/u })).toHaveLength(2);
  });
});
