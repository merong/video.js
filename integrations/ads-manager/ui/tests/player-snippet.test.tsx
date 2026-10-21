// @vitest-environment jsdom
import { describe, expect, it } from 'vite-plus/test';

import {
  DEFAULT_PLAYER_PRESET,
  installSnippet,
  type InstallSnippetOptions,
  loaderSnippet,
  type LoaderSnippetOptions,
  type PlayerPreset,
} from '../src/player';

const hostile = `a"b<c>&d'e</script>\nf`;
// URLs cannot carry control characters, so they get the same markup without the line break.
const hostilePath = `a"b<c>&d'e</script>`;
const themed: PlayerPreset = {
  ...DEFAULT_PLAYER_PRESET,
  id: 'p-abc123def4',
  language: 'ja',
  theme: { ...DEFAULT_PLAYER_PRESET.theme, accentColor: '#f5c518', borderRadius: 8 },
  playback: { ...DEFAULT_PLAYER_PRESET.playback, autoplay: true, loop: true, preload: 'auto' },
  ads: {
    ...DEFAULT_PLAYER_PRESET.ads,
    // A typed preset can bypass the parser; escaping must not depend on validation.
    labels: { ...DEFAULT_PLAYER_PRESET.ads.labels, skip: hostile },
    fontSize: 14,
  },
};
// Native presets carry no theme; timeouts apply only to them.
const native: PlayerPreset = {
  ...themed,
  playerType: 'native',
  theme: DEFAULT_PLAYER_PRESET.theme,
  ads: { ...themed.ads, timeouts: { loadSeconds: 8, stallSeconds: null } },
};
const base: InstallSnippetOptions = {
  preset: themed,
  host: 'standalone',
  videoId: 'video-1',
  contentUrl: 'https://media.example/content.mp4',
  media: 'mp4',
  assetsUrl: 'https://ads.example/assets/',
  apiUrl: 'https://ads.example/api/index.php',
};

function parse(html: string): DocumentFragment {
  const template = document.createElement('template');

  template.innerHTML = html;
  return template.content;
}

function moduleScript(html: string): string {
  return parse(html).querySelector('script:not([src])')?.textContent ?? '';
}

