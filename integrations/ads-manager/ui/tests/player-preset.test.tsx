/// <reference types="node" />
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vite-plus/test';

import {
  AD_LABEL_DEFAULTS,
  AD_LABEL_KEYS,
  DEFAULT_PLAYER_PRESET,
  LOGO_DEFAULTS,
  parsePlayerPreset,
  type PlayerPreset,
  type PlayerPresetRender,
  type PresetError,
  presetRender,
  type PresetResult,
} from '../src/player';
import { PRESET_CSS_PROPERTIES } from '../src/player/preset';

type Json = string | number | boolean | null | readonly Json[] | JsonObject;

interface JsonObject {
  readonly [key: string]: Json | undefined;
}

type RenderResult =
  | { readonly ok: true; readonly render: PlayerPresetRender; readonly preset: PlayerPreset }
  | { readonly ok: false; readonly errors: readonly PresetError[] };

/** `public/player/preset.js`, the browser copy of the parser that the loader, the examples and the preview share. */
interface BrowserPreset {
  readonly PRESET_CSS_PROPERTIES: readonly string[];
  readonly MEDIA_ADS_ATTRIBUTES: readonly string[];
  readonly AD_LABEL_KEYS: readonly string[];
  parsePlayerPreset(value: Json | undefined): PresetResult;
  presetRender(preset: PlayerPreset, revision?: number): PlayerPresetRender;
  defaultRender(playerType?: string): PlayerPresetRender;
  readPresetRender(value: Json | undefined): RenderResult;
  applyPresetCss(element: HTMLElement, css: Readonly<Record<string, string>>): void;
  applyMediaAdsAttributes(element: HTMLElement, attributes: Readonly<Record<string, string>>): void;
}

interface Fixture {
  readonly builtIn: readonly JsonObject[];
  readonly normalize: readonly {
    readonly name: string;
    readonly input: Json;
    readonly expect:
      | { readonly ok: true; readonly preset: JsonObject }
      | { readonly ok: false; readonly field: string };
  }[];
  readonly render: readonly {
    readonly name: string;
    readonly preset: JsonObject;
    readonly revision: number;
    readonly render: JsonObject;
  }[];
}

// A variable specifier keeps the untyped browser file out of the TypeScript program (`allowJs` is off).
const browserPath = `${import.meta.dirname}/../../public/player/preset.js`;
const browser: BrowserPreset = await import(/* @vite-ignore */ browserPath);
// Shared with the PHP and loader validators; ads-admin-api owns the file.
const fixture: Fixture = JSON.parse(
  readFileSync(`${import.meta.dirname}/../../tests/fixtures/player-preset-v2.json`, 'utf8')
);

const full = {
  id: 'p-abc123def4',
  name: '  메인 플레이어  ',
  playerType: 'videojs',
  language: 'ja',
  theme: {
    accentColor: '#f5c518',
    accentTextColor: '#111111',
    borderColor: '#000000',
    borderRadius: 12,
    fontFamily: 'system',
    objectFit: 'cover',
    scaleUnit: 'root',
  },
  playback: { autoplay: true, muted: true, loop: true, preload: 'auto' },
  display: { poster: false, title: true },
  input: { hotkeys: false, gestures: true },
  controls: { captions: false, seekButtons: 10 },
  ads: {
    labels: {
      skip: '건너뛰기',
      skipCountdown: '{seconds}초 뒤',
      timer: '{elapsed} / {duration}',
      sequence: '광고 {index}/{count}',
    },
    accentColor: '#00ff88',
    skipRadius: 4,
    fontSize: 14,
    progress: { bar: true },
  },
};
const native = {
  id: 'p-xyz123def4',
  name: '기본 video',
  playerType: 'native',
  language: 'en',
  playback: { loop: true },
  display: { poster: false },
  ads: { ...full.ads, timeouts: { loadSeconds: 8, stallSeconds: 20 } },
};

/** Both parsers must agree on every case in this file. */
function parsed(value: Json): PlayerPreset {
  const result = parsePlayerPreset(value);

  expect(browser.parsePlayerPreset(value)).toStrictEqual(result);

  if (!result.ok) throw new Error(JSON.stringify(result.errors));

  return result.preset;
}

