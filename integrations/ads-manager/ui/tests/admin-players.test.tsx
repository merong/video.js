/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import type { Bootstrap } from '../src/api/actions';
import { AdminApi } from '../src/api/client';
import { App } from '../src/app/App';
import { locationFromHash, parsePlayerPath, playerHref, routesFor } from '../src/app/routes';
import { DEFAULT_PLAYER_PRESET, helpHref, optionAnchor, type PlayerPreset, playerOptions } from '../src/player';

interface Reply {
  status?: number;
  body: unknown;
}

type Handler = (url: URL, init: RequestInit) => Reply | Promise<Reply>;

/** The parts of an IntersectionObserver entry the preset editor reads; jsdom has no IntersectionObserver. */
interface SeenSection {
  isIntersecting: boolean;
  boundingClientRect: { top: number };
  target: Element;
}

function bootstrap(host: 'standalone' | 'gnuboard', playerModuleUrl: string | null = '/assets/ads.js'): Bootstrap {
  return {
    authenticated: true,
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
    playerModuleUrl,
    limits: { uploadBytes: 8 * 1024 * 1024 },
    user: { displayName: '운영자' },
  };
}

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- any JSON payload the fake API returns.
const ok = (data: unknown): Reply => ({ body: { ok: true, data } });
const fail = (status: number, code: string, fields: Record<string, string> = {}): Reply => ({
  status,
  body: { ok: false, error: { code, message: `server ${code}`, fields } },
});

const BUILT_IN = { ...DEFAULT_PLAYER_PRESET, builtIn: true, createdAt: null, updatedAt: null };
// The other built-ins of schema v2 section 1 and spec A2-E 1.2 (src/PlayerPresets.php).
const FLAT = {
  ...BUILT_IN,
  id: 'flat',
  name: '플랫',
  theme: { ...DEFAULT_PLAYER_PRESET.theme, borderRadius: 0, borderColor: '#00000000' },
};
const ROUNDED = {
  ...BUILT_IN,
  id: 'rounded',
  name: '둥근 테두리',
  theme: { ...DEFAULT_PLAYER_PRESET.theme, borderRadius: 12 },
};
const ACCENT = {
  ...BUILT_IN,
  id: 'accent',
  name: '강조색',
  theme: { ...DEFAULT_PLAYER_PRESET.theme, accentColor: '#2563eb', accentTextColor: '#ffffff' },
  ads: { ...DEFAULT_PLAYER_PRESET.ads, accentColor: '#2563eb' },
};

const LMS = {
  ...BUILT_IN,
  id: 'lms',
  name: '강의',
  controls: { ...DEFAULT_PLAYER_PRESET.controls, seekButtons: 10, captions: true },
  lms: { ...DEFAULT_PLAYER_PRESET.lms, enabled: true },
};

function stored(id: string, name: string, overrides: Partial<PlayerPreset> = {}) {
  return {
    ...DEFAULT_PLAYER_PRESET,
    id,
    name,
    theme: { ...DEFAULT_PLAYER_PRESET.theme, accentColor: '#112233' },
    ...overrides,
    builtIn: false,
    createdAt: '2026-10-20T01:00:00Z',
    updatedAt: '2026-10-20T02:00:00Z',
  };
}

const BRAND = stored('p-brand00001', '브랜드');
const NATIVE = stored('p-native0001', '기본 비디오', { playerType: 'native', theme: DEFAULT_PLAYER_PRESET.theme });

const LIST = {
  revision: 5,
  defaultPresetId: 'default',
  presets: [BUILT_IN, FLAT, ROUNDED, ACCENT, LMS, BRAND, NATIVE],
  migratedNeutral: [],
};

function serve(handlers: Record<string, Handler>, host: 'standalone' | 'gnuboard' = 'standalone', moduleUrl?: null) {
  const fetch = vi.fn(async (input: string, init: RequestInit = {}) => {
    const url = new URL(input);
    const action = url.searchParams.get('action') ?? '';
    const all = new Map<string, Handler>(
      Object.entries({
        bootstrap: () => ok(moduleUrl === null ? bootstrap(host, null) : bootstrap(host)),
        creatives: () => ok({ items: [] }),
        'player-presets': () => ok(LIST),
        ...handlers,
      })
    );
    const handler = all.get(action);
    if (!handler) throw new Error(`unexpected action ${action}`);

    const { status = 200, body } = await handler(url, init);

    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  });

  vi.stubGlobal('fetch', fetch);
  return fetch;
}

function actions(fetch: ReturnType<typeof serve>): string[] {
  return fetch.mock.calls.map(([input]) => new URL(input).searchParams.get('action') ?? '');
}

function sent(fetch: ReturnType<typeof serve>, action: string, nth = 0) {
  const call = fetch.mock.calls.filter(([input]) => new URL(input).searchParams.get('action') === action)[nth];
  if (!call) throw new Error(`no ${action} request #${nth}`);

  return JSON.parse(String(call[1]?.body));
}

function go(hash: string) {
  act(() => {
    location.hash = hash;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}

// The default 1s wait is too short for the first render while every test file runs at once.
const LOAD_WAIT = { timeout: 4000 };

async function open(hash: string) {
  history.replaceState(null, '', `/${hash}`);
  render(<App api={new AdminApi('http://admin.test/ads/api/index.php')} publicBase="/ads/" />);
  await screen.findByRole('heading', { level: 1, name: '플레이어' }, LOAD_WAIT);
  // Saving waits for the preset list (its revision); under load the list can arrive after the first clicks.
  await waitFor(() => expect(document.body.textContent).not.toContain('프리셋 목록을 불러오고 있어요.'), LOAD_WAIT);
}

/** GnuBoard's one player setting; its editor shows once the list is read. */
async function openSettings(hash: string) {
  history.replaceState(null, '', `/${hash}`);
  render(<App api={new AdminApi('http://admin.test/ads/api/index.php')} publicBase="/ads/" />);
  await screen.findByRole('heading', { level: 1, name: '플레이어 설정' }, LOAD_WAIT);
  await screen.findByRole('button', { name: '설정 저장' }, LOAD_WAIT);
}

const table = () => screen.getByRole('table', { name: '플레이어 프리셋' });

function control(element: HTMLElement) {
  if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement)) throw new Error('not a control');

  return element;
}

function checkbox(element: HTMLElement) {
  if (!(element instanceof HTMLInputElement)) throw new Error('not an input');

  return element;
}

const input = (label: string) => control(screen.getByLabelText(label));
const color = (label: string) => control(screen.getByRole('textbox', { name: label }));

