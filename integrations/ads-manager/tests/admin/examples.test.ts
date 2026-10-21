import { readFileSync } from 'node:fs';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { adProgress, EVENT_LOG_LIMIT, nowText, progressText, pushProgress } from '../../public/examples/ad-progress.js';
import {
  alignToPreset,
  changedCount,
  DEMO_DEFAULTS,
  demoLogoUrl,
  demoMountOptions,
  demoOverrides,
  loadPresetList,
  logoChoice,
  mutedLock,
  presetLabel,
  presetValue,
  readDemoQuery,
  sampleCaptionsUrl,
  writeDemoQuery,
} from '../../public/examples/demo-state.js';
import { apiExample, installOptions, loaderSnippet as demoSnippet } from '../../public/examples/install-code.js';
import {
  acceptsText,
  fieldAnchor as demoFieldAnchor,
  HELP_SECTIONS as DEMO_SECTIONS,
  INSTALL_OPTIONS,
  optionAnchor as demoOptionAnchor,
  PRESET_FIELDS,
  stageText,
} from '../../public/examples/options.js';
import { configurePlayTestLinks, readPlayTestQuery } from '../../public/examples/play-test.js';
import {
  PREVIEW_COMMAND_MESSAGE,
  PREVIEW_EVENT_MESSAGE,
  PREVIEW_MESSAGE,
  PREVIEW_STATUS_MESSAGE,
  STANDALONE_MESSAGE,
  startPreviewFrame,
} from '../../public/examples/preview-frame.js';
import {
  checkSample,
  INVALID_SAMPLE_MESSAGE,
  MISSING_SAMPLE_MESSAGE,
  SAMPLE_SCHEDULE_URL,
  SAMPLE_TITLE,
} from '../../public/examples/sample.js';
import { readPresetRender } from '../../public/player/preset.js';
import { fieldAnchor, HELP_SECTIONS, optionAnchor } from '../../ui/src/player/help-anchors';
import { loaderSnippet, type LoaderSnippetOptions } from '../../ui/src/player/install-snippet';
import { playerOptions } from '../../ui/src/player/player-options';
import {
  AD_LABEL_DEFAULTS,
  DEFAULT_PLAYER_PRESET,
  parsePlayerPreset,
  type PlayerPreset,
  presetRender,
} from '../../ui/src/player/preset';

const examples = 'integrations/ads-manager/public/examples';
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

/** A rendered preset for `input` over a Video.js preset named 데모. */
function render(input: Record<string, unknown> = {}) {
  const parsed = parsePlayerPreset({ name: '데모', playerType: 'videojs', ...input });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));

  return presetRender(parsed.preset);
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('readDemoQuery', () => {
  it('starts from the defaults and reads every valid value', () => {
    expect(readDemoQuery('')).toEqual({ state: DEMO_DEFAULTS, ignored: [] });

    const { state, ignored } = readDemoQuery(
      '?preset=p-abcdefghij&autoplay=true&muted=false&loop=true&preload=none&language=&pageLang=ja' +
        '&poster=false&posterUrl=/media/a.jpg&title=true&titleText=%20회사%20소개%20&thumbnails=https://cdn.test/t.vtt' +
        '&media=hls&engine=hlsjs'
    );

    expect(ignored).toEqual([]);
    expect(state).toEqual({
      ...DEMO_DEFAULTS,
      preset: 'p-abcdefghij',
      autoplay: true,
      muted: false,
      loop: true,
      preload: 'none',
      language: null,
      pageLang: 'ja',
      poster: false,
      posterUrl: '/media/a.jpg',
      title: true,
      titleText: '회사 소개',
      thumbnails: 'https://cdn.test/t.vtt',
      media: 'hls',
      engine: 'hlsjs',
    });
  });

  it('ignores invalid values and lists their keys', () => {
    const { state, ignored } = readDemoQuery(
      '?preset=p_ab&autoplay=yes&preload=all&language=fr&posterUrl=javascript:alert(1)&media=dash&titleText=%20'
    );

    expect(state).toEqual(DEMO_DEFAULTS);
    expect(ignored).toEqual(['preset', 'autoplay', 'preload', 'language', 'posterUrl', 'titleText', 'media']);
  });
});

describe('readDemoQuery controls and logo (A2-E 3.4, 5.6)', () => {
  it('reads the control, captions and logo keys', () => {
    const { state, ignored } = readDemoQuery(
      '?seekButtons=15&captions=false&captionsUrl=/examples/sample-captions.vtt&logo=sample-png' +
        '&logoPosition=bottom-left&logoWidth=160&logoOpacity=50&logoMargin=0&logoHref=https://example.com/store' +
        '&logoAlt=%20데모%20스토어%20&logoHideDuringAds=false&logoHideWithControls=true'
    );

    expect(ignored).toEqual([]);
    expect(state).toMatchObject({
      seekButtons: 15,
      captions: false,
      captionsUrl: '/examples/sample-captions.vtt',
      logo: 'sample-png',
      logoPosition: 'bottom-left',
      logoWidth: 160,
      logoOpacity: 50,
      logoMargin: 0,
      logoHref: 'https://example.com/store',
      logoAlt: '데모 스토어',
      logoHideDuringAds: false,
      logoHideWithControls: true,
    });
    expect(readDemoQuery('?seekButtons=&logoHref=&logoAlt=').state).toMatchObject({
      seekButtons: null,
      logoHref: null,
      logoAlt: null,
    });
  });

  it('ignores values outside the preset rules', () => {
    const { state, ignored } = readDemoQuery(
      '?seekButtons=20&captions=on&captionsUrl=a.vtt&logo=toString&logoPosition=middle&logoWidth=241' +
        '&logoOpacity=9&logoMargin=1.5&logoHref=/store&logoAlt=' +
        'x'.repeat(81)
    );

    expect(state).toEqual(DEMO_DEFAULTS);
    expect(ignored).toEqual([
      'seekButtons',
      'captions',
      'captionsUrl',
      'logo',
      'logoPosition',
      'logoWidth',
      'logoOpacity',
      'logoMargin',
      'logoHref',
      'logoAlt',
    ]);
  });

  it.each([
    [{ logo: 'sample-svg' }, 'logo=sample-svg', 'sample-svg'],
    [{ logo: 'custom' }, 'logo=custom', 'custom'],
    [{ logo: '/media/logo.png' }, 'logo=%2Fmedia%2Flogo.png', 'custom'],
    [{ seekButtons: null, captions: false }, 'seekButtons=&captions=false', ''],
    [
      { logo: 'sample-png', logoPosition: 'top-left', logoHref: null, logoAlt: '데모' },
      'logo=sample-png&logoPosition=top-left&logoHref=&logoAlt=%EB%8D%B0%EB%AA%A8',
      'sample-png',
    ],
  ])('writes %j and reads back the same state', (values, query, choice) => {
    const state = { ...DEMO_DEFAULTS, ...values };

    expect(writeDemoQuery(state)).toBe(query);
    expect(readDemoQuery(`?${writeDemoQuery(state)}`)).toEqual({ state, ignored: [] });
    expect(logoChoice(state)).toBe(choice);
  });
});