describe('installSnippet', () => {
  it('wraps the player in media-i18n for the preset language: video-player > skin > video + media-ads', () => {
    const fragment = parse(installSnippet(base));
    const skin = fragment.querySelector('media-i18n[lang="ja"] > video-player > video-skin');
    const ads = skin?.querySelector(':scope > media-ads');
    const video = skin?.querySelector(':scope > video[id^="ads-content-video-1-"]');

    expect(fragment.querySelector('link')?.getAttribute('href')).toBe('https://ads.example/assets/videojs/video.css');
    expect([...fragment.querySelectorAll('script')].map((script) => script.getAttribute('src'))).toEqual([
      'https://ads.example/assets/videojs/video.js',
      'https://ads.example/assets/ads.js',
    ]);
    expect(video?.getAttribute('src')).toBe(base.contentUrl);
    // The preset leaves muted empty; the snippet mutes autoplay like the loader.
    expect(video?.getAttributeNames().sort()).toEqual([
      'autoplay',
      'id',
      'loop',
      'muted',
      'playsinline',
      'preload',
      'src',
    ]);
    expect(video?.getAttribute('preload')).toBe('auto');
    expect(skin?.getAttribute('style')).toBe(
      '--media-accent-color: #f5c518; --media-border-radius: 8px; --ads-font-size: 14px'
    );
    expect(ads?.getAttribute('for')).toBe(video?.id);
    expect(ads?.getAttribute('video-id')).toBe('video-1');
    expect(ads?.getAttribute('src')).toBe('https://ads.example/api/index.php?action=schedule&videoId=video-1');
    expect(ads?.getAttribute('lang')).toBe('ko');
    expect(ads?.getAttribute('skip-label')).toBe(hostile);
  });

  it('omits options the preset leaves empty and follows the page lang without a preset language', () => {
    const html = installSnippet({ ...base, preset: DEFAULT_PLAYER_PRESET });
    const fragment = parse(html);
    const skin = fragment.querySelector('video-player > video-skin');

    expect(fragment.querySelector('media-i18n')).toBeNull();
    expect(skin?.hasAttribute('style')).toBe(false);
    expect(skin?.querySelector('video')?.getAttributeNames().sort()).toEqual(['id', 'playsinline', 'preload', 'src']);
    // Ad labels are always Korean (schema v2), so the element always carries lang="ko".
    expect(skin?.querySelector('media-ads')?.getAttributeNames().sort()).toEqual(['for', 'lang', 'src', 'video-id']);
    expect(html).not.toContain('timeouts');
  });

  it.each([
    ['autoplay with muted left empty', { autoplay: true, muted: null }, ['autoplay', 'muted']],
    ['muted without autoplay', { autoplay: null, muted: true }, ['muted']],
    ['neither', { autoplay: false, muted: false }, []],
  ] as const)('sets autoplay and muted for %s', (_name, playback, expected) => {
    for (const preset of [themed, native]) {
      const html = installSnippet({ ...base, preset: { ...preset, playback: { ...preset.playback, ...playback } } });
      const video = parse(html).querySelector('[id^="ads-content-"]');

      expect(['autoplay', 'muted'].filter((name) => video?.hasAttribute(name))).toEqual(expected);
    }
  });

  it('marks itself as the previous installation method', () => {
    expect(installSnippet(base).split('\n')[0]).toBe('<!-- 솔애드 광고 플레이어(이전 방식) -->');
  });

  it.each([
    ['hls-spf', 'hls-video'],
    ['hls-hlsjs', 'hlsjs-video'],
  ] as const)('uses the %s media element and module like the examples', (media, tag) => {
    const fragment = parse(installSnippet({ ...base, media }));

    expect(fragment.querySelector(`video-skin > ${tag}[id^="ads-content-"]`)).not.toBeNull();
    expect(fragment.querySelector(`script[src="https://ads.example/assets/videojs/media/${tag}.js"]`)).not.toBeNull();
  });

  it('escapes attribute values', () => {
    const html = installSnippet({ ...base, videoId: hostile, contentUrl: `https://media.example/${hostilePath}` });
    const fragment = parse(html);
    const ads = fragment.querySelector('media-ads');

    expect(html).toContain('&#34;');
    expect(fragment.querySelectorAll('media-ads')).toHaveLength(1);
    expect(fragment.querySelectorAll('script')).toHaveLength(2);
    expect(ads?.getAttribute('video-id')).toBe(hostile);
    expect(new URL(ads!.getAttribute('src')!).searchParams.get('videoId')).toBe(hostile);
    expect(fragment.querySelector('[id^="ads-content-"]')?.getAttribute('src')).toBe(
      `https://media.example/${hostilePath}`
    );
    // The id is made from the video ID but keeps only [a-z0-9-].
    expect(fragment.querySelector('[id^="ads-content-"]')?.id).toMatch(/^ads-content-[a-z0-9-]+$/);
  });

  it('builds the native controller like the loader does', () => {
    const html = installSnippet({ ...base, preset: native });
    const fragment = parse(html);
    const script = moduleScript(html);

    const player = fragment.querySelector('div[id^="ads-player-video-1-"]');
    const video = player?.querySelector(':scope > video[id^="ads-content-video-1-"][controls]');

    expect(video?.getAttribute('src')).toBe(base.contentUrl);
    expect(video?.hasAttribute('autoplay') && video.hasAttribute('muted') && video.hasAttribute('loop')).toBe(true);
    expect(script).toContain(`media: document.getElementById("${video?.id}"),`);
    expect(script).toContain(`container: document.getElementById("${player?.id}"),`);
    expect(player?.getAttribute('style')).toBe('position: relative; aspect-ratio: 16 / 9; --ads-font-size: 14px');
    expect(fragment.querySelector('video-player, media-ads, link')).toBeNull();
    expect(script).toContain('import { createAdsController } from "https://ads.example/assets/ads.js";');
    expect(script).toContain('timeouts: {"loadSeconds":8},');
    expect(script).toContain('"locale":"ko"');
    expect(script).toContain('tracking,');
    expect(script).not.toContain('preview');
  });

  it('reads the schedule JSON only after a successful response', () => {
    const script = moduleScript(installSnippet({ ...base, preset: native }));

    expect(script).toContain('const payload = response?.ok ? await response.json().catch(() => null) : null;');
    expect(script.indexOf('response?.ok')).toBeLessThan(script.indexOf('response.json()'));
    expect(script).toContain('if (payload?.ok) {');
  });

  it.each([
    ['Video.js', themed],
    ['native', native],
  ] as const)('gives each video its own %s element ids so two snippets can share a page', (_name, preset) => {
    const ids = (videoId: string) =>
      [...parse(installSnippet({ ...base, preset, videoId })).querySelectorAll('[id]')].map((element) => element.id);
    const first = ids('board:1:main');
    const second = ids('board-1-main');

    expect(first.every((id) => /^ads-(content|player)-board-1-main-[a-z0-9]+$/.test(id))).toBe(true);
    expect(first.filter((id) => second.includes(id))).toEqual([]);
    expect(ids('board:1:main')).toEqual(first);
  });

  it('escapes script values so they cannot close the script', () => {
    const html = installSnippet({
      ...base,
      preset: native,
      videoId: hostile,
      apiUrl: `https://ads.example/${hostilePath}`,
      assetsUrl: `https://ads.example/${hostilePath}/`,
    });
    const script = moduleScript(html);

    expect(parse(html).querySelectorAll('script')).toHaveLength(1);
    expect(script.match(/<\/script>/gi)).toBeNull();
    expect(script).toContain(
      `endpoint.searchParams.set('videoId', ${JSON.stringify(hostile).replace(/</g, '\\u003c')});`
    );
    // The serialized values decode back to the originals.
    expect(JSON.parse(script.match(/searchParams\.set\('videoId', (.*)\);/)![1]!)).toBe(hostile);
    expect(JSON.parse(script.match(/ui: (.*),/)![1]!).labels.skip).toBe(hostile);
  });

  it('notes the gnuboard video ID format', () => {
    expect(installSnippet({ ...base, host: 'gnuboard' })).toContain('게시판:글번호:영상키');
  });

  it('accepts /-rooted paths, which <media-ads src> allows', () => {
    const fragment = parse(
      installSnippet({
        ...base,
        contentUrl: '/media/content.mp4',
        assetsUrl: '/ads/assets/',
        apiUrl: '/ads/api/index.php',
      })
    );

    expect(fragment.querySelector('media-ads')?.getAttribute('src')).toBe(
      '/ads/api/index.php?action=schedule&videoId=video-1'
    );
    expect(fragment.querySelector('link')?.getAttribute('href')).toBe('/ads/assets/videojs/video.css');
  });

  it.each([
    ['contentUrl', 'content.mp4'],
    ['contentUrl', `https://media.example/${hostile}`],
    ['assetsUrl', '../assets/'],
    ['assetsUrl', '//cdn.example/assets/'],
    ['apiUrl', 'api/index.php'],
    ['apiUrl', 'javascript:alert(1)'],
  ])('rejects %s = %j: relative or unsafe addresses', (key, value) => {
    expect(() => installSnippet({ ...base, [key]: value })).toThrow(RangeError);
  });

  it('rejects HLS for the native player and empty required values', () => {
    expect(() => installSnippet({ ...base, preset: native, media: 'hls-spf' })).toThrow(RangeError);
    expect(() => installSnippet({ ...base, videoId: ' ' })).toThrow('고정 영상 ID');
    expect(() => installSnippet({ ...base, contentUrl: '' })).toThrow('본편 주소');
  });
});