beforeEach(() => {
  history.replaceState(null, '', '/');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('parsePlayerPath', () => {
  it.each([
    ['', { page: 'list' }],
    ['new', { page: 'new' }],
    ['setup', { page: 'setup' }],
    ['options', { page: 'options' }],
    ['edit/default', { page: 'edit', presetId: 'default' }],
    ['edit/rounded', { page: 'edit', presetId: 'rounded' }],
    ['edit/accent', { page: 'edit', presetId: 'accent' }],
    ['edit/p-abc1234567', { page: 'edit', presetId: 'p-abc1234567' }],
    ['edit/../x', { page: 'list' }],
    ['edit/P-ABC1234567', { page: 'list' }],
    ['edit/neutral', { page: 'list' }],
    ['edit', { page: 'list' }],
    ['new/extra', { page: 'list' }],
    ['unknown', { page: 'list' }],
  ])('reads "%s"', (path, page) => {
    expect(parsePlayerPath(path)).toEqual(page);
  });
});

describe('locationFromHash', () => {
  it('keeps canonical player sub paths and drops sub paths of other menus', () => {
    const routes = routesFor('standalone');

    expect(locationFromHash('#/players/edit/default', routes, 'dashboard')).toEqual({
      id: 'players',
      path: 'edit/default',
    });
    expect(locationFromHash('#/players/whatever', routes, 'dashboard')).toEqual({ id: 'players', path: '' });
    expect(locationFromHash('#/schedule/x', routes, 'dashboard')).toEqual({ id: 'schedule', path: '' });
    expect(playerHref({ page: 'edit', presetId: 'p-abc1234567' })).toBe('#/players/edit/p-abc1234567');
  });
});

describe('PlayersScreen', () => {
  it.each([
    ['standalone', '주 메뉴', '플레이어'],
    ['gnuboard', '광고 관리 메뉴', '플레이어 설정'],
  ] as const)('sits right after 지면 편성 on %s', async (host, menu, label) => {
    serve({}, host);
    await (host === 'gnuboard' ? openSettings('#/players') : open('#/players'));

    const links = within(screen.getByRole('navigation', { name: menu }))
      .getAllByRole('link')
      .map((link) => link.textContent);

    expect(links[links.indexOf('지면 편성') + 1]).toBe(label);
  });

  it('lists presets with built-in actions blocked', async () => {
    serve({});
    await open('#/players');

    const rows = within(await screen.findByRole('table', { name: '플레이어 프리셋' })).getAllByRole('row');

    expect(rows).toHaveLength(8);
    expect(
      within(rows[0]!)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent)
    ).toEqual(['이름', '플레이어 종류', '언어', '사이트 적용', '수정 시각', '작업']);
    expect(within(rows[1]!).getByText('사이트 적용')).toBeTruthy();
    expect(
      within(rows[7]!)
        .getAllByRole('cell')
        .map((cell) => cell.textContent)
    ).toEqual([
      expect.stringContaining('기본 비디오'),
      '기본 video',
      '페이지 언어',
      '—',
      expect.any(String),
      expect.any(String),
    ]);

    // The five built-ins come first, in spec A2-E 1.2 and ads-lms-spec 1.2 order.
    const builtIns = ['기본', '플랫', '둥근 테두리', '강조색', '강의'];

    expect(rows.slice(1, 6).map((row) => within(row).getAllByRole('cell')[0]?.textContent)).toEqual(
      builtIns.map((name) => expect.stringContaining(name))
    );

    for (const name of builtIns) {
      expect(within(rows[1 + builtIns.indexOf(name)]!).getByText('내장')).toBeTruthy();
      expect(screen.getByRole('button', { name: `${name} 수정` }).hasAttribute('disabled')).toBe(true);
      expect(screen.getByRole('button', { name: `${name} 삭제` }).hasAttribute('disabled')).toBe(true);
      expect(screen.getByRole('button', { name: `${name} 복제` }).hasAttribute('disabled')).toBe(false);
    }

    expect(screen.getAllByText('내장 프리셋은 바꿀 수 없어요. 복제해서 쓰세요.').length).toBe(10);
    expect(screen.getByRole('button', { name: '기본 사이트에 적용' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: '둥근 테두리 사이트에 적용' }).hasAttribute('disabled')).toBe(false);
    expect(screen.getByRole('button', { name: '브랜드 수정' }).hasAttribute('disabled')).toBe(false);
  });

  it('blocks new presets and duplicates at 20 saved presets', async () => {
    const presets = Array.from({ length: 20 }, (_, index) =>
      stored(`p-${String(index).padStart(10, '0')}`, `P${index}`)
    );

    serve({ 'player-presets': () => ok({ ...LIST, presets: [BUILT_IN, ...presets] }) });
    await open('#/players');
    await screen.findByRole('table', { name: '플레이어 프리셋' });

    expect(screen.getByRole('button', { name: '새 프리셋 만들기' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'P0 복제' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getAllByText(/저장 프리셋은 20개까지예요/u).length).toBeGreaterThan(1);
  });

  it('duplicates into a new form with copied values', async () => {
    serve({});
    await open('#/players');
    fireEvent.click(await screen.findByRole('button', { name: '브랜드 복제' }));

    await waitFor(() => expect(location.hash).toBe('#/players/new'));
    expect(input('이름').value).toBe('브랜드 복사본');
    expect(color('강조색').value).toBe('#112233');
    expect(screen.getByText('저장하지 않은 변경')).toBeTruthy();
  });

  it('deletes only after the confirmation is accepted', async () => {
    const fetch = serve({ 'player-preset-delete': () => ok({ ...LIST, revision: 6, presets: [BUILT_IN, NATIVE] }) });

    await open('#/players');
    fireEvent.click(await screen.findByRole('button', { name: '브랜드 삭제' }));
    const dialog = await screen.findByRole('dialog');

    expect(within(dialog).getAllByRole('button', { name: '취소' })).toHaveLength(1);
    fireEvent.click(within(dialog).getByRole('button', { name: '취소' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    expect(actions(fetch)).not.toContain('player-preset-delete');

    fireEvent.click(screen.getByRole('button', { name: '브랜드 삭제' }));
    const again = await screen.findByRole('dialog');

    // The id sits in brackets, so no particle hangs on a value.
    expect(again.textContent).toContain(
      '이 프리셋을 불러오는 페이지(preset=p-brand00001)는 프리셋을 찾지 못해 패키지 기본값으로 재생돼요.'
    );
    fireEvent.click(within(again).getByRole('button', { name: '삭제' }));

    expect(await screen.findByText('"브랜드" 프리셋을 삭제했어요.')).toBeTruthy();
    expect(sent(fetch, 'player-preset-delete')).toEqual({ id: 'p-brand00001', revision: 5 });
    expect(within(table()).queryByText('브랜드')).toBeNull();
  });

  it('applies a preset to the site after the confirmation, with the list revision', async () => {
    const fetch = serve({
      'player-preset-default': () => ok({ ...LIST, revision: 6, defaultPresetId: 'p-brand00001' }),
    });

    await open('#/players');
    fireEvent.click(await screen.findByRole('button', { name: '브랜드 사이트에 적용' }));

    let dialog = await screen.findByRole('dialog', { name: '"브랜드" 프리셋을 사이트에 적용할까요?' });

    expect(dialog.textContent).toContain('지금 사이트 적용');
    expect(dialog.textContent).toContain('기본 · Video.js 플레이어 · 페이지 언어');
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: '취소' }));

    fireEvent.click(within(dialog).getByRole('button', { name: '취소' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(actions(fetch)).not.toContain('player-preset-default');

    fireEvent.click(screen.getByRole('button', { name: '브랜드 사이트에 적용' }));
    dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: '사이트에 적용' }));

    expect(await screen.findByText(/"브랜드" 프리셋을 사이트에 적용했어요/u)).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(sent(fetch, 'player-preset-default')).toEqual({ id: 'p-brand00001', revision: 5 });
    expect(screen.getByRole('button', { name: '브랜드 사이트에 적용' }).hasAttribute('disabled')).toBe(true);
    // Focus moves in a passive effect after the write settles, which can run after the commit findByText waited for.
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: '브랜드 수정' })));
  });

  it('keeps the apply dialog open with the current site preset named when the apply fails', async () => {
    serve({ 'player-preset-default': () => fail(500, 'server') });

    await open('#/players');
    fireEvent.click(await screen.findByRole('button', { name: '브랜드 사이트에 적용' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: '사이트에 적용' }));

    const dialog = screen.getByRole('dialog');

    await waitFor(() =>
      expect(dialog.textContent).toContain('사이트에 적용하지 못했어요. 지금 사이트 적용 프리셋은 "기본" 그대로예요.')
    );
    expect(within(dialog).getByRole('button', { name: '사이트에 적용' }).hasAttribute('disabled')).toBe(false);
  });

  it('shows the neutral skin move once, until it is confirmed', async () => {
    const store = new Map<string, string>();

    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
    });
    serve({ 'player-presets': () => ok({ ...LIST, migratedNeutral: ['p-brand00001'] }) });
    await open('#/players');

    const note = (await screen.findByText(/중립 스킨을 쓰던 프리셋 1개\(브랜드\)/u)).closest('.sa-note');
    if (!(note instanceof HTMLElement)) throw new Error('no migration note');

    expect(within(table()).getByText('중립 스킨에서 옮김')).toBeTruthy();
    expect(within(note).getByRole('link', { name: '재생 테스트 열기' }).getAttribute('href')).toBe('#/schedule');

    fireEvent.click(within(note).getByRole('button', { name: '확인했어요' }));

    expect(screen.queryByText(/중립 스킨을 쓰던 프리셋/u)).toBeNull();
    expect([...store.values()]).toEqual(['p-brand00001']);

    cleanup();
    await open('#/players');
    await screen.findByRole('table', { name: '플레이어 프리셋' });
    expect(screen.queryByText(/중립 스킨을 쓰던 프리셋/u)).toBeNull();
  });

  it('shows the neutral skin move every time when storage throws', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    serve({ 'player-presets': () => ok({ ...LIST, migratedNeutral: ['p-brand00001'] }) });
    await open('#/players');

    fireEvent.click(await screen.findByRole('button', { name: '확인했어요' }));

    expect(screen.queryByText(/중립 스킨을 쓰던 프리셋/u)).toBeNull();
  });

  it('shows the Korean ad labels move once, until it is confirmed', async () => {
    const store = new Map<string, string>();

    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
    });
    serve({ 'player-presets': () => ok({ ...LIST, migratedLabels: ['p-native0001', 'p-brand00001'] }) });
    await open('#/players');

    const note = (await screen.findByText(/영어 광고로 만든 프리셋 2개\(브랜드, 기본 비디오\)/u)).closest('.sa-note');
    if (!(note instanceof HTMLElement)) throw new Error('no labels note');

    expect(within(note).getByText('광고 문구를 한국어로 바꿨어요')).toBeTruthy();
    expect(note.textContent).toContain(
      '광고 화면은 이제 늘 한국어예요. 영어 광고로 만든 프리셋 2개(브랜드, 기본 비디오)에 직접 넣었던 광고 문구를 ' +
        '한국어 기본 문구로 바꿨어요. 다른 문구가 필요하면 편집기의 광고 구획에서 다시 넣어 주세요.'
    );
    expect(within(note).getByRole('link', { name: '재생 테스트 열기' }).getAttribute('href')).toBe('#/schedule');
    expect(within(table()).queryByText('중립 스킨에서 옮김')).toBeNull();

    fireEvent.click(within(note).getByRole('button', { name: '확인했어요' }));

    expect(screen.queryByText(/영어 광고로 만든 프리셋/u)).toBeNull();
    expect(document.activeElement?.textContent).toBe('프리셋 목록');
    expect(Object.fromEntries(store)).toEqual({ 'aa-players-migrated-labels': 'p-brand00001,p-native0001' });

    cleanup();
    await open('#/players');
    await screen.findByRole('table', { name: '플레이어 프리셋' });
    expect(screen.queryByText(/영어 광고로 만든 프리셋/u)).toBeNull();
  });

  it('confirms the neutral skin and ad labels notes apart', async () => {
    const store = new Map<string, string>();

    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
    });
    serve({
      'player-presets': () => ok({ ...LIST, migratedNeutral: ['p-brand00001'], migratedLabels: ['p-brand00001'] }),
    });
    await open('#/players');

    await screen.findByText('광고 문구를 한국어로 바꿨어요');

    const notes = [...document.querySelectorAll<HTMLElement>('.sa-note')];
    const neutral = notes[0];
    if (!neutral) throw new Error('no neutral skin note');

    // The neutral skin note keeps its place first; the ad labels note follows it.
    expect(notes.slice(0, 2).map((note) => note.querySelector('b')?.textContent)).toEqual([
      '모양이 조금 달라질 수 있어요',
      '광고 문구를 한국어로 바꿨어요',
    ]);

    fireEvent.click(within(neutral).getByRole('button', { name: '확인했어요' }));

    expect(screen.queryByText(/중립 스킨을 쓰던 프리셋/u)).toBeNull();
    expect(screen.getByText(/영어 광고로 만든 프리셋 1개\(브랜드\)/u)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '확인했어요' }));

    expect(screen.queryByText(/영어 광고로 만든 프리셋/u)).toBeNull();
    expect(Object.fromEntries(store)).toEqual({
      'aa-players-migrated-neutral': 'p-brand00001',
      'aa-players-migrated-labels': 'p-brand00001',
    });
  });

  it('shows the ad labels move every time when storage throws', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    serve({ 'player-presets': () => ok({ ...LIST, migratedLabels: ['p-brand00001'] }) });
    await open('#/players');

    fireEvent.click(await screen.findByRole('button', { name: '확인했어요' }));

    expect(screen.queryByText(/영어 광고로 만든 프리셋/u)).toBeNull();
  });

  it('sends values the selected player cannot use as null', async () => {
    const fetch = serve({
      'player-preset-save': () =>
        ok({
          ...LIST,
          revision: 6,
          presets: [...LIST.presets, stored('p-new0000001', '새것')],
          preset: stored('p-new0000001', '새것'),
        }),
    });

    await open('#/players/new');
    fireEvent.change(input('이름'), { target: { value: '새것' } });
    fireEvent.change(color('강조색'), { target: { value: '#112233' } });
    fireEvent.change(input('플레이어 종류'), { target: { value: 'native' } });

    expect(screen.getByText('기본 video에서는 테마를 쓸 수 없어요.')).toBeTruthy();
    // The theme stays on screen with its value, disabled and described by the reason (decision 27).
    expect(color('강조색').value).toBe('#112233');
    expect(color('강조색').matches(':disabled')).toBe(true);
    expect(color('강조색').getAttribute('aria-describedby')).toBeTruthy();

    fireEvent.change(input('광고 로드 시간 제한 (초)'), { target: { value: '8' } });
    fireEvent.click(screen.getByRole('button', { name: '프리셋 저장' }));
    await waitFor(() => expect(actions(fetch)).toContain('player-preset-save'));

    const { preset, revision } = sent(fetch, 'player-preset-save');

    expect(revision).toBe(5);
    expect(preset.theme.accentColor).toBeNull();
    expect(preset.display.title).toBeNull();
    expect(preset.ads.timeouts).toEqual({ loadSeconds: 8, stallSeconds: null });
    await waitFor(() => expect(location.hash).toBe('#/players/edit/p-new0000001'));
  });

  describe('테두리 없음', () => {
    const noBorder = () => screen.getByRole<HTMLInputElement>('checkbox', { name: '테두리 없음' });
    const CLEAR = stored('p-clear00001', '투명 테두리', {
      theme: { ...DEFAULT_PLAYER_PRESET.theme, borderColor: '#11223300' },
    });

    it('takes an 8-digit border color, and turns the border off and back to the skin default', async () => {
      const fetch = serve({ 'player-preset-save': () => fail(500, 'server') });

      await open('#/players/new');
      fireEvent.change(input('이름'), { target: { value: '새것' } });
      fireEvent.change(color('테두리 색'), { target: { value: '#00000026' } });
      fireEvent.blur(color('테두리 색'));

      expect(color('테두리 색').value).toBe('#00000026');
      expect(color('테두리 색').hasAttribute('aria-invalid')).toBe(false);
      expect(noBorder().checked).toBe(false);

      // The picker cannot show a partial alpha; both inputs say so.
      const box = color('테두리 색').closest('.sa-color');
      const picker = box?.querySelector('input[type=color]');
      if (!(box instanceof HTMLElement) || !(picker instanceof HTMLInputElement)) throw new Error('no color field');

      const alphaHelp = screen.getByText('색 칸은 투명도를 보이지 못해요. 색 칸에서 고르면 투명도가 빠져요.');

      expect(color('테두리 색').getAttribute('aria-describedby')?.split(' ')).toContain(alphaHelp.id);
      expect(picker.getAttribute('aria-describedby')?.split(' ')).toContain(alphaHelp.id);
      expect(document.getElementById(noBorder().getAttribute('aria-describedby')!)?.textContent).toBe(
        '켜면 플레이어 둘레에 선을 그리지 않아요.'
      );

      fireEvent.change(color('테두리 색'), { target: { value: '#0000002' } });
      fireEvent.blur(color('테두리 색'));

      expect(
        screen.getByText('#과 16진수 6자리로 입력해 주세요. 투명도를 넣으려면 8자리로 써요. 예: #cdf352, #00000026')
      ).toBeTruthy();

      // Typing a see-through color does not lock the field mid-entry.
      fireEvent.change(color('테두리 색'), { target: { value: '#ff000000' } });

      expect(noBorder().checked).toBe(false);
      expect(color('테두리 색').matches(':disabled')).toBe(false);

      fireEvent.click(noBorder());

      expect(noBorder().checked).toBe(true);
      expect(color('테두리 색').value).toBe('#00000000');
      expect(color('테두리 색').matches(':disabled')).toBe(true);
      // Hatched like the default, with the value still in the text and nothing to clear.
      expect(box.className).toBe('sa-color is-none');
      expect(picker.disabled).toBe(true);
      expect(within(box).queryByRole('button')).toBeNull();
      expect(screen.queryByText('색 칸은 투명도를 보이지 못해요. 색 칸에서 고르면 투명도가 빠져요.')).toBeNull();

      fireEvent.click(noBorder());

      expect(noBorder().checked).toBe(false);
      expect(color('테두리 색').value).toBe('');
      expect(color('테두리 색').matches(':disabled')).toBe(false);

      fireEvent.click(noBorder());
      fireEvent.click(screen.getByRole('button', { name: '프리셋 저장' }));
      await waitFor(() => expect(actions(fetch)).toContain('player-preset-save'));

      expect(sent(fetch, 'player-preset-save').preset.theme.borderColor).toBe('#00000000');
    });

    it('opens a see-through border with 테두리 없음 on, and another preset by its own value', async () => {
      const fetch = serve({
        'player-presets': () => ok({ ...LIST, presets: [...LIST.presets, CLEAR] }),
        'player-preset-save': () => fail(500, 'server'),
      });

      await open('#/players/edit/p-brand00001');

      expect((await screen.findByRole<HTMLInputElement>('checkbox', { name: '테두리 없음' })).checked).toBe(false);

      // The editor stays mounted when only the address changes; each preset opens by its own value.
      go('#/players/edit/p-clear00001');

      expect(await screen.findByDisplayValue('투명 테두리')).toBeTruthy();
      expect(noBorder().checked).toBe(true);
      expect(color('테두리 색').value).toBe('#11223300');
      expect(color('테두리 색').matches(':disabled')).toBe(true);

      fireEvent.click(noBorder());
      fireEvent.click(screen.getByRole('button', { name: '프리셋 저장' }));
      await waitFor(() => expect(actions(fetch)).toContain('player-preset-save'));

      expect(sent(fetch, 'player-preset-save').preset.theme.borderColor).toBeNull();
    });

    it('is blocked with the theme for native video', async () => {
      serve({});
      await open('#/players/new');
      fireEvent.change(input('플레이어 종류'), { target: { value: 'native' } });

      expect(noBorder().matches(':disabled')).toBe(true);
    });
  });

  it('sends timeouts as null after switching back to Video.js', async () => {
    const fetch = serve({ 'player-preset-save': () => fail(500, 'server') });

    await open('#/players/new');
    fireEvent.change(input('이름'), { target: { value: '새것' } });
    fireEvent.change(input('플레이어 종류'), { target: { value: 'native' } });
    fireEvent.change(input('광고 로드 시간 제한 (초)'), { target: { value: '8' } });
    fireEvent.change(input('플레이어 종류'), { target: { value: 'videojs' } });

    expect(screen.getByText(/Video\.js의 광고 요소에는 시간 제한 속성이 없어요/u)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '프리셋 저장' }));
    await waitFor(() => expect(actions(fetch)).toContain('player-preset-save'));

    expect(sent(fetch, 'player-preset-save').preset.ads.timeouts).toEqual({ loadSeconds: null, stallSeconds: null });
  });

  it('marks local schema errors without a request', async () => {
    const fetch = serve({});

    await open('#/players/new');
    fireEvent.change(input('광고 글자 크기 (px)'), { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: '프리셋 저장' }));

    expect(await screen.findByText('저장하지 못했어요. 표시한 항목을 확인해 주세요.')).toBeTruthy();
    expect(input('이름').getAttribute('aria-invalid')).toBe('true');
    expect(input('광고 글자 크기 (px)').getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(input('이름'));
    expect(actions(fetch)).not.toContain('player-preset-save');
  });

  it('keeps malformed colors out of the form and warns about contrast', async () => {
    serve({});
    await open('#/players/new');
    fireEvent.change(color('강조색'), { target: { value: '#1a1a80' } });

    expect(screen.getByText(/검정과의 대비가/u)).toBeTruthy();

    fireEvent.change(color('강조 글자색'), { target: { value: 'red' } });
    fireEvent.blur(color('강조 글자색'));

    // The format error hides the warning (Field contract); the form still holds no accent text color.
    expect(color('강조 글자색').getAttribute('aria-invalid')).toBe('true');

    fireEvent.change(color('강조 글자색'), { target: { value: '#888888' } });

    expect(screen.getByText(/4\.5:1 이상을 권해요/u)).toBeTruthy();
  });

  it('shows 422 fields on their controls', async () => {
    serve({ 'player-preset-save': () => fail(422, 'validation', { 'ads.fontSize': 'server words' }) });

    await open('#/players/edit/p-brand00001');
    fireEvent.change(await screen.findByLabelText('광고 글자 크기 (px)'), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: '프리셋 저장' }));

    await waitFor(() => expect(input('광고 글자 크기 (px)').getAttribute('aria-invalid')).toBe('true'));
    // Focus moves in a passive effect after the write settles, which can run after the marked commit.
    await waitFor(() => expect(document.activeElement).toBe(input('광고 글자 크기 (px)')));
    expect(screen.queryByText(/server words/u)).toBeNull();

    fireEvent.change(input('광고 글자 크기 (px)'), { target: { value: '13' } });
    expect(input('광고 글자 크기 (px)').getAttribute('aria-invalid')).toBeNull();
  });

  it('keeps input after a 409 and reloads the list on request', async () => {
    const fetch = serve({ 'player-preset-save': () => fail(409, 'revision_conflict') });

    await open('#/players/edit/p-brand00001');
    fireEvent.change(await screen.findByLabelText('이름'), { target: { value: '바뀐 이름' } });
    fireEvent.click(screen.getByRole('button', { name: '프리셋 저장' }));

    expect(await screen.findByText(/다른 곳에서 먼저 바뀌었어요/u)).toBeTruthy();
    expect(input('이름').value).toBe('바뀐 이름');

    fireEvent.click(screen.getByRole('button', { name: '프리셋 목록 다시 불러오기' }));

    expect(await screen.findByText(/프리셋 목록을 다시 불러왔어요/u)).toBeTruthy();
    expect(actions(fetch).filter((action) => action === 'player-presets')).toHaveLength(2);
    expect(input('이름').value).toBe('바뀐 이름');
  });

  it('keeps the new preset input after the server refuses a 21st preset (QA PL07)', async () => {
    const fetch = serve({ 'player-preset-save': () => fail(400, 'preset_limit') });

    await open('#/players/new');
    fireEvent.change(await screen.findByLabelText('이름'), { target: { value: '스물한 번째' } });
    fireEvent.change(input('광고 글자 크기 (px)'), { target: { value: '15' } });
    fireEvent.click(screen.getByRole('button', { name: '프리셋 저장' }));

    await waitFor(() =>
      expect(screen.getAllByRole('alert').map((alert) => alert.textContent)).toContain(
        '저장 프리셋은 20개까지예요. 쓰지 않는 프리셋을 지운 뒤 다시 저장해 주세요.'
      )
    );
    expect(input('이름').value).toBe('스물한 번째');
    expect(input('광고 글자 크기 (px)').value).toBe('15');
    expect(location.hash).toBe('#/players/new');
    expect(leaveWarns()).toBe(true);
    expect(actions(fetch).filter((action) => action === 'player-preset-save')).toHaveLength(1);
  });

  it.each(['default', 'flat', 'rounded', 'accent', 'lms'])(
    'opens the built-in preset "%s" read-only with a duplicate action',
    async (id) => {
      serve({});
      await open(`#/players/edit/${id}`);

      expect(await screen.findByText(/내장 프리셋은 바꿀 수 없어요\. 복제해서 쓰세요\./u)).toBeTruthy();
      expect(screen.queryByRole('button', { name: '프리셋 저장' })).toBeNull();
      expect(screen.getByRole('button', { name: '복제해서 새로 만들기' })).toBeTruthy();
    }
  );

  it.each([BUILT_IN, FLAT, ROUNDED, ACCENT, LMS])(
    'shows the built-in preset $id whole in the player preview, with the demo always open',
    async (fixture) => {
      serve({});
      await open(`#/players/edit/${fixture.id}`);

      const card = await screen.findByRole('region', { name: '플레이어 미리보기' });
      // SAFETY: the title query returns the preview iframe.
      const frame = within(card).getByTitle('플레이어 미리보기 화면') as HTMLIFrameElement;
      const post = vi.spyOn(frame.contentWindow!, 'postMessage');

      fireEvent.load(frame);

      const [message] = post.mock.lastCall ?? [];
      // The stored preset without the list's metadata (builtIn, createdAt, updatedAt).
      const whole = Object.fromEntries(
        Object.entries(fixture).filter(([key]) => Object.hasOwn(DEFAULT_PLAYER_PRESET, key))
      );

      expect(message).toMatchObject({ type: 'ads-player-preview' });
      expect(message.preset).toEqual(whole);

      expect(within(card).getByText('내장 프리셋 모습이에요')).toBeTruthy();
      expect(within(card).getByRole('radio', { name: '넓게 · 자리 폭' })).toBeTruthy();
      expect(within(card).getByRole('group', { name: '장면 바로가기' })).toBeTruthy();
      expect(within(card).getByText('아직 광고가 나오지 않았어요')).toBeTruthy();
      expect(within(card).queryByLabelText('페이지 언어') !== null).toBe(fixture.language === null);

      const demo = within(card).getByRole('link', { name: '데모에서 열기 (새 창)' });

      expect(demo.getAttribute('href')).toBe(`${location.origin}/ads/examples/index.html?preset=${fixture.id}`);
      expect(demo.hasAttribute('aria-disabled')).toBe(false);
      // The notice and the duplicate action stay.
      expect(screen.getByText(/내장 프리셋은 바꿀 수 없어요\. 복제해서 쓰세요\./u)).toBeTruthy();
      expect(screen.getByRole('button', { name: '복제해서 새로 만들기' })).toBeTruthy();
    }
  );

  it('puts the built-in notice and its preview side by side on wide screens', async () => {
    serve({});
    await open('#/players/edit/rounded');

    const card = await screen.findByRole('region', { name: '플레이어 미리보기' });
    const page = card.parentElement!;
    const duplicate = within(page).getByRole('button', { name: '복제해서 새로 만들기' });

    expect(card.tagName).toBe('SECTION');
    expect(card.classList.contains('aa-builtin-preview')).toBe(true);
    expect(page.className).toBe('aa-builtin is-wide');
    // Left column: the notice and the duplicate action; right column: the card.
    expect(page.children).toHaveLength(2);
    expect(page.firstElementChild?.textContent).toContain('내장 프리셋은 바꿀 수 없어요. 복제해서 쓰세요.');
    expect(page.firstElementChild?.contains(duplicate)).toBe(true);
    expect(page.lastElementChild).toBe(card);
    expect(within(card).queryByRole('button', { name: /열기|접기/u })).toBeNull();
  });

  it('keeps the built-in preview in place, unlike the sticky editor preview', () => {
    const rules = [
      ...readFileSync(resolve(import.meta.dirname, '../src/app/app.css'), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//gu, '')
        .matchAll(/([^{}]+)\{([^{}]*)\}/gu),
    ];
    const sticky = (part: string) =>
      rules.some(([, selectors = '', body = '']) => selectors.includes(part) && /position:\s*sticky/u.test(body));

    expect(sticky('aa-editor-preview')).toBe(true);
    expect(sticky('aa-builtin')).toBe(false);
  });

  describe('below the wide layout', () => {
    beforeEach(() => {
      vi.stubGlobal('matchMedia', (query: string) => ({
        matches: query.includes('max-width'),
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }));
    });

    function fold(card: HTMLElement) {
      const toggle = within(card).getByRole('button', { name: /^(열기|접기)$/u });

      return {
        toggle,
        expanded: toggle.getAttribute('aria-expanded'),
        hidden: document.getElementById(toggle.getAttribute('aria-controls') ?? '')?.hidden,
      };
    }

    it('stacks the built-in page and folds its preview, like the editor', async () => {
      serve({});
      await open('#/players/edit/rounded');

      const card = await screen.findByRole('region', { name: '플레이어 미리보기' });

      expect(card.parentElement?.className).toBe('aa-builtin is-narrow');
      expect(fold(card)).toMatchObject({ expanded: 'false', hidden: true });

      fireEvent.click(fold(card).toggle);

      expect(fold(card)).toMatchObject({ expanded: 'true', hidden: false });
    });

    it('starts the next built-in preset folded when only the address changes', async () => {
      serve({});
      await open('#/players/edit/rounded');
      fireEvent.click(fold(await screen.findByRole('region', { name: '플레이어 미리보기' })).toggle);

      go('#/players/edit/accent');

      const card = screen.getByRole('region', { name: '플레이어 미리보기' });

      expect(screen.getByText('강조색', { selector: '.sa-note *' })).toBeTruthy();
      expect(fold(card)).toMatchObject({ expanded: 'false', hidden: true });
    });

    it('starts the next saved preset folded in the editor when only the address changes', async () => {
      serve({});
      await open('#/players/edit/p-brand00001');
      fireEvent.click(fold(await screen.findByRole('complementary', { name: '플레이어 미리보기' })).toggle);
      expect(fold(screen.getByRole('complementary', { name: '플레이어 미리보기' })).expanded).toBe('true');

      go('#/players/edit/p-native0001');

      expect(screen.getByLabelText<HTMLInputElement>('이름').value).toBe(NATIVE.name);
      expect(fold(screen.getByRole('complementary', { name: '플레이어 미리보기' }))).toMatchObject({
        expanded: 'false',
        hidden: true,
      });
    });
  });

  it('unmounts the live preview while another menu is shown and keeps the form', async () => {
    serve({
      'schedule-draft': () => ok({ draft: null, publishedVersion: null, resolvedFrom: null }),
    });
    await open('#/players/new');

    expect(screen.getByTitle('플레이어 미리보기 화면')).toBeTruthy();
    fireEvent.change(input('이름'), { target: { value: '작성 중' } });

    go('#/schedule');
    expect(document.querySelector('iframe')).toBeNull();

    go('#/players/new');
    expect(screen.getByTitle('플레이어 미리보기 화면')).toBeTruthy();
    expect(input('이름').value).toBe('작성 중');
  });

  it('opens a saved preset in the demo until its input changes', async () => {
    serve({});
    await open('#/players/edit/p-brand00001');

    const link = await screen.findByRole('link', { name: '데모에서 열기 (새 창)' });

    expect(link.getAttribute('href')).toBe(`${location.origin}/ads/examples/index.html?preset=p-brand00001`);

    fireEvent.change(input('이름'), { target: { value: '브랜드 2' } });

    const blocked = screen.getByRole('link', { name: '데모에서 열기 (새 창)' });

    expect(blocked).toBe(link);
    expect(blocked.hasAttribute('href')).toBe(false);
    expect(blocked.getAttribute('aria-disabled')).toBe('true');
    expect(document.getElementById(blocked.getAttribute('aria-describedby') ?? '')?.textContent).toBe(
      '저장하지 않은 입력이 있어요. 저장하면 데모에서 열 수 있어요.'
    );
  });

  it('keeps the last valid preview while the form is invalid', async () => {
    serve({});
    await open('#/players/new');
    fireEvent.change(input('광고 글자 크기 (px)'), { target: { value: '30' } });

    expect(screen.getByText(/마지막으로 올바르던 값으로 보여 줘요/u)).toBeTruthy();
    expect(screen.getByTitle('플레이어 미리보기 화면')).toBeTruthy();
  });
});