describe('demo logo and captions paths', () => {
  it('finds the samples beside the page', () => {
    const page = 'https://host.test/ads/examples/index.html?logo=sample-svg';

    expect(demoLogoUrl({ ...DEMO_DEFAULTS, logo: 'sample-svg' }, page)).toBe('/ads/examples/sample-logo.svg');
    expect(demoLogoUrl({ ...DEMO_DEFAULTS, logo: 'sample-png' }, page)).toBe('/ads/examples/sample-logo.png');
    expect(demoLogoUrl({ ...DEMO_DEFAULTS, logo: 'custom' }, page)).toBe('');
    expect(demoLogoUrl({ ...DEMO_DEFAULTS, logo: 'https://cdn.test/l.png' }, page)).toBe('https://cdn.test/l.png');
    expect(demoLogoUrl(DEMO_DEFAULTS, page)).toBe('');
    expect(sampleCaptionsUrl(page)).toBe('/ads/examples/sample-captions.vtt');
  });
});

describe('demo preset values for controls and logo', () => {
  it('reads the logo layout from the preset with the render defaults and counts what differs', () => {
    const preset = { logo: { position: 'bottom-right', width: null, hideDuringAds: false } };
    const plain = render();

    expect(presetValue('seekButtons', plain)).toBeNull();
    expect(presetValue('captions', plain)).toBe(true);
    expect(presetValue('seekButtons', render({ controls: { seekButtons: 15 } }))).toBe(15);
    expect(presetValue('logoPosition', plain, preset)).toBe('bottom-right');
    expect(presetValue('logoWidth', plain, preset)).toBe(80);
    expect(presetValue('logoHideDuringAds', plain, preset)).toBe(false);
    expect(presetValue('logoPosition', plain)).toBe('top-right');

    const state = alignToPreset(
      {
        ...DEMO_DEFAULTS,
        logoPosition: 'bottom-right',
        logoWidth: 80,
        logoOpacity: 40,
        captions: true,
        seekButtons: null,
      },
      plain,
      preset
    );

    expect(state).toMatchObject({ logoPosition: undefined, logoWidth: undefined, logoOpacity: 40 });
    expect(state.captions).toBeUndefined();
    expect(state.seekButtons).toBeUndefined();
    expect(changedCount(state)).toBe(1);
  });
});

describe('writeDemoQuery', () => {
  it('writes only changed values and reads back the same state', () => {
    const state = { ...DEMO_DEFAULTS, preset: 'accent', muted: true, language: null, media: 'hls' };
    const query = writeDemoQuery(state);

    expect(query).toBe('preset=accent&muted=true&language=&media=hls');
    expect(readDemoQuery(`?${query}`).state).toEqual(state);
    expect(writeDemoQuery(DEMO_DEFAULTS)).toBe('');
  });
});

describe('demoOverrides', () => {
  it('passes changed preset fields and leaves the rest to the preset', () => {
    expect(demoOverrides(DEMO_DEFAULTS, render())).toBeNull();
    expect(
      demoOverrides({ ...DEMO_DEFAULTS, loop: true, language: null, poster: false, title: false }, render())
    ).toEqual({
      playback: { loop: true },
      display: { poster: false, title: false },
      language: null,
    });
  });

  it('locks muted on with autoplay, from the state or the preset, as the loader does', () => {
    const autoplay = render({ playback: { autoplay: true } });

    expect(mutedLock({ ...DEMO_DEFAULTS, autoplay: true }, render())).toMatch(/음소거/);
    expect(mutedLock(DEMO_DEFAULTS, autoplay)).toMatch(/음소거/);
    expect(mutedLock(DEMO_DEFAULTS, render())).toBe('');
    expect(demoOverrides({ ...DEMO_DEFAULTS, autoplay: true, muted: false }, render())).toEqual({
      playback: { autoplay: true, muted: true },
    });
    // Every override must pass the loader's own check, or the loader would drop them all.
    expect(
      parsePlayerPreset({ name: '덮어쓰기', playerType: 'videojs', playback: { autoplay: true, muted: true } }).ok
    ).toBe(true);
  });

  it('leaves the title out for the native player, whose presets refuse it', () => {
    expect(demoOverrides({ ...DEMO_DEFAULTS, title: true }, render({ playerType: 'native' }))).toBeNull();
  });

  it('passes the controls for Video.js only and the logo layout only with an image', () => {
    const controls = { ...DEMO_DEFAULTS, seekButtons: null, captions: false };
    const layout = { logoPosition: 'top-left', logoWidth: 200, logoHideWithControls: true };

    expect(demoOverrides(controls, render())).toEqual({ controls: { seekButtons: null, captions: false } });
    expect(demoOverrides({ ...controls, seekButtons: 30 }, render({ playerType: 'native' }))).toBeNull();
    expect(demoOverrides({ ...DEMO_DEFAULTS, ...layout }, render())).toBeNull();
    expect(demoOverrides({ ...DEMO_DEFAULTS, ...layout, logo: 'sample-svg' }, render())).toEqual({
      logo: { position: 'top-left', width: 200, hideWithControls: true },
    });
    expect(
      demoOverrides({ ...DEMO_DEFAULTS, ...layout, logo: 'sample-svg' }, render({ playerType: 'native' }))
    ).toBeNull();
  });

  it('shows a link without a name as an unlinked image, so the loader keeps every override', () => {
    const state = { ...DEMO_DEFAULTS, logo: 'sample-svg', loop: true, logoHref: 'https://example.com' };
    const linked = { ...state, logoAlt: '데모 스토어' };
    const fromPreset = { logo: { href: 'https://example.com/p', alt: null } };

    expect(demoOverrides(state, render())).toEqual({ playback: { loop: true }, logo: { href: null } });
    expect(demoOverrides(linked, render())!.logo).toEqual({ href: 'https://example.com', alt: '데모 스토어' });
    expect(demoOverrides({ ...DEMO_DEFAULTS, logo: 'sample-svg' }, render(), fromPreset)).toEqual({
      logo: { href: null },
    });

    for (const overrides of [demoOverrides(state, render()), demoOverrides(linked, render())])
      expect(parsePlayerPreset({ name: '덮어쓰기', playerType: 'videojs', ...overrides }).ok).toBe(true);
  });
});

