import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import type { Bootstrap } from '../src/api/actions';
import { AdminApi } from '../src/api/client';
import type { LogoLibrary } from '../src/api/logos';
import { App } from '../src/app/App';
import { READ_ONLY_TEXT } from '../src/app/status';
import { DEFAULT_PLAYER_PRESET, parsePlayerPreset, type PlayerLogo, presetRender } from '../src/player';
import { previewLogo } from '../src/screens/logo-library';
import { checkImage, uploadProblem } from '../src/screens/LogoPicker';
import { formFromPreset, presetInput, updateForm } from '../src/screens/preset-form';

interface Reply {
  status?: number;
  body: unknown;
}

type Handler = (url: URL, init: RequestInit) => Reply;

function bootstrap(canWrite: boolean): Bootstrap {
  return {
    authenticated: true,
    csrfToken: 'token-1',
    capabilities: {
      host: 'gnuboard',
      manualTargets: false,
      uploads: true,
      loginUrl: '/bbs/login.php',
      siteUrl: 'https://site.test/',
      adminUrl: 'https://site.test/adm/',
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

const HEX = '0123456789abcdef0123456789abcdef';
const NEW_HEX = 'fedcba9876543210fedcba9876543210';
const LIMITS = {
  bytes: 1024 * 1024,
  count: 50,
  mimes: ['image/png', 'image/svg+xml', 'image/gif', 'image/webp', 'image/jpeg'],
};
const SAMPLE = {
  logoId: 'sample',
  name: '샘플 로고',
  url: '/ads/player/logo-sample.svg',
  mime: 'image/svg+xml',
  builtIn: true,
  inUse: false,
};
const BRAND = {
  logoId: HEX,
  name: '브랜드 로고',
  url: `/data/solad/logos/${HEX}.png`,
  mime: 'image/png',
  bytes: 4096,
  width: 200,
  height: 80,
  builtIn: false,
  inUse: false,
};
const IN_USE = { ...BRAND, logoId: NEW_HEX.replace('f', 'e'), name: '쓰는 로고', inUse: true };
const LOGOS = { items: [SAMPLE, BRAND, IN_USE], limits: LIMITS };
const BUILT_IN = { ...DEFAULT_PLAYER_PRESET, builtIn: true, createdAt: null, updatedAt: null };
const LIST = { revision: 5, defaultPresetId: 'default', presets: [BUILT_IN], migratedNeutral: [] };
const SAVED = {
  ...LIST,
  revision: 6,
  preset: { ...DEFAULT_PLAYER_PRESET, id: 'p-site000001', name: '플레이어 설정', builtIn: false },
};

function serve(handlers: Record<string, Handler> = {}, canWrite = true) {
  const fetch = vi.fn(async (input: string, init: RequestInit = {}) => {
    const url = new URL(input);
    const action = url.searchParams.get('action') ?? '';
    const handler = new Map<string, Handler>(
      Object.entries({
        bootstrap: () => ok(bootstrap(canWrite)),
        creatives: () => ok({ items: [] }),
        'player-presets': () => ok(LIST),
        logos: () => ok(LOGOS),
        'player-preset-save': () => ok(SAVED),
        ...handlers,
      })
    ).get(action);
    if (!handler) throw new Error(`unexpected action ${action}`);

    const { status = 200, body } = handler(url, init);

    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  });

  vi.stubGlobal('fetch', fetch);
  return fetch;
}

function requests(fetch: ReturnType<typeof serve>, action: string) {
  return fetch.mock.calls.filter(([input]) => new URL(input).searchParams.get('action') === action);
}

function sent(fetch: ReturnType<typeof serve>, action: string) {
  const call = requests(fetch, action)[0];
  if (!call) throw new Error(`no ${action} request`);

  return JSON.parse(String(call[1]?.body));
}

/** Jsdom never loads images; an address with `broken` fails, `never` stays pending, any other is 200×80. */
class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 0;
  naturalHeight = 0;

  set src(value: string) {
    if (value.includes('never')) return;

    setTimeout(() => {
      if (value.includes('broken')) return this.onerror?.();

      this.naturalWidth = 200;
      this.naturalHeight = 80;
      this.onload?.();
    }, 0);
  }
}

// The default 1s wait is too short for the first render while every test file runs at once.
const LOAD_WAIT = { timeout: 4000 };

async function openSettings() {
  history.replaceState(null, '', '/#/players');
  render(<App api={new AdminApi('http://admin.test/ads/api/index.php')} publicBase="/ads/" />);
  await screen.findByRole('button', { name: '설정 저장' }, LOAD_WAIT);
}

async function openLibrary() {
  await openSettings();
  fireEvent.click(screen.getByRole('radio', { name: '보관함에서 고르기' }));
  await screen.findByRole('radio', { name: '브랜드 로고' }, LOAD_WAIT);
}

function fileInput(): HTMLInputElement {
  const input = document.querySelector('input[type="file"]');
  if (!(input instanceof HTMLInputElement)) throw new Error('no file input');

  return input;
}

function png(name: string, bytes: number): File {
  return new File([new Uint8Array(bytes)], name, { type: 'image/png' });
}

beforeEach(() => {
  vi.stubGlobal('Image', FakeImage);
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

describe('LogoPicker', () => {
  it('saves an uploaded library logo by its id', async () => {
    const fetch = serve();

    await openLibrary();
    fireEvent.click(screen.getByRole('radio', { name: '브랜드 로고' }));
    expect(screen.getByRole('group', { name: '로고 미리보기' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '설정 저장' }));
    await waitFor(() => expect(requests(fetch, 'player-preset-save')).toHaveLength(1));

    const { preset } = sent(fetch, 'player-preset-save');

    expect(preset.logo.assetId).toBe(HEX);
    expect(preset.logo).not.toHaveProperty('url');
  });

  it('uploads a dropped or chosen file and picks the new logo', async () => {
    const created = { ...BRAND, logoId: NEW_HEX, name: '새 로고' };
    const fetch = serve({
      'logo-upload': () => ok({ items: [...LOGOS.items, created], limits: LIMITS, logo: created }),
    });

    await openLibrary();
    fireEvent.change(fileInput(), { target: { files: [png('new.png', 2048)] } });

    expect(await screen.findByText(/새 로고 로고를 올리고 골랐어요/u)).toBeTruthy();
    expect(screen.getByRole('radio', { name: '새 로고' })).toHaveProperty('checked', true);

    const body = requests(fetch, 'logo-upload')[0]?.[1]?.body;

    expect(body).toBeInstanceOf(FormData);
    // SAFETY: checked just above.
    expect(((body as FormData).get('file') as File).name).toBe('new.png');
  });

  it('refuses a file over the size limit without sending it', async () => {
    const fetch = serve();

    await openLibrary();
    fireEvent.change(fileInput(), { target: { files: [png('big.png', 2 * 1024 * 1024)] } });

    expect(await screen.findByText('파일이 1MB보다 커요(2MB). 용량을 줄여서 다시 올려 주세요.')).toBeTruthy();
    expect(requests(fetch, 'logo-upload')).toHaveLength(0);
  });

  it('deletes a logo after confirming and keeps one in use', async () => {
    const fetch = serve({ 'logo-delete': () => ok({ items: [SAMPLE, IN_USE], limits: LIMITS }) });

    await openLibrary();

    const inUse = screen.getByRole('button', { name: '쓰는 로고 지우기' });

    expect(inUse.matches(':disabled')).toBe(true);
    expect(screen.getByText('쓰는 중이라 지울 수 없어요.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '브랜드 로고 지우기' }));

    const dialog = await screen.findByRole('dialog', { name: '브랜드 로고 로고를 지울까요?' });

    fireEvent.click(within(dialog).getByRole('button', { name: '지우기' }));

    expect(await screen.findByText('브랜드 로고 로고를 지웠어요.')).toBeTruthy();
    expect(sent(fetch, 'logo-delete')).toMatchObject({ logoId: HEX });
    expect(screen.queryByRole('radio', { name: '브랜드 로고' })).toBeNull();
  });

  it('checks an image address in the browser and saves it', async () => {
    const fetch = serve();

    await openSettings();
    fireEvent.click(screen.getByRole('radio', { name: '이미지 주소' }));
    fireEvent.change(screen.getByLabelText('로고 이미지 주소'), { target: { value: 'https://cdn.test/logo.png' } });
    fireEvent.click(screen.getByRole('button', { name: '확인' }));

    expect(await screen.findByText('이미지를 확인했어요. 200×80px이에요.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '설정 저장' }));
    await waitFor(() => expect(requests(fetch, 'player-preset-save')).toHaveLength(1));

    const { preset } = sent(fetch, 'player-preset-save');

    expect(preset.logo).toMatchObject({ assetId: null, url: 'https://cdn.test/logo.png' });
  });

  it('keeps an address that does not load from being saved', async () => {
    const fetch = serve();

    await openSettings();
    fireEvent.click(screen.getByRole('radio', { name: '이미지 주소' }));
    fireEvent.change(screen.getByLabelText('로고 이미지 주소'), { target: { value: 'https://cdn.test/broken.png' } });
    fireEvent.click(screen.getByRole('button', { name: '확인' }));

    expect(await screen.findByText(/이미지를 불러오지 못했어요/u)).toBeTruthy();
    expect(screen.getByText('이미지 주소를 확인하면 여기에 보여요.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '설정 저장' }));
    await new Promise((done) => setTimeout(done, 50));

    expect(requests(fetch, 'player-preset-save')).toHaveLength(0);
  });

  it('turns off uploads for a read-only account and explains a refused save', async () => {
    const fetch = serve(
      {
        'player-preset-save': () => ({
          status: 403,
          body: { ok: false, error: { code: 'forbidden', message: 'forbidden' } },
        }),
      },
      false
    );

    await openLibrary();

    expect(screen.getByRole('button', { name: '로고 올리기' }).matches(':disabled')).toBe(true);
    expect(screen.getByText('읽기 권한만 있어 로고를 올리거나 지울 수 없어요.')).toBeTruthy();
    expect(screen.getByRole('button', { name: '브랜드 로고 지우기' }).matches(':disabled')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: '설정 저장' }));

    expect(await screen.findByText(READ_ONLY_TEXT)).toBeTruthy();
    expect(screen.queryByRole('button', { name: '연결 다시 확인' })).toBeNull();
    expect(requests(fetch, 'player-preset-save')).toHaveLength(1);
  });
});

describe('parsePlayerPreset', () => {
  const withLogo = (logo: Partial<PlayerLogo>, playerType = 'videojs') =>
    parsePlayerPreset({ ...DEFAULT_PLAYER_PRESET, playerType, logo: { ...DEFAULT_PLAYER_PRESET.logo, ...logo } });
  const errors = (result: ReturnType<typeof parsePlayerPreset>) => (result.ok ? [] : result.errors);

  it('reads a library id or an image address, the address only when set', () => {
    const library = withLogo({ assetId: HEX });
    const address = withLogo({ assetId: null, url: '/data/logo.png' });

    expect(library.ok && library.preset.logo.assetId).toBe(HEX);
    expect(library.ok && Object.keys(library.preset.logo)).not.toContain('url');
    expect(address.ok && address.preset.logo.url).toBe('/data/logo.png');
    expect(address.ok && Object.keys(address.preset.logo).slice(0, 2)).toEqual(['assetId', 'url']);
  });

  it('rejects other addresses, both images at once and a logo on the native player', () => {
    expect(errors(withLogo({ assetId: null, url: 'http://cdn.test/logo.png' }))).toEqual([
      { path: 'logo.url', code: 'format' },
    ]);
    expect(errors(withLogo({ assetId: null, url: '//cdn.test/logo.png' }))).toEqual([
      { path: 'logo.url', code: 'format' },
    ]);
    expect(errors(withLogo({ assetId: HEX, url: 'https://cdn.test/logo.png' }))).toEqual([
      { path: 'logo.url', code: 'conflict' },
    ]);
    expect(errors(withLogo({ assetId: 'Sample' }))).toEqual([{ path: 'logo.assetId', code: 'unavailable' }]);
    expect(errors(withLogo({ assetId: null, url: '/data/logo.png' }, 'native'))).toContainEqual({
      path: 'logo.url',
      code: 'player_type',
    });
  });

  it('renders only the sample logo for the site player', () => {
    const render = (logo: Partial<PlayerLogo>) => {
      const result = withLogo(logo);
      if (!result.ok) throw new Error('invalid preset');

      const rendered = presetRender(result.preset);

      return 'logo' in rendered ? rendered.logo : undefined;
    };

    expect(render({ assetId: 'sample' })).toMatchObject({ src: 'logo-sample.svg' });
    expect(render({ assetId: HEX })).toBeNull();
    expect(render({ assetId: null, url: 'https://cdn.test/logo.png' })).toBeNull();
  });
});

describe('previewLogo', () => {
  const library: LogoLibrary = {
    items: [{ ...BRAND, createdAt: null }],
    limits: LIMITS,
  };
  const preset = (logo: Partial<PlayerLogo>) => ({
    ...DEFAULT_PLAYER_PRESET,
    logo: { ...DEFAULT_PLAYER_PRESET.logo, ...logo },
  });

  it('hands uploads and addresses to the frame as an image and keeps the sample', () => {
    const sample = preset({ assetId: 'sample' });

    expect(previewLogo(sample, library)).toEqual({ preset: sample, logoSrc: null });
    expect(previewLogo(preset({ assetId: HEX }), library)).toMatchObject({
      preset: { logo: { assetId: null } },
      logoSrc: BRAND.url,
    });

    const address = previewLogo(preset({ assetId: null, url: '/logo.png' }), library);

    expect(address.logoSrc).toBe('/logo.png');
    expect(address.preset.logo).not.toHaveProperty('url');
  });
});

describe('presetInput', () => {
  it('sends `logo.url` only when an address is typed', () => {
    const form = formFromPreset(DEFAULT_PLAYER_PRESET);

    expect(presetInput(updateForm(form, 'logo.assetId', HEX)).logo).not.toHaveProperty('url');
    expect(presetInput(updateForm(form, 'logo.url', 'https://cdn.test/logo.png')).logo).toMatchObject({
      url: 'https://cdn.test/logo.png',
    });
  });
});

describe('uploadProblem', () => {
  it('names the allowed types and the size limit', () => {
    expect(uploadProblem(new File(['x'], 'logo.bmp', { type: 'image/bmp' }), LIMITS)).toBe(
      'PNG, SVG, GIF, WebP, JPEG 파일만 올릴 수 있어요.'
    );
    expect(uploadProblem(png('logo.png', 2048), LIMITS)).toBeNull();
  });
});

describe('checkImage', () => {
  it('reports the size, a failed load and a timeout', async () => {
    vi.stubGlobal('Image', FakeImage);

    await expect(checkImage('https://cdn.test/logo.png')).resolves.toEqual({ state: 'ok', width: 200, height: 80 });
    await expect(checkImage('https://cdn.test/broken.png')).resolves.toEqual({ state: 'error', reason: 'load' });
    await expect(checkImage('https://cdn.test/never.png', 10)).resolves.toEqual({ state: 'error', reason: 'timeout' });
  });
});
