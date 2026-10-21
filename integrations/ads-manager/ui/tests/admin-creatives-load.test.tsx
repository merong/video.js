import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import type { Bootstrap } from '../src/api/actions';
import { AdminApi } from '../src/api/client';
import type { Creative } from '../src/api/model';
import { App } from '../src/app/App';

interface Reply {
  status?: number;
  body: unknown;
}

type Handler = () => Reply | Promise<Reply>;

function bootstrap(): Bootstrap {
  return {
    authenticated: true,
    csrfToken: 'token-1',
    capabilities: {
      host: 'standalone',
      manualTargets: true,
      uploads: true,
      loginUrl: null,
      siteUrl: null,
      adminUrl: null,
    },
    site: { siteId: 'site-1', timeZone: 'Asia/Seoul' },
    playerModuleUrl: '/assets/ads.js',
    limits: { uploadBytes: 8 * 1024 * 1024 },
    user: { displayName: '운영자' },
  };
}

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- any JSON payload the fake API returns.
const ok = (data: unknown): Reply => ({ body: { ok: true, data } });
const fail = (status: number, code: string): Reply => ({
  status,
  body: { ok: false, error: { code, message: `server ${code}`, fields: {} } },
});

function creative(creativeId: string, name: string, archived = false): Creative {
  return {
    creativeId,
    version: 1,
    name,
    kind: 'video',
    url: '/media/ad.mp4',
    mime: 'video/mp4',
    alt: '',
    source: 'url',
    archived,
    createdAt: '2026-10-20T00:00:00Z',
  };
}

const SPRING = creative('cr-1', '봄 광고');
const OLD = creative('cr-2', '지난 광고', true);

const DRAFT = {
  target: { type: 'site', id: 'site-1' },
  mode: 'replace',
  revision: 2,
  breaks: [
    {
      breakId: 'break-1',
      position: 'pre',
      ads: [
        {
          itemId: 'item-1',
          adId: 'cr-1',
          creativeId: 'cr-1',
          creativeVersion: 1,
          kind: 'video',
          url: '/media/ad.mp4',
          mime: 'video/mp4',
          alt: '',
          clickUrl: null,
          skipAfterSeconds: null,
        },
        {
          itemId: 'item-2',
          adId: 'cr-2',
          creativeId: 'cr-2',
          creativeVersion: 1,
          kind: 'video',
          url: '/media/old.mp4',
          mime: 'video/mp4',
          alt: '',
          clickUrl: null,
          skipAfterSeconds: null,
        },
      ],
    },
  ],
};

/** Each call takes the next reply; a function reply may hold the response back. */
function sequence(...replies: Handler[]): Handler {
  let calls = 0;

  return () => {
    calls += 1;
    return replies[Math.min(calls, replies.length) - 1]!();
  };
}

/** A reply the test sends later, for out-of-order responses. */
function deferred() {
  let send: (reply: Reply) => void = () => {};
  const reply = new Promise<Reply>((resolve) => (send = resolve));

  return { handler: () => reply, send: (value: Reply) => act(async () => send(value)) };
}

function serve(handlers: Record<string, Handler>) {
  const fetch = vi.fn(async (input: string) => {
    const action = new URL(input).searchParams.get('action') ?? '';
    const all = new Map<string, Handler>(
      Object.entries({
        bootstrap: () => ok(bootstrap()),
        creatives: () => ok({ items: [] }),
        'player-presets': () => ok({ revision: 0, defaultPresetId: 'default', presets: [] }),
        'schedule-draft': () => ok({ draft: DRAFT, publishedVersion: null, resolvedFrom: null }),
        ...handlers,
      })
    );
    const handler = all.get(action);
    if (!handler) throw new Error(`unexpected action ${action}`);

    const { status = 200, body } = await handler();

    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  });

  vi.stubGlobal('fetch', fetch);
  return fetch;
}

const reads = (fetch: ReturnType<typeof serve>) =>
  fetch.mock.calls.filter(([input]) => new URL(input).searchParams.get('action') === 'creatives').length;