describe('demoMountOptions', () => {
  it('plays the sample schedule in preview mode with the chosen preset object and video values', () => {
    const schedule = { videoId: 'grok-demo-scene-01', breaks: [] };
    const source = readPresetRender(render());
    const options = demoMountOptions(
      { ...DEMO_DEFAULTS, preset: 'rounded', posterUrl: '/media/a.jpg', loop: true, media: 'hls', engine: 'hlsjs' },
      source,
      schedule
    );

    expect(options).toMatchObject({
      videoId: 'grok-demo-scene-01',
      poster: '/media/a.jpg',
      engine: 'hlsjs',
      overrides: { playback: { loop: true } },
      preview: { schedule, preset: source.preset },
    });
    expect(options).not.toHaveProperty('preset');
    expect(options.src).toMatch(/\/demo-media\/content-master\.m3u8$/);
  });

  it('gives the logo image as preview.logo beside the page and the captions address as captions', () => {
    const source = readPresetRender(render());
    const page = 'https://host.test/examples/index.html';
    const state = { ...DEMO_DEFAULTS, logo: 'sample-png', logoOpacity: 40, captionsUrl: '/media/ko.vtt' };
    const options = demoMountOptions(state, source, SAMPLE_SCHEDULE_URL, page);

    expect(options.preview.logo).toBe('/examples/sample-logo.png');
    expect(options.captions).toBe('/media/ko.vtt');
    expect(options.overrides).toEqual({ logo: { opacity: 40 } });
    expect(demoMountOptions(DEMO_DEFAULTS, source, SAMPLE_SCHEDULE_URL, page).preview).not.toHaveProperty('logo');

    const native = readPresetRender(render({ playerType: 'native' }));
    const nativeOptions = demoMountOptions(state, native, SAMPLE_SCHEDULE_URL, page);

    expect(nativeOptions.preview).not.toHaveProperty('logo');
    expect(nativeOptions).not.toHaveProperty('captions');
    expect(nativeOptions).not.toHaveProperty('overrides');
  });
});

describe('loaderSnippet (public/examples/install-code.js)', () => {
  const base = {
    host: 'standalone',
    videoId: 'notice:12:main',
    contentUrl: '/media/intro.mp4',
    loaderUrl: '/ads/player/loader.js',
  } as const;
  const cases: [string, LoaderSnippetOptions][] = [
    ['required values only', base],
    ['gnuboard note', { ...base, host: 'gnuboard' }],
    [
      'every video value',
      { ...base, posterUrl: '/a.jpg', title: ' "회사" <소개> ', thumbnailsUrl: 'https://x.test/t.vtt' },
    ],
    ['data-preset for another preset', { ...base, presetId: 'p-abcdefghij' }],
    ['hls.js engine', { ...base, contentUrl: '/m.m3u8', engine: 'hlsjs' }],
    ['spf engine left out', { ...base, engine: 'spf' }],
    ['playback values', { ...base, playback: { muted: true, loop: false, preload: 'auto' } }],
    ['autoplay leaves muted out', { ...base, playback: { autoplay: true, muted: false } }],
    ['language', { ...base, lang: 'zh-CN' }],
    ['captions after thumbnails', { ...base, thumbnailsUrl: '/t.vtt', captionsUrl: '/examples/sample-captions.vtt' }],
    [
      'lecture with a token',
      { ...base, presetId: 'lms', lang: 'ko', lms: { lectureUrl: '/l/manifest.json', learnerToken: 'a.b' } },
    ],
    ['lecture stand-ins', { ...base, presetId: 'lms', lms: {} }],
    [
      'everything',
      {
        ...base,
        posterUrl: 'https://x.test/a.jpg',
        title: '제목',
        presetId: 'accent',
        engine: 'hlsjs',
        playback: { autoplay: false, muted: true, loop: true, preload: 'none' },
        lang: 'en',
      },
    ],
  ];

  it.each(cases)('matches the admin loaderSnippet: %s', (_, options) => {
    expect(demoSnippet(options)).toBe(loaderSnippet(options));
  });

  it.each([
    { ...base, videoId: ' ' },
    { ...base, contentUrl: 'media/a.mp4' },
    { ...base, posterUrl: 'javascript:alert(1)' },
    { ...base, captionsUrl: 'captions.vtt' },
    { ...base, presetId: 'p_ab' },
  ])('throws the same RangeError as the admin for %o', (options) => {
    let message = '';

    try {
      loaderSnippet(options);
    } catch (error) {
      expect(error).toBeInstanceOf(RangeError);
      message = (error as Error).message;
    }

    expect(message).not.toBe('');
    expect(() => demoSnippet(options)).toThrow(new RangeError(message));
  });
});

describe('installOptions', () => {
  const video = {
    videoId: 'grok-demo-scene-01',
    contentUrl: '/ads/demo-media/grok-20261018/content-scene-01.mp4',
    posterUrl: '/a.jpg',
    title: '장면',
    thumbnailsUrl: '',
    hls: false,
  };
  const install = (state: object, preset = render({ id: 'p-site000001' }), sitePresetId = 'p-site000001') =>
    installOptions(
      { ...DEMO_DEFAULTS, ...state },
      { render: preset, sitePresetId, video, loaderUrl: '/ads/player/loader.js' }
    );

  it('leaves data-preset out for the site preset and writes it for another one', () => {
    expect(install({ preset: null }).snippet.presetId).toBeUndefined();
    expect(install({ preset: 'p-site000001' }).snippet.presetId).toBeUndefined();
    expect(install({ preset: 'accent' }).snippet.presetId).toBe('accent');
    expect(loaderSnippet(install({ preset: 'accent' }).snippet)).toContain('data-preset="accent"');
    expect(loaderSnippet(install({}).snippet)).not.toContain('data-preset');
  });

  it('writes no data-* for values equal to the preset', () => {
    const preset = render({ id: 'p-site000001', playback: { loop: true, preload: 'auto' }, language: 'en' });
    const { snippet, overrides } = install({ loop: true, preload: 'auto', language: 'en', muted: false }, preset);

    expect(snippet.playback).toBeUndefined();
    expect(snippet.lang).toBeUndefined();
    expect(overrides).toBeNull();
    expect(install({ loop: false, language: 'ja' }, preset).snippet).toMatchObject({
      playback: { loop: false },
      lang: 'ja',
    });
  });

  it('writes autoplay without muted, which the loader turns on anyway', () => {
    const { snippet } = install({ autoplay: true, muted: false });
    const html = demoSnippet(snippet);

    expect(snippet.playback).toEqual({ autoplay: true });
    expect(html).toContain('data-autoplay="true"');
    expect(html).not.toContain('data-muted');
    expect(html).toBe(loaderSnippet(snippet));
  });

  it('moves what data-* cannot say into the JS API overrides', () => {
    const preset = render({ id: 'p-site000001', language: 'en', display: { poster: false } });
    const result = install({ language: null, poster: true }, preset);

    expect(result.overrides).toEqual({ language: null, display: { poster: true } });
    expect(apiExample(result)).toContain('overrides: {"language":null,"display":{"poster":true}},');
    expect(install({ poster: false }).snippet.posterUrl).toBeUndefined();
  });

  it('installs the captions address as data-captions and changed controls as overrides', () => {
    const withCaptions = (state: object, preset = render({ id: 'p-site000001' })) =>
      installOptions(
        { ...DEMO_DEFAULTS, ...state },
        {
          render: preset,
          sitePresetId: 'p-site000001',
          video: { ...video, captionsUrl: '/examples/sample-captions.vtt' },
          loaderUrl: '/ads/player/loader.js',
        }
      );
    const result = withCaptions({ seekButtons: 10, captions: false });

    expect(result.snippet.captionsUrl).toBe('/examples/sample-captions.vtt');
    expect(loaderSnippet(result.snippet)).toContain('data-captions="/examples/sample-captions.vtt"');
    expect(result.overrides).toEqual({ controls: { seekButtons: 10, captions: false } });
    expect(apiExample(result)).toContain('  captions: "/examples/sample-captions.vtt",');
    expect(apiExample(result)).toContain('overrides: {"controls":{"seekButtons":10,"captions":false}},');
    expect(
      withCaptions({ seekButtons: 15 }, render({ id: 'p-site000001', controls: { seekButtons: 15 } })).overrides
    ).toBeNull();

    const native = withCaptions({ seekButtons: 10 }, render({ id: 'p-site000001', playerType: 'native' }));

    expect(native.snippet.captionsUrl).toBeUndefined();
    expect(native.overrides).toBeNull();
  });

  it('never installs the logo', () => {
    const { snippet, overrides } = install({ logo: 'sample-svg', logoPosition: 'top-left', logoWidth: 200 });

    expect(JSON.stringify({ snippet, overrides })).not.toMatch(/logo/i);
  });
});

