import { readFileSync } from 'node:fs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { adProgress } from '../../public/examples/ad-progress.js';
import { parsePlayerPreset, presetRender, readPresetRender } from '../../public/player/preset.js';

interface FakeController {
  readonly options: any;
  destroyed: boolean;
  destroy(): void;
}

// jsdom cannot run the player bundles: these doubles stand in for them and record what the controller receives.
const loaded = vi.hoisted(() => {
  const controllers: FakeController[] = [];

  return { controllers };
});

vi.mock('../../public/assets/ads.js', () => {
  return {
    createAdsController(options: any) {
      const controller = { options, destroyed: false, destroy: () => (controller.destroyed = true) };

      loaded.controllers.push(controller);
      return controller;
    },
  };
});
vi.mock('../../public/assets/videojs/video.js', () => ({}));
vi.mock('../../public/assets/videojs/media/hls-video.js', () => ({}));
vi.mock('../../public/assets/videojs/media/hlsjs-video.js', () => ({}));
// With video.js mocked there is no `<video-skin>` to extend; skin.test.ts covers the real skin.
vi.mock('../../public/assets/videojs/ui/seek-button.js', () => ({}));
vi.mock('../../public/player/solad-video-skin.js', () => ({}));

type Route = (url: URL, init?: RequestInit) => Response | Promise<Response>;

/** The manager API envelope. */
interface ApiBody {
  readonly ok: boolean;
  readonly data?: object;
  readonly error?: { readonly code?: string; readonly message?: string };
}

/** Preset fields a test sets over a Video.js preset named 테스트. */
interface PresetInput {
  readonly id?: string;
  readonly playerType?: 'videojs' | 'native';
  readonly language?: string;
  readonly theme?: object;
  readonly playback?: object;
  readonly display?: object;
  readonly controls?: object;
  readonly ads?: object;
}

const json = (body: ApiBody, status = 200) => new Response(JSON.stringify(body), { status });

function render(input: PresetInput = {}, revision = 1) {
  const parsed = parsePlayerPreset({ name: '테스트', playerType: 'videojs', ...input });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));

  return presetRender(parsed.preset, revision);
}

function serve(preset: Route, schedule?: Route) {
  const fetch = vi.fn(async (input: URL | string, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.searchParams.get('action') === 'player-preset') return preset(url, init);

    return schedule ? schedule(url, init) : json({ ok: false }, 500);
  });

  vi.stubGlobal('fetch', fetch);
  return fetch;
}

const presetCalls = (fetch: ReturnType<typeof serve>) =>
  fetch.mock.calls.filter(([input]) => new URL(String(input)).searchParams.get('action') === 'player-preset');

function placeholder(attributes: Record<string, string>, parent: Element = document.body) {
  const element = document.createElement('div');

  element.setAttribute('data-solad-player', '');

  for (const [name, value] of Object.entries({
    'data-video-id': 'notice:1:main',
    'data-src': '/media/a.mp4',
    ...attributes,
  }))
    element.setAttribute(name, value);

  parent.append(element);
  return element;
}

const manual = (attributes: Record<string, string> = {}) => placeholder({ 'data-solad-manual': '', ...attributes });

/** A `CustomEvent`'s detail; the loader dispatches only those. */
const detailOf = (event: Event) => (event instanceof CustomEvent ? event.detail : undefined);

const ready = (element: Element) =>
  new Promise<any>((resolve) =>
    element.addEventListener('solad-ready', (event) => resolve(detailOf(event)), { once: true })
  );

let instance = 0;
let current: Promise<any> | null = null;

/** A fresh loader per test (its preset cache is per page); repeated calls in one test share it. */
function loader() {
  current ??= import(/* @vite-ignore */ `../../public/player/loader.js?test=${++instance}`);
  return current;
}

const observers: MutationObserver[] = [];
let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  current = null;
  loaded.controllers.length = 0;
  document.documentElement.lang = 'ko';
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});

  const observe = MutationObserver.prototype.observe;

  // Each test imports a fresh loader; earlier observers must not create players in later tests.
  vi.spyOn(MutationObserver.prototype, 'observe').mockImplementation(function (this: MutationObserver, ...args) {
    observers.push(this);
    return observe.apply(this, args);
  });
});

afterEach(() => {
  for (const observer of observers.splice(0)) observer.disconnect();

  document.body.replaceChildren();
  document.head.querySelectorAll('link').forEach((link) => link.remove());
  document.documentElement.removeAttribute('lang');
  vi.useRealTimers();
});

describe('loader automatic creation (4.1)', () => {
  it('creates existing placeholders on import, skips manual ones and catches later ones once', async () => {
    const fetch = serve(() => json({ ok: true, data: render() }));
    const first = placeholder({});
    const skipped = manual();
    const firstReady = ready(first);

    await loader();
    await firstReady;

    const later = placeholder({ 'data-video-id': 'notice:2:main' });

    await ready(later);
    // Moving an element re-adds it to the DOM; it is still created only once.
    document.body.append(later);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(first.querySelectorAll('video-player')).toHaveLength(1);
    expect(later.querySelectorAll('video-player')).toHaveLength(1);
    expect(skipped.children).toHaveLength(0);
    expect(presetCalls(fetch)).toHaveLength(1);
  });

  it('requests each preset once per page with the default fetch cache and same-origin credentials', async () => {
    const fetch = serve((url) => json({ ok: true, data: render({ id: url.searchParams.get('id') ?? 'default' }) }));
    const { mount } = await loader();

    await Promise.all([
      mount(manual()),
      mount(manual()),
      mount(manual({ 'data-preset': 'accent' })),
      mount(manual({ 'data-preset': 'accent' })),
    ]);

    const calls = presetCalls(fetch);
    const urls = calls.map(([input]) => new URL(String(input)));

    expect(calls).toHaveLength(2);
    expect(urls[0].pathname).toMatch(/\/public\/api\/index\.php$/);
    expect(urls.map((url) => url.searchParams.get('id'))).toEqual([null, 'accent']);
    expect(calls[0][1]).toMatchObject({ credentials: 'same-origin' });
    expect(calls[0][1]).not.toHaveProperty('cache');
  });
});