function go(hash: string) {
  act(() => {
    location.hash = hash;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}

async function open(hash: string, heading: string) {
  history.replaceState(null, '', `/${hash}`);
  render(<App api={new AdminApi('http://admin.test/ads/api/index.php')} publicBase="/ads/" />);
  await screen.findByRole('heading', { level: 1, name: heading });
}

async function loadSchedule() {
  fireEvent.click(screen.getByRole('button', { name: '편성 불러오기' }));
  await screen.findByRole('button', { name: '소재 목록 새로고침' });
}

const banner = () => screen.queryByRole('button', { name: '소재 목록 다시 불러오기' });

const choices = () =>
  within(screen.getByLabelText('추가할 소재'))
    .getAllByRole('option')
    .map((option) => option.textContent);

beforeEach(() => {
  history.replaceState(null, '', '/');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Workspace', () => {
  it('reads creatives only once a screen that uses them opens', async () => {
    const fetch = serve({});

    await open('#/players', '플레이어');
    go('#/help');
    expect(reads(fetch)).toBe(0);

    go('#/schedule');
    await waitFor(() => expect(reads(fetch)).toBe(1));

    go('#/creatives');
    await screen.findByText('아직 등록한 소재가 없어요.');
    expect(reads(fetch)).toBe(1);
  });

  it('shows loading instead of an empty list until the creatives arrive', async () => {
    const list = deferred();

    serve({ creatives: list.handler });
    await open('#/creatives', '소재');

    expect(screen.getByText('소재 목록을 불러오고 있어요.')).toBeTruthy();
    expect(screen.queryByText('아직 등록한 소재가 없어요.')).toBeNull();

    go('#/schedule');
    await loadSchedule();
    expect(choices()[0]).toBe('소재 목록을 불러오고 있어요');

    await list.send(ok({ items: [SPRING] }));
    expect(choices()).toEqual(['소재 버전을 선택해 주세요', '봄 광고 · v1 · 영상']);
  });

  it('shows a failed load with a retry on the creative screens only', async () => {
    const fetch = serve({
      creatives: sequence(
        () => fail(500, 'server_error'),
        () => ok({ items: [SPRING] })
      ),
    });

    await open('#/creatives', '소재');
    expect(await screen.findByText('소재 목록을 불러오지 못했어요.')).toBeTruthy();
    expect(banner()).toBeTruthy();

    go('#/players');
    expect(banner()).toBeNull();

    go('#/schedule');
    expect(banner()).toBeTruthy();

    fireEvent.click(banner()!);
    await waitFor(() => expect(banner()).toBeNull());
    expect(reads(fetch)).toBe(2);

    go('#/creatives');
    expect(await screen.findByText('봄 광고')).toBeTruthy();
  });

  it('offers to reconnect after a 401 and reads the list again once connected', async () => {
    const fetch = serve({
      creatives: sequence(
        () => fail(401, 'unauthorized'),
        () => ok({ items: [SPRING] })
      ),
    });

    await open('#/creatives', '소재');
    fireEvent.click(await screen.findByRole('button', { name: '연결 다시 확인' }));

    expect(await screen.findByText('봄 광고')).toBeTruthy();
    expect(banner()).toBeNull();
    expect(reads(fetch)).toBe(2);
  });

  it('keeps a newer list when an older response arrives last', async () => {
    const first = deferred();

    serve({ creatives: sequence(first.handler, () => ok({ items: [SPRING] })) });
    await open('#/schedule', '지면 편성');
    await loadSchedule();

    fireEvent.click(screen.getByRole('button', { name: '소재 목록 새로고침' }));
    await screen.findByText('소재 1개를 다시 불러왔어요.');

    await first.send(ok({ items: [] }));
    expect(choices()).toEqual(['소재 버전을 선택해 주세요', '봄 광고 · v1 · 영상']);
  });

  it('keeps the failed banner off when a newer read succeeded', async () => {
    const first = deferred();

    serve({ creatives: sequence(first.handler, () => ok({ items: [SPRING] })) });
    await open('#/schedule', '지면 편성');
    await loadSchedule();

    fireEvent.click(screen.getByRole('button', { name: '소재 목록 새로고침' }));
    await screen.findByText('소재 1개를 다시 불러왔어요.');

    await first.send(fail(500, 'server_error'));
    expect(banner()).toBeNull();
  });
});

describe('BreakEditor', () => {
  it('names items by creative and warns about archived ones', async () => {
    serve({ creatives: () => ok({ items: [SPRING, OLD] }) });
    await open('#/schedule', '지면 편성');
    await loadSchedule();

    expect(await screen.findByText('1. 봄 광고')).toBeTruthy();
    expect(screen.getByText('2. 지난 광고')).toBeTruthy();
    expect(screen.getByText(/보관된 소재: 게시 전에 제거하거나 교체해 주세요\./u)).toBeTruthy();
    // Archived creatives cannot be added again.
    expect(choices()).toEqual(['소재 버전을 선택해 주세요', '봄 광고 · v1 · 영상']);
  });

  it('reads the creative list again on request and says when that fails', async () => {
    serve({
      creatives: sequence(
        () => ok({ items: [] }),
        () => ok({ items: [SPRING] }),
        () => fail(500, 'server_error')
      ),
    });
    await open('#/schedule', '지면 편성');
    await loadSchedule();

    fireEvent.click(screen.getByRole('button', { name: '소재 목록 새로고침' }));
    expect(await screen.findByText('소재 1개를 다시 불러왔어요.')).toBeTruthy();
    expect(choices()).toContain('봄 광고 · v1 · 영상');

    fireEvent.click(screen.getByRole('button', { name: '소재 목록 새로고침' }));
    expect(await screen.findByRole('button', { name: '소재 목록 다시 불러오기' })).toBeTruthy();
    // The list on screen stays usable.
    expect(choices()).toContain('봄 광고 · v1 · 영상');
  });
});

describe('CreativesScreen', () => {
  it('reports an archive as done even when the list reload after it fails', async () => {
    serve({
      creatives: sequence(
        () => ok({ items: [SPRING] }),
        () => fail(500, 'server_error')
      ),
      'creative-archive': () => ok({}),
    });
    await open('#/creatives', '소재');

    fireEvent.click(await screen.findByRole('button', { name: '보관' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: '보관' }));

    expect(
      await screen.findByText('소재를 보관했어요. 목록은 다시 읽지 못했어요. 새로고침을 눌러 주세요.')
    ).toBeTruthy();
  });
});