describe('options.js', () => {
  const helpGroups = new Set(['mount', 'events']);

  it('keeps every admin playerOptions row with the same name, accepted values, default and preset field', () => {
    const shared = INSTALL_OPTIONS.filter((group) => !helpGroups.has(group.id));
    const pick = ({ name, type, defaultValue, presetField }: Record<string, unknown>) => ({
      name,
      type,
      defaultValue,
      presetField,
    });

    expect(shared.map((group) => group.id)).toEqual(playerOptions.map((group) => group.id));

    for (const group of playerOptions) {
      const mirror = shared.find((item) => item.id === group.id)!;

      expect(mirror.source).toBe(group.source);
      expect(mirror.rows.filter((row: { help?: boolean }) => !row.help).map(pick)).toEqual(group.rows.map(pick));
    }
  });

  it('adds only data-preset and the JS API and event groups for the help page', () => {
    const extra = INSTALL_OPTIONS.flatMap((group) =>
      group.rows.filter((row: { help?: boolean }) => row.help).map((row: { name: string }) => row.name)
    );

    expect(extra).toEqual(['data-preset']);
    expect(INSTALL_OPTIONS.filter((group) => helpGroups.has(group.id)).map((group) => group.id)).toEqual([
      'mount',
      'events',
    ]);

    for (const row of INSTALL_OPTIONS.flatMap((group) => group.rows)) expect(row.description).toMatch(/요\.$/);
  });

  it('lists every preset field once, with the admin parser accepting its values and its defaults', () => {
    const leaves = (value: object, prefix = ''): string[] =>
      Object.entries(value).flatMap(([key, item]) =>
        item !== null && typeof item === 'object' ? leaves(item, `${prefix}${key}.`) : [`${prefix}${key}`]
      );
    const preset = (playerType: string, path: string, value: unknown) => {
      const input: Record<string, any> = { name: '검사', playerType };
      const keys = path.split('.');
      let group = input;

      for (const key of keys.slice(0, -1)) group = group[key] ??= {};

      group[keys.at(-1)!] = value;

      // A logo link needs its text.
      if (path === 'logo.href') input.logo.alt = '로고';

      return parsePlayerPreset(input);
    };
    const videojs = presetRender({ ...DEFAULT_PLAYER_PRESET });
    const native = presetRender({ ...DEFAULT_PLAYER_PRESET, playerType: 'native' } as PlayerPreset);
    const read = (object: any, path: string) => path.split('.').reduce((value, key) => value?.[key], object);

    expect(PRESET_FIELDS.map((field) => field.path)).toEqual(
      leaves(DEFAULT_PLAYER_PRESET).filter((path) => path !== 'id')
    );

    for (const field of PRESET_FIELDS) {
      const { path, accepts, players } = field;
      const playerType = players[0];

      if (['name', 'playerType'].includes(path)) continue;

      const ok = (value: unknown) => expect(preset(playerType, path, value).ok, `${path} = ${value}`).toBe(true);
      const bad = (value: unknown) => expect(preset(playerType, path, value).ok, `${path} = ${value}`).toBe(false);

      switch (accepts.kind) {
        case 'boolean':
          ok(true);
          ok(false);
          bad('true');
          break;
        case 'enum':
        case 'step':
          for (const value of accepts.values) ok(value);

          bad(accepts.kind === 'enum' ? 'other' : 7);
          break;
        case 'integer':
          ok(accepts.min);
          ok(accepts.max);
          bad(accepts.min - 1);
          bad(accepts.max + 1);
          break;
        case 'color':
          ok('#12abef');
          bad('#12ABEF');
          bad('#12ABEF80');

          if (accepts.alpha) ok('#12abef80');
          else bad('#12abef80');

          break;
        case 'url':
          ok('https://example.test/');
          bad('javascript:alert(1)');
          break;
        case 'text':
          ok('가'.repeat(accepts.max));
          bad('가'.repeat(accepts.max + 1));

          for (const token of accepts.placeholders ?? []) ok(token);

          break;
        default:
          bad('logo-1');
      }

      // A field for one player is refused for the other.
      if (players.length === 1 && !['logo.alt', 'logo.href'].includes(path)) {
        const other = playerType === 'videojs' ? 'native' : 'videojs';
        const sample = accepts.kind === 'boolean' ? true : (accepts.values?.[0] ?? accepts.min ?? '#12abef');

        if (accepts.kind !== 'unavailable') expect(preset(other, path, sample).ok, `${path} on ${other}`).toBe(false);
      }

      if (path.startsWith('ads.labels.')) {
        expect(field.defaultValue).toBe(AD_LABEL_DEFAULTS[path.slice(11) as keyof typeof AD_LABEL_DEFAULTS]);
      } else if (field.defaultValue !== null) {
        const rendered = read(players.includes('videojs') ? videojs : native, path.replace(/^ads\./, ''));

        expect(rendered, path).toBe(field.defaultValue);
        expect(field.defaultText).toBe(String(field.defaultValue));
      }
    }
  });

  it('marks what A2-1 and the ad skin apply and what waits for A2-2 and A2-3', () => {
    const applied = ['skip', 'skipCountdown', 'timer'].map((key) => `ads.labels.${key}`);
    const stage = (path: string) => {
      if (['controls.seekButtons', 'controls.captions'].includes(path)) return 'A2-E';

      if (path.startsWith('lms.')) return 'L-2';

      if (/^(input|controls)\./.test(path)) return 'A2-2';

      if (/^(logo|ads\.progress)\./.test(path)) return 'A2-3';

      if (path.startsWith('ads.labels.') && !applied.includes(path)) return 'A2-3';

      return 'A2-1';
    };

    for (const field of PRESET_FIELDS) expect(field.stage, field.path).toBe(stage(field.path));

    expect(stageText('A2-1')).toBe('적용');
    expect(stageText('A2-E')).toBe('적용');
    expect(stageText('L-2')).toBe('적용');
    expect(stageText('A2-2')).toBe('준비 중(A2-2)');
    expect(acceptsText({ kind: 'integer', min: 0, max: 32, unit: 'px' })).toBe('0–32px 정수');
    expect(acceptsText({ kind: 'color' })).toBe('#rrggbb(소문자)');
    expect(acceptsText({ kind: 'color', alpha: true })).toBe('#rrggbb 또는 투명도를 더한 #rrggbbaa(소문자)');
  });

  it('lets only theme.borderColor take 8 digits and names flat in the border rows (A2-E 1.3)', () => {
    const alpha = PRESET_FIELDS.filter((field) => field.accepts.kind === 'color' && field.accepts.alpha);
    const rows = INSTALL_OPTIONS.flatMap((group) => group.rows);
    const descriptions = (path: string) => [
      PRESET_FIELDS.find((field) => field.path === path)?.description,
      rows.find((row) => row.presetField === path)?.description,
    ];

    expect(alpha.map((field) => field.path)).toEqual(['theme.borderColor']);
    expect(descriptions('theme.borderColor')).toEqual(
      Array(2).fill(
        '플레이어 둘레의 가는 선 색이에요. 8자리로 투명도를 줄 수 있고 #00000000이면 선이 없어요. 내장 프리셋 "플랫"은 선이 없어요.'
      )
    );
    expect(descriptions('theme.borderRadius')).toEqual(
      Array(2).fill(
        '플레이어 모서리 둥글기예요. 광고 화면 모서리도 따라가요. 내장 프리셋 "플랫"은 0px, "둥근 테두리"는 12px예요.'
      )
    );
    expect(rows.find((row) => row.name === 'data-preset')?.type).toBe(
      'default | flat | rounded | accent | lms | p-로 시작하는 저장 id'
    );
  });
});