function errors(value: Json) {
  const result = parsePlayerPreset(value);

  expect(browser.parsePlayerPreset(value)).toStrictEqual(result);

  return result.ok ? [] : result.errors;
}

/** A stored or built-in preset without the metadata the parser drops. */
function stripped({ builtIn: _builtIn, createdAt: _createdAt, updatedAt: _updatedAt, ...preset }: JsonObject) {
  return preset;
}

describe('player-preset-v2.json (shared fixture)', () => {
  it.each(fixture.normalize.map((entry) => [entry.name, entry] as const))('normalizes %s', (_name, entry) => {
    const result = parsePlayerPreset(entry.input);

    expect(browser.parsePlayerPreset(entry.input)).toStrictEqual(result);

    if (entry.expect.ok) {
      expect(result).toStrictEqual({ ok: true, preset: entry.expect.preset });
      // Key order is part of the stored document.
      expect(JSON.stringify(result.ok && result.preset)).toBe(JSON.stringify(entry.expect.preset));
    } else {
      expect(result.ok ? null : result.errors[0]?.path).toBe(entry.expect.field);
    }
  });

  it.each(fixture.render.map((entry) => [entry.name, entry] as const))('renders %s', (_name, entry) => {
    const preset = parsed(entry.preset);
    const render = presetRender(preset, entry.revision);

    expect(render).toStrictEqual(entry.render);
    expect(JSON.stringify(render)).toBe(JSON.stringify(entry.render));
    expect(browser.presetRender(preset, entry.revision)).toStrictEqual(render);

    // The loader rebuilds a preset from the render alone, so only its render has to round-trip.
    const read = browser.readPresetRender(entry.render);

    expect(read).toMatchObject({ ok: true, render });
    expect(read.ok && presetRender(read.preset, entry.revision)).toStrictEqual(render);
  });

  it.each(fixture.builtIn.map((entry) => [entry.id, entry] as const))('reads the built-in %s', (_id, entry) => {
    expect(parsed(entry)).toStrictEqual(stripped(entry));
  });

  it('matches DEFAULT_PLAYER_PRESET with the built-in default', () => {
    expect(DEFAULT_PLAYER_PRESET).toStrictEqual(stripped(fixture.builtIn[0]!));
  });

  // `migrate` reads stored v1 documents; only the PHP side does that (contract 2.3).
});

describe('AD_LABEL_DEFAULTS', () => {
  it('copies the ads package Korean labels in contract order without mediaAlt', () => {
    const source = readFileSync(`${import.meta.dirname}/../../../../packages/extensions/ads/src/dom/ui.ts`, 'utf8');
    const korean = source.slice(
      source.indexOf('const KO: AdsLabels = {'),
      source.indexOf('\n};', source.indexOf('const KO'))
    );
    const labels = Object.fromEntries(
      [...korean.matchAll(/^ {2}(\w+): '([^']*)',$/gm)].map(([, key, value]) => [key!, value!])
    );
    const expected = Object.fromEntries(Object.entries(labels).filter(([key]) => key !== 'mediaAlt'));

    expect(Object.keys(labels)).toContain('mediaAlt');
    expect(AD_LABEL_DEFAULTS).toStrictEqual(expected);
    expect(Object.keys(AD_LABEL_DEFAULTS)).toEqual([...AD_LABEL_KEYS]);
    expect(browser.AD_LABEL_KEYS).toEqual([...AD_LABEL_KEYS]);
  });
});