const loaderBase: LoaderSnippetOptions = {
  host: 'standalone',
  videoId: 'video-1',
  contentUrl: 'https://media.example/content.m3u8',
  loaderUrl: 'https://ads.example/player/loader.js',
};

describe('loaderSnippet', () => {
  it('writes the placeholder and the loader line, without any preset value', () => {
    const html = loaderSnippet({
      ...loaderBase,
      posterUrl: '/media/poster.jpg',
      title: '  첫 영상  ',
      thumbnailsUrl: 'https://media.example/thumbnails.vtt',
    });
    const fragment = parse(html);
    const placeholder = fragment.querySelector<HTMLElement>('div[data-solad-player]');

    expect(html.split('\n')[0]).toBe('<!-- 솔애드 광고 플레이어 -->');
    expect(placeholder?.getAttributeNames()).toEqual([
      'data-solad-player',
      'data-video-id',
      'data-src',
      'data-poster',
      'data-title',
      'data-thumbnails',
    ]);
    expect({ ...placeholder?.dataset }).toEqual({
      soladPlayer: '',
      videoId: 'video-1',
      src: loaderBase.contentUrl,
      poster: '/media/poster.jpg',
      title: '첫 영상',
      thumbnails: 'https://media.example/thumbnails.vtt',
    });
    expect(placeholder?.childNodes).toHaveLength(0);
    expect([...fragment.querySelectorAll('script')].map((script) => [script.type, script.getAttribute('src')])).toEqual(
      [['module', loaderBase.loaderUrl]]
    );
    expect(html).toContain('<!-- 아래 로더 줄은 페이지에 한 번만 넣어요. -->');
  });

  it('writes data-captions like data-thumbnails, right after it', () => {
    const fragment = parse(
      loaderSnippet({
        ...loaderBase,
        thumbnailsUrl: '/media/thumbnails.vtt',
        captionsUrl: 'https://media.example/ko.vtt',
        playback: { loop: true },
      })
    );
    const placeholder = fragment.querySelector<HTMLElement>('div[data-solad-player]');

    expect(placeholder?.getAttributeNames()).toEqual([
      'data-solad-player',
      'data-video-id',
      'data-src',
      'data-thumbnails',
      'data-captions',
      'data-loop',
    ]);
    expect(placeholder?.dataset.captions).toBe('https://media.example/ko.vtt');
    expect(() => loaderSnippet({ ...loaderBase, captionsUrl: 'ko.vtt' })).toThrow(
      '자막 주소는 http(s):// 주소나 /로 시작하는 경로로 입력해 주세요.'
    );
  });

  it('leaves out empty optional values', () => {
    const fragment = parse(
      loaderSnippet({ ...loaderBase, posterUrl: ' ', title: '', thumbnailsUrl: undefined, captionsUrl: ' ' })
    );

    expect(fragment.querySelector('div')?.getAttributeNames()).toEqual([
      'data-solad-player',
      'data-video-id',
      'data-src',
    ]);
  });

  it('escapes attribute values', () => {
    const html = loaderSnippet({
      ...loaderBase,
      videoId: hostile,
      title: hostile,
      contentUrl: `https://media.example/${hostilePath}`,
      loaderUrl: `/ads/${hostilePath}/loader.js`,
    });
    const fragment = parse(html);
    const placeholder = fragment.querySelector<HTMLElement>('div[data-solad-player]');

    expect(html).toContain('&#34;');
    expect(fragment.querySelectorAll('div, script')).toHaveLength(2);
    expect(placeholder?.dataset.videoId).toBe(hostile);
    expect(placeholder?.dataset.title).toBe(hostile.trim());
    expect(placeholder?.dataset.src).toBe(`https://media.example/${hostilePath}`);
    expect(fragment.querySelector('script')?.getAttribute('src')).toBe(`/ads/${hostilePath}/loader.js`);
  });

  it('notes the gnuboard video ID format', () => {
    expect(loaderSnippet({ ...loaderBase, host: 'gnuboard' })).toContain('게시판:글번호:영상키');
  });

  it('writes the demo values after the video values, leaving muted out with autoplay', () => {
    const placeholder = (options: Partial<Parameters<typeof loaderSnippet>[0]>) =>
      parse(loaderSnippet({ ...loaderBase, ...options })).querySelector<HTMLElement>('div[data-solad-player]')!;
    const full = placeholder({
      title: '제목',
      presetId: 'p-abcdefghij',
      engine: 'hlsjs',
      playback: { autoplay: false, muted: true, loop: true, preload: 'none' },
      lang: 'zh-CN',
    });

    expect(full.getAttributeNames().slice(4)).toEqual([
      'data-preset',
      'data-engine',
      'data-autoplay',
      'data-muted',
      'data-loop',
      'data-preload',
      'data-lang',
    ]);
    expect({ ...full.dataset }).toMatchObject({
      preset: 'p-abcdefghij',
      engine: 'hlsjs',
      autoplay: 'false',
      muted: 'true',
      loop: 'true',
      preload: 'none',
      lang: 'zh-CN',
    });
    expect(placeholder({ playback: { autoplay: true, muted: false } }).dataset).not.toHaveProperty('muted');
    // The loader's default engine is not written.
    expect(placeholder({ engine: 'spf' }).hasAttribute('data-engine')).toBe(false);
    expect(() => loaderSnippet({ ...loaderBase, presetId: 'p_ab' })).toThrow('프리셋 id');
  });

  it.each([
    ['contentUrl', 'content.mp4'],
    ['loaderUrl', '../player/loader.js'],
    ['loaderUrl', 'javascript:alert(1)'],
    ['posterUrl', '//cdn.example/poster.jpg'],
    ['thumbnailsUrl', 'thumbnails.vtt'],
    ['captionsUrl', 'javascript:alert(1)'],
  ])('rejects %s = %j: relative or unsafe addresses', (key, value) => {
    expect(() => loaderSnippet({ ...loaderBase, [key]: value })).toThrow(RangeError);
  });

  it('rejects empty required values', () => {
    expect(() => loaderSnippet({ ...loaderBase, videoId: ' ' })).toThrow('고정 영상 ID');
    expect(() => loaderSnippet({ ...loaderBase, contentUrl: '' })).toThrow('본편 주소');
  });
});