describe('optionAnchor', () => {
  it('gives the same anchors as the admin for every row, field and section, all unique', () => {
    const anchors = [
      ...INSTALL_OPTIONS.flatMap((group) =>
        group.rows.map((row: { name: string }) => {
          const anchor = demoOptionAnchor(row.name, group.id);

          expect(anchor).toBe(optionAnchor(row.name, group.id));
          expect(anchor).toMatch(/^opt-[a-z0-9-]+$/);
          return anchor;
        })
      ),
      ...PRESET_FIELDS.map((field) => {
        expect(demoFieldAnchor(field.path)).toBe(fieldAnchor(field.path));
        return fieldAnchor(field.path);
      }),
      ...HELP_SECTIONS,
    ];

    expect(DEMO_SECTIONS).toEqual([...HELP_SECTIONS]);
    expect(new Set(anchors).size).toBe(anchors.length);
    expect(optionAnchor('data-preset', 'loaderData')).toBe('opt-data-preset');
    expect(optionAnchor('--ads-accent-color', 'adsCss')).toBe('opt-ads-accent-color');
    expect(optionAnchor('media', 'exampleQuery')).toBe('opt-query-media');
    expect(fieldAnchor('playback.autoplay')).toBe('field-playback-autoplay');
  });
});

describe('readPlayTestQuery', () => {
  it('reads the test query with defaults and resolves content against the page', () => {
    expect(readPlayTestQuery('https://host.test/ads/examples/play-test.html')).toMatchObject({
      videoId: null,
      type: 'videojs',
      media: 'mp4',
      engine: 'spf',
      preset: null,
      ignored: [],
    });
    expect(
      readPlayTestQuery(
        'https://host.test/ads/examples/play-test.html?video=free:1:main&type=videojs&media=hls&engine=hlsjs' +
          '&content=/media/master.m3u8?token=a&preset=accent'
      )
    ).toMatchObject({
      videoId: 'free:1:main',
      type: 'videojs',
      media: 'hls',
      engine: 'hlsjs',
      src: 'https://host.test/media/master.m3u8?token=a',
      preset: 'accent',
      ignored: [],
    });
    expect(readPlayTestQuery('https://host.test/examples/play-test.html?video=v&type=native&media=hls')).toMatchObject({
      type: 'native',
      media: 'mp4',
      ignored: ['media'],
    });
  });

  it('ignores invalid values and executable content', () => {
    const query = readPlayTestQuery(
      'https://host.test/examples/play-test.html?video=%20&type=flash&content=javascript:alert(1)&preset=x'
    );

    expect(query.ignored).toEqual(['video', 'type', 'content', 'preset']);
    expect(query.src).toMatch(/\/demo-media\/content\.mp4$/);
  });
});

