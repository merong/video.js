import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import type { Bootstrap } from '../src/api/actions';
import { AdminApi } from '../src/api/client';
import { App } from '../src/app/App';
import { clock, generateBlock } from '../src/screens/VideosScreen';

interface Reply {
  status?: number;
  body: unknown;
}

type Handler = (url: URL, init: RequestInit) => Reply;

function bootstrap(canWrite = true): Bootstrap {
  return {
    authenticated: true,
    csrfToken: 'token-1',
    capabilities: { host: 'gnuboard', manualTargets: false, uploads: true, loginUrl: '/bbs/login.php' },
    site: { siteId: 'site-1', timeZone: 'Asia/Seoul' },
    playerModuleUrl: '/assets/ads.js',
    limits: { uploadBytes: 8 * 1024 * 1024 },
    user: { displayName: '운영자', canWrite },
  };
}

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- any JSON payload the fake API returns.
const ok = (data: unknown): Reply => ({ body: { ok: true, data } });

const FOUND = {
  available: true,
  ffmpeg: { path: '/opt/homebrew/bin/ffmpeg', version: '8.0.1' },
  ffprobe: { path: '/opt/homebrew/bin/ffprobe', version: '8.0.1' },
  reason: null,
  message: null,
};
const MISSING = {
  available: false,
  ffmpeg: null,
  ffprobe: null,
  reason: 'not_found',
  message: 'ffmpeg를 찾지 못했어요.',
};
// What a read-only account gets: the server drops the paths.
const MASKED = { ...FOUND, ffmpeg: { path: null, version: '8.0.1' }, ffprobe: { path: null, version: '8.0.1' } };
const none = { status: 'none', url: null, message: null };

const VIDEO = {
  boardId: 'video',
  boardSubject: '동영상',
  postId: 7,
  title: '여름 여행',
  secret: false,
  source: 'file',
  duration: 65,
  createdAt: '2026-10-20 09:30:00',
  postUrl: '/bbs/board.php?bo_table=video&wr_id=7',
  location: { address: '/data/file/video/1234_summer.mp4', name: '여름 여행.mp4' },
  features: {
    cover: none,
    thumbnails: none,
    highlight: { ...none, status: 'disabled', message: '게시판 설정에서 꺼져 있어요.' },
  },
};
const EXTERNAL = {
  ...VIDEO,
  postId: 8,
  title: '외부 영상',
  source: 'url',
  location: { address: 'https://cdn.example.com/trip.mp4', name: null },
  features: Object.fromEntries(
    ['cover', 'thumbnails', 'highlight'].map((name) => [
      name,
      { status: 'unsupported', url: null, message: '외부 주소 영상이라 만들 수 없어요.' },
    ])
  ),
};
const READY = {
  ...VIDEO,
  features: {
    cover: { status: 'ready', url: '/data/file/video/solad/7/cover.jpg?v=1', message: null },
    thumbnails: {
      status: 'ready',
      url: '/data/file/video/solad/7/thumbnails.vtt?v=1',
      image: '/data/file/video/solad/7/thumbnails.jpg?v=1',
      message: null,
    },
    highlight: VIDEO.features.highlight,
  },
};

const ITEMS = [VIDEO, EXTERNAL];
const internal = (item: { source: string }) => item.source === 'file' || item.source === 'hls_zip';

/** The list the server sends for `place`; `counts` ignores it, `total` does not (BRIEF-V1). */
function list(
  media: typeof FOUND | typeof MISSING | typeof MASKED = FOUND,
  place = 'internal',
  items: readonly { source: string }[] = ITEMS
) {
  const shown = items.filter((item) => !place || (place === 'internal') === internal(item));

  return ok({
    media,
    boards: [
      {
        id: 'video',
        subject: '동영상',
        features: ['cover', 'thumbnails'],
        formUrl: '/adm/board_form.php?w=u&bo_table=video',
      },
    ],
    items: shown,
    page: 1,
    pageSize: 20,
    total: shown.length,
    counts: {
      internal: items.filter(internal).length,
      external: items.filter((item) => !internal(item)).length,
    },
  });
}