describe('PresetPreviewDialog', () => {
  const NAMES = LIST.presets.map((preset) => preset.name);
  const NOTE =
    '저장된 값으로 보여요. 이 프리셋에는 저장하지 않은 입력이 있어요. 편집 화면에서 저장하면 여기에도 보여요.';
  let showModal: ReturnType<typeof vi.fn<(this: HTMLDialogElement) => void>>;

  // jsdom has no dialog methods; these follow the browser's open and close.
  beforeEach(() => {
    showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    });
    HTMLDialogElement.prototype.showModal = showModal;
    HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    };
  });

  afterEach(() => {
    // SAFETY: removes the stubs above; jsdom's prototype has neither method.
    delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).showModal;
    // SAFETY: as above.
    delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).close;
  });

  const escape = (dialog: HTMLElement) => fireEvent(dialog, new Event('cancel', { cancelable: true }));
  const closed = () => waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

  it('fits the stage to the dialog height, so 1280×800 needs no body scroll', async () => {
    const watched: { target: Element; report: (entries: { contentRect: { width: number } }[]) => void }[] = [];

    vi.stubGlobal(
      'ResizeObserver',
      class {
        report: (entries: { contentRect: { width: number } }[]) => void;
        constructor(report: (entries: { contentRect: { width: number } }[]) => void) {
          this.report = report;
        }
        observe(target: Element) {
          watched.push({ target, report: this.report });
        }
        disconnect() {}
      }
    );
    serve({});
    await open('#/players');
    fireEvent.click(screen.getByRole('button', { name: '기본 미리보기' }));

    const dialog = await screen.findByRole('dialog', { name: '기본 미리보기' });
    const body = dialog.querySelector<HTMLElement>('.sa-dialog-b')!;
    const view = dialog.querySelector<HTMLElement>('.sa-stage-view')!;

    // The sizes measured at 1280×800 (A2E-01): body 638 of 723 with the view 395 tall.
    dialog.style.maxHeight = '768px';
    Object.defineProperty(dialog, 'getBoundingClientRect', { configurable: true, value: () => ({ height: 768 }) });
    Object.defineProperty(view, 'getBoundingClientRect', { configurable: true, value: () => ({ height: 395 }) });
    Object.defineProperty(body, 'clientWidth', { configurable: true, value: 738 });
    Object.defineProperty(body, 'clientHeight', { configurable: true, value: 638 });
    Object.defineProperty(body, 'scrollHeight', { configurable: true, value: 723 });
    body.style.padding = '18px';
    act(() => {
      for (const { target, report } of watched) if (dialog.contains(target)) report([{ contentRect: { width: 702 } }]);
    });

    expect(view.style.getPropertyValue('--_fit')).toBe('551px');
  });

  it('puts 미리보기 first in every row, built-in rows included, before the other actions in their order', async () => {
    serve({});
    await open('#/players');

    const rows = within(table()).getAllByRole('row').slice(1);

    expect(rows).toHaveLength(NAMES.length);

    rows.forEach((row, index) => {
      const buttons = within(row).getAllByRole('button');

      expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual(
        ['미리보기', '수정', '복제', '삭제', '사이트에 적용'].map((action) => `${NAMES[index]} ${action}`)
      );
      expect(buttons[0]?.textContent).toBe('미리보기');
      expect(buttons[0]?.hasAttribute('disabled') || buttons[0]?.getAttribute('aria-disabled') === 'true').toBe(false);
    });
  });

  it('opens the saved preset in a wide modal with focus on the close icon, and Esc removes the player', async () => {
    serve({});
    await open('#/players');

    const opener = screen.getByRole('button', { name: '기본 미리보기' });

    opener.focus();
    fireEvent.click(opener);

    const dialog = await screen.findByRole('dialog', { name: '기본 미리보기' });
    const [closeIcon, closeButton] = within(dialog).getAllByRole('button', { name: '닫기' });

    expect(showModal).toHaveBeenCalledTimes(1);
    expect(dialog.className).toBe('sa-dialog is-wide');
    expect(dialog.querySelector(':scope > form')?.getAttribute('method')).toBe('dialog');
    expect(dialog.querySelector('.sa-dialog-title')?.textContent).toBe('기본 미리보기저장된 값 · 통계에 남기지 않아요');
    expect(dialog.hasAttribute('aria-describedby')).toBe(false);
    expect(document.activeElement).toBe(closeIcon);
    expect(closeButton?.getAttribute('type')).toBe('submit');
    expect(closeButton?.getAttribute('value')).toBe('close');
    expect(dialog.querySelector('.sa-ppv-h, .sa-card')).toBeNull();
    expect(dialog.querySelector('iframe')?.getAttribute('src')).toBe(
      new URL('/ads/examples/preview.html?type=videojs', location.href).href
    );
    expect(within(dialog).getByRole<HTMLInputElement>('radio', { name: '넓게 · 자리 폭' }).checked).toBe(true);

    const demo = within(dialog).getByRole('link', { name: '데모에서 열기 (새 창)' });

    expect(demo.getAttribute('href')).toBe(new URL('/ads/examples/index.html?preset=default', location.href).href);
    expect(demo.getAttribute('target')).toBe('_blank');
    expect(demo.classList.contains('is-start')).toBe(true);
    expect(demo.closest('.sa-dialog-f')).not.toBeNull();

    escape(dialog);
    await closed();

    expect(document.querySelector('iframe')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('closes with the footer 닫기 and builds a new player when opened again', async () => {
    serve({});
    await open('#/players');

    fireEvent.click(screen.getByRole('button', { name: '브랜드 미리보기' }));

    let dialog = await screen.findByRole('dialog', { name: '브랜드 미리보기' });
    const first = dialog.querySelector('iframe');

    expect(first).not.toBeNull();

    fireEvent.click(within(dialog).getAllByRole('button', { name: '닫기' })[1]!);
    await closed();

    expect(document.querySelector('iframe')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: '브랜드 미리보기' })));

    fireEvent.click(screen.getByRole('button', { name: '브랜드 미리보기' }));
    dialog = await screen.findByRole('dialog', { name: '브랜드 미리보기' });

    expect(dialog.querySelector('iframe')).not.toBeNull();
    expect(dialog.querySelector('iframe')).not.toBe(first);
    expect(showModal).toHaveBeenCalledTimes(2);
  });

  it('says it shows the saved values when the preset has unsaved input', async () => {
    serve({});
    await open('#/players/edit/p-brand00001');
    fireEvent.change(input('이름'), { target: { value: '브랜드 새 이름' } });
    go('#/players');
    fireEvent.click(await screen.findByRole('button', { name: '브랜드 미리보기' }));

    const dialog = await screen.findByRole('dialog', { name: '브랜드 미리보기' });
    const note = within(dialog).getByRole('note');

    expect(note.tagName).toBe('P');
    expect(note.textContent).toBe(NOTE);
    expect(dialog.getAttribute('aria-describedby')).toBe(note.id);
    expect(dialog.querySelector('.sa-dialog-b')?.firstElementChild).toBe(note);

    escape(dialog);
    await closed();
    fireEvent.click(screen.getByRole('button', { name: '강조색 미리보기' }));

    const other = await screen.findByRole('dialog', { name: '강조색 미리보기' });

    expect(within(other).queryByRole('note')).toBeNull();
    expect(other.hasAttribute('aria-describedby')).toBe(false);
  });

  it('returns focus to the same name after a reload replaced the row, else to the list heading', async () => {
    const RENAMED = { ...LIST, revision: 6, presets: [BUILT_IN, stored('p-brand00002', '브랜드'), NATIVE] };
    const GONE = { ...LIST, revision: 7, presets: [BUILT_IN, NATIVE] };

    serve({
      'player-presets': presetReads(
        ok(LIST),
        fail(500, 'server_error'),
        ok(RENAMED),
        fail(500, 'server_error'),
        ok(GONE)
      ),
    });
    await open('#/players');

    const reloadAfterFailure = async () => {
      go('#/dashboard');
      go('#/players');

      const banner = (
        await screen.findByText('최신 프리셋 목록을 불러오지 못했어요. 이전 목록으로 보여 줘요.')
      ).closest('.aa-global');
      if (!(banner instanceof HTMLElement)) throw new Error('no stale banner');

      return () => fireEvent.click(within(banner).getByRole('button', { name: '다시 불러오기' }));
    };

    let reload = await reloadAfterFailure();

    fireEvent.click(screen.getByRole('button', { name: '브랜드 미리보기' }));
    reload();
    await waitFor(() => expect(within(table()).queryByText('p-brand00001')).toBeNull());

    let dialog = screen.getByRole('dialog', { name: '브랜드 미리보기' });

    escape(dialog);
    await closed();
    await waitFor(() => expect(document.activeElement?.id).toBe('aa-preset-preview-p-brand00002'));

    reload = await reloadAfterFailure();
    fireEvent.click(screen.getByRole('button', { name: '브랜드 미리보기' }));
    reload();
    await waitFor(() => expect(within(table()).queryByText('브랜드')).toBeNull());

    dialog = screen.getByRole('dialog', { name: '브랜드 미리보기' });
    escape(dialog);
    await closed();
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2, name: '프리셋 목록' }))
    );
  });

  it('closes when the menu changes and stays closed on the way back', async () => {
    serve({});
    await open('#/players');
    fireEvent.click(screen.getByRole('button', { name: '브랜드 미리보기' }));
    await screen.findByRole('dialog', { name: '브랜드 미리보기' });

    go('#/dashboard');
    await closed();
    go('#/players');
    await screen.findByRole('table', { name: '플레이어 프리셋' });

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.querySelector('iframe')).toBeNull();
  });
});