describe('configurePlayTestLinks', () => {
  it('switches one value per link in the real page, keeping the rest of the query', () => {
    const page = new DOMParser().parseFromString(readFileSync(`${examples}/play-test.html`, 'utf8'), 'text/html');
    const current = new URL('https://host.test/customer/ads/examples/play-test.html');

    current.search = new URLSearchParams({
      video: 'free:1:main',
      type: 'videojs',
      media: 'hls',
      engine: 'hlsjs',
      content: '/media/master.m3u8?token=a&part=2',
      preset: 'accent',
    }).toString();
    configurePlayTestLinks(page, current.href);

    const links = [...page.querySelectorAll<HTMLAnchorElement>('a[data-type], a[data-media], a[data-engine]')];

    expect(links).toHaveLength(6);

    for (const link of links) {
      const destination = new URL(link.href);
      const [key, value] = Object.entries(link.dataset)[0]!;

      expect(destination.pathname).toBe('/customer/ads/examples/play-test.html');
      expect(destination.searchParams.get(key)).toBe(value);
      expect(destination.searchParams.get('video')).toBe('free:1:main');
      expect(destination.searchParams.get('content')).toBe('/media/master.m3u8?token=a&part=2');
      expect(destination.searchParams.get('preset')).toBe('accent');
    }

    expect(page.querySelector('[data-type="videojs"]')?.getAttribute('aria-current')).toBe('page');
    expect(page.querySelector('[data-type="native"]')?.hasAttribute('aria-current')).toBe(false);
    expect(page.querySelector('[data-media="hls"]')?.getAttribute('aria-current')).toBe('page');
    expect(page.querySelector('[data-engine="hlsjs"]')?.getAttribute('aria-current')).toBe('page');
    expect(page.querySelector<HTMLElement>('[data-engine-field]')!.hidden).toBe(false);
    expect(page.querySelector<HTMLElement>('[data-media-off]')!.hidden).toBe(true);
  });

  it('drops HLS for the native player and hides the engine with MP4', () => {
    const page = new DOMParser().parseFromString(readFileSync(`${examples}/play-test.html`, 'utf8'), 'text/html');
    const address = 'https://host.test/examples/play-test.html?video=v&type=videojs&media=hls';

    configurePlayTestLinks(page, address);
    expect(new URL(page.querySelector<HTMLAnchorElement>('[data-type="native"]')!.href).searchParams.get('media')).toBe(
      'mp4'
    );

    configurePlayTestLinks(page, 'https://host.test/examples/play-test.html?video=v&type=native');

    const hls = page.querySelector<HTMLAnchorElement>('a[data-media="hls"]')!;

    expect(hls.hidden).toBe(true);
    expect(page.querySelector<HTMLElement>('[data-media-off]')!.hidden).toBe(false);
    expect(hls.parentElement!.getAttribute('aria-describedby')).toBe('sw-m-h');
    expect(page.getElementById('sw-m-h')!.hidden).toBe(false);
    expect(page.querySelector<HTMLElement>('[data-engine-field]')!.hidden).toBe(true);
  });
});