describe('loader value merging (4.2)', () => {
  it('applies overrides over data-* over the preset', async () => {
    serve(() => json({ ok: true, data: render({ playback: { loop: true, preload: 'auto' }, language: 'ja' }) }));
    const { mount } = await loader();
    const element = manual({ 'data-preload': 'none', 'data-loop': 'false', 'data-lang': 'en' });
    const handle = await mount(element, { overrides: { playback: { preload: 'metadata' } } });

    expect(handle.media.getAttribute('preload')).toBe('metadata');
    expect(handle.media.hasAttribute('loop')).toBe(false);
    expect(element.querySelector('media-i18n')?.getAttribute('lang')).toBe('en');
  });

  it('uses the preset value when the override is absent and data-* is absent', async () => {
    serve(() => json({ ok: true, data: render({ playback: { loop: true, preload: 'auto' } }) }));
    const { mount } = await loader();
    const handle = await mount(manual());

    expect(handle.media.getAttribute('preload')).toBe('auto');
    expect(handle.media.hasAttribute('loop')).toBe(true);
  });

  it('starts autoplay muted and warns when data-muted="false" conflicts', async () => {
    serve(() => json({ ok: true, data: render() }));
    const { mount } = await loader();
    const handle = await mount(manual({ 'data-autoplay': 'true', 'data-muted': 'false' }));

    expect(handle.media.hasAttribute('autoplay')).toBe(true);
    expect(handle.media.hasAttribute('muted')).toBe(true);
    expect(handle.media.muted).toBe(true);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/^\[solad\] .*muted/));
  });

  it('starts an autoplay preset with muted left empty muted, without a warning', async () => {
    const data = render({ playback: { autoplay: true } });

    // The render keeps the preset's muted (contract 3); only the merged values are muted.
    expect(data.playback).toMatchObject({ autoplay: true, muted: false });
    serve(() => json({ ok: true, data }));
    const { mount } = await loader();
    const handle = await mount(manual());

    expect(handle.media.hasAttribute('autoplay')).toBe(true);
    expect(handle.media.hasAttribute('muted')).toBe(true);
    expect(handle.media.muted).toBe(true);
    expect(warn).not.toHaveBeenCalledWith(expect.stringMatching(/muted/));
  });

  it.each([
    ['left empty', null, false],
    ['true', true, true],
  ])('turns autoplay off with data-autoplay="false" and keeps the preset muted %s', async (_name, muted, expected) => {
    serve(() => json({ ok: true, data: render({ playback: { autoplay: true, muted } }) }));
    const { mount } = await loader();
    const handle = await mount(manual({ 'data-autoplay': 'false' }));

    expect(handle.media.hasAttribute('autoplay')).toBe(false);
    expect(handle.media.hasAttribute('muted')).toBe(expected);
    expect(handle.media.muted).toBe(expected);
  });

  it('mutes a page autoplay over a preset muted false without a warning', async () => {
    serve(() => json({ ok: true, data: render({ playback: { muted: false } }) }));
    const { mount } = await loader();
    const handle = await mount(manual({ 'data-autoplay': 'true' }));

    expect(handle.media.hasAttribute('muted')).toBe(true);
    expect(warn).not.toHaveBeenCalledWith(expect.stringMatching(/muted/));
  });

  it('ignores only an invalid data-* value, with a warning', async () => {
    serve(() => json({ ok: true, data: render({ playback: { preload: 'auto' } }) }));
    const { mount } = await loader();
    const handle = await mount(manual({ 'data-preload': 'fast', 'data-loop': '1', 'data-autoplay': 'true' }));

    expect(handle.media.getAttribute('preload')).toBe('auto');
    expect(handle.media.hasAttribute('loop')).toBe(false);
    expect(handle.media.hasAttribute('autoplay')).toBe(true);
    expect(warn).toHaveBeenCalledWith('[solad] data-preload="fast" 값은 쓸 수 없어 무시합니다.');
    expect(warn).toHaveBeenCalledWith('[solad] data-loop="1" 값은 쓸 수 없어 무시합니다.');
  });

  it.each([
    ['an invalid field', { playback: { loop: true, preload: 'fast' } }, 'playback.preload'],
    ['a fixed key', { playerType: 'native', playback: { loop: true } }, 'playerType'],
    [
      'a native-only field on Video.js',
      { playback: { loop: true }, ads: { timeouts: { loadSeconds: 5 } } },
      'ads.timeouts.loadSeconds',
    ],
  ])('drops all overrides with %s and reports it', async (_name, overrides, path) => {
    serve(() => json({ ok: true, data: render() }));
    const { mount } = await loader();
    const onError = vi.fn();
    const handle = await mount(manual(), { overrides, onError });

    expect(handle.media.hasAttribute('loop')).toBe(false);
    expect(handle.player.localName).toBe('video-player');
    expect(onError).toHaveBeenCalledWith({ code: 'invalid_overrides', message: expect.stringContaining(path) });
  });

  it('adds data-thumbnails as the thumbnail metadata track', async () => {
    serve(() => json({ ok: true, data: render() }));
    const { mount } = await loader();
    const handle = await mount(manual({ 'data-thumbnails': '/media/a-thumbs.vtt' }));
    const track = handle.media.querySelector('track');

    expect(track).toMatchObject({ kind: 'metadata', label: 'thumbnails', default: true });
    expect(track.getAttribute('src')).toBe(new URL('/media/a-thumbs.vtt', document.baseURI).href);
  });
});

describe('loader elements (4.3)', () => {
  it('builds media-i18n > video-player > skin > media + media-ads with the preset CSS and Korean ads', async () => {
    serve(() =>
      json({
        ok: true,
        data: render({ theme: { accentColor: '#2563eb' }, ads: { labels: { skip: '건너뛰기' } } }),
      })
    );
    const { mount } = await loader();
    const element = manual({ 'data-poster': '/media/a.jpg', 'data-title': '회사 소개 영상' });
    const handle = await mount(element);
    const skin = element.querySelector<HTMLElement>('media-i18n > video-player > solad-video-skin')!;
    const ads = skin.querySelector('media-ads')!;

    expect(handle.player.getAttribute('content-title')).toBe('회사 소개 영상');
    expect(handle.player.getAttribute('poster')).toBe(new URL('/media/a.jpg', document.baseURI).href);
    expect(skin.style.getPropertyValue('--media-accent-color')).toBe('#2563eb');
    expect(handle.media.parentElement).toBe(skin);
    expect(handle.media.localName).toBe('video');
    expect(handle.media.hasAttribute('playsinline')).toBe(true);
    expect(handle.media.getAttribute('preload')).toBe('metadata');
    expect(ads.getAttribute('for')).toBe(handle.media.id);
    expect(ads.getAttribute('video-id')).toBe('notice:1:main');
    expect(new URL(ads.getAttribute('src')!).searchParams.get('videoId')).toBe('notice:1:main');
    expect(ads.getAttribute('lang')).toBe('ko');
    expect(ads.getAttribute('skip-label')).toBe('건너뛰기');
    expect(document.head.querySelector('link[rel="stylesheet"]')?.getAttribute('href')).toMatch(
      /assets\/videojs\/video\.css$/
    );
  });

  it('hides the poster and title when the preset turns them off', async () => {
    serve(() => json({ ok: true, data: render({ display: { poster: false, title: false } }) }));
    const { mount } = await loader();
    const handle = await mount(manual({ 'data-poster': '/media/a.jpg', 'data-title': '제목' }));

    expect(handle.player.hasAttribute('poster')).toBe(false);
    expect(handle.player.hasAttribute('content-title')).toBe(false);
  });

  it.each([
    [undefined, 'hls-video'],
    ['hlsjs', 'hlsjs-video'],
  ])('uses the %s HLS engine for .m3u8 sources', async (engine, tag) => {
    serve(() => json({ ok: true, data: render() }));
    const { mount } = await loader();
    const handle = await mount(manual({ 'data-src': '/media/master.m3u8?token=a' }), { engine });

    expect(handle.media.localName).toBe(tag);
  });

  it('builds a native video with the controller, the Korean ads UI and bubbling ads-event', async () => {
    const schedule = { schemaVersion: 1, videoId: 'notice:1:main', breaks: [] };
    const fetch = serve(
      () =>
        json({
          ok: true,
          data: render({ playerType: 'native', ads: { labels: { skip: '건너뛰기' }, timeouts: { loadSeconds: 5 } } }),
        }),
      () => json({ ok: true, data: { schedule, sessionId: 's-1' } })
    );
    const { mount } = await loader();
    const element = manual({ 'data-poster': '/media/a.jpg', 'data-title': '제목' });
    const onEvent = vi.fn();
    const bubbled = vi.fn();

    element.addEventListener('ads-event', (event) => bubbled(detailOf(event)));

    const handle = await mount(element, { onEvent });
    const [controller] = loaded.controllers;

    expect(handle.player).toBe(handle.media);
    expect(handle.media.controls).toBe(true);
    expect(handle.media.getAttribute('poster')).toBe(new URL('/media/a.jpg', document.baseURI).href);
    expect(handle.schedule).toEqual(schedule);
    expect(controller.options).toMatchObject({
      media: handle.media,
      container: handle.media.parentElement,
      schedule,
      tracking: { sessionId: 's-1' },
      ui: { locale: 'ko', labels: { skip: '건너뛰기' } },
      timeouts: { loadSeconds: 5 },
    });
    expect(fetch.mock.calls.at(-1)?.[1]).toMatchObject({ credentials: 'same-origin', cache: 'no-store' });

    controller.options.onEvent({ type: 'start', breakId: 'b' });
    expect(onEvent).toHaveBeenCalledWith({ type: 'start', breakId: 'b' });
    expect(bubbled).toHaveBeenCalledWith({ type: 'start', breakId: 'b' });
  });

  it('reports an unavailable native schedule and keeps the content video', async () => {
    serve(
      () => json({ ok: true, data: render({ playerType: 'native' }) }),
      () => json({ ok: false, error: { message: '편성 없음' } }, 503)
    );
    const { mount } = await loader();
    const onError = vi.fn();
    const handle = await mount(manual(), { onError });

    expect(handle.media.getAttribute('src')).toBe(new URL('/media/a.mp4', document.baseURI).href);
    expect(loaded.controllers).toHaveLength(0);
    expect(onError).toHaveBeenCalledWith({ code: 'schedule_unavailable', message: '편성 없음' });
  });
});