const byPlace =
  (
    media: typeof FOUND | typeof MISSING | typeof MASKED = FOUND,
    items: readonly { source: string }[] = ITEMS
  ): Handler =>
  (url) =>
    list(media, url.searchParams.get('place') ?? '', items);

function serve(handlers: Record<string, Handler>, canWrite = true) {
  const fetch = vi.fn(async (input: string, init: RequestInit = {}) => {
    const action = new URL(input).searchParams.get('action') ?? '';
    const handler = new Map<string, Handler>(
      Object.entries({ bootstrap: () => ok(bootstrap(canWrite)), creatives: () => ok({ items: [] }), ...handlers })
    ).get(action);
    if (!handler) throw new Error(`unexpected action ${action}`);

    const { status = 200, body } = handler(new URL(input), init);

    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  });

  vi.stubGlobal('fetch', fetch);
  return fetch;
}

const LOAD_WAIT = { timeout: 4000 };

async function open() {
  history.replaceState(null, '', '/#/uploaded-videos');
  render(<App api={new AdminApi('http://admin.test/ads/api/index.php')} publicBase="/ads/" />);
  await screen.findByRole('heading', { level: 1, name: '업로드 동영상' }, LOAD_WAIT);
  await screen.findByText('여름 여행', undefined, LOAD_WAIT);
}

const row = (title: string) => {
  const cell = screen.getByRole('heading', { level: 3, name: title }).closest('li');
  if (!cell) throw new Error(`no row ${title}`);

  return within(cell);
};