describe('startPreviewFrame', () => {
  const origin = location.origin;
  const preset = { name: '편집 중', playerType: 'videojs', theme: { accentColor: '#16a34a' } };
  const schedule = {
    videoId: 'grok-demo-scene-01',
    breaks: [{ breakId: 'pre', position: 'pre', ads: [{ itemId: 'a' }, { itemId: 'b' }] }],
  };

  /** A `checkSample` result; a failed check has no reason. */
  interface SampleCheck {
    ok: boolean;
    reason?: string;
    message?: string;
    schedule?: typeof schedule;
  }

  function frame({
    sample = { ok: true, schedule },
    search = '?type=videojs',
  }: { sample?: SampleCheck; search?: string } = {}) {
    const root = document.createElement('div');
    const notice = document.createElement('p');
    const parent = { postMessage: vi.fn() };
    const self = new EventTarget();
    const handles: any[] = [];
    const mount = vi.fn(async (_element: Element, options: any) => {
      const handle = {
        options,
        schedule,
        restyle: vi.fn(() => false),
        seek: vi.fn(async () => true),
        destroy: vi.fn(),
      };

      handles.push(handle);
      return handle;
    });
    const started = startPreviewFrame({
      root,
      notice,
      search,
      origin,
      parent: parent as unknown as Window,
      self: self as unknown as Window,
      mount,
      checkSample: async () => sample,
    });
    const send = (data: unknown, from: unknown = parent, at = origin) =>
      started.receive({ data, source: from, origin: at } as MessageEvent);
    const statuses = () =>
      parent.postMessage.mock.calls
        .map(([message]) => message)
        .filter((message) => message.type === PREVIEW_STATUS_MESSAGE)
        .map(({ status }) => status);
    const settle = async () => {
      await started.ready;
      await new Promise((resolve) => setTimeout(resolve));
    };

    return { root, notice, parent, mount, handles, started, send, statuses, settle };
  }

  it('says loading at once and mounts the Grok sample in preview mode for the posted preset', async () => {
    const test = frame();

    expect(test.statuses()).toEqual(['loading']);
    expect(test.parent.postMessage).toHaveBeenCalledWith(expect.anything(), origin);

    test.send({ type: PREVIEW_MESSAGE, preset });
    await test.settle();

    const [options] = test.mount.mock.calls.map(([, value]) => value);

    expect(options).toMatchObject({ playerType: 'videojs', preview: { schedule: SAMPLE_SCHEDULE_URL, preset } });
    expect(options.src).toMatch(/\/demo-media\/grok-20261018\/content-scene-01\.mp4$/);
    expect(test.root.getAttribute('lang')).toBe('ko');
    expect(test.statuses()).toEqual(['loading', 'loading', 'ready']);
  });

  it('follows pageLang only while the preset leaves the language empty', async () => {
    const test = frame();

    test.send({ type: PREVIEW_MESSAGE, preset, pageLang: 'ja' });
    await test.settle();

    expect(test.root.getAttribute('lang')).toBe('ja');

    test.send({ type: PREVIEW_MESSAGE, preset: { ...preset, language: 'en' }, pageLang: 'ja' });
    await test.settle();

    expect(test.root.getAttribute('lang')).toBe('ko');
    expect(test.mount).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['fr', 'fr'],
    ['zh-Hant-TW', 'zh-Hant-TW'],
    ['ko KR', 'ko'],
    ['<b>', 'ko'],
    [42, 'ko'],
  ])('hands the page language %j to the loader as %j', async (pageLang, lang) => {
    const test = frame();

    test.send({ type: PREVIEW_MESSAGE, preset, pageLang });
    await test.settle();

    expect(test.root.getAttribute('lang')).toBe(lang);
  });

  it('ignores messages from another origin or another window', async () => {
    const test = frame();

    test.send({ type: PREVIEW_MESSAGE, preset }, test.parent, 'https://evil.test');
    test.send({ type: PREVIEW_MESSAGE, preset }, window);
    test.send({ type: PREVIEW_COMMAND_MESSAGE, command: 'restart' }, {});
    await test.settle();

    expect(test.mount).not.toHaveBeenCalled();
    expect(test.statuses()).toEqual(['loading']);
  });

  it('runs scene commands on the player and mounts again for restart', async () => {
    const test = frame();

    test.send({ type: PREVIEW_COMMAND_MESSAGE, command: 'start' });
    test.send({ type: PREVIEW_MESSAGE, preset });
    await test.settle();
    test.send({ type: PREVIEW_COMMAND_MESSAGE, command: 'before-midroll' });
    test.send({ type: PREVIEW_COMMAND_MESSAGE, command: 'jump' });
    test.send({ type: PREVIEW_COMMAND_MESSAGE, command: 'restart' });
    await test.settle();

    expect(test.handles[0].seek.mock.calls).toEqual([['before-midroll']]);
    expect(test.handles[0].destroy).toHaveBeenCalled();
    expect(test.mount).toHaveBeenCalledTimes(2);
  });

  describe('scene commands after ads (A2DD2-01)', () => {
    const events = (test: ReturnType<typeof frame>) =>
      test.parent.postMessage.mock.calls
        .map(([message]) => message)
        .filter((message) => message.type === PREVIEW_EVENT_MESSAGE);
    const ad = (type: string) => ({ type, breakId: 'pre', itemId: 'a', occurredAt: '2026-10-21T00:00:00.000Z' });

    async function playing() {
      const test = frame();

      test.send({ type: PREVIEW_MESSAGE, preset });
      await test.settle();
      test.handles[0].options.onEvent(ad('start'));
      return test;
    }

    it('mounts a new player at a scene the player asks to remount for, and drops the old player events', async () => {
      const test = await playing();

      test.handles[0].seek.mockResolvedValueOnce('remount');
      test.send({ type: PREVIEW_COMMAND_MESSAGE, command: 'before-midroll' });
      await test.settle();
      test.handles[0].options.onEvent(ad('error'));

      expect(test.handles[0].destroy).toHaveBeenCalled();
      expect(test.mount).toHaveBeenCalledTimes(2);
      expect(test.mount.mock.calls[1]![1].preview).toEqual({
        schedule: SAMPLE_SCHEDULE_URL,
        preset,
        scene: 'before-midroll',
      });
      expect(test.statuses().slice(-2)).toEqual(['loading', 'ready']);
      expect(events(test).map(({ event }) => event.kind)).toEqual(['start']);
    });

    it('moves the same player when the scene has not played', async () => {
      const test = await playing();

      test.send({ type: PREVIEW_COMMAND_MESSAGE, command: 'before-end' });
      await test.settle();

      expect(test.handles[0].seek).toHaveBeenCalledWith('before-end');
      expect(test.mount).toHaveBeenCalledTimes(1);
      expect(test.handles[0].destroy).not.toHaveBeenCalled();
    });

    it('keeps only the last of quick scene commands', async () => {
      const test = await playing();

      test.handles[0].seek.mockResolvedValue('remount');
      test.send({ type: PREVIEW_COMMAND_MESSAGE, command: 'before-midroll' });
      test.send({ type: PREVIEW_COMMAND_MESSAGE, command: 'start' });
      await test.settle();

      expect(test.mount).toHaveBeenCalledTimes(2);
      expect(test.mount.mock.calls[1]![1].preview.scene).toBe('start');
    });

    it('mounts again for a scene asked while a player mounts, and only that player reports', async () => {
      const test = await playing();
      let finish = () => {};

      test.mount.mockImplementationOnce(
        (_element, options) =>
          new Promise((resolve) => {
            finish = () => resolve({ options, schedule, restyle: vi.fn(), seek: vi.fn(), destroy: vi.fn() });
          })
      );
      test.handles[0].seek.mockResolvedValueOnce('remount');
      test.send({ type: PREVIEW_COMMAND_MESSAGE, command: 'before-midroll' });
      await test.settle();
      test.send({ type: PREVIEW_COMMAND_MESSAGE, command: 'before-end' });
      await test.settle();
      finish();
      await test.settle();

      expect(test.mount.mock.calls.map(([, options]) => options.preview.scene)).toEqual([
        undefined,
        'before-midroll',
        'before-end',
      ]);
      expect(test.handles).toHaveLength(2);
      expect(test.statuses().slice(-3)).toEqual(['loading', 'loading', 'ready']);
    });
  });

  it('restyles in place when the player can and mounts again when it cannot', async () => {
    const test = frame();

    test.send({ type: PREVIEW_MESSAGE, preset });
    await test.settle();
    test.handles[0].restyle.mockReturnValueOnce(true);
    test.send({ type: PREVIEW_MESSAGE, preset: { ...preset, theme: { accentColor: '#000000' } } });
    await test.settle();

    expect(test.mount).toHaveBeenCalledTimes(1);

    test.send({ type: PREVIEW_MESSAGE, preset: { ...preset, playback: { loop: true } } });
    await test.settle();

    expect(test.mount).toHaveBeenCalledTimes(2);
  });

  it('reports an invalid preset and skips a preset for the other player', async () => {
    const test = frame();

    test.send({ type: PREVIEW_MESSAGE, preset: { ...preset, theme: { accentColor: 'red' } } });
    test.send({ type: PREVIEW_MESSAGE, preset: { name: '기본', playerType: 'native' } });
    await test.settle();

    expect(test.mount).not.toHaveBeenCalled();
    expect(test.statuses()).toEqual(['loading', 'error']);
    expect(test.notice.hidden).toBe(false);
  });

  it.each([
    ['missing', MISSING_SAMPLE_MESSAGE],
    ['invalid', INVALID_SAMPLE_MESSAGE],
  ])('reports missing-sample with reason %s and leaves the player area empty', async (reason, message) => {
    const test = frame({ sample: { ok: false, reason, message } });

    test.send({ type: PREVIEW_MESSAGE, preset });
    await test.settle();

    expect(test.mount).not.toHaveBeenCalled();
    expect(test.statuses()).toEqual(['loading', 'missing-sample']);
    expect(test.parent.postMessage).toHaveBeenLastCalledWith(
      { type: PREVIEW_STATUS_MESSAGE, status: 'missing-sample', message, reason },
      origin
    );
    expect(test.root.children).toHaveLength(0);
  });

  it('reports a sample check without a reason, such as a failed one, as missing', async () => {
    const test = frame({ sample: { ok: false, message: '' } });

    test.send({ type: PREVIEW_MESSAGE, preset });
    await test.settle();

    expect(test.parent.postMessage).toHaveBeenLastCalledWith(
      { type: PREVIEW_STATUS_MESSAGE, status: 'missing-sample', message: '', reason: 'missing' },
      origin
    );
  });

  it('gives the sample its title and the placeholder poster', async () => {
    const test = frame();

    test.send({ type: PREVIEW_MESSAGE, preset });
    await test.settle();

    expect(test.mount.mock.calls[0]![1]).toMatchObject({
      title: SAMPLE_TITLE,
      poster: expect.stringMatching(/\/examples\/sample-poster\.svg$/),
    });
  });

  it.each([
    ['the posted title', '  지면 본편  ', '지면 본편'],
    ['the video ID for a malformed title', 'a\u0007b', 'grok-demo-scene-01'],
    ['the video ID without a title', undefined, 'grok-demo-scene-01'],
  ])('titles posted content with %s', async (_case, title, expected) => {
    const test = frame();

    test.send({ type: PREVIEW_MESSAGE, preset, schedule, content: '/media/a.mp4', title });
    await test.settle();

    expect(test.mount.mock.calls[0]![1]).toMatchObject({
      title: expected,
      poster: expect.stringMatching(/\/examples\/sample-poster\.svg$/),
    });
  });

  it('mounts again when the posted title changes', async () => {
    const test = frame();

    test.send({ type: PREVIEW_MESSAGE, preset, schedule, content: '/media/a.mp4', title: '하나' });
    await test.settle();
    test.handles[0].restyle.mockReturnValue(true);
    test.send({ type: PREVIEW_MESSAGE, preset, schedule, content: '/media/a.mp4', title: '둘' });
    await test.settle();

    expect(test.mount).toHaveBeenCalledTimes(2);
    expect(test.mount.mock.calls[1]![1].title).toBe('둘');
  });

  it('plays a posted schedule and content under the data-src rule instead of the sample', async () => {
    const test = frame({ sample: { ok: false, reason: 'missing', message: MISSING_SAMPLE_MESSAGE } });

    test.send({ type: PREVIEW_MESSAGE, preset, schedule, content: `${origin}/media/a.mp4?x=1` });
    await test.settle();

    expect(test.mount.mock.calls[0]![1]).toMatchObject({ src: '/media/a.mp4?x=1', preview: { schedule } });

    test.send({ type: PREVIEW_MESSAGE, preset, schedule, content: 'https://other.test/a.mp4' });
    await test.settle();

    expect(test.mount.mock.calls[1]![1]).toMatchObject({ src: 'https://other.test/a.mp4', preview: { schedule } });

    for (const content of [
      'media/a.mp4',
      '//other.test/a.mp4',
      'javascript:alert(1)',
      'https://user:pw@other.test/a.mp4',
    ]) {
      test.send({ type: PREVIEW_MESSAGE, preset, schedule, content });
      await test.settle();
    }

    expect(test.mount).toHaveBeenCalledTimes(2);
    expect(test.statuses().at(-1)).toBe('error');
  });

  it('forwards ad events with their break position and place', async () => {
    const test = frame();

    test.send({ type: PREVIEW_MESSAGE, preset });
    await test.settle();
    test.mount.mock.calls[0]![1].onEvent({ type: 'start', breakId: 'pre', itemId: 'b', occurredAt: 'T' });

    expect(test.parent.postMessage).toHaveBeenLastCalledWith(
      { type: PREVIEW_EVENT_MESSAGE, event: { kind: 'start', position: 'pre', at: 'T', index: 2, count: 2 } },
      origin
    );
  });

  it('shows only guidance when opened on its own', () => {
    const root = document.createElement('div');
    const notice = document.createElement('p');
    const mount = vi.fn();

    startPreviewFrame({ root, notice, parent: window, self: window, mount });

    expect(notice.hidden).toBe(false);
    expect(notice.textContent).toBe(STANDALONE_MESSAGE);
    expect(notice.getAttribute('role')).toBe('note');
    expect(root.hidden).toBe(true);
    expect(mount).not.toHaveBeenCalled();
  });
});