describe('loader language (4.4)', () => {
  it.each([
    ['ko', 'ko'],
    ['ko-KR', 'ko'],
    ['EN-us', 'en'],
    ['en-GB', 'en'],
    ['ja', 'ja'],
    ['ja-JP', 'ja'],
    ['zh', 'zh-CN'],
    ['zh-CN', 'zh-CN'],
    ['ZH-cn', 'zh-CN'],
    ['zh-SG', 'zh-CN'],
    ['zh-Hans', 'zh-CN'],
    ['zh-Hans-HK', 'zh-CN'],
    ['zh-TW', 'en'],
    ['zh-HK', 'en'],
    ['zh-Hant', 'en'],
    ['zh-Hant-TW', 'en'],
    ['kok', 'en'],
    ['fr', 'en'],
    ['', 'en'],
  ])('normalizes the page language %j to %s', async (lang, expected) => {
    serve(() => json({ ok: true, data: render() }));
    document.documentElement.lang = lang;
    const { mount } = await loader();
    const element = manual();

    await mount(element);
    expect(element.querySelector('media-i18n')?.getAttribute('lang')).toBe(expected);
    expect(element.querySelector('media-ads')?.getAttribute('lang')).toBe('ko');
  });

  it.each([
    ['fr', 'en'],
    ['zh-Hant-TW', 'en'],
    ['ko', 'ko'],
  ])('maps the preview frame lang %s on the placeholder to %s', async (lang, expected) => {
    serve(() => json({ ok: true, data: render() }));
    document.documentElement.lang = 'ko';
    const { mount } = await loader();
    const element = manual();

    element.setAttribute('lang', lang);
    await mount(element, {
      preview: {
        schedule: { schedule: { schemaVersion: 1, videoId: 'demo:1', breaks: [] } },
        preset: { name: '편집 중', playerType: 'videojs' },
      },
    });
    expect(element.querySelector('media-i18n')?.getAttribute('lang')).toBe(expected);
  });

  it('prefers the preset language, then the nearest ancestor lang, then the document', async () => {
    serve((url) =>
      json({ ok: true, data: render(url.searchParams.has('id') ? { id: 'p-abcdefghij', language: 'ja' } : {}) })
    );
    document.documentElement.lang = 'ko';
    const { mount } = await loader();
    const section = document.createElement('section');

    section.lang = 'zh-TW';
    document.body.append(section);

    const inherited = manual();
    const preset = manual({ 'data-preset': 'p-abcdefghij' });

    section.append(inherited, preset);
    await Promise.all([mount(inherited), mount(preset)]);

    expect(inherited.querySelector('media-i18n')?.getAttribute('lang')).toBe('en');
    expect(preset.querySelector('media-i18n')?.getAttribute('lang')).toBe('ja');
  });
});