describe('parsePlayerPreset', () => {
  it('accepts every A2-1 field and trims the name and labels', () => {
    const preset = parsed({ ...full, ads: { ...full.ads, labels: { skip: '  건너뛰기 ' } } });

    expect(preset.name).toBe('메인 플레이어');
    expect(preset.language).toBe('ja');
    expect(preset.playback).toStrictEqual({ autoplay: true, muted: true, loop: true, preload: 'auto' });
    expect(preset.controls.seekButtons).toBe(10);
    expect(preset.ads.labels.skip).toBe('건너뛰기');
  });

  it('reads absent groups and fields as empty', () => {
    expect(parsed({ name: '새 프리셋', playerType: 'videojs' })).toStrictEqual({
      ...DEFAULT_PLAYER_PRESET,
      id: null,
      name: '새 프리셋',
    });
  });

  it("reads '' in text and boolean fields as empty", () => {
    const preset = parsed({
      ...full,
      language: '',
      theme: { accentColor: '', fontFamily: '' },
      playback: { loop: '', preload: '' },
      display: { title: '' },
      ads: { accentColor: '', labels: { skip: '', timer: '   ' } },
    });

    expect(preset.language).toBeNull();
    expect(preset.theme).toStrictEqual(DEFAULT_PLAYER_PRESET.theme);
    expect(preset.playback).toStrictEqual(DEFAULT_PLAYER_PRESET.playback);
    expect(preset.display).toStrictEqual(DEFAULT_PLAYER_PRESET.display);
    expect(preset.ads).toStrictEqual(DEFAULT_PLAYER_PRESET.ads);
  });

  it('ignores stored metadata and keeps the contract key order', () => {
    const preset = parsed({ id: 'default', name: '기본', playerType: 'videojs', builtIn: true, createdAt: null });

    expect(preset.id).toBe('default');
    expect(Object.keys(preset)).toEqual([
      'id',
      'name',
      'playerType',
      'language',
      'theme',
      'playback',
      'display',
      'input',
      'controls',
      'logo',
      'ads',
      'lms',
    ]);
    expect(Object.keys(preset.ads)).toEqual([
      'labels',
      'accentColor',
      'skipRadius',
      'fontSize',
      'progress',
      'timeouts',
    ]);
  });

  it.each([
    [{ skin: 'default' }, 'skin'],
    [{ ads: { locale: 'ko' } }, 'ads.locale'],
    [{ ads: { labels: { mediaAlt: '광고' } } }, 'ads.labels.mediaAlt'],
  ])('rejects the removed key in %j', (patch, path) => {
    expect(errors({ name: '테스트', playerType: 'videojs', ...patch })).toStrictEqual([{ path, code: 'unknown_key' }]);
  });

  it.each([0, 1, 'true'])('rejects %j in a boolean field', (value) => {
    expect(errors({ ...full, display: { poster: value } })).toStrictEqual([{ path: 'display.poster', code: 'type' }]);
  });

  it('rejects autoplay without muted and a logo asset that is not built in', () => {
    expect(errors({ ...full, playback: { autoplay: true, muted: false } })).toStrictEqual([
      { path: 'playback.muted', code: 'conflict' },
    ]);
    expect(errors({ ...full, logo: { assetId: 'a-1' } })).toStrictEqual([
      { path: 'logo.assetId', code: 'unavailable' },
    ]);
    expect(parsed({ ...full, logo: { assetId: 'sample' } }).logo.assetId).toBe('sample');
  });

  it('rejects values the selected player cannot apply', () => {
    expect(
      errors({ ...native, theme: { accentColor: '#000000' }, display: { title: true }, input: { hotkeys: true } })
    ).toStrictEqual([
      { path: 'theme.accentColor', code: 'player_type' },
      { path: 'display.title', code: 'player_type' },
      { path: 'input.hotkeys', code: 'player_type' },
    ]);
    expect(errors({ ...full, ads: { ...full.ads, timeouts: { loadSeconds: 8, stallSeconds: 20 } } })).toStrictEqual([
      { path: 'ads.timeouts.loadSeconds', code: 'player_type' },
      { path: 'ads.timeouts.stallSeconds', code: 'player_type' },
    ]);
  });

  it.each([
    ['NBSP', ' 건너뛰기 '],
    ['U+3000', '　건너뛰기　'],
    ['U+FEFF', '﻿건너뛰기'],
  ])('trims %s like String.prototype.trim', (_name, skip) => {
    const preset = parsed({ ...full, name: skip, ads: { ...full.ads, labels: { skip } } });

    expect(preset.name).toBe('건너뛰기');
    expect(preset.ads.labels.skip).toBe('건너뛰기');
  });

  it.each([
    ['RLO U+202E', '‮기뛰너건'],
    ['LRE U+202A', '‪건너뛰기'],
    ['LRI U+2066', '⁦건너뛰기⁩'],
    ['PDI U+2069', '건너뛰기⁩'],
  ])('rejects the bidirectional control %s in the name and labels', (_name, value) => {
    expect(errors({ ...full, name: value, ads: { ...full.ads, labels: { skip: value, timer: value } } })).toStrictEqual(
      [
        { path: 'name', code: 'control' },
        { path: 'ads.labels.skip', code: 'control' },
        { path: 'ads.labels.timer', code: 'control' },
      ]
    );
  });

  it('takes #rrggbbaa only in the border color', () => {
    const eight = '#00000026';

    expect(parsed({ ...full, theme: { borderColor: eight } }).theme.borderColor).toBe(eight);
    expect(parsed({ ...full, theme: { borderColor: '#00000000' } }).theme.borderColor).toBe('#00000000');
    expect(
      errors({
        ...full,
        theme: { accentColor: eight, accentTextColor: eight, borderColor: '#0000002' },
        ads: { ...full.ads, accentColor: eight },
      })
    ).toStrictEqual([
      { path: 'theme.accentColor', code: 'format' },
      { path: 'theme.accentTextColor', code: 'format' },
      { path: 'theme.borderColor', code: 'format' },
      { path: 'ads.accentColor', code: 'format' },
    ]);
    // Uppercase is refused as in the other color fields; the admin lowercases what it sends.
    expect(errors({ ...full, theme: { borderColor: '#AABBCC26' } })).toStrictEqual([
      { path: 'theme.borderColor', code: 'format' },
    ]);
  });

  it.each(['default', 'flat', 'rounded', 'accent', 'lms'])('accepts the built-in id %s', (id) => {
    expect(parsed({ ...full, id }).id).toBe(id);
  });

  it('keeps bidirectional marks that only set direction', () => {
    expect(parsed({ ...full, ads: { ...full.ads, labels: { skip: '‏건너뛰기' } } }).ads.labels.skip).toBe('‏건너뛰기');
  });

  it('rejects non-object input', () => {
    expect(parsePlayerPreset(null)).toStrictEqual({ ok: false, errors: [{ path: '', code: 'type' }] });
    expect(parsePlayerPreset([])).toStrictEqual({ ok: false, errors: [{ path: '', code: 'type' }] });
  });
});