describe('PresetEditor', () => {
  const describedText = (element: HTMLElement) =>
    (element.getAttribute('aria-describedby') ?? '')
      .split(' ')
      .map((id) => document.getElementById(id)?.textContent ?? '')
      .join(' ');

  it('moves between the eight sections and focuses the section heading', async () => {
    serve({});
    await open('#/players/new');

    const nav = screen.getByRole('navigation', { name: '편집 구획' });
    const links = within(nav).getAllByRole('link');

    expect(links.map((link) => link.textContent)).toEqual([
      '기본',
      '테마',
      '로고',
      '컨트롤',
      '재생 동작',
      '강의(LMS)',
      '언어',
      '광고 화면',
    ]);
    expect(links[0]?.getAttribute('aria-current')).toBe('true');

    fireEvent.click(links[7]!);

    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2, name: '광고 화면' }));
    expect(links[7]?.getAttribute('aria-current')).toBe('true');
    expect(location.hash).toBe('#/players/new');
  });

  describe('강의(LMS) section', () => {
    const enabled = () => screen.getByRole<HTMLInputElement>('checkbox', { name: '강의 기능 사용' });

    it('blocks the whole section for native video', async () => {
      serve({});
      await open('#/players/new');
      fireEvent.click(enabled());
      fireEvent.change(input('플레이어 종류'), { target: { value: 'native' } });

      expect(screen.getByText('강의 기능은 Video.js 플레이어에서만 써요.')).toBeTruthy();
      expect(enabled().matches(':disabled')).toBe(true);
      // The value stays on screen (decision 27).
      expect(enabled().checked).toBe(true);
      expect(input('완료 기준 (%)').matches(':disabled')).toBe(true);
    });

    it('blocks the lecture fields until the feature is on', async () => {
      serve({});
      await open('#/players/new');

      expect(enabled().checked).toBe(false);
      expect(screen.getByText('강의 기능 사용을 켜면 고칠 수 있어요.')).toBeTruthy();
      expect(input('완료 기준 (%)').matches(':disabled')).toBe(true);
      expect(screen.getByRole('radio', { name: '본 곳까지만' }).matches(':disabled')).toBe(true);
      expect(screen.queryByRole('img', { name: /강의 미리보기/u })).toBeNull();

      fireEvent.click(enabled());

      expect(screen.queryByText('강의 기능 사용을 켜면 고칠 수 있어요.')).toBeNull();
      expect(input('완료 기준 (%)').matches(':disabled')).toBe(false);
      expect(screen.getByRole('link', { name: /샘플 강의 열기/u }).getAttribute('href')).toBe(
        '/ads/examples/lecture.html'
      );
    });

    it('saves the lecture values, with defaults as null', async () => {
      const fetch = serve({
        'player-preset-save': () =>
          ok({
            ...LIST,
            revision: 6,
            presets: [...LIST.presets, stored('p-new0000001', '강의 사본')],
            preset: stored('p-new0000001', '강의 사본'),
          }),
      });

      await open('#/players/new');
      fireEvent.change(input('이름'), { target: { value: '강의 사본' } });
      fireEvent.click(enabled());
      fireEvent.click(screen.getByRole('radio', { name: '본 곳까지만' }));
      fireEvent.click(screen.getByRole('radio', { name: '1.5×' }));
      fireEvent.click(screen.getByRole('radio', { name: '프리롤만' }));
      fireEvent.change(input('완료 기준 (%)'), { target: { value: '80' } });
      fireEvent.click(screen.getByRole('switch', { name: '메모' }));

      // Bookmarks need the notes tab (ads-lms-spec 10.1).
      expect(screen.getByText('메모 탭을 켜야 북마크를 쓸 수 있어요.')).toBeTruthy();
      expect(screen.getByRole('switch', { name: '북마크 버튼' }).matches(':disabled')).toBe(true);
      expect(
        screen.getByRole('img', { name: '강의 미리보기: 시청한 구간과 한계 표시, 진도 42%, 완료 기준 80%' })
      ).toBeTruthy();

      fireEvent.click(screen.getByRole('button', { name: '프리셋 저장' }));
      await waitFor(() => expect(actions(fetch)).toContain('player-preset-save'));

      expect(sent(fetch, 'player-preset-save').preset.lms).toEqual({
        enabled: true,
        resume: null,
        seekLimit: 'watched',
        maxRate: 1.5,
        completion: 80,
        tabs: { chapters: null, materials: null, transcript: null, notes: false },
        bookmarks: null,
        ads: 'preroll',
      });
    });
  });

  // QA A21-1: the jump's focus scroll left the 테마 section in the observed band, which took the mark back.
  it('keeps a picked section current through its own scroll, then follows scrolling again', async () => {
    let report: (entries: readonly SeenSection[]) => void = () => undefined;

    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: (entries: readonly SeenSection[]) => void) {
          report = callback;
        }

        observe() {}

        disconnect() {}
      }
    );
    serve({});
    await open('#/players/edit/p-brand00001');

    const nav = screen.getByRole('navigation', { name: '편집 구획' });
    const marked = () => within(nav).getByRole('link', { current: true }).textContent;
    const seen = (name: string) => [
      {
        isIntersecting: true,
        boundingClientRect: { top: 120 },
        target: screen.getByRole('heading', { level: 2, name }).closest('section')!,
      },
    ];

    fireEvent.pointerDown(within(nav).getByRole('link', { name: '재생 동작' }));
    fireEvent.click(within(nav).getByRole('link', { name: '재생 동작' }));
    act(() => report(seen('테마')));

    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2, name: '재생 동작' }));
    expect(marked()).toBe('재생 동작');

    fireEvent.wheel(window);
    act(() => report(seen('테마')));

    expect(marked()).toBe('테마');
  });

  it('locks muted on while autoplay is on, with the reason, and saves both', async () => {
    const fetch = serve({ 'player-preset-save': () => fail(500, 'server') });

    await open('#/players/new');
    fireEvent.change(input('이름'), { target: { value: '자동' } });

    const muted = screen.getByRole('switch', { name: '음소거로 시작' });

    expect(muted.getAttribute('aria-checked')).toBe('false');

    fireEvent.click(screen.getByRole('switch', { name: '자동 재생' }));

    expect(muted.getAttribute('aria-checked')).toBe('true');
    expect(muted.matches(':disabled')).toBe(true);
    expect(describedText(muted)).toContain('자동 재생을 켜서 바꿀 수 없어요.');
    expect(screen.getByText('자동 재생 때문에 켜짐')).toBeTruthy();

    fireEvent.click(screen.getByRole('switch', { name: '반복 재생' }));
    expect(screen.getByText('포스트롤은 재생되지 않아요')).toBeTruthy();

    fireEvent.click(screen.getByRole('radio', { name: '누를 때' }));
    expect(describedText(screen.getByRole('radiogroup', { name: '미리 불러오기' }))).toContain('데이터를 가장 적게');

    fireEvent.click(screen.getByRole('button', { name: '프리셋 저장' }));
    await waitFor(() => expect(actions(fetch)).toContain('player-preset-save'));

    expect(sent(fetch, 'player-preset-save').preset.playback).toEqual({
      autoplay: true,
      muted: null,
      loop: true,
      preload: 'none',
    });
  });

  it('locks the title switch for native video and sends it as null', async () => {
    serve({});
    await open('#/players/edit/p-brand00001');

    const title = await screen.findByRole('switch', { name: '제목 표시' });

    fireEvent.click(title);
    expect(title.getAttribute('aria-checked')).toBe('false');

    fireEvent.change(input('플레이어 종류'), { target: { value: 'native' } });

    expect(title.matches(':disabled')).toBe(true);
    expect(title.getAttribute('aria-checked')).toBe('false');
    expect(describedText(title)).toContain('브라우저 컨트롤에는 제목 자리가 없어요.');
    expect(
      within(screen.getByRole('navigation', { name: '편집 구획' })).getByRole('link', { name: /테마/u }).textContent
    ).toBe('테마 쓸 수 없음');
    expect(input('플레이어 화면 언어').getAttribute('aria-describedby')).toBeTruthy();
    expect(describedText(input('플레이어 화면 언어'))).toContain('브라우저 컨트롤은 브라우저 언어로');
  });

  it('shows the built-in ad texts as placeholders and names the ad accent color', async () => {
    serve({});
    await open('#/players/new');

    expect(input('건너뛰기 문구').getAttribute('placeholder')).toBe('광고 건너뛰기');
    expect(input('건너뛰기 대기 문구').getAttribute('placeholder')).toBe('{seconds}초 후 건너뛰기');
    expect(input('광고 시간 문구').getAttribute('placeholder')).toBe('{elapsed} / {duration}');
    expect(color('광고 강조색')).toBeTruthy();
    expect(screen.getByText(/광고 문구는 늘 한국어로 나와요/u)).toBeTruthy();
  });

  it('links a 422 on playback.muted to the autoplay switch that locks it', async () => {
    serve({
      'player-preset-save': () => fail(422, 'validation', { 'playback.muted': 'server words' }),
    });

    await open('#/players/edit/p-brand00001');
    fireEvent.click(await screen.findByRole('switch', { name: '자동 재생' }));
    fireEvent.click(screen.getByRole('button', { name: '프리셋 저장' }));

    const muted = screen.getByRole('switch', { name: '음소거로 시작' });

    await waitFor(() => expect(muted.getAttribute('aria-invalid')).toBe('true'));
    expect(describedText(muted)).toContain('자동 재생을 켜면 음소거로 시작해야 해요.');
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('switch', { name: '자동 재생' })));
    expect(
      within(screen.getByRole('navigation', { name: '편집 구획' })).getByRole('link', { name: /재생 동작/u })
        .textContent
    ).toBe('재생 동작오류 1');
    expect(screen.getByText('고칠 칸 1개 · 표시한 칸을 고친 뒤 저장해 주세요.')).toBeTruthy();
    expect(screen.queryByText(/server words/u)).toBeNull();
  });

  it('says in the save bar when the preset is the site-applied one', async () => {
    serve({ 'player-presets': () => ok({ ...LIST, defaultPresetId: 'p-brand00001' }) });
    await open('#/players/edit/p-brand00001');

    expect(
      await screen.findByText(
        '사이트 적용 프리셋이에요. 저장하면 로더를 넣은 모든 페이지에서, 새로고침하면 바뀐 플레이어가 보여요.'
      )
    ).toBeTruthy();

    go('#/players/edit/p-native0001');
    expect(
      await screen.findByText('저장하면 이 프리셋을 쓰는 페이지에서, 새로고침하면 바뀐 플레이어가 보여요.')
    ).toBeTruthy();
  });
});