describe('loader failures and events (4.5)', () => {
  it.each([
    ['a 500', () => json({ ok: false }, 500), 'preset_unavailable', '프리셋을 받지 못했습니다(HTTP 500).'],
    [
      'a network error',
      () => Promise.reject(new TypeError('Failed to fetch')),
      'preset_unavailable',
      '프리셋을 받지 못했습니다.',
    ],
    [
      'a validation failure',
      () => json({ ok: true, data: { ...render(), css: { color: 'red' } } }),
      'preset_invalid',
      '프리셋 값이 올바르지 않습니다.',
    ],
    [
      'a malformed body',
      () => new Response('<html>', { status: 200 }),
      'preset_invalid',
      '프리셋 값이 올바르지 않습니다.',
    ],
    [
      'a 404',
      () => json({ ok: false, error: { code: 'preset_not_found' } }, 404),
      'preset_not_found',
      '프리셋을 찾지 못했습니다(p-abcdefghij).',
    ],
  ])('falls back to the built-in default after %s with one warning per page', async (_name, respond, code, message) => {
    const fetch = serve(respond);
    const first = placeholder({ 'data-preset': 'p-abcdefghij' });
    const second = placeholder({ 'data-preset': 'p-abcdefghij', 'data-video-id': 'notice:2:main' });
    const details = Promise.all([ready(first), ready(second)]);

    await loader();

    const [detail] = await details;

    expect(detail).toMatchObject({ presetId: 'default', fallback: true });
    expect(detail.player).toBe(first.querySelector('video-player'));
    expect(first.querySelector('media-ads')?.getAttribute('video-id')).toBe('notice:1:main');
    expect(presetCalls(fetch)).toHaveLength(1);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(`[solad] ${message} 기본 설정으로 재생합니다.`);

    const onError = vi.fn();
    const { mount } = await loader();

    await mount(manual({ 'data-preset': 'p-abcdefghij' }), { onError });
    expect(onError).toHaveBeenCalledWith({ code, message });
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('falls back after the 3-second timeout', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    serve(
      (_url, init) =>
        new Promise((_resolve, reject) =>
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
        )
    );
    const element = placeholder({});
    const detail = vi.fn();

    element.addEventListener('solad-ready', (event) => detail(detailOf(event)));
    await loader();
    await vi.advanceTimersByTimeAsync(2999);
    expect(detail).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await vi.waitFor(() => expect(detail).toHaveBeenCalled());
    expect(detail.mock.calls[0][0]).toMatchObject({ presetId: 'default', fallback: true });
    expect(warn).toHaveBeenCalledWith('[solad] 프리셋 응답이 3초 안에 오지 않았습니다. 기본 설정으로 재생합니다.');
  });

  it('reports the applied preset without fallback on success', async () => {
    serve(() => json({ ok: true, data: render({ id: 'accent', theme: { accentColor: '#2563eb' } }, 7) }));
    const { mount } = await loader();
    const element = manual();
    const detail = ready(element);
    const handle = await mount(element);

    expect(await detail).toEqual({ player: handle.player, presetId: 'accent', fallback: false });
    expect(warn).not.toHaveBeenCalled();
  });

  it.each([
    [{ 'data-video-id': '' }, 'missing_video_id'],
    [{ 'data-video-id': '   ' }, 'missing_video_id'],
    [{ 'data-video-id': 'a\u0007b' }, 'missing_video_id'],
    [{ 'data-video-id': 'v'.repeat(129) }, 'missing_video_id'],
    [{ 'data-src': '' }, 'missing_src'],
    [{ 'data-src': 'javascript:alert(1)' }, 'invalid_src'],
    [{ 'data-src': 'media/a.mp4' }, 'invalid_src'],
    [{ 'data-src': 'ftp://host/a.mp4' }, 'invalid_src'],
  ])('skips a placeholder with %j and sends solad-error %s', async (attributes, code) => {
    const fetch = serve(() => json({ ok: true, data: render() }));
    const element = placeholder(attributes);
    const error = new Promise<any>((resolve) =>
      element.addEventListener('solad-error', (event) => resolve(detailOf(event)), { once: true })
    );

    await loader();
    expect(await error).toEqual({ code, message: expect.any(String) });
    expect(element.children).toHaveLength(0);
    expect(presetCalls(fetch)).toHaveLength(0);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('accepts 128-character video IDs and absolute HTTP(S) sources', async () => {
    serve(() => json({ ok: true, data: render() }));
    const { mount } = await loader();
    const handle = await mount(manual({ 'data-video-id': 'v'.repeat(128), 'data-src': 'https://cdn.test/a.mp4' }));

    expect(handle.media.getAttribute('src')).toBe('https://cdn.test/a.mp4');
  });
});

describe('mount (4.6)', () => {
  it('rejects without a player when the required values are missing', async () => {
    serve(() => json({ ok: true, data: render() }));
    const { mount } = await loader();
    const onError = vi.fn();

    await expect(mount(manual({ 'data-src': '' }), { onError })).rejects.toMatchObject({ code: 'missing_src' });
    expect(onError).toHaveBeenCalledWith({ code: 'missing_src', message: expect.any(String) });
  });

  it('takes JS options over data-* values', async () => {
    serve(() => json({ ok: true, data: render() }));
    const { mount } = await loader();
    const handle = await mount(manual(), { videoId: 'notice:9:main', src: '/media/b.mp4', title: '옵션 제목' });

    expect(handle.media.getAttribute('src')).toBe(new URL('/media/b.mp4', document.baseURI).href);
    expect(handle.player.getAttribute('content-title')).toBe('옵션 제목');
    expect(handle.media.parentElement?.querySelector('media-ads')?.getAttribute('video-id')).toBe('notice:9:main');
  });

  it('passes ads-event details to onEvent', async () => {
    serve(() => json({ ok: true, data: render() }));
    const { mount } = await loader();
    const element = manual();
    const onEvent = vi.fn();

    await mount(element, { onEvent });
    element
      .querySelector('media-ads')!
      .dispatchEvent(new CustomEvent('ads-event', { bubbles: true, composed: true, detail: { type: 'start' } }));
    expect(onEvent).toHaveBeenCalledWith({ type: 'start' });
  });

  it('destroys the created elements, the controller and the listeners', async () => {
    serve(
      () => json({ ok: true, data: render({ playerType: 'native' }) }),
      () => json({ ok: true, data: { schedule: { schemaVersion: 1, breaks: [] } } })
    );
    const { mount } = await loader();
    const element = manual();
    const onEvent = vi.fn();
    const handle = await mount(element, { onEvent });
    const [controller] = loaded.controllers;

    handle.destroy();
    controller.options.onEvent({ type: 'start' });

    expect(element.children).toHaveLength(0);
    expect(controller.destroyed).toBe(true);
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
    expect(onEvent).not.toHaveBeenCalled();
  });

  it('replaces the previous player when mounting the same element twice, even mid-request', async () => {
    serve(() => json({ ok: true, data: render() }));
    const { mount } = await loader();
    const element = manual();
    const first = mount(element);
    const second = mount(element, { title: '두 번째' });

    await expect(first).rejects.toMatchObject({ name: 'AbortError' });

    const handle = await second;
    const third = await mount(element, { title: '세 번째' });

    expect(element.querySelectorAll('video-player')).toHaveLength(1);
    expect(handle.player.isConnected).toBe(false);
    expect(third.player.getAttribute('content-title')).toBe('세 번째');
  });

  it('keeps the example-only player type and falls back from a preset of the other type', async () => {
    const fetch = serve(
      () => json({ ok: true, data: render({ id: 'p-site000001' }) }),
      () => json({ ok: false }, 500)
    );
    const { mount } = await loader();
    const onError = vi.fn();
    const site = await mount(manual(), { playerType: 'native', onError });
    const mismatch = await mount(manual({ 'data-preset': 'accent' }), { playerType: 'native', onError });
    const same = await mount(manual(), { playerType: 'videojs' });

    expect(site).toMatchObject({ presetId: 'default', fallback: true });
    expect(site.player.localName).toBe('video');
    expect(mismatch).toMatchObject({ presetId: 'default', fallback: true });
    expect(same).toMatchObject({ presetId: 'p-site000001', fallback: false });
    // The native players also report their unavailable schedule.
    expect(onError.mock.calls.map(([error]) => error).filter((error) => error.code === 'player_type')).toEqual([
      { code: 'player_type', message: '프리셋이 다른 플레이어용입니다(p-site000001: videojs 플레이어용).' },
      { code: 'player_type', message: '프리셋이 다른 플레이어용입니다(accent: videojs 플레이어용).' },
    ]);
    expect(warn).toHaveBeenCalledWith(
      '[solad] 프리셋이 다른 플레이어용이라 기본 설정으로 재생합니다(accent: videojs 플레이어용).'
    );
    expect(presetCalls(fetch).map(([input]) => new URL(String(input)).searchParams.get('id'))).toEqual([
      null,
      'accent',
    ]);
  });
});

describe('mount preview (A2-D 5)', () => {
  const schedule = {
    schemaVersion: 1,
    videoId: 'demo:1',
    breaks: [
      { breakId: 'pre', position: 'pre', ads: [] },
      { breakId: 'mid-30', position: 'mid', atSeconds: 30, ads: [] },
      { breakId: 'mid-12', position: 'mid', atSeconds: 12, ads: [] },
    ],
  };
  const scheduleFile = () => json(schedule as unknown as ApiBody);
  /** Every request the loader made that is not the public preset or the raw schedule file. */
  const collection = (fetch: ReturnType<typeof serve>) =>
    fetch.mock.calls.filter(([input]) => {
      const url = new URL(String(input));

      return url.searchParams.get('action') !== 'player-preset' && !url.pathname.endsWith('/demo/schedule.json');
    });

  it('puts a raw schedule URL in <media-ads src> with its video ID and makes no collection request', async () => {
    const fetch = serve(() => json({ ok: true, data: render() }), scheduleFile);
    const { mount } = await loader();
    const element = manual({ 'data-video-id': 'other' });
    const handle = await mount(element, { preview: { schedule: '/demo/schedule.json' } });
    const ads = element.querySelector('media-ads')!;

    expect(ads.getAttribute('src')).toBe(new URL('/demo/schedule.json', document.baseURI).href);
    expect(ads.getAttribute('video-id')).toBe('demo:1');
    expect(handle.schedule).toEqual(schedule);
    expect(loaded.controllers).toHaveLength(0);
    expect(collection(fetch)).toEqual([]);
  });

  it('gives a native preview controller the raw schedule only, with preview on and no tracking', async () => {
    const fetch = serve(() => json({ ok: true, data: render({ playerType: 'native' }) }));
    const { mount } = await loader();
    const onEvent = vi.fn();
    const handle = await mount(manual(), {
      playerType: 'native',
      onEvent,
      preview: { schedule: { ok: true, data: { schedule, sessionId: 's-1', eventsUrl: '/api/events' } } },
    });
    const [controller] = loaded.controllers;

    expect(controller.options).toMatchObject({ media: handle.media, schedule, preview: true });
    expect(Object.hasOwn(controller.options, 'tracking')).toBe(false);
    expect(collection(fetch)).toEqual([]);

    controller.options.onEvent({ type: 'start', breakId: 'pre' });
    expect(onEvent).toHaveBeenCalledWith({ type: 'start', breakId: 'pre' });
  });

  it('attaches a preview controller with the ad labels to a Video.js player for a schedule object', async () => {
    serve(() => json({ ok: true, data: render() }));
    const { mount } = await loader();
    const element = manual();
    const onEvent = vi.fn();
    const handle = await mount(element, {
      onEvent,
      preview: {
        schedule: { schedule },
        preset: { name: '편집 중', playerType: 'videojs', ads: { labels: { skip: '넘기기', timer: '광고' } } },
      },
    });
    const [controller] = loaded.controllers;
    const skin = element.querySelector('solad-video-skin')!;

    expect(element.querySelector('media-ads')).toBeNull();
    expect(handle.media.parentElement).toBe(skin);
    // Once the skin bundle has defined `<solad-video-skin>`, the ad screen goes in its shadow container like `<media-ads>`.
    expect(controller.options).toMatchObject({
      media: handle.media,
      container: skin.shadowRoot?.querySelector('media-container') ?? skin,
      schedule,
      preview: true,
      ui: { locale: 'ko', labels: { skip: '넘기기', timer: '광고' } },
    });
    expect(Object.hasOwn(controller.options, 'tracking')).toBe(false);

    controller.options.onEvent({ type: 'skip', breakId: 'pre' });
    expect(onEvent).toHaveBeenCalledWith({ type: 'skip', breakId: 'pre' });
  });

  it('uses a valid preview preset without requesting a preset', async () => {
    const fetch = serve(() => json({ ok: true, data: render() }));
    const { mount } = await loader();
    const element = manual();
    const handle = await mount(element, {
      preview: {
        schedule: { schedule },
        preset: { name: '편집 중', playerType: 'videojs', theme: { accentColor: '#16a34a' } },
      },
    });

    expect(handle).toMatchObject({ fallback: false });
    expect(element.querySelector<HTMLElement>('solad-video-skin')!.style.getPropertyValue('--media-accent-color')).toBe(
      '#16a34a'
    );
    expect(presetCalls(fetch)).toEqual([]);
  });

  it('falls back to the default render and reports invalid_preview_preset', async () => {
    const fetch = serve(() => json({ ok: true, data: render() }));
    const { mount } = await loader();
    const onError = vi.fn();
    const handle = await mount(manual(), {
      onError,
      preview: { schedule: { schedule }, preset: { name: '', playerType: 'native', theme: { accentColor: 'red' } } },
    });

    expect(handle).toMatchObject({ presetId: 'default', fallback: true });
    expect(handle.player.localName).toBe('video');
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: 'invalid_preview_preset' }));
    expect(onError.mock.calls[0][0].message).toMatch(
      /^미리보기 프리셋 값이 올바르지 않아 기본 설정으로 재생합니다\(.+\)\.$/
    );
    expect(presetCalls(fetch)).toEqual([]);
  });

  it.each([
    ['an envelope URL', '/demo/schedule.json', () => json({ ok: true, data: { schedule, sessionId: 's-1' } })],
    [
      'the manager schedule action',
      '/api/index.php?action=schedule&videoId=demo:1',
      () => json({ ok: true, data: { schedule, sessionId: 's-1' } }),
    ],
  ])('plays the content without ads for %s', async (_, url, route) => {
    serve(() => json({ ok: true, data: render() }), route);
    const { mount } = await loader();
    const element = manual();
    const onError = vi.fn();
    const handle = await mount(element, { onError, preview: { schedule: url } });

    expect(element.querySelector('media-ads')).toBeNull();
    expect(loaded.controllers).toHaveLength(0);
    expect(handle.media.getAttribute('src')).toBe(new URL('/media/a.mp4', document.baseURI).href);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: 'invalid_preview_schedule' }));
  });

  it('reports an unavailable preview schedule as preview_schedule_unavailable', async () => {
    serve(
      () => json({ ok: true, data: render() }),
      () => new Response('', { status: 404 })
    );
    const { mount } = await loader();
    const onError = vi.fn();

    await mount(manual(), { playerType: 'native', onError, preview: { schedule: '/demo/schedule.json' } });

    expect(onError).toHaveBeenCalledWith({
      code: 'preview_schedule_unavailable',
      message: '미리보기 편성을 받지 못해 광고 없이 재생합니다(HTTP 404).',
    });
    expect(loaded.controllers).toHaveLength(0);
  });

  it('moves the start in place and asks for a new player for the midroll and end scenes, first press included', async () => {
    serve(() => json({ ok: true, data: render() }));
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    const { mount } = await loader();
    const handle = await mount(manual(), { playerType: 'native', preview: { schedule: { schedule } } });

    Object.defineProperty(handle.media, 'readyState', { value: 1 });
    Object.defineProperty(handle.media, 'duration', { value: 60 });
    handle.media.currentTime = 5;

    await expect(handle.seek('before-midroll')).resolves.toBe('remount');
    await expect(handle.seek('before-end')).resolves.toBe('remount');
    expect(handle.media.currentTime).toBe(5);
    expect(play).not.toHaveBeenCalled();
    await expect(handle.seek('start')).resolves.toBe(true);
    expect(handle.media.currentTime).toBe(0);
    await expect(handle.seek('middle')).resolves.toBe(false);
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('waits for metadata before moving and refuses a midroll the schedule does not have', async () => {
    serve(() => json({ ok: true, data: render() }));
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    const { mount } = await loader();
    const handle = await mount(manual(), {
      playerType: 'native',
      preview: { schedule: { schedule: { ...schedule, breaks: [schedule.breaks[0]] } } },
    });

    await expect(handle.seek('before-midroll')).resolves.toBe(false);

    const seeking = handle.seek('start');

    expect(play).not.toHaveBeenCalled();
    Object.defineProperty(handle.media, 'readyState', { value: 1 });
    Object.defineProperty(handle.media, 'duration', { value: 20 });
    handle.media.dispatchEvent(new Event('loadedmetadata'));

    await expect(seeking).resolves.toBe(true);
    expect(play).toHaveBeenCalledTimes(1);
  });

  describe('scene shortcuts (A2DD2-01)', () => {
    const pod = {
      ...schedule,
      breaks: [
        { breakId: 'pre', position: 'pre', ads: [{ itemId: 'a' }, { itemId: 'b' }] },
        { breakId: 'mid-12', position: 'mid', atSeconds: 12, ads: [{ itemId: 'c' }, { itemId: 'e' }] },
        { breakId: 'mid-30', position: 'mid', atSeconds: 30, ads: [{ itemId: 'f' }] },
        { breakId: 'post', position: 'post', ads: [{ itemId: 'd' }] },
      ],
    };
    const ids = (value: { breaks: { breakId: string }[] }) => value.breaks.map((item) => item.breakId);

    async function played(preview: { preset?: object; scene?: string } = {}) {
      serve(() => json({ ok: true, data: render() }));
      const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
      const { mount } = await loader();
      const handle = await mount(manual(), {
        playerType: 'native',
        preview: { schedule: { schedule: pod }, ...preview },
      });
      const emit = (type: string, breakId: string, itemId: string) =>
        loaded.controllers[0]!.options.onEvent({ type, breakId, itemId, occurredAt: '2026-10-21T00:00:00.000Z' });

      Object.defineProperty(handle.media, 'readyState', { value: 1 });
      Object.defineProperty(handle.media, 'duration', { value: 60 });

      return { handle, play, emit };
    }

    it('moves the start in place until its preroll starts', async () => {
      const { handle, emit } = await played();

      await expect(handle.seek('start')).resolves.toBe(true);
      emit('start', 'pre', 'a');
      emit('complete', 'pre', 'a');
      emit('skip', 'pre', 'b');
      await expect(handle.seek('start')).resolves.toBe('remount');
    });

    it('asks for a new player for the start while a pod is on, between its ads included, until a cancel', async () => {
      const { handle, emit } = await played();

      emit('start', 'mid-12', 'c');
      await expect(handle.seek('start')).resolves.toBe('remount');
      emit('complete', 'mid-12', 'c');
      await expect(handle.seek('start')).resolves.toBe('remount');
      emit('cancel', 'mid-12', 'e');
      await expect(handle.seek('start')).resolves.toBe(true);
    });

    it.each([
      ['before-midroll', ['mid-12', 'mid-30', 'post']],
      ['before-end', ['post']],
      ['start', ['pre', 'mid-12', 'mid-30', 'post']],
    ])('plays a player made for %s without the breaks before it', async (scene, kept) => {
      const { handle } = await played({ scene });
      const given = loaded.controllers[0]!.options.schedule;

      expect(ids(given)).toEqual(kept);
      expect(handle.schedule).toBe(given);
      expect(given.breaks).toEqual(pod.breaks.filter((item) => kept.includes(item.breakId)));
      expect(ids(pod)).toEqual(['pre', 'mid-12', 'mid-30', 'post']);
    });

    it('counts ad places in a trimmed schedule as in the full one', async () => {
      const { handle } = await played({ scene: 'before-midroll' });
      const event = { type: 'start', breakId: 'mid-12', itemId: 'e', occurredAt: '2026-10-21T00:00:00.000Z' };

      expect(adProgress(event, handle.schedule)).toEqual(adProgress(event, pod));
      expect(adProgress(event, handle.schedule)).toMatchObject({ position: 'mid', index: 2, count: 2 });
    });

    it.each([
      ['before-midroll', 10],
      ['before-end', 58],
    ])('starts a player made for %s there, without autoplay', async (scene, time) => {
      const autoplay = { name: '편집 중', playerType: 'native', playback: { autoplay: true } };
      const { handle, play } = await played({ preset: autoplay, scene });

      expect(handle.media.hasAttribute('autoplay')).toBe(false);
      expect(handle.media.muted).toBe(true);
      expect(play).not.toHaveBeenCalled();
      handle.media.dispatchEvent(new Event('loadedmetadata'));
      await vi.waitFor(() => expect(handle.media.currentTime).toBe(time));
      expect(play).toHaveBeenCalledTimes(1);
    });

    it('trims a schedule URL into an object for Video.js, reading it once and sending no events', async () => {
      const fetch = serve(
        () => json({ ok: true, data: render() }),
        () => new Response(JSON.stringify(pod))
      );
      const { mount } = await loader();
      const element = manual();
      const handle = await mount(element, { preview: { schedule: '/demo/schedule.json', scene: 'before-end' } });
      const given = loaded.controllers[0]!.options;

      expect(element.querySelector('media-ads')).toBeNull();
      expect(given).toMatchObject({ preview: true });
      expect(given.tracking).toBeUndefined();
      expect(ids(given.schedule)).toEqual(['post']);
      expect(handle.schedule).toBe(given.schedule);
      expect(fetch.mock.calls.filter(([input]) => String(input).endsWith('/demo/schedule.json'))).toHaveLength(1);
      expect(collection(fetch)).toEqual([]);
    });
  });

  it('restyles the theme and labels in place and asks for a new mount otherwise', async () => {
    serve(() => json({ ok: true, data: render() }));
    const { mount } = await loader();
    const element = manual();
    const onError = vi.fn();
    const base = { name: '편집 중', playerType: 'videojs' };
    const handle = await mount(element, { onError, preview: { schedule: { schedule }, preset: base } });
    const [controller] = loaded.controllers;

    (controller as any).updateUI = vi.fn();

    expect(handle.restyle({ ...base, theme: { accentColor: '#16a34a' }, ads: { labels: { skip: '넘기기' } } })).toBe(
      true
    );
    expect(element.querySelector<HTMLElement>('solad-video-skin')!.style.getPropertyValue('--media-accent-color')).toBe(
      '#16a34a'
    );
    expect((controller as any).updateUI).toHaveBeenCalledWith({ locale: 'ko', labels: { skip: '넘기기' } });
    expect(handle.restyle({ ...base, playback: { loop: true } })).toBe(false);
    expect(handle.restyle({ ...base, display: { poster: false } })).toBe(false);
    expect(handle.restyle({ ...base, display: { title: false } })).toBe(false);
    expect(handle.restyle({ ...base, name: '' })).toBe(false);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: 'invalid_preview_preset' }));
  });

  it.each([
    [{}, '해안 장면', '/examples/sample-poster.svg'],
    [{ display: { title: false, poster: false } }, null, null],
  ])('shows the preview title and poster under the display switches %j', async (display, title, poster) => {
    serve(() => json({ ok: true, data: render() }));
    const { mount } = await loader();
    const element = manual();
    const preset = { name: '편집 중', playerType: 'videojs', ...display };

    await mount(element, {
      title: '해안 장면',
      poster: '/examples/sample-poster.svg',
      preview: { schedule: { schedule }, preset },
    });

    const player = element.querySelector('video-player')!;

    expect(player.getAttribute('content-title')).toBe(title);
    expect(player.getAttribute('poster')).toBe(poster && new URL(poster, document.baseURI).href);
  });

  it('takes the lang option over data-lang', async () => {
    serve(() => json({ ok: true, data: render() }));
    const { mount } = await loader();
    const element = manual({ 'data-lang': 'ja' });

    await mount(element, { lang: 'en' });

    expect(element.querySelector('media-i18n')!.getAttribute('lang')).toBe('en');
  });
});