describe('presetRender', () => {
  it('fills defaults, keeps an empty muted false under autoplay and keeps the language for the page', () => {
    const render = presetRender(parsed({ ...full, playback: { autoplay: true, muted: null } }), 7);

    expect(render).toMatchObject({
      revision: 7,
      language: 'ja',
      // The loader mutes autoplay after merging page values (contract 3), not the render.
      playback: { autoplay: true, muted: false, loop: false, preload: 'metadata' },
      display: { poster: false, title: true },
      input: { hotkeys: false, gestures: true },
      logo: null,
      progress: { sequence: true, timer: true, bar: true },
      skinTag: 'video-skin',
      styles: { css: 'video.css', js: 'video.js' },
    });
    expect(Object.keys(render.css)).toEqual([...PRESET_CSS_PROPERTIES]);
    expect(render).toHaveProperty('attributes', {
      lang: 'ko',
      'skip-label': '건너뛰기',
      'skip-countdown-label': '{seconds}초 뒤',
      'timer-label': '{elapsed} / {duration}',
    });
    // Only set labels, in contract order.
    expect(Object.keys(render.labels)).toEqual(['sequence', 'skip', 'skipCountdown', 'timer']);
  });

  it('renders native labels, the Korean locale and both timeouts', () => {
    const render = presetRender(parsed(native));

    expect(render).not.toHaveProperty('attributes');
    expect(render).not.toHaveProperty('input');
    expect(render).toHaveProperty('display', { poster: false });
    expect(render).toHaveProperty('ui', {
      locale: 'ko',
      labels: {
        sequence: '광고 {index}/{count}',
        skip: '건너뛰기',
        skipCountdown: '{seconds}초 뒤',
        timer: '{elapsed} / {duration}',
      },
    });
    expect(render).toHaveProperty('timeouts', { loadSeconds: 8, stallSeconds: 20 });
  });

  it.each([
    ['full Video.js', full, 7],
    ['full native', native, 0],
    ['built-in', JSON.parse(JSON.stringify(DEFAULT_PLAYER_PRESET)), 3],
  ] as const)('renders the %s preset like public/player/preset.js', (_name, value: Json, revision) => {
    const preset = parsed(value);

    expect(browser.presetRender(preset, revision)).toStrictEqual(presetRender(preset, revision));
  });

  it('matches the loader fallback with the built-in default', () => {
    expect(browser.defaultRender()).toStrictEqual(presetRender(DEFAULT_PLAYER_PRESET));
    expect(browser.defaultRender('native')).toStrictEqual(
      presetRender({ ...DEFAULT_PLAYER_PRESET, playerType: 'native' })
    );
  });

  it('shares the CSS property and attribute tables', () => {
    expect(browser.PRESET_CSS_PROPERTIES).toEqual([...PRESET_CSS_PROPERTIES]);
    expect(browser.MEDIA_ADS_ATTRIBUTES).toEqual(['lang', 'skip-label', 'skip-countdown-label', 'timer-label']);
  });
});