beforeEach(() => {
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

describe('VideosScreen', () => {
  it('shows ffmpeg, the board features and a badge per feature', async () => {
    serve({ 'uploaded-videos': byPlace() });
    await open();

    expect(screen.getByText('8.0.1 · /opt/homebrew/bin/ffmpeg')).toBeTruthy();
    expect(screen.getByText('하이라이트 꺼짐')).toBeTruthy();
    expect(screen.getByRole('link', { name: /게시판 설정/u }).getAttribute('href')).toBe(
      '/adm/board_form.php?w=u&bo_table=video'
    );
    expect(row('여름 여행').getByText('하이라이트 · 꺼짐')).toBeTruthy();
  });

  it('splits internal and external videos into place tabs with the counts', async () => {
    const fetch = serve({ 'uploaded-videos': byPlace() });

    await open();

    const places = () =>
      fetch.mock.calls
        .map(([input]) => new URL(input).searchParams)
        .filter((params) => params.get('action') === 'uploaded-videos')
        .map((params) => [params.get('place'), params.get('page')]);

    expect(screen.getByRole('radiogroup', { name: '영상 위치' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: '내부 영상 1' })).toHaveProperty('checked', true);
    expect(screen.queryByRole('heading', { level: 3, name: '외부 영상' })).toBeNull();
    expect(screen.queryByText(/외부 주소 영상은/u)).toBeNull();

    fireEvent.click(screen.getByRole('radio', { name: '외부 주소 1' }));

    await screen.findByRole('heading', { level: 3, name: '외부 영상' }, LOAD_WAIT);
    expect(screen.queryByRole('heading', { level: 3, name: '여름 여행' })).toBeNull();
    // One note above the list, no make button and no row of "못 만듦" badges per item.
    expect(screen.getAllByText(/외부 주소 영상은 사이트에 파일이 없어/u)).toHaveLength(1);
    expect(row('외부 영상').queryByRole('button', { name: /모두 만들기/u })).toBeNull();
    expect(row('외부 영상').queryByText('커버 · 못 만듦')).toBeNull();
    expect(row('외부 영상').getByRole('button', { name: '외부 영상 관리' })).toBeTruthy();
    expect(places()).toEqual([
      ['internal', '1'],
      ['external', '1'],
    ]);
  });

  it('lays each video out as a cover beside two lines with its path or address', async () => {
    serve({ 'uploaded-videos': byPlace(FOUND, [READY, EXTERNAL]) });
    await open();

    const item = screen.getByRole('heading', { level: 3, name: '여름 여행' }).closest('li');
    const [cover, head, body] = Array.from(item?.children ?? []);

    expect(cover?.getAttribute('src')).toBe('/data/file/video/solad/7/cover.jpg?v=1');
    expect(head?.textContent).toContain('7번');
    expect(head?.textContent).toContain('첨부 파일');
    expect(body?.textContent).toContain('경로');
    expect(body?.textContent).toContain('원래 파일 여름 여행.mp4');
    expect(row('여름 여행').getByRole('button', { name: '여름 여행 추가 기능 모두 만들기' })).toBeTruthy();

    const path = row('여름 여행').getByRole('link', { name: /1234_summer\.mp4/u });

    expect(path.getAttribute('href')).toBe('/data/file/video/1234_summer.mp4');
    expect(path.getAttribute('target')).toBe('_blank');
    expect(path.getAttribute('rel')).toBe('noopener noreferrer');
    expect(path.getAttribute('title')).toBe('/data/file/video/1234_summer.mp4');

    fireEvent.click(screen.getByRole('radio', { name: '외부 주소 1' }));

    const address = await screen.findByRole('link', { name: /cdn\.example\.com/u }, LOAD_WAIT);

    expect(address.getAttribute('href')).toBe('https://cdn.example.com/trip.mp4');
    expect(row('외부 영상').getByText('주소')).toBeTruthy();
  });

  it('keeps an unsafe address as text and says why one is missing', async () => {
    const unsafe = {
      ...EXTERNAL,
      postId: 9,
      title: '이상한 주소',
      location: { address: 'javascript:alert(1)', name: null },
    };
    const lost = { ...VIDEO, postId: 10, title: '잃은 파일', location: { address: null, name: null } };

    serve({ 'uploaded-videos': byPlace(FOUND, [VIDEO, lost, unsafe]) });
    await open();

    expect(row('잃은 파일').getByText('영상 파일을 찾지 못했어요.')).toBeTruthy();

    fireEvent.click(screen.getByRole('radio', { name: '외부 주소 1' }));
    await screen.findByRole('heading', { level: 3, name: '이상한 주소' }, LOAD_WAIT);

    expect(row('이상한 주소').queryByRole('link')).toBeNull();
    expect(row('이상한 주소').getByText('javascript:alert(1)')).toBeTruthy();
  });

  it('says a read-only account sees no address for a secret post, also in the dialog', async () => {
    const secret = { ...VIDEO, secret: true, location: { address: null, name: null } };

    serve({ 'uploaded-videos': byPlace(MASKED, [secret]) }, false);
    await open();

    expect(row('여름 여행').getByText('비밀글이라 숨겼어요.')).toBeTruthy();

    fireEvent.click(row('여름 여행').getByRole('button', { name: '여름 여행 관리' }));

    const location = within(screen.getByRole('table', { name: '영상 위치' }));

    expect(location.getByRole('rowheader', { name: '경로' })).toBeTruthy();
    expect(location.getByText('비밀글이라 숨겼어요.')).toBeTruthy();
  });

  it('generates every enabled feature and reloads only that row', async () => {
    const fetch = serve({
      'uploaded-videos': byPlace(),
      'uploaded-video-generate': () => ok({ item: READY, failed: [] }),
    });

    await open();

    fireEvent.click(row('여름 여행').getByRole('button', { name: '여름 여행 추가 기능 모두 만들기' }));

    await waitFor(() => expect(row('여름 여행').getByText('커버')).toBeTruthy());
    const call = fetch.mock.calls.find(
      ([input]) => new URL(input).searchParams.get('action') === 'uploaded-video-generate'
    );

    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ boardId: 'video', postId: 7, feature: 'all' });
    expect(
      screen
        .getByRole('heading', { level: 3, name: '여름 여행' })
        .closest('li')
        ?.querySelector('img')
        ?.getAttribute('src')
    ).toBe('/data/file/video/solad/7/cover.jpg?v=1');
    expect(
      fetch.mock.calls.filter(([input]) => new URL(input).searchParams.get('action') === 'uploaded-videos')
    ).toHaveLength(1);
    expect(screen.getByText('「여름 여행」의 추가 기능을 만들었어요.')).toBeTruthy();
  });

  it('previews the made files in the dialog and deletes one feature', async () => {
    const fetch = serve({
      'uploaded-videos': byPlace(FOUND, [READY]),
      'uploaded-video-delete': () => ok({ item: { ...READY, features: { ...READY.features, cover: none } } }),
    });

    history.replaceState(null, '', '/#/uploaded-videos');
    render(<App api={new AdminApi('http://admin.test/ads/api/index.php')} publicBase="/ads/" />);
    fireEvent.click(await screen.findByRole('button', { name: '여름 여행 관리' }, LOAD_WAIT));

    const dialog = within(screen.getByRole('dialog'));

    expect(
      within(dialog.getByRole('table', { name: '영상 위치' }))
        .getByRole('link', { name: /1234_summer\.mp4/u })
        .getAttribute('href')
    ).toBe('/data/file/video/1234_summer.mp4');

    expect(dialog.getByRole('img', { name: '여름 여행 진행바 썸네일 모음' }).getAttribute('src')).toBe(
      '/data/file/video/solad/7/thumbnails.jpg?v=1'
    );
    expect(dialog.getByRole('button', { name: '만들기' }).hasAttribute('disabled')).toBe(true);
    fireEvent.click(within(dialog.getByRole('region', { name: '커버' })).getByRole('button', { name: '지우기' }));

    await waitFor(() => expect(dialog.queryByRole('img', { name: '여름 여행 커버' })).toBeNull());
    const call = fetch.mock.calls.find(
      ([input]) => new URL(input).searchParams.get('action') === 'uploaded-video-delete'
    );

    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ boardId: 'video', postId: 7, feature: 'cover' });
  });

  it('turns the buttons off with a reason for a read-only account or without ffmpeg', async () => {
    serve({ 'uploaded-videos': byPlace(MISSING) }, false);
    await open();

    expect(screen.getByText('읽기 전용 계정이라 만들거나 지울 수 없어요.')).toBeTruthy();
    expect(screen.getByText('ffmpeg를 찾지 못했어요.')).toBeTruthy();
    expect(
      row('여름 여행').getByRole('button', { name: '여름 여행 추가 기능 모두 만들기' }).hasAttribute('disabled')
    ).toBe(true);
  });

  it('shows only the versions when the server hides the paths from a read-only account', async () => {
    serve({ 'uploaded-videos': byPlace(MASKED) }, false);
    await open();

    expect(screen.getByText('찾았어요')).toBeTruthy();
    expect(screen.getAllByText('8.0.1')).toHaveLength(2);
    expect(screen.queryByText(/\/opt\/homebrew/u)).toBeNull();
  });
});

describe('generateBlock', () => {
  const video = {
    ...VIDEO,
    source: 'file' as const,
    features: {
      cover: { status: 'none' as const, url: null, image: null, message: null },
      thumbnails: { status: 'disabled' as const, url: null, image: null, message: null },
      highlight: { status: 'disabled' as const, url: null, image: null, message: null },
    },
  };
  const found = { ...FOUND, reason: null };

  it('says why a feature cannot be made', () => {
    expect(generateBlock(video, 'cover', found, true)).toBeNull();
    expect(generateBlock(video, 'thumbnails', found, true)).toBe('게시판 설정에서 꺼져 있어요.');
    expect(generateBlock(video, 'all', found, true)).toBeNull();
    expect(generateBlock(video, 'cover', { ...found, available: false }, true)).toBe(
      'ffmpeg를 찾지 못해 만들 수 없어요.'
    );
    expect(generateBlock(video, 'cover', found, false)).toBe('읽기 전용 계정이라 만들거나 지울 수 없어요.');
  });
});

describe('clock', () => {
  it('formats seconds', () => {
    expect([clock(65), clock(3725)]).toEqual(['1:05', '1:02:05']);
  });
});