type ThemeColor = 'accentColor' | 'accentTextColor' | 'borderColor';

describe('built-in flat and the border alpha (A2-E 1.2)', () => {
  /** The shared fixture, read only: ads-admin-api owns it. */
  const fixture = JSON.parse(readFileSync(`${import.meta.dirname}/../fixtures/player-preset-v2.json`, 'utf8'));
  const flat = fixture.builtIn.find((entry: { id: string }) => entry.id === 'flat');
  const theme = (input: { readonly [key in ThemeColor]?: string }, playerType = 'videojs') =>
    parsePlayerPreset({ name: '테두리', playerType, theme: input });

  it('reads the built-in flat as a borderless square Video.js preset', () => {
    const parsed = parsePlayerPreset(flat);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));

    const rendered = presetRender(parsed.preset, 7);

    expect(fixture.builtIn.map((entry: { id: string }) => entry.id)).toEqual([
      'default',
      'flat',
      'rounded',
      'accent',
      'lms',
    ]);
    expect(parsed.preset).toMatchObject({ id: 'flat', name: '플랫', playerType: 'videojs' });
    expect(rendered.css).toEqual({ '--media-border-color': '#00000000', '--media-border-radius': '0px' });
    expect(readPresetRender(rendered)).toMatchObject({ ok: true, render: rendered });
  });

  it('takes #rrggbbaa only for theme.borderColor, in lowercase', () => {
    expect(theme({ borderColor: '#00000026' }).ok).toBe(true);
    expect(theme({ borderColor: '#cdf352' }).ok).toBe(true);

    for (const value of ['#0000002', '#000000260', '#0000002A'])
      expect(theme({ borderColor: value }).ok, value).toBe(false);

    const others: ThemeColor[] = ['accentColor', 'accentTextColor'];

    for (const path of others)
      expect(theme({ [path]: '#2563eb80' }), path).toEqual({
        ok: false,
        errors: [{ path: `theme.${path}`, code: 'format' }],
      });

    expect(parsePlayerPreset({ name: '광고', playerType: 'videojs', ads: { accentColor: '#2563eb80' } }).ok).toBe(
      false
    );
    expect(theme({ borderColor: '#00000000' }, 'native').ok).toBe(false);
  });

  it('matches every normalize and render case of the shared fixture', () => {
    for (const entry of fixture.normalize) {
      const result = parsePlayerPreset(entry.input);

      if (entry.expect.ok)
        expect(JSON.stringify(result), entry.name).toBe(JSON.stringify({ ok: true, preset: entry.expect.preset }));
      else expect(result.ok ? null : result.errors[0]?.path, entry.name).toBe(entry.expect.field);
    }

    for (const entry of fixture.render) {
      const parsed = parsePlayerPreset(entry.preset);

      expect(parsed.ok && JSON.stringify(presetRender(parsed.preset, entry.revision)), entry.name).toBe(
        JSON.stringify(entry.render)
      );
    }
  });

  it('requests data-preset="flat" and puts its border on the skin', async () => {
    const parsed = parsePlayerPreset(flat);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));

    const fetch = serve(() => json({ ok: true, data: presetRender(parsed.preset, 7) }));
    const { mount } = await loader();
    const element = manual({ 'data-preset': 'flat' });

    await mount(element);

    const skin = element.querySelector<HTMLElement>('solad-video-skin')!;

    expect(new URL(String(presetCalls(fetch)[0]![0])).searchParams.get('id')).toBe('flat');
    expect(skin.style.getPropertyValue('--media-border-color')).toBe('#00000000');
    expect(skin.style.getPropertyValue('--media-border-radius')).toBe('0px');
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('the ad skin and the captions input (A2-E 3)', () => {
  const schedule = { schemaVersion: 1, videoId: 'demo:1', breaks: [{ breakId: 'pre', position: 'pre', ads: [] }] };
  const skinOf = (element: Element) =>
    element.querySelector<HTMLElement>('media-i18n > video-player > solad-video-skin')!;

  it('keeps the video-skin render contract and builds <solad-video-skin> without attributes by default', async () => {
    const data = render();

    serve(() => json({ ok: true, data }));
    const { mount } = await loader();
    const element = manual();

    await mount(element);

    const skin = skinOf(element);

    expect(data).toMatchObject({ skinTag: 'video-skin', controls: { captions: true } });
    expect(element.querySelector('video-skin')).toBeNull();
    expect(skin.hasAttribute('seek-buttons')).toBe(false);
    expect(skin.hasAttribute('captions')).toBe(false);
  });

  it.each([
    [10, true, '10', null],
    [30, false, '30', 'off'],
  ])('passes seekButtons %s and captions %s to the skin', async (seekButtons, captions, seek, off) => {
    serve(() => json({ ok: true, data: render({ controls: { seekButtons, captions } }) }));
    const { mount } = await loader();
    const element = manual();

    await mount(element);

    expect(skinOf(element).getAttribute('seek-buttons')).toBe(seek);
    expect(skinOf(element).getAttribute('captions')).toBe(off);
  });

  it('adds data-captions as a subtitles track in the player language, off by default', async () => {
    serve(() => json({ ok: true, data: render() }));
    const { mount } = await loader();
    const handle = await mount(
      manual({ 'data-captions': '/media/a-ko.vtt', 'data-thumbnails': '/media/a-thumbs.vtt' })
    );
    const track = handle.media.querySelector('track[kind="subtitles"]');

    expect(track).toMatchObject({ kind: 'subtitles', srclang: 'ko', label: '한국어', default: false });
    expect(track.hasAttribute('default')).toBe(false);
    expect(track.getAttribute('src')).toBe(new URL('/media/a-ko.vtt', document.baseURI).href);
    expect(handle.media.querySelector('track[kind="metadata"]').label).toBe('thumbnails');
  });

  it.each([
    ['ja', '日本語'],
    ['zh-CN', '中文(简体)'],
    ['en', 'English'],
  ])('labels the captions track for the %s player language', async (lang, label) => {
    serve(() => json({ ok: true, data: render() }));
    const { mount } = await loader();
    const handle = await mount(manual({ 'data-captions': '/media/a.vtt', 'data-lang': lang }));

    expect(handle.media.querySelector('track')).toMatchObject({ srclang: lang, label });
  });

  it('prefers the JS API captions value and drops one that is not a page URL', async () => {
    serve(() => json({ ok: true, data: render() }));
    const { mount } = await loader();
    const api = await mount(manual({ 'data-captions': '/media/a.vtt' }), { captions: 'https://cdn.example/b.vtt' });
    const relative = await mount(manual({ 'data-captions': 'b.vtt' }));

    expect(api.media.querySelector('track').getAttribute('src')).toBe('https://cdn.example/b.vtt');
    expect(relative.media.querySelector('track')).toBeNull();
    expect(warn).toHaveBeenCalledWith('[solad] data-captions="b.vtt" 값은 쓸 수 없어 무시합니다.');
  });

  it('leaves a native player without a captions track', async () => {
    serve(() => json({ ok: true, data: render({ playerType: 'native' }) }));
    const { mount } = await loader();
    const handle = await mount(manual({ 'data-captions': '/media/a.vtt' }), { playerType: 'native' });

    expect(handle.media.querySelector('track')).toBeNull();
  });

  it('keeps a preview with seek buttons, captions off and a captions track free of collection requests', async () => {
    const fetch = serve(() => json({ ok: true, data: render() }));
    const { mount } = await loader();
    const element = manual();
    const handle = await mount(element, {
      captions: '/media/a.vtt',
      preview: {
        schedule: { schedule },
        preset: { name: '편집 중', playerType: 'videojs', controls: { seekButtons: 15, captions: false } },
      },
    });

    expect(skinOf(element).getAttribute('seek-buttons')).toBe('15');
    expect(skinOf(element).getAttribute('captions')).toBe('off');
    expect(handle.media.querySelector('track[kind="subtitles"]')).not.toBeNull();
    expect(loaded.controllers[0]!.options.preview).toBe(true);
    expect(
      fetch.mock.calls.filter(([input]) => new URL(String(input)).searchParams.get('action') !== 'player-preset')
    ).toEqual([]);
  });
});