describe('readPresetRender', () => {
  const videojs = JSON.parse(JSON.stringify(presetRender(parsed(full), 3)));
  const nativeRender = JSON.parse(JSON.stringify(presetRender(parsed(native), 3)));
  const sampleLogo = { src: 'logo-sample.svg', ...LOGO_DEFAULTS };

  it.each([
    ['Video.js', videojs],
    ['Video.js with the sample logo', { ...videojs, logo: sampleLogo }],
    ['native', nativeRender],
  ] as const)('accepts the %s render presetRender makes and returns its preset', (_name, render) => {
    const result = browser.readPresetRender(render);

    expect(result).toMatchObject({ ok: true, render });
    expect(result.ok && presetRender(result.preset, 3)).toStrictEqual(render);
  });

  it('reads an autoplay render with muted false back as a preset with muted left empty', () => {
    const render = presetRender(parsed({ ...full, playback: { autoplay: true } }), 3);
    const result = browser.readPresetRender(JSON.parse(JSON.stringify(render)));

    expect(render.playback).toMatchObject({ autoplay: true, muted: false });
    expect(result).toMatchObject({ ok: true, render, preset: { playback: { autoplay: true, muted: null } } });
  });

  it.each([
    ['an unknown CSS property', { ...videojs, css: { '--evil': 'url(x)' } }, 'css.--evil', 'unknown_key'],
    ['a non-table font', { ...videojs, css: { '--media-font-family': 'serif' } }, 'theme.fontFamily', 'enum'],
    ['a non-pixel radius', { ...videojs, css: { '--media-border-radius': '1em' } }, 'theme.borderRadius', 'type'],
    ['a bad color', { ...videojs, css: { '--ads-accent-color': 'red' } }, 'ads.accentColor', 'format'],
    ['an unknown attribute', { ...videojs, attributes: { onclick: 'x' } }, 'attributes.onclick', 'unknown_key'],
    [
      'the removed media-alt',
      { ...videojs, attributes: { 'media-alt': '광고' } },
      'attributes.media-alt',
      'unknown_key',
    ],
    ['a stray label brace', { ...videojs, labels: { skip: '{x}' } }, 'ads.labels.skip', 'placeholder'],
    [
      'a removed ui label',
      { ...nativeRender, ui: { labels: { mediaAlt: '광고' } } },
      'ads.labels.mediaAlt',
      'unknown_key',
    ],
    ['Video.js timeouts', { ...videojs, timeouts: { loadSeconds: 8 } }, 'ads.timeouts.loadSeconds', 'player_type'],
    ['an out-of-range timeout', { ...nativeRender, timeouts: { loadSeconds: 0 } }, 'ads.timeouts.loadSeconds', 'range'],
    [
      'a native theme',
      { ...nativeRender, css: { '--media-accent-color': '#000000' } },
      'theme.accentColor',
      'player_type',
    ],
    ['an unknown language', { ...videojs, language: 'fr' }, 'language', 'enum'],
    ['a numeric boolean', { ...videojs, playback: { ...videojs.playback, loop: 1 } }, 'playback.loop', 'type'],
    ['a missing revision', { ...nativeRender, revision: null }, 'revision', 'type'],
    ['an unknown logo key', { ...videojs, logo: { url: '/x.png' } }, 'logo.url', 'unknown_key'],
    [
      'a logo image that is not built in',
      { ...videojs, logo: { ...sampleLogo, src: 'https://example.com/x.png' } },
      'logo.assetId',
      'unavailable',
    ],
  ] as const)('rejects %s', (_name, render, path, code) => {
    expect(browser.readPresetRender(render)).toStrictEqual({ ok: false, errors: [{ path, code }] });
  });

  it.each([
    ['skin tag', { ...videojs, skinTag: 'video-neutral-skin' }],
    ['skin script', { ...videojs, styles: { css: 'video.css', js: '../evil.js' } }],
    ['native styles', { ...nativeRender, styles: { css: 'video.css', js: 'video.js' } }],
    ['logo', { ...videojs, logo: { src: 'logo-sample.svg', position: 'top-right' } }],
    ['extra key', { ...nativeRender, script: 'x' }],
  ] as const)('rejects a render whose %s does not match its preset', (_name, render) => {
    expect(browser.readPresetRender(render)).toStrictEqual({ ok: false, errors: [{ path: '', code: 'format' }] });
  });

  // JSON.parse makes `__proto__` an own key, as an API response would.
  it.each(['constructor', 'toString', '__proto__', 'hasOwnProperty'])(
    'rejects the inherited name %s as a CSS property or attribute without throwing',
    (name) => {
      const css = JSON.parse(JSON.stringify({ ...videojs, css: { [name]: '#000000' } }));
      const attributes = JSON.parse(JSON.stringify({ ...videojs, attributes: { [name]: 'x' } }));

      expect(browser.readPresetRender(css)).toStrictEqual({
        ok: false,
        errors: [{ path: `css.${name}`, code: 'unknown_key' }],
      });
      expect(browser.readPresetRender(attributes)).toStrictEqual({
        ok: false,
        errors: [{ path: `attributes.${name}`, code: 'unknown_key' }],
      });
    }
  );

  it.each(['constructor', 'toString', '__proto__', 'hasOwnProperty'])(
    'rejects the inherited name %s as a native label or timeout without throwing',
    (name) => {
      const labels = JSON.parse(
        JSON.stringify({ ...nativeRender, ui: { ...nativeRender.ui, labels: { [name]: 'x' } } })
      );
      const timeouts = JSON.parse(JSON.stringify({ ...nativeRender, timeouts: { [name]: 5 } }));

      expect(browser.readPresetRender(labels)).toStrictEqual({
        ok: false,
        errors: [{ path: `ads.labels.${name}`, code: 'unknown_key' }],
      });
      expect(browser.readPresetRender(timeouts)).toStrictEqual({
        ok: false,
        errors: [{ path: `ads.timeouts.${name}`, code: 'unknown_key' }],
      });
    }
  );

  it('rejects non-object input', () => {
    expect(browser.readPresetRender(null)).toStrictEqual({ ok: false, errors: [{ path: '', code: 'type' }] });
  });
});