describe('PresetEditor 컨트롤', () => {
  const STEPPED = stored('p-steps00001', '건너뛰기', {
    controls: { ...DEFAULT_PLAYER_PRESET.controls, seekButtons: 15, captions: false, pip: false },
  });
  const sw = (name: string) => screen.getByRole('switch', { name });
  const steps = () => screen.getByRole('radiogroup', { name: '건너뛰는 폭' });
  const step = (name: string) => within(steps()).getByRole<HTMLInputElement>('radio', { name });
  const sub = () => document.getElementById(sw('이전·이후 버튼').getAttribute('aria-controls') ?? '');

  it('turns 이전·이후 버튼 on at 10초, brings back the last step, and sends the steps and 자막', async () => {
    const fetch = serve({ 'player-preset-save': () => fail(500, 'server') });

    await open('#/players/new');
    fireEvent.change(input('이름'), { target: { value: '컨트롤' } });

    const section = screen.getByRole('region', { name: '컨트롤' });
    const save = async (nth: number) => {
      fireEvent.click(screen.getByRole('button', { name: '프리셋 저장' }));
      await waitFor(() =>
        expect(actions(fetch).filter((action) => action === 'player-preset-save')).toHaveLength(nth + 1)
      );

      return sent(fetch, 'player-preset-save', nth).preset.controls;
    };

    expect(within(section).getAllByRole('switch')).toEqual([sw('이전·이후 버튼'), sw('자막')]);
    expect(sw('이전·이후 버튼').getAttribute('aria-checked')).toBe('false');
    expect(sub()?.hidden).toBe(true);
    expect(section.contains(sub())).toBe(true);
    expect(sw('자막').getAttribute('aria-checked')).toBe('true');
    expect(
      sw('자막')
        .getAttribute('aria-describedby')
        ?.split(' ')
        .map((id) => document.getElementById(id)?.textContent)
    ).toEqual([
      '자막 버튼과 설정 메뉴의 자막 항목이에요. 영상에 자막이 없으면 버튼이 ‘자막 없음’으로 막혀 보여요.',
      '끄면 단축키 c도 꺼져요.',
    ]);
    expect(document.getElementById(sw('이전·이후 버튼').getAttribute('aria-describedby')!)?.textContent).toBe(
      '뒤로·앞으로 건너뛰기 버튼을 컨트롤 막대나 화면 가운데, 또는 두 곳 모두에 보여요.'
    );
    expect(await save(0)).toEqual(DEFAULT_PLAYER_PRESET.controls);

    fireEvent.click(sw('이전·이후 버튼'));

    expect(sw('이전·이후 버튼').getAttribute('aria-checked')).toBe('true');
    expect(sub()?.hidden).toBe(false);
    expect(step('10초').checked).toBe(true);
    expect(steps().className).toBe('sa-seg is-num');
    expect(
      within(steps())
        .getAllByRole('radio')
        .map((radio) => radio.closest('label')?.textContent)
    ).toEqual(['5초', '10초', '15초', '30초']);

    fireEvent.click(step('30초'));
    fireEvent.click(sw('이전·이후 버튼'));

    expect(sub()?.hidden).toBe(true);
    expect((await save(1)).seekButtons).toBeNull();

    fireEvent.click(sw('이전·이후 버튼'));
    fireEvent.click(sw('자막'));

    expect(step('30초').checked).toBe(true);
    expect(await save(2)).toEqual({ ...DEFAULT_PLAYER_PRESET.controls, seekButtons: 30, captions: false });
  });

  it('places the seek buttons in the bar, the middle of the video or both, keeping one place on', async () => {
    const fetch = serve({ 'player-preset-save': () => fail(500, 'server') });
    const place = (name: string) =>
      within(screen.getByRole('group', { name: '이전·이후 버튼 위치' })).getByRole<HTMLInputElement>('checkbox', {
        name,
      });
    const save = async (nth: number) => {
      fireEvent.click(screen.getByRole('button', { name: '프리셋 저장' }));
      await waitFor(() =>
        expect(actions(fetch).filter((action) => action === 'player-preset-save')).toHaveLength(nth + 1)
      );

      return sent(fetch, 'player-preset-save', nth).preset.controls;
    };

    await open('#/players/new');
    fireEvent.change(input('이름'), { target: { value: '가운데' } });
    fireEvent.click(sw('이전·이후 버튼'));

    expect(sub()?.contains(screen.getByRole('group', { name: '이전·이후 버튼 위치' }))).toBe(true);
    expect([place('컨트롤 막대').checked, place('컨트롤 막대').disabled]).toEqual([true, true]);
    expect([place('화면 가운데').checked, place('화면 가운데').disabled]).toEqual([false, false]);

    fireEvent.click(place('화면 가운데'));

    expect([place('컨트롤 막대').disabled, place('화면 가운데').disabled]).toEqual([false, false]);
    expect(await save(0)).toMatchObject({ seekButtons: 10, seekPlacement: 'both' });

    fireEvent.click(place('컨트롤 막대'));

    expect([place('컨트롤 막대').checked, place('화면 가운데').disabled]).toEqual([false, true]);
    expect(await save(1)).toMatchObject({ seekButtons: 10, seekPlacement: 'center' });

    // Turning the buttons off keeps the place for the next time they come back.
    fireEvent.click(sw('이전·이후 버튼'));

    expect(await save(2)).toMatchObject({ seekButtons: null, seekPlacement: 'center' });

    fireEvent.click(sw('이전·이후 버튼'));
    fireEvent.click(place('컨트롤 막대'));
    fireEvent.click(place('화면 가운데'));

    expect(await save(3)).toMatchObject({ seekButtons: 10, seekPlacement: null });
  });

  it('opens saved values and keeps the controls the editor does not show yet', async () => {
    const fetch = serve({
      'player-presets': () => ok({ ...LIST, presets: [...LIST.presets, STEPPED] }),
      'player-preset-save': () => fail(500, 'server'),
    });

    await open('#/players/edit/p-steps00001');

    expect(sw('이전·이후 버튼').getAttribute('aria-checked')).toBe('true');
    expect(step('15초').checked).toBe(true);
    expect(sw('자막').getAttribute('aria-checked')).toBe('false');

    fireEvent.click(sw('자막'));
    fireEvent.click(screen.getByRole('button', { name: '프리셋 저장' }));
    await waitFor(() => expect(actions(fetch)).toContain('player-preset-save'));

    expect(sent(fetch, 'player-preset-save').preset.controls).toEqual({
      ...DEFAULT_PLAYER_PRESET.controls,
      seekButtons: 15,
      captions: null,
      pip: false,
    });
  });

  it('blocks the section for native video with its reason, sends null, and keeps the values', async () => {
    const fetch = serve({
      'player-presets': () => ok({ ...LIST, presets: [...LIST.presets, STEPPED] }),
      'player-preset-save': () => fail(500, 'server'),
    });

    await open('#/players/edit/p-steps00001');
    fireEvent.change(input('플레이어 종류'), { target: { value: 'native' } });

    const reason = screen.getByText(/기본 video에서는 컨트롤을 쓸 수 없어요\./u).closest('.sa-off-reason');
    if (!(reason instanceof HTMLElement)) throw new Error('no reason');

    expect(reason.textContent).toBe(
      '기본 video에서는 컨트롤을 쓸 수 없어요. 기본 구획의 플레이어 종류를 Video.js로 바꾸면 쓸 수 있어요.'
    );

    for (const name of ['이전·이후 버튼', '자막']) {
      expect(sw(name).matches(':disabled')).toBe(true);
      expect(sw(name).getAttribute('aria-describedby')).toBe(reason.id);
      expect(sw(name).closest('li')?.className).toBe('is-locked');
    }

    expect(sub()?.hidden).toBe(true);
    expect(sw('이전·이후 버튼').getAttribute('aria-checked')).toBe('true');
    expect(
      within(screen.getByRole('navigation', { name: '편집 구획' })).getByRole('link', { name: /컨트롤/u }).textContent
    ).toBe('컨트롤 쓸 수 없음');
    // The preview card names the buttons as the A2-E copy does ("±초" is retired).
    expect(
      screen.getByText('기본 video는 브라우저 컨트롤로 보여요. 로고와 이전·이후 버튼은 나오지 않아요.')
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '프리셋 저장' }));
    await waitFor(() => expect(actions(fetch)).toContain('player-preset-save'));

    expect(sent(fetch, 'player-preset-save').preset.controls).toEqual(DEFAULT_PLAYER_PRESET.controls);

    fireEvent.change(input('플레이어 종류'), { target: { value: 'videojs' } });

    expect(sw('이전·이후 버튼').matches(':disabled')).toBe(false);
    expect(sub()?.hidden).toBe(false);
    expect(step('15초').checked).toBe(true);
    expect(sw('자막').getAttribute('aria-checked')).toBe('false');
  });
});