describe('the preview logo (A2-E 5.2, 5.3)', () => {
  const schedule = { schemaVersion: 1, videoId: 'demo:1', breaks: [{ breakId: 'pre', position: 'pre', ads: [] }] };
  const base = { name: '편집 중', playerType: 'videojs' };
  const skinOf = (element: Element) => element.querySelector('solad-video-skin') as HTMLElement & { logo?: unknown };

  it('renders logo null without an image and every layout default with one', () => {
    const parsed = parsePlayerPreset({ ...base, logo: { position: 'bottom-left', width: 160 } });
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));

    expect(presetRender(parsed.preset).logo).toBeNull();
    expect(presetRender(parsed.preset, 0, '/examples/sample-logo.svg').logo).toEqual({
      src: '/examples/sample-logo.svg',
      position: 'bottom-left',
      margin: 12,
      width: 160,
      opacity: 80,
      href: null,
      alt: null,
      hideDuringAds: true,
      hideWithControls: false,
    });

    const native = parsePlayerPreset({ name: 'n', playerType: 'native' });
    if (!native.ok) throw new Error(JSON.stringify(native.errors));

    expect(Object.hasOwn(presetRender(native.preset, 0, '/examples/sample-logo.svg'), 'logo')).toBe(false);
  });

  it('gives the skin the preview logo over the preset and overrides.logo layout', async () => {
    serve(() => json({ ok: true, data: render() }));
    const { mount } = await loader();
    const element = manual();

    await mount(element, {
      overrides: { logo: { position: 'top-left', opacity: 50, href: 'https://example.com/store', alt: '데모 스토어' } },
      preview: { schedule: { schedule }, preset: { ...base, logo: { width: 120 } }, logo: '/examples/sample-logo.png' },
    });

    expect(skinOf(element).logo).toEqual({
      src: new URL('/examples/sample-logo.png', document.baseURI).href,
      position: 'top-left',
      margin: 12,
      width: 120,
      opacity: 50,
      href: 'https://example.com/store',
      alt: '데모 스토어',
      hideDuringAds: true,
      hideWithControls: false,
    });
  });

  it.each(['logo.png', 'javascript:alert(1)', 12])(
    'drops a wrong preview logo %j and reports invalid_preview_logo',
    async (logo) => {
      serve(() => json({ ok: true, data: render() }));
      const { mount } = await loader();
      const element = manual();
      const onError = vi.fn();

      await mount(element, { onError, preview: { schedule: { schedule }, preset: base, logo } });

      expect(skinOf(element).logo ?? null).toBeNull();
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: 'invalid_preview_logo' }));
    }
  );

  it('reads the logo only on the preview path', async () => {
    serve(() => json({ ok: true, data: render() }));
    const { mount } = await loader();
    const element = manual({ 'data-logo': '/examples/sample-logo.svg' });

    await mount(element, { logo: '/examples/sample-logo.svg' } as object);

    expect(skinOf(element).logo ?? null).toBeNull();
  });

  it('gives a native preview no logo', async () => {
    serve(() => json({ ok: true, data: render({ playerType: 'native' }) }));
    const { mount } = await loader();
    const element = manual();
    const onError = vi.fn();

    await mount(element, {
      playerType: 'native',
      onError,
      preview: { schedule: { schedule }, preset: { name: 'n', playerType: 'native' }, logo: '/a.png' },
    });

    expect(element.querySelector('solad-video-skin')).toBeNull();
    expect(onError).not.toHaveBeenCalled();
  });

  it('changes only the logo in place with restyle and reports a wrong one', async () => {
    serve(() => json({ ok: true, data: render() }));
    const { mount } = await loader();
    const element = manual();
    const onError = vi.fn();
    const handle = await mount(element, { onError, preview: { schedule: { schedule }, preset: base } });
    const skin = skinOf(element);

    (loaded.controllers[0] as any).updateUI = vi.fn();

    expect(handle.restyle(base, { overrides: { logo: { position: 'bottom-right' } }, logo: '/a.svg' })).toBe(true);
    expect(skinOf(element)).toBe(skin);
    expect(skin.logo).toMatchObject({ src: new URL('/a.svg', document.baseURI).href, position: 'bottom-right' });

    expect(handle.restyle(base, { overrides: { logo: { width: 200 } }, logo: 'bad.svg' })).toBe(true);
    expect(skin.logo).toBeNull();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: 'invalid_preview_logo' }));

    // Any other override still needs a new player.
    expect(handle.restyle(base, { overrides: { playback: { loop: true } }, logo: '/a.svg' })).toBe(false);
  });
});