describe('checkSample', () => {
  it('reports a missing schedule or content file with the preparation message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 404 }))
    );
    await expect(checkSample()).resolves.toEqual({ ok: false, reason: 'missing', message: MISSING_SAMPLE_MESSAGE });

    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) =>
        init?.method === 'HEAD'
          ? new Response('', { status: 404 })
          : json({ videoId: 'grok-demo-scene-01', breaks: [] })
      )
    );
    await expect(checkSample()).resolves.toMatchObject({ ok: false, reason: 'missing' });
  });

  it('refuses a schedule for another video and returns a good one', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ videoId: 'other', breaks: [] }))
    );
    await expect(checkSample()).resolves.toMatchObject({ ok: false, reason: 'invalid' });

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ videoId: 'grok-demo-scene-01', breaks: [] }))
    );
    await expect(checkSample()).resolves.toEqual({ ok: true, schedule: { videoId: 'grok-demo-scene-01', breaks: [] } });
  });
});

describe('loadPresetList', () => {
  const route = (presets: (url: URL) => Response) =>
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: URL | string) => {
        const url = new URL(String(input));

        return url.searchParams.get('action') === 'player-preset'
          ? json({ ok: true, data: { id: 'p-site000001' } })
          : presets(url);
      })
    );

  it.each([401, 403])('quietly keeps the public list on %i', async (status) => {
    route(() => json({ ok: false }, status));

    const list = await loadPresetList();

    expect(list).toMatchObject({ siteId: 'p-site000001', signedIn: false, notice: '' });
    expect(list.items.map((item) => [item.id, presetLabel(item, list.signedIn)])).toEqual([
      ['default', '기본'],
      ['flat', '플랫'],
      ['rounded', '둥근 테두리'],
      ['accent', '강조색'],
      ['lms', '강의'],
      ['p-site000001', '사이트 적용 프리셋'],
    ]);
  });

  it('keeps the public list with a notice on another failure', async () => {
    route(() => json({ ok: false }, 500));

    expect(await loadPresetList()).toMatchObject({
      signedIn: false,
      notice: expect.stringMatching(/내장 프리셋과 사이트 적용 프리셋만 보여요/),
    });
  });

  it('lists every saved preset for a signed-in admin, marking the site preset', async () => {
    route(() =>
      json({
        ok: true,
        data: {
          defaultPresetId: 'p-site000001',
          presets: [
            { id: 'default', name: '기본', builtIn: true },
            { id: 'p-site000001', name: '회사 프리셋' },
          ],
        },
      })
    );

    const list = await loadPresetList();

    expect(list.signedIn).toBe(true);
    expect(list.items.map((item) => presetLabel(item, true))).toEqual(['기본', '회사 프리셋 (사이트 적용)']);
  });
});

describe('adProgress', () => {
  it('finds the break position and the ad place, and keeps the latest 20 lines', () => {
    const entry = adProgress(
      { type: 'start', breakId: 'mid', itemId: 'y', occurredAt: 'T' },
      { breaks: [{ breakId: 'mid', position: 'mid', ads: [{ itemId: 'x' }, { itemId: 'y' }] }] }
    );

    expect(entry).toEqual({ kind: 'start', position: 'mid', at: 'T', index: 2, count: 2 });
    expect(progressText(entry)).toBe('미드롤 2/2 · 시작');
    expect(nowText(entry)).toBe('미드롤 2/2 재생 중');
    expect(nowText({ ...entry, kind: 'complete' })).toBe('미드롤 2/2 · 끝남');
    expect(progressText({ kind: 'skip', position: '', index: 0, count: 0 })).toBe('건너뜀');

    let log: unknown[] = [];

    for (let index = 0; index < EVENT_LOG_LIMIT + 5; index++) log = pushProgress(log, index);

    expect(log).toHaveLength(EVENT_LOG_LIMIT);
    expect(log[0]).toBe(EVENT_LOG_LIMIT + 4);
  });
});