describe('PlayerSetup', () => {
  const region = (name: string) => screen.queryByRole('region', { name });

  it('builds the loader install code from the video fields, with no data-preset, and reports input errors', async () => {
    serve({});
    await open('#/players/setup');

    const card = (await screen.findByRole('heading', { name: '설치 코드' })).closest('section');
    if (!(card instanceof HTMLElement)) throw new Error('no install card');

    expect(within(card).getByText('권장')).toBeTruthy();
    expect(within(card).getByText('고정 영상 ID를 입력해 주세요.')).toBeTruthy();
    expect(region('로더 설치 코드')).toBeNull();

    fireEvent.change(input('영상 ID'), { target: { value: 'video-1' } });
    fireEvent.change(input('포스터 URL (선택)'), { target: { value: '/ads/poster.jpg' } });
    fireEvent.change(input('제목 (선택)'), { target: { value: '첫 영상' } });

    const code = region('로더 설치 코드')?.textContent ?? '';

    expect(screen.getByRole('button', { name: '로더 설치 코드 복사' })).toBeTruthy();
    expect(code).toContain('<div data-solad-player');
    expect(code).toContain('data-video-id="video-1"');
    expect(code).toContain(`data-src="${location.origin}/ads/`);
    expect(code).toContain('data-poster="/ads/poster.jpg"');
    expect(code).toContain('data-title="첫 영상"');
    expect(code).toContain('<script type="module" src="/ads/player/loader.js"></script>');
    expect(code).not.toContain('data-preset');
    expect(within(card).getByText('매니저와 같은 사이트의 페이지에서만 동작해요')).toBeTruthy();

    fireEvent.change(input('포스터 URL (선택)'), { target: { value: 'javascript:alert(1)' } });

    expect(within(card).getByText(/포스터 주소는 http\(s\):\/\/ 주소나 \/로 시작하는 경로로/u)).toBeTruthy();
    expect(region('로더 설치 코드')).toBeNull();
  });

  it('lists the placeholder data-* attributes and a JS API example', async () => {
    serve({});
    await open('#/players/setup');

    const attributes = await screen.findByRole('table', { name: '자리 요소 data-* 속성' });
    const names = within(attributes)
      .getAllByRole('row')
      .slice(1)
      .map((row) => row.querySelector('code')?.textContent);

    expect(names).toContain('data-solad-player');
    expect(names).toContain('data-video-id');
    expect(names).not.toContain('data-preset');
    expect(region('JS API 예')?.textContent).toContain('import { mount } from "/ads/player/loader.js";');
  });

  it('keeps the old static code folded, with the video ID typed above', async () => {
    serve({});
    await open('#/players/setup');
    fireEvent.change(await screen.findByLabelText('영상 ID'), { target: { value: 'video-1' } });

    const details = screen.getByText(/^예전 정적 코드 보기/u).closest('details');

    expect(details?.open).toBe(false);

    const code = region('예전 정적 코드')?.textContent ?? '';

    expect(code).toContain(`${location.origin}/assets/`);
    expect(code).toContain('http://admin.test/ads/api/index.php');
    expect(code).toContain('video-id="video-1"');
    expect(screen.getByText('이미 붙여 넣은 코드는 프리셋을 바꿔도 그대로예요. 다시 복사해 주세요.')).toBeTruthy();
    expect(input('프리셋').value).toBe('default');
    expect(screen.getByRole('option', { name: '기본 (사이트 적용)' })).toBeTruthy();
  });

  it('disables HLS for a native video preset', async () => {
    serve({});
    await open('#/players/setup');
    fireEvent.change(await screen.findByLabelText('프리셋'), { target: { value: 'p-native0001' } });

    expect(checkbox(screen.getByLabelText('HLS · SPF')).disabled).toBe(true);
    expect(checkbox(screen.getByLabelText('HLS · hls.js')).disabled).toBe(true);
    expect(checkbox(screen.getByLabelText('MP4')).checked).toBe(true);
  });

  it('explains why there is no old static code without a player module URL, and keeps the loader code', async () => {
    serve({}, 'standalone', null);
    await open('#/players/setup');

    expect(await screen.findByText('예전 정적 코드를 만들 수 없어요')).toBeTruthy();
    expect(region('예전 정적 코드')).toBeNull();

    fireEvent.change(input('영상 ID'), { target: { value: 'video-1' } });

    expect(region('로더 설치 코드')).toBeTruthy();
  });

  const steps = () => screen.getAllByRole('listitem').map((item) => item.textContent);

  it('keeps the GnuBoard video ID format and post insertion out of the standalone install steps', async () => {
    serve({});
    await open('#/players/setup');

    expect(await screen.findByRole('heading', { name: '설치 순서' })).toBeTruthy();
    expect(steps()).toContain(
      '영상을 넣을 자리에 코드 붙이기. 아래 설치 코드를 붙이고 data-video-id, data-src를 영상에 맞게 바꿔요. 영상 ID가 지면 편성의 영상 ID와 같아야 광고가 붙어요. 영상을 등록하면 게시판·분류 편성도 적용돼요.'
    );
    expect(document.body.textContent).not.toContain('게시판:글번호:영상키');
    expect(screen.queryByText('그누보드 게시물 자동 삽입 · 준비 중', { exact: false })).toBeNull();
  });
});

describe('PlayerSettingsScreen', () => {
  // The API hides the lecture built-in on GnuBoard; a fresh site still shows the built-in "기본".
  const SITE_LIST = { ...LIST, presets: [BUILT_IN, FLAT, ROUNDED, ACCENT] };
  const SETTING = stored('p-site000001', '플레이어 설정');

  it('opens the one setting for old #/players sub pages, without a list, copies or lectures', async () => {
    serve({ 'player-presets': () => ok(SITE_LIST) }, 'gnuboard');
    await openSettings('#/players/setup');

    expect(location.hash).toBe('#/players');
    expect(screen.queryByRole('table', { name: '플레이어 프리셋' })).toBeNull();
    expect(screen.queryByLabelText('이름')).toBeNull();
    expect(screen.queryByRole('button', { name: /복제|삭제|사이트에 적용/u })).toBeNull();
    // The settings page gives the section list's width to the preview.
    expect(screen.queryByRole('navigation', { name: '편집 구획' })).toBeNull();
    expect(screen.queryByRole('heading', { name: '강의(LMS)' })).toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: '로고' })).toBeTruthy();
  });

  it('saves a theme card, its fine-tuning and the sample logo in the corner picked', async () => {
    const fetch = serve(
      { 'player-presets': () => ok(SITE_LIST), 'player-preset-save': () => ok({ ...SITE_LIST, preset: SETTING }) },
      'gnuboard'
    );

    await openSettings('#/players');

    const themes = screen.getByRole('group', { name: '테마 고르기' });
    const corner = (name: string) => checkbox(screen.getByRole('radio', { name }));

    expect(checkbox(within(themes).getByRole('radio', { name: /^기본/u })).checked).toBe(true);
    expect(corner('왼쪽 아래').matches(':disabled')).toBe(true);

    fireEvent.click(within(themes).getByRole('radio', { name: /^플랫/u }));

    expect(within(themes).getByText(/지금 테마: 플랫/u)).toBeTruthy();

    fireEvent.change(color('강조색'), { target: { value: '#445566' } });

    expect(within(themes).queryByRole('radio', { checked: true })).toBeNull();
    expect(within(themes).getByText(/지금 테마: 직접 조정/u)).toBeTruthy();

    fireEvent.click(screen.getByRole('radio', { name: '샘플 로고' }));
    expect(corner('오른쪽 위').checked).toBe(true);
    fireEvent.click(corner('왼쪽 아래'));
    fireEvent.click(screen.getByRole('button', { name: '설정 저장' }));
    await waitFor(() => expect(actions(fetch)).toContain('player-preset-save'));

    const { preset } = sent(fetch, 'player-preset-save');

    expect(preset.theme).toMatchObject({ accentColor: '#445566', borderColor: '#00000000', borderRadius: 0 });
    expect(preset.logo).toMatchObject({ assetId: 'sample', position: 'bottom-left', width: null, alt: null });
  });

  it('stores the first save as the site setting and updates it afterwards', async () => {
    const saved = (revision: number) =>
      ok({
        ...SITE_LIST,
        revision,
        defaultPresetId: SETTING.id,
        presets: [...SITE_LIST.presets, SETTING],
        preset: SETTING,
      });
    const replies = [saved(6), saved(7)];
    const fetch = serve(
      { 'player-presets': () => ok(SITE_LIST), 'player-preset-save': () => replies.shift() ?? fail(500, 'server') },
      'gnuboard'
    );

    await openSettings('#/players');
    fireEvent.change(color('강조색'), { target: { value: '#445566' } });
    fireEvent.click(screen.getByRole('button', { name: '설정 저장' }));
    await screen.findByText(/플레이어 설정을 저장했어요/u);

    const first = sent(fetch, 'player-preset-save');

    expect(first.revision).toBe(5);
    expect(first.preset.id).toBeNull();
    expect(first.preset.name).toBe('플레이어 설정');
    expect(first.preset.theme.accentColor).toBe('#445566');
    expect(first.preset.lms.enabled).toBeNull();

    fireEvent.change(color('강조색'), { target: { value: '#778899' } });
    fireEvent.click(screen.getByRole('button', { name: '설정 저장' }));
    await waitFor(() => expect(actions(fetch).filter((action) => action === 'player-preset-save')).toHaveLength(2));

    const second = sent(fetch, 'player-preset-save', 1);

    expect(second.revision).toBe(6);
    expect(second.preset.id).toBe(SETTING.id);
  });
});

describe('ExamplePageLinks', () => {
  it.each(['#/players/setup', '#/players/options'])('links the demo, guide and help pages from %s', async (hash) => {
    serve({});
    await open(hash);

    const nav = screen.getByRole('navigation', { name: '플레이어 문서' });
    const links = within(nav)
      .getAllByRole('link')
      .map((link) => [link.textContent, link.getAttribute('href'), link.getAttribute('target')]);

    expect(links).toEqual([
      ['데모 열기 (새 창)', '/ads/examples/index.html', '_blank'],
      ['설명서 (새 창)', '/ads/examples/guide.html', '_blank'],
      ['도움말 (새 창)', '/ads/examples/help.html', '_blank'],
    ]);
  });
});

describe('PlayerOptions', () => {
  it('renders one captioned table per group without API requests', async () => {
    const fetch = serve({});

    await open('#/players/options');

    for (const group of playerOptions) expect(screen.getByRole('table', { name: group.title })).toBeTruthy();

    expect(screen.getAllByRole('table')).toHaveLength(playerOptions.length);
    expect(actions(fetch)).not.toContain('player-presets');
  });

  it('links every row to its entry on the public help page in a new window', async () => {
    serve({});
    await open('#/players/options');

    for (const group of playerOptions) {
      const table = screen.getByRole('table', { name: group.title });

      for (const row of group.rows) {
        const link = within(table).getByRole('link', { name: `‘${row.name}’ 도움말 (새 창)` });

        expect(link.getAttribute('href')).toBe(`/ads/examples/${helpHref(optionAnchor(row.name, group.id))}`);
        expect(link.getAttribute('target')).toBe('_blank');
        expect(link.getAttribute('rel')).toBe('noopener noreferrer');
      }
    }

    // The anchors the public help page has (contract A2-D 4).
    for (const [name, href] of [
      ['data-video-id', '/ads/examples/help.html#opt-data-video-id'],
      ['--ads-accent-color', '/ads/examples/help.html#opt-ads-accent-color'],
    ]) {
      expect(screen.getAllByRole('link', { name: `‘${name}’ 도움말 (새 창)` })[0]?.getAttribute('href')).toBe(href);
    }
  });

  it('links the loader attribute rows on the setup page too', async () => {
    serve({});
    await open('#/players/setup');

    expect(screen.getByRole('link', { name: '‘data-video-id’ 도움말 (새 창)' }).getAttribute('href')).toBe(
      '/ads/examples/help.html#opt-data-video-id'
    );
  });
});

describe('PlaybackPanel', () => {
  it('passes the selected preset to the test links, default preset first', async () => {
    serve({
      'player-presets': () => ok({ ...LIST, defaultPresetId: 'p-brand00001' }),
      'schedule-draft': () =>
        ok({
          draft: { target: { type: 'site', id: 'site-1' }, mode: 'disabled', revision: 1, breaks: [] },
          publishedVersion: 1,
          resolvedFrom: null,
        }),
    });
    history.replaceState(null, '', '/#/schedule');
    render(<App api={new AdminApi('http://admin.test/ads/api/index.php')} publicBase="/ads/" />);

    const select = control(await screen.findByLabelText('적용할 프리셋'));

    await waitFor(() => expect(select.value).toBe('p-brand00001'));
    fireEvent.change(screen.getByLabelText('고정 영상 ID'), { target: { value: 'video-1' } });

    const link = () => screen.getByRole('link', { name: /Video.js로 재생/u }).getAttribute('href') ?? '';

    expect(new URL(link()).searchParams.get('preset')).toBe('p-brand00001');

    fireEvent.change(select, { target: { value: 'default' } });
    expect(new URL(link()).searchParams.get('preset')).toBeNull();
  });
});

/** Whether leaving the page now would ask first, i.e. some menu reports unsaved input. */
function leaveWarns(): boolean {
  const event = new Event('beforeunload', { cancelable: true });

  window.dispatchEvent(event);
  return event.defaultPrevented;
}

const pageTitle = () => document.getElementById('aa-title-players-page');

/** Counts list reads and answers each with the next reply; the last one repeats. */
function presetReads(...replies: Reply[]) {
  let reads = 0;

  return () => {
    reads += 1;
    return replies[Math.min(reads, replies.length) - 1]!;
  };
}