describe('applyPresetCss', () => {
  it('sets only table properties and clears stale ones', () => {
    const element = document.createElement('div');

    element.style.setProperty('--media-border-color', '#000000');
    element.style.setProperty('color', 'red');
    browser.applyPresetCss(element, { '--media-accent-color': '#ff6600', '--evil': 'url(x)' });

    expect(element.style.getPropertyValue('--media-accent-color')).toBe('#ff6600');
    expect(element.style.getPropertyValue('--media-border-color')).toBe('');
    expect(element.style.getPropertyValue('--evil')).toBe('');
    expect(element.style.getPropertyValue('color')).toBe('red');
  });
});

describe('applyMediaAdsAttributes', () => {
  it('sets only table attributes and clears stale ones', () => {
    const element = document.createElement('media-ads');

    element.setAttribute('timer-label', '{elapsed}');
    element.setAttribute('video-id', 'video-1');
    browser.applyMediaAdsAttributes(element, { lang: 'ko', 'skip-label': 'Skip', onclick: 'x' });

    expect(element.getAttribute('lang')).toBe('ko');
    expect(element.getAttribute('skip-label')).toBe('Skip');
    expect(element.hasAttribute('timer-label')).toBe(false);
    expect(element.hasAttribute('onclick')).toBe(false);
    expect(element.getAttribute('video-id')).toBe('video-1');
  });
});
