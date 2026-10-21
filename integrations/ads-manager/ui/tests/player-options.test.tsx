// @vitest-environment node
/// <reference types="node" />
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vite-plus/test';

import { loaderApiExample, type PlayerOptionGroup, playerOptions } from '../src/player';
import { DEFAULT_PLAYER_PRESET, PRESET_CSS_PROPERTIES } from '../src/player/preset';

const root = new URL('../../../../', import.meta.url);

function source(path: string): string {
  return readFileSync(new URL(path, root), 'utf8');
}

function names(id: PlayerOptionGroup['id']): string[] {
  return (playerOptions.find((group) => group.id === id)?.rows ?? []).map((row) => row.name).sort();
}

function block(text: string, start: string, end = '\n}'): string {
  const from = text.indexOf(start);

  expect(from).toBeGreaterThanOrEqual(0);
  return text.slice(from, text.indexOf(end, from));
}

describe('playerOptions', () => {
  it('lists every <media-ads> property attribute plus the inherited lang', () => {
    const properties = block(
      source('packages/extensions/ads/src/html/element.ts'),
      'static override properties',
      '\n  };'
    );
    const attributes = [...properties.matchAll(/^ +(\w+): (\{.*\}),$/gm)].map(
      ([, name, options]) => /attribute: '([\w-]+)'/.exec(options!)?.[1] ?? name!
    );

    expect(attributes.length).toBeGreaterThan(0);
    // `lang` is not a property; the element and controller resolve it from the nearest ancestor (dom/ui.ts).
    expect(names('element')).toEqual([...attributes, 'lang'].sort());
  });

  it('lists every createAdsController option key', () => {
    const options = block(
      source('packages/extensions/ads/src/dom/controller.ts'),
      'export interface AdsControllerOptions'
    );
    const keys = [...options.matchAll(/^ {2}readonly (\w+)\??:/gm)].map(([, key]) => key!);
    const timeouts = [...(options.match(/timeouts\?: \{([^}]*)\}/)?.[1] ?? '').matchAll(/readonly (\w+)\?/g)].map(
      ([, key]) => `timeouts.${key}`
    );

    expect([...new Set(names('controller').map((name) => name.split('.')[0]))].sort()).toEqual([...keys].sort());
    expect(names('controller').filter((name) => name.startsWith('timeouts.'))).toEqual(timeouts.sort());
  });

  it('lists every AdsController method', () => {
    const controller = block(
      source('packages/extensions/ads/src/dom/controller.ts'),
      'export interface AdsController {'
    );
    const methods = [...controller.matchAll(/^ {2}(\w+)\(/gm)].map(([, name]) => name!);

    expect(names('controllerMethods').map((name) => name.split('(')[0])).toEqual(methods.sort());
  });

  it('lists exactly the public --media-* skin properties from the skin guide', () => {
    const guide = source('site/src/content/docs/guides/customize-skins.mdx');
    const section = guide.slice(guide.indexOf('## Style a packaged skin'), guide.indexOf('## Style skin source'));
    const properties = [...section.matchAll(/^\| `(--media-[\w-]+)` \|/gm)].map(([, name]) => name!);

    expect(properties.length).toBeGreaterThan(0);
    expect(names('skinCss')).toEqual(properties.sort());
  });

  it('lists exactly the --ads-* properties the overlay reads', () => {
    const styles = source('packages/extensions/ads/src/dom/overlay.styles.ts');
    const properties = [...new Set([...styles.matchAll(/var\((--ads-[\w-]+)/g)].map(([, name]) => name!))];

    expect(names('adsCss')).toEqual(properties.sort());
  });

  it('states the skin values the overlay inherits for radius, focus ring and font', () => {
    const theme = source('packages/skins/src/styles/themes/theme.css');
    const styles = source('packages/extensions/ads/src/dom/overlay.styles.ts');
    const row = (name: string) =>
      playerOptions.flatMap((group) => group.rows).find((option) => option.name === name) ?? { defaultValue: '' };

    // Presets use only the default skin (schema v2), so the rows no longer describe the neutral skin.
    expect(theme).toContain('--media-control-radius: 99px;');
    expect(row('--ads-control-radius').defaultValue).toContain('스킨 안에서 99px');
    expect(JSON.stringify(playerOptions)).not.toMatch(/neutral/i);

    // The skin pins the ring, so the overlay focus ring stays white whatever the accent color is.
    expect(theme).toContain('--media-ring: oklch(1 0 0);');
    expect(styles).toContain('var(--ads-focus-color,var(--media-ring,var(--media-accent-color,#fff)))');
    expect(row('--ads-focus-color').defaultValue).toContain('흰색 oklch(1 0 0)');
    expect(row('--media-accent-color')).toHaveProperty(
      'description',
      expect.stringContaining('흰색(--media-ring)으로 고정')
    );

    expect(styles).toContain('var(--ads-font-family,var(--media-font-family,system-ui))');
    expect(row('--ads-font-family')).toHaveProperty(
      'description',
      expect.stringContaining('지정했으면 그것을 따라가요')
    );
  });

  it('lists the queries the demo and playback test pages read', () => {
    const playTest = source('integrations/ads-manager/public/examples/play-test.js');
    const demo = block(source('integrations/ads-manager/public/examples/demo-state.js'), 'const readers = {', '\n};');
    const read = [
      ...[...playTest.matchAll(/query\.get\('(\w+)'\)/g)].map(([, name]) => name!),
      ...Object.keys(
        JSON.parse(
          /const choices = (\{.*\});/
            .exec(playTest)![1]!
            .replace(/(\w+):/g, '"$1":')
            .replace(/'/g, '"')
        )
      ),
      ...[...demo.matchAll(/^ {2}(\w+):/gm)].map(([, name]) => name!),
    ];

    expect(names('exampleQuery')).toEqual([...new Set(read)].sort());
  });

  it('adds the demo control and logo queries after thumbnails, in the order the demo reads them', () => {
    const demo = block(source('integrations/ads-manager/public/examples/demo-state.js'), 'const readers = {', '\n};');
    const keys = [...demo.matchAll(/^ {2}(\w+):/gm)].map(([, name]) => name!);
    const added = keys.slice(keys.indexOf('thumbnails') + 1, keys.indexOf('media'));
    const rows = playerOptions.find((group) => group.id === 'exampleQuery')!.rows;
    const at = rows.findIndex((row) => row.name === 'thumbnails');
    const row = (name: string) => rows.find((item) => item.name === name)!;

    expect(added).toEqual([
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
      'logoHideDuringAds',
      'logoHideWithControls',
    ]);
    expect(rows.slice(at + 1, at + 1 + added.length).map((item) => item.name)).toEqual(added);
    expect(rows.slice(at + 1).map(({ presetField }) => presetField)).toEqual([
      'controls.seekButtons',
      'controls.captions',
      undefined,
      undefined,
      'logo.position',
      'logo.width',
      'logo.opacity',
      'logo.margin',
      'logo.href',
      'logo.alt',
      'logo.hideDuringAds',
      'logo.hideWithControls',
    ]);

    for (const name of added) {
      expect(row(name).status).toBe('preview');
      expect(row(name).description).toMatch(/기본 video에서는 쓰지 않아요|Video\.js 플레이어에서만 써요/);
    }

    for (const name of added.filter((key) => key.startsWith('logo') && key !== 'logo'))
      expect(row(name).description).toContain('logo를 골랐을 때만 쓰고');

    expect(row('logo').description).toContain('미리보기 전용 입력(preview.logo)이라 설치 코드에는 들어가지 않아요');
    expect(row('logoHref').description).toContain(
      '대체 텍스트(logoAlt나 프리셋 값)가 없으면 링크 없이 이미지만 보여요'
    );
    expect(row('logoAlt').description).toContain('로고 링크는 대체 텍스트가 있어야 쓰여요');
    expect(row('captionsUrl').description).toContain('data-captions');
    expect(row('seekButtons')).toMatchObject({ type: "'' | 5 | 10 | 15 | 30", defaultValue: '프리셋 값' });
  });

  it('maps preset fields only to rows a preset sets, and every preset CSS property has a row', () => {
    const rows = playerOptions.flatMap((group) => group.rows);
    const cssRows = rows.filter((row) => row.name.startsWith('--') && row.presetField).map((row) => row.name);

    expect(cssRows.sort()).toEqual([...PRESET_CSS_PROPERTIES].sort());

    for (const row of rows) expect(row.description).toMatch(/요\.$/);
  });

  it('lists data-captions right after data-thumbnails, as an install attribute with the same shape', () => {
    const rows = playerOptions.find((group) => group.id === 'loaderData')!.rows;
    const at = rows.findIndex((row) => row.name === 'data-thumbnails');
    const { name, type, defaultValue, presetField, description } = rows[at + 1]!;

    expect({ name, type, defaultValue, presetField }).toEqual({
      name: 'data-captions',
      type: rows[at]!.type,
      defaultValue: rows[at]!.defaultValue,
      presetField: undefined,
    });
    expect(description).toBe(
      '자막 파일이에요. 플레이어 화면 언어의 자막으로 붙이고 처음에는 꺼 둬요. 자막 버튼은 프리셋의 자막이 정하고, Video.js 플레이어에서만 써요.'
    );
  });

  it('lists every data-* attribute the loader reads except data-preset', () => {
    const loader = source('integrations/ads-manager/public/player/loader.js');
    const kebab = (name: string) => `data-${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
    const read = [
      ...[...loader.matchAll(/\b(?:pick|url|text)\('\w+', '(\w+)'[,)]/g)].map(([, name]) => kebab(name!)),
      ...[...(loader.match(/for \(const key of \[([^\]]*)\]\)/)?.[1] ?? '').matchAll(/'(\w+)'/g)].map(([, name]) =>
        kebab(name!)
      ),
      ...[...loader.matchAll(/\bdata\.(\w+)\b/g)].map(([, name]) => kebab(name!)),
      ...[...loader.matchAll(/\b(data-solad-[\w-]+)/g)].map(([, name]) => name!),
    ];

    expect(read).toContain('data-preset');
    // The site preset is chosen in the manager; data-preset stays out of the table (spec decision 28).
    expect(names('loaderData')).toEqual([...new Set(read)].filter((name) => name !== 'data-preset').sort());
  });

  it('points presetField only at preset schema paths, leaving out mediaAlt and object-position', () => {
    const { theme, playback, display, controls, logo, ads } = DEFAULT_PLAYER_PRESET;
    const paths = [
      ...Object.keys(DEFAULT_PLAYER_PRESET),
      ...Object.keys(theme).map((key) => `theme.${key}`),
      ...Object.keys(playback).map((key) => `playback.${key}`),
      ...Object.keys(display).map((key) => `display.${key}`),
      ...Object.keys(controls).map((key) => `controls.${key}`),
      ...Object.keys(logo).map((key) => `logo.${key}`),
      ...Object.keys(ads).map((key) => `ads.${key}`),
      ...Object.keys(ads.labels).map((key) => `ads.labels.${key}`),
      ...Object.keys(ads.timeouts).map((key) => `ads.timeouts.${key}`),
    ];
    const rows = playerOptions.flatMap((group) => group.rows);

    for (const row of rows) if (row.presetField) expect(paths).toContain(row.presetField);

    expect(rows.filter((row) => ['media-alt', '--media-object-position'].includes(row.name))).toEqual([
      expect.not.objectContaining({ presetField: expect.anything() }),
      expect.not.objectContaining({ presetField: expect.anything() }),
    ]);
  });
});

describe('loaderApiExample', () => {
  it('imports mount from the given loader and uses only options the loader reads', () => {
    const loader = source('integrations/ads-manager/public/player/loader.js');
    const example = loaderApiExample('/x/player/loader.js');
    const keys = [...example.matchAll(/^ {2}(\w+)(?::|\()/gm)].map(([, key]) => key!);

    expect(example).toContain('import { mount } from "/x/player/loader.js";');
    expect(keys).toEqual(['videoId', 'src', 'poster', 'title', 'overrides', 'onEvent', 'onError']);

    for (const key of keys) expect(loader).toMatch(new RegExp(`(options\\.${key}\\b|'${key}')`));

    expect(loaderApiExample()).toContain('"/ads/player/loader.js"');
  });
});