describe('PlayersScreen review fixes', () => {
  it('offers a list reload after a 404 and keeps a deleted preset input as a new preset', async () => {
    const fetch = serve({
      'player-presets': presetReads(ok(LIST), ok({ ...LIST, revision: 6, presets: [BUILT_IN, NATIVE] })),
      'player-preset-save': () => fail(404, 'preset_not_found'),
    });

    await open('#/players/edit/p-brand00001');
    fireEvent.change(await screen.findByLabelText('이름'), { target: { value: '살릴 이름' } });
    fireEvent.click(screen.getByRole('button', { name: '프리셋 저장' }));

    expect(await screen.findByText(/다른 곳에서 지웠을 수 있어요\. 목록을 다시 불러와 주세요\./u)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '프리셋 목록 다시 불러오기' }));

    expect(await screen.findByText('저장하지 않은 입력이 남아 있어요')).toBeTruthy();
    expect(actions(fetch).filter((action) => action === 'player-presets')).toHaveLength(2);
    expect(leaveWarns()).toBe(true);

    go('#/players');
    const note = await screen.findByText('지워진 프리셋에 저장하지 않은 입력이 있어요');

    expect(within(note.parentElement!).getByRole('link', { name: '살릴 이름' }).getAttribute('href')).toBe(
      '#/players/edit/p-brand00001'
    );

    go('#/players/edit/p-brand00001');
    fireEvent.click(await screen.findByRole('button', { name: '입력한 값으로 새 프리셋 만들기' }));

    await waitFor(() => expect(location.hash).toBe('#/players/new'));
    expect(input('이름').value).toBe('살릴 이름');
    expect(screen.getByText('저장하지 않은 변경')).toBeTruthy();

    go('#/players');
    expect(screen.queryByText('지워진 프리셋에 저장하지 않은 입력이 있어요')).toBeNull();
  });

  it('drops a deleted preset input after confirming, which clears the leave warning', async () => {
    serve({
      'player-presets': presetReads(ok(LIST), ok({ ...LIST, revision: 6, presets: [BUILT_IN, NATIVE] })),
      'player-preset-save': () => fail(409, 'revision_conflict'),
    });

    await open('#/players/edit/p-brand00001');
    fireEvent.change(await screen.findByLabelText('이름'), { target: { value: '버릴 이름' } });
    fireEvent.click(screen.getByRole('button', { name: '프리셋 저장' }));
    fireEvent.click(await screen.findByRole('button', { name: '프리셋 목록 다시 불러오기' }));
    fireEvent.click(await screen.findByRole('button', { name: '입력 버리기' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: '버리기' }));

    expect(await screen.findByText('입력을 버렸어요.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '입력 버리기' })).toBeNull();
    // The drop settles after the confirm dialog closes, outside act(); the screen reports dirty state in a passive
    // effect, which can still be pending when findByText resolves at the commit.
    await waitFor(() => expect(leaveWarns()).toBe(false));
  });

  it('offers a list reload after a 404 on the list page, with list-page wording for a 409', async () => {
    serve({
      'player-preset-default': () => fail(404, 'preset_not_found'),
      'player-preset-delete': () => fail(409, 'revision_conflict'),
    });

    await open('#/players');
    fireEvent.click(await screen.findByRole('button', { name: '브랜드 사이트에 적용' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: '사이트에 적용' }));

    await waitFor(() => expect(screen.getByRole('dialog').textContent).toContain('목록을 다시 불러와 주세요.'));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '취소' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    expect(await screen.findByRole('button', { name: '프리셋 목록 다시 불러오기' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '브랜드 삭제' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: '삭제' }));

    expect(
      await screen.findByText('다른 곳에서 프리셋 목록이 먼저 바뀌었어요. 목록을 다시 불러온 뒤 다시 해 주세요.')
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '프리셋 목록 다시 불러오기' }));

    expect(await screen.findByText('프리셋 목록을 다시 불러왔어요.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '프리셋 목록 다시 불러오기' })).toBeNull();
  });

  it('warns that a new preset with the same name appeared after a 409', async () => {
    serve({
      'player-presets': presetReads(
        ok(LIST),
        ok({ ...LIST, revision: 6, presets: [...LIST.presets, stored('p-new0000001', '새것')] })
      ),
      'player-preset-save': () => fail(409, 'revision_conflict'),
    });

    await open('#/players/new');
    fireEvent.change(input('이름'), { target: { value: '새것' } });
    fireEvent.click(screen.getByRole('button', { name: '프리셋 저장' }));
    fireEvent.click(await screen.findByRole('button', { name: '프리셋 목록 다시 불러오기' }));

    expect(await screen.findByText(/"새것" 프리셋이 새로 생겼어요/u)).toBeTruthy();
    expect(input('이름').value).toBe('새것');
  });

  it('clears the unsaved mark when a value goes back to the saved one', async () => {
    serve({});
    await open('#/players/edit/p-brand00001');

    fireEvent.change(await screen.findByLabelText('이름'), { target: { value: '바뀐 이름' } });
    expect(screen.getByText('저장하지 않은 변경')).toBeTruthy();
    expect(leaveWarns()).toBe(true);

    fireEvent.change(input('이름'), { target: { value: '브랜드' } });
    expect(screen.queryByText('저장하지 않은 변경')).toBeNull();
    expect(leaveWarns()).toBe(false);
  });

  it('says a delete also drops unsaved edits of that preset', async () => {
    serve({});
    await open('#/players/edit/p-brand00001');
    fireEvent.change(await screen.findByLabelText('이름'), { target: { value: '바뀐 이름' } });

    go('#/players');
    fireEvent.click(await screen.findByRole('button', { name: '브랜드 삭제' }));

    expect(within(await screen.findByRole('dialog')).getByText(/저장하지 않은 수정도 함께 사라져요\./u)).toBeTruthy();
  });

  it('cuts a long name so the copy fits 40 characters', async () => {
    const long = '가'.repeat(39);

    serve({ 'player-presets': () => ok({ ...LIST, presets: [BUILT_IN, stored('p-long000001', long)] }) });
    await open('#/players');
    fireEvent.click(await screen.findByRole('button', { name: `${long} 복제` }));

    await waitFor(() => expect(location.hash).toBe('#/players/new'));
    expect(input('이름').value).toBe(`${'가'.repeat(36)} 복사본`);
    expect([...input('이름').value]).toHaveLength(40);
  });

  it('refuses to save while a color field shows a format error', async () => {
    const fetch = serve({});

    await open('#/players/edit/p-brand00001');
    const accent = await screen.findByRole('textbox', { name: '강조색' });

    fireEvent.change(accent, { target: { value: '#12' } });
    fireEvent.blur(accent);
    fireEvent.click(screen.getByRole('button', { name: '프리셋 저장' }));

    expect(screen.getByText('저장하지 못했어요. 표시한 항목을 확인해 주세요.')).toBeTruthy();
    expect(actions(fetch)).not.toContain('player-preset-save');
    await waitFor(() => expect(document.activeElement).toBe(accent));
  });

  it('keeps focus in the field while the workspace re-renders, and returns it to the page title after a save', async () => {
    let answer: (reply: Reply) => void = () => {};

    serve({
      creatives: () => new Promise<Reply>((resolve) => (answer = resolve)),
      'player-preset-save': () =>
        ok({
          ...LIST,
          revision: 6,
          presets: [BUILT_IN, stored('p-brand00001', '새 이름'), NATIVE],
          preset: stored('p-brand00001', '새 이름'),
        }),
    });
    history.replaceState(null, '', '/#/creatives');
    render(<App api={new AdminApi('http://admin.test/ads/api/index.php')} publicBase="/ads/" />);
    await screen.findByRole('heading', { level: 1, name: '소재' });

    go('#/players/edit/p-brand00001');
    const name = await screen.findByLabelText('이름');

    name.focus();
    await act(async () => answer(ok({ items: [] })));
    expect(document.activeElement).toBe(name);

    fireEvent.change(name, { target: { value: '새 이름' } });
    fireEvent.click(screen.getByRole('button', { name: '프리셋 저장' }));

    expect(await screen.findByText(/"새 이름" 프리셋을 저장했어요/u)).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(pageTitle()));
  });

  it('marks 프리셋 목록 as current on the editor pages', async () => {
    serve({});
    await open('#/players/new');

    const nav = screen.getByRole('navigation', { name: '플레이어 화면' });

    expect(within(nav).getByRole('link', { name: '프리셋 목록' }).getAttribute('aria-current')).toBe('page');

    go('#/players/edit/p-brand00001');
    expect(within(nav).getByRole('link', { name: '프리셋 목록' }).getAttribute('aria-current')).toBe('page');

    go('#/players/setup');
    expect(within(nav).getByRole('link', { name: '프리셋 목록' }).getAttribute('aria-current')).toBeNull();
  });

  it('reads the list again on a later visit and keeps the old list when that fails', async () => {
    const fetch = serve({
      'player-presets': presetReads(ok({ ...LIST, presets: [BUILT_IN] }), ok(LIST), fail(500, 'server_error')),
    });

    await open('#/players');
    await screen.findByRole('table', { name: '플레이어 프리셋' });
    expect(within(table()).queryByText('브랜드')).toBeNull();

    go('#/dashboard');
    go('#/players');
    expect(await within(table()).findByText('브랜드')).toBeTruthy();

    go('#/dashboard');
    go('#/players');
    expect(await screen.findByText('최신 프리셋 목록을 불러오지 못했어요. 이전 목록으로 보여 줘요.')).toBeTruthy();
    expect(within(table()).getByText('브랜드')).toBeTruthy();
    expect(actions(fetch).filter((action) => action === 'player-presets')).toHaveLength(3);
  });
});

describe('PlayerSetup review fixes', () => {
  it('shows a failed list as an error with a retry', async () => {
    serve({ 'player-presets': presetReads(fail(500, 'server_error'), ok(LIST)) });
    await open('#/players/setup');

    expect(await screen.findByText(/프리셋 목록을 불러오지 못했어요/u)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '다시 불러오기' }));

    expect(control(await screen.findByLabelText('프리셋')).value).toBe('default');
  });

  it('falls back to the default preset when the chosen one was deleted elsewhere', async () => {
    serve({ 'player-presets': presetReads(ok(LIST), ok({ ...LIST, revision: 6, presets: [BUILT_IN, NATIVE] })) });
    await open('#/players/setup');
    fireEvent.change(await screen.findByLabelText('프리셋'), { target: { value: 'p-brand00001' } });

    go('#/dashboard');
    go('#/players/setup');

    expect(
      await screen.findByText('고른 프리셋이 목록에 없어서 사이트 적용 프리셋으로 코드를 만들었어요.')
    ).toBeTruthy();
    expect(input('프리셋').value).toBe('default');
  });

  it.each([
    ['standalone', 'RLO U+202E', '\u202evid-1'],
    ['standalone', 'C1 NEL U+0085', 'vid\u00851'],
    ['standalone', 'only ideographic spaces', '\u3000\u3000'],
    ['standalone', '129 characters', 'a'.repeat(129)],
  ] as const)('on %s, makes no install code for a video ID with %s', async (host, _name, value) => {
    serve({}, host);
    await open('#/players/setup');

    const field = await screen.findByLabelText('영상 ID');

    fireEvent.change(field, { target: { value } });

    const errorId =
      field
        .getAttribute('aria-describedby')
        ?.split(' ')
        .find((id) => id.endsWith('-error')) ?? '';

    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(errorId)?.textContent).toMatch(/영상 ID/u);
    expect(screen.getByText('영상 ID를 고치면 설치 코드를 만들어요.')).toBeTruthy();
    expect(screen.getByText('위 설치 코드의 영상 ID를 고치면 예전 정적 코드도 만들어요.')).toBeTruthy();
    expect(screen.queryByRole('region', { name: '로더 설치 코드' })).toBeNull();
    expect(screen.queryByRole('region', { name: '예전 정적 코드' })).toBeNull();
  });
});

describe('PlaybackPanel review fixes', () => {
  const DRAFT_REPLY = () =>
    ok({
      draft: { target: { type: 'site', id: 'site-1' }, mode: 'disabled', revision: 1, breaks: [] },
      publishedVersion: 1,
      resolvedFrom: null,
    });

  async function openSchedule() {
    history.replaceState(null, '', '/#/schedule');
    render(<App api={new AdminApi('http://admin.test/ads/api/index.php')} publicBase="/ads/" />);
    await screen.findByRole('heading', { level: 1, name: '지면 편성' });
  }

  async function loadDraft() {
    fireEvent.click(await screen.findByRole('button', { name: '편성 불러오기' }));
    expect(await screen.findByText('게시 v1')).toBeTruthy();
  }

  const href = (name: RegExp) => new URL(screen.getByRole('link', { name }).getAttribute('href') ?? '');

  it('adds the preset only to the link of the preset player type', async () => {
    serve({ 'schedule-draft': DRAFT_REPLY });
    await openSchedule();

    const select = control(await screen.findByLabelText('적용할 프리셋'));

    fireEvent.change(screen.getByLabelText('고정 영상 ID'), { target: { value: 'video-1' } });
    await waitFor(() => expect(select.disabled).toBe(false));

    fireEvent.change(select, { target: { value: 'p-native0001' } });
    expect(href(/기본 video로 재생/u).searchParams.get('preset')).toBe('p-native0001');
    expect(href(/Video.js로 재생/u).searchParams.get('preset')).toBeNull();

    fireEvent.change(select, { target: { value: 'p-brand00001' } });
    expect(href(/Video.js로 재생/u).searchParams.get('preset')).toBe('p-brand00001');
    expect(href(/기본 video로 재생/u).searchParams.get('preset')).toBeNull();
  });

  it.each([
    [null, 'default', 'videojs'],
    ['p-native0001', 'p-native0001', 'native'],
  ] as const)('plays the draft preview with the picked preset %j', async (pick, presetId, type) => {
    const schedule = { videoId: 'video-1', breaks: [] };

    serve({ 'schedule-draft': DRAFT_REPLY, 'schedule-preview': () => ok({ schedule }) });
    await openSchedule();
    await loadDraft();

    const select = control(await screen.findByLabelText('적용할 프리셋'));

    await waitFor(() => expect(select.disabled).toBe(false));

    if (pick) fireEvent.change(select, { target: { value: pick } });

    fireEvent.change(screen.getByLabelText('고정 영상 ID'), { target: { value: 'video-1' } });
    fireEvent.click(screen.getByRole('button', { name: '미리보기 준비' }));

    // SAFETY: the title query returns the preview iframe.
    const frame = (await screen.findByTitle('플레이어 미리보기 화면')) as HTMLIFrameElement;
    const post = vi.spyOn(frame.contentWindow!, 'postMessage');

    expect(Object.fromEntries(new URL(frame.src).searchParams)).toEqual({ type });

    fireEvent.load(frame);

    const [message] = post.mock.lastCall ?? [];

    expect(message).toMatchObject({
      type: 'ads-player-preview',
      preset: { id: presetId, playerType: type },
      schedule,
      content: `${location.origin}/ads/demo-media/grok-20261018/content-scene-01.mp4`,
    });
    // The screen knows no name for video-1, so the frame titles it with the video ID.
    expect(Object.hasOwn(message, 'title')).toBe(false);
  });

  it('sends the video name the screen knows as the content title', async () => {
    const schedule = { videoId: 'video-1', breaks: [] };

    serve({
      'schedule-draft': () =>
        ok({
          draft: { target: { type: 'video', id: 'video-1' }, mode: 'disabled', revision: 1, breaks: [] },
          publishedVersion: 1,
          resolvedFrom: null,
        }),
      'schedule-preview': () => ok({ schedule }),
      'video-context-save': () => ok({}),
    });
    await openSchedule();
    fireEvent.change(screen.getByLabelText('적용 단위'), { target: { value: 'video' } });
    fireEvent.change(screen.getByLabelText('고정 대상 ID'), { target: { value: 'video-1' } });

    const context = screen.getByRole('form', { name: '영상 소속 연결' });

    fireEvent.change(within(context).getByLabelText('영상 ID'), { target: { value: 'video-1' } });
    fireEvent.change(within(context).getByLabelText('영상 이름'), { target: { value: ' 가을 특집 ' } });
    fireEvent.click(within(context).getByRole('button', { name: '영상 소속 저장' }));
    expect(await within(context).findByText(/영상 소속을 저장했어요/u)).toBeTruthy();

    await loadDraft();
    fireEvent.click(screen.getByRole('button', { name: '미리보기 준비' }));

    // SAFETY: the title query returns the preview iframe.
    const frame = (await screen.findByTitle('플레이어 미리보기 화면')) as HTMLIFrameElement;
    const post = vi.spyOn(frame.contentWindow!, 'postMessage');

    fireEvent.load(frame);

    expect(post.mock.lastCall?.[0]).toMatchObject({ schedule, title: '가을 특집' });
  });

  it('plays content from another origin, as the loader takes it', async () => {
    const schedule = { videoId: 'video-1', breaks: [] };

    serve({ 'schedule-draft': DRAFT_REPLY, 'schedule-preview': () => ok({ schedule }) });
    await openSchedule();
    await loadDraft();
    fireEvent.change(await screen.findByLabelText('본편 영상 URL'), {
      target: { value: 'https://cdn.example/content.mp4' },
    });
    fireEvent.change(screen.getByLabelText('고정 영상 ID'), { target: { value: 'video-1' } });
    fireEvent.click(screen.getByRole('button', { name: '미리보기 준비' }));

    // SAFETY: the title query returns the preview iframe.
    const frame = (await screen.findByTitle('플레이어 미리보기 화면')) as HTMLIFrameElement;
    const post = vi.spyOn(frame.contentWindow!, 'postMessage');

    fireEvent.load(frame);

    expect(post.mock.lastCall?.[0]).toMatchObject({ schedule, content: 'https://cdn.example/content.mp4' });
  });

  it('puts the preset pick in the preview card, and the test links follow it', async () => {
    serve({ 'schedule-draft': DRAFT_REPLY });
    await openSchedule();

    const card = screen.getByRole('region', { name: '게시 전 미리보기' });
    const select = within(card).getByLabelText<HTMLSelectElement>('적용할 프리셋');

    expect(within(card).getByText('통계에 남기지 않아요')).toBeTruthy();
    expect(within(card).getByText('고른 프리셋 모양으로 이 초안을 재생해요. 편성에는 저장되지 않아요.')).toBeTruthy();
    expect(within(card).queryByRole('button', { name: '데모에서 열기' })).toBeNull();

    await waitFor(() => expect(select.disabled).toBe(false));
    expect([...select.options].map((option) => option.text)).toContain('기본 (사이트 적용)');

    fireEvent.change(screen.getByLabelText('고정 영상 ID'), { target: { value: 'video-1' } });
    fireEvent.change(select, { target: { value: 'p-brand00001' } });

    expect(href(/Video.js로 재생/u).searchParams.get('preset')).toBe('p-brand00001');
    expect(screen.getAllByLabelText(/프리셋/u).filter((element) => element.tagName === 'SELECT')).toHaveLength(1);
  });

  it('says the list may be old when a later read fails, and that help stops the preview', async () => {
    serve({ 'schedule-draft': DRAFT_REPLY, 'player-presets': presetReads(ok(LIST), fail(500, 'server_error')) });
    await openSchedule();
    await waitFor(() => expect(control(screen.getByLabelText('적용할 프리셋')).disabled).toBe(false));

    expect(screen.getByText(/도움말이나 다른 메뉴를 열면 미리보기가 멈춰요\./u)).toBeTruthy();

    go('#/dashboard');
    go('#/schedule');

    expect(await screen.findByText(/최신 프리셋 목록을 불러오지 못했어요\. 이전 목록으로 보여 줘요\./u)).toBeTruthy();
    expect(control(screen.getByLabelText('적용할 프리셋')).value).toBe('default');
  });
});

describe('PlayersScreen with a save made elsewhere', () => {
  // Another tab saved the brand preset with an ad accent color (QA PL08).
  const THEIRS = { ...BRAND, ads: { ...BRAND.ads, accentColor: '#ff8800' } };
  const NEWER = { ...LIST, revision: 6, presets: [BUILT_IN, THEIRS, NATIVE] };

  /** The first list read returns `LIST`, later ones the list after the other save. */
  function lists() {
    let reads = 0;

    return () => ok((reads += 1) === 1 ? LIST : NEWER);
  }

  const adAccent = () => screen.getByRole('textbox', { name: '광고 강조색' });
  const saves = (fetch: ReturnType<typeof serve>) => actions(fetch).filter((action) => action === 'player-preset-save');

  it('takes the other save into the draft after a 409 and the reload, and saves both changes', async () => {
    let saveCalls = 0;
    const fetch = serve({
      'player-presets': lists(),
      'player-preset-save': () =>
        (saveCalls += 1) === 1 ? fail(409, 'revision_conflict') : ok({ saved: THEIRS, list: NEWER }),
    });

    await open('#/players/edit/p-brand00001');
    fireEvent.change(await screen.findByLabelText('이름'), { target: { value: '바뀐 이름' } });
    fireEvent.click(screen.getByRole('button', { name: '프리셋 저장' }));
    fireEvent.click(await screen.findByRole('button', { name: '프리셋 목록 다시 불러오기' }));

    expect(
      await screen.findByText(/그쪽에서 바꾼 값\(광고 강조색\)을 입력에 반영했어요\. 확인한 뒤 다시 저장해 주세요\./u)
    ).toBeTruthy();
    expect(adAccent()).toHaveProperty('value', '#ff8800');
    expect(input('이름').value).toBe('바뀐 이름');

    fireEvent.click(screen.getByRole('button', { name: '프리셋 저장' }));
    await waitFor(() => expect(saves(fetch)).toHaveLength(2));
    expect(sent(fetch, 'player-preset-save', 1)).toMatchObject({
      revision: 6,
      preset: { name: '바뀐 이름', ads: { accentColor: '#ff8800' } },
    });
  });

  it.each([
    ['다른 곳에서 저장한 값 쓰기', '#ff8800'],
    ['내 입력 유지', '#000000'],
  ])('asks which value to keep when both sides changed a field (%s)', async (choice, expected) => {
    const fetch = serve({
      'player-presets': lists(),
      'player-preset-save': () =>
        saves(fetch).length === 1 ? fail(409, 'revision_conflict') : ok({ saved: THEIRS, list: NEWER }),
    });

    await open('#/players/edit/p-brand00001');
    fireEvent.change(await screen.findByRole('textbox', { name: '광고 강조색' }), {
      target: { value: '#000000' },
    });
    fireEvent.click(screen.getByRole('button', { name: '프리셋 저장' }));
    fireEvent.click(await screen.findByRole('button', { name: '프리셋 목록 다시 불러오기' }));

    expect(await screen.findByText('다른 곳에서도 바꾼 항목이 있어요')).toBeTruthy();
    expect(screen.getByText(/광고 강조색: 내 입력 #000000 · 다른 곳에서 저장한 값 #ff8800/u)).toBeTruthy();

    // No save goes out until a side is picked.
    fireEvent.click(screen.getByRole('button', { name: '프리셋 저장' }));
    expect(saves(fetch)).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: choice }));
    expect(adAccent()).toHaveProperty('value', expected);
    expect(screen.queryByText('다른 곳에서도 바꾼 항목이 있어요')).toBeNull();
    // The choice buttons are gone; focus moves to the field the choice settled, not the page body.
    await waitFor(() => expect(document.activeElement).toBe(adAccent()));

    fireEvent.click(screen.getByRole('button', { name: '프리셋 저장' }));
    await waitFor(() => expect(saves(fetch)).toHaveLength(2));
    expect(sent(fetch, 'player-preset-save', 1)).toMatchObject({
      revision: 6,
      preset: { ads: { accentColor: expected } },
    });
  });

  it('does not save over a change it learned about from a later list read', async () => {
    const fetch = serve({
      'player-presets': lists(),
      'player-preset-save': () => ok({ saved: THEIRS, list: NEWER }),
    });

    await open('#/players/edit/p-brand00001');
    fireEvent.change(await screen.findByLabelText('이름'), { target: { value: '바뀐 이름' } });

    // Leaving and coming back reads the list again; it now has the other save, with no 409 involved.
    go('#/creatives');
    go('#/players/edit/p-brand00001');
    await waitFor(() => expect(actions(fetch).filter((action) => action === 'player-presets')).toHaveLength(2));

    fireEvent.click(screen.getByRole('button', { name: '프리셋 저장' }));
    expect(await screen.findByText(/그쪽에서 바꾼 값\(광고 강조색\)을 입력에 반영했어요/u)).toBeTruthy();
    expect(saves(fetch)).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: '프리셋 저장' }));
    await waitFor(() => expect(saves(fetch)).toHaveLength(1));
    expect(sent(fetch, 'player-preset-save')).toMatchObject({
      revision: 6,
      preset: { name: '바뀐 이름', ads: { accentColor: '#ff8800' } },
    });
  });
});

describe('PresetEditor color format errors', () => {
  /** Enter submits the form unless the focused control cancels the key, as a browser's implicit submission does. */
  function pressEnter(element: HTMLElement) {
    if (fireEvent.keyDown(element, { key: 'Enter' })) fireEvent.submit(element.closest('form')!);
  }

  // A click or another field takes focus (blur) first; Enter in the color field commits the text itself.
  it.each([
    ['clicking 프리셋 저장', true, () => fireEvent.click(screen.getByRole('button', { name: '프리셋 저장' }))],
    ['Enter in the color field', false, () => pressEnter(screen.getByRole('textbox', { name: '강조색' }))],
    ['Enter in another field', true, () => pressEnter(screen.getByLabelText('이름'))],
  ])('sends nothing for #GGG (QA PL09) on %s', async (_, blurFirst, submit) => {
    const fetch = serve({ 'player-preset-save': () => ok({ saved: BRAND, list: LIST }) });

    await open('#/players/new');
    fireEvent.change(screen.getByLabelText('이름'), { target: { value: '새 프리셋' } });

    const accent = screen.getByRole('textbox', { name: '강조색' });

    fireEvent.change(accent, { target: { value: '#GGG' } });

    if (blurFirst) fireEvent.blur(accent);

    submit();

    expect(accent.getAttribute('aria-invalid')).toBe('true');
    expect(actions(fetch)).not.toContain('player-preset-save');
  });
});

describe('PlannedNote', () => {
  it.each([['#/players', 'standalone', ['프리셋 변경 이력과 되돌리기']]] as const)(
    'marks the contract 3.2 features that are not built yet on %s (QA PL23)',
    async (hash, host, names) => {
      serve({}, host);
      await open(hash);

      await screen.findByText('준비 중인 기능');

      for (const name of names) expect(screen.getByText(`${name} · 준비 중.`)).toBeTruthy();
    }
  );

  it('drops the marks for features schema v2 built', async () => {
    serve({});
    await open('#/players/new');
    await screen.findByRole('heading', { name: '광고 화면' });

    expect(screen.queryByText('준비 중인 기능')).toBeNull();
    expect(document.body.textContent).not.toMatch(/compat·scaffold|광고 시간 제한 · 준비 중|로고·워터마크 · 준비 중/u);

    go('#/players/setup');
    await screen.findByRole('heading', { name: '설치 순서' });
    expect(document.body.textContent).not.toContain('프리셋 ID로 불러오는 설치 코드');
  });
});
