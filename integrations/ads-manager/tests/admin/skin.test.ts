import { readFileSync } from 'node:fs';

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const assets = 'integrations/ads-manager/public/assets/videojs';
const bundle = readFileSync(`${assets}/video.js`, 'utf8');

/** The default video skin template inlined in the built bundle. */
function upstreamTemplate() {
  const markup = bundle.match(
    /`(<media-container class="media-skin media-container video-skin"[\s\S]*?<\/media-container>)`/
  );
  if (!markup) throw new Error('video.js no longer inlines the default video skin template.');

  const template = document.createElement('template');

  template.innerHTML = markup[1]!;
  return template.content;
}

/** `<media-captions-button>` with the label function the ad skin sets. */
interface CaptionsButton extends HTMLElement {
  label(state: { availability: string }): { key: string; text: string } | '';
}

const tooltipOf = (button: Element) => {
  const next = button.nextElementSibling;

  return next?.localName === 'media-tooltip' && next.getAttribute('trigger') === button.id ? next : null;
};

describe('video-skin upstream markup', () => {
  // solad-video-skin.js edits these nodes by selector; a renamed node would silently stop an edit.
  it('has every node the ad skin edits', () => {
    const root = upstreamTemplate();
    const play = root.querySelector('.video-controls-primary > media-play-button');
    const captions = root.querySelector('media-captions-button.video-controls-captions-button');
    const item = [...root.querySelectorAll('media-menu-item[commandfor]')].find((node) =>
      [...node.children].some((child) => child.matches('media-text[token="menu.captions"]'))
    );

    expect(play && tooltipOf(play)).not.toBeNull();
    expect(captions && tooltipOf(captions)).not.toBeNull();
    expect(item).toBeDefined();
    expect(root.getElementById(item!.getAttribute('commandfor')!)?.localName).toBe('media-menu-content');
    expect(root.querySelectorAll('media-hotkey[keys="c"][action="toggleSubtitles"]')).toHaveLength(1);
    expect(root.querySelector('media-gesture[type="doubletap"][action="seekStep"][region="left"]')).not.toBeNull();
    expect(root.querySelector('media-gesture[type="doubletap"][action="seekStep"][region="right"]')).not.toBeNull();

    for (const selector of ['media-cast-button', 'media-airplay-button']) {
      const button = root.querySelector(selector);

      expect(button && tooltipOf(button), selector).not.toBeNull();
    }
  });

  it('keeps the CSS rules the ad skin overrides', () => {
    expect(bundle).toContain('@layer base{');
    expect(bundle).toContain(':where(.media-skin) [hidden][hidden]{display:none!important}');
    expect(bundle).toContain(
      '@container media-root (width<32rem){:where(.media-skin[data-theme=default][data-preset=video]) .video-controls-captions-button{display:none}}'
    );
    expect(readFileSync(`${assets}/i18n.js`, 'utf8')).toMatch(/E as loadLocale/);
  });
});

describe('SoladVideoSkinElement', () => {
  let i18n: typeof import('../../public/assets/videojs/i18n.js');

  beforeAll(async () => {
    await import('../../public/assets/videojs/video.js');
    await import('../../public/assets/videojs/ui/seek-button.js');
    await import('../../public/player/solad-video-skin.js');
    i18n = await import('../../public/assets/videojs/i18n.js');
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  function skin(attributes: Record<string, string> = {}) {
    const element = document.createElement('solad-video-skin');

    for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);

    document.body.append(element);
    return element.shadowRoot!;
  }

  it('drops cast and AirPlay and adds no seek buttons without seek-buttons', () => {
    const root = skin();

    expect(root.querySelector('media-cast-button, media-airplay-button')).toBeNull();
    expect(root.querySelector('media-seek-button')).toBeNull();
    expect(root.querySelectorAll('media-tooltip').length).toBe(
      upstreamTemplate().querySelectorAll('media-tooltip').length - 2
    );
    expect(root.querySelector('media-gesture[region="left"][action="seekStep"]')!.hasAttribute('value')).toBe(false);
  });

  it.each(['10', '30'])('puts a -%s/+N pair right after the play button and matches double taps', (seconds) => {
    const root = skin({ 'seek-buttons': seconds });
    const play = root.querySelector('.video-controls-primary > media-play-button')!;
    const backward = tooltipOf(play)!.nextElementSibling!;
    const forward = tooltipOf(backward)!.nextElementSibling!;

    expect(backward.localName).toBe('media-seek-button');
    expect(backward.getAttribute('seconds')).toBe(`-${seconds}`);
    expect(forward.getAttribute('seconds')).toBe(seconds);
    expect(tooltipOf(forward)!.nextElementSibling!.localName).toBe('media-mute-button');
    expect(backward.querySelector('svg')!.classList).toContain('media-seek-button-backward-icon');

    for (const button of [backward, forward]) {
      const label = button.querySelector('.media-seek-button-label')!;

      expect(label.textContent).toBe(seconds);
      expect(label.getAttribute('aria-hidden')).toBe('true');
    }

    expect(root.querySelector('media-gesture[region="left"][action="seekStep"]')!.getAttribute('value')).toBe(
      `-${seconds}`
    );
    expect(root.querySelector('media-gesture[region="right"][action="seekStep"]')!.getAttribute('value')).toBe(seconds);
    // Arrow keys keep the upstream step.
    expect(root.querySelector('media-hotkey[keys="ArrowLeft"]')!.hasAttribute('value')).toBe(false);
  });

  it('ignores a seek-buttons value outside 5, 10, 15 and 30', () => {
    expect(skin({ 'seek-buttons': '20' }).querySelector('media-seek-button')).toBeNull();
    expect(skin({ 'seek-buttons': '20', 'seek-placement': 'center' }).querySelector('.solad-center')).toBeNull();
  });

  it.each([
    ['center', 0],
    ['both', 2],
  ])('puts a play button between -N/+N in the middle of the video for seek-placement %s', (placement, inBar) => {
    const root = skin({ 'seek-buttons': '10', 'seek-placement': placement });
    const group = root.querySelector('.solad-center')!;
    const [backward, play, forward] = [...group.children];

    expect(root.querySelectorAll('.video-controls-primary > media-seek-button')).toHaveLength(inBar);
    // After the controls, so the bar's play button stays first in the Tab order and for the lecture focus.
    expect(group.parentElement!.lastElementChild).toBe(group);
    expect(root.querySelector('media-play-button')!.closest('.solad-center')).toBeNull();
    expect(group.children).toHaveLength(3);
    expect(backward!.getAttribute('seconds')).toBe('-10');
    expect(forward!.getAttribute('seconds')).toBe('10');
    expect(play!.localName).toBe('media-play-button');
    expect(play!.id).toBe('solad-center-play');
    expect(play!.querySelector('.media-play-button-play-icon')).not.toBeNull();
    expect(group.querySelector('.solad-center-seek-label')!.textContent).toBe('10');
    expect(group.querySelector('media-tooltip')).toBeNull();
    expect(root.querySelector('media-gesture[region="left"][action="seekStep"]')!.getAttribute('value')).toBe('-10');
  });

  it('keeps the bar for a missing or unknown seek-placement', () => {
    for (const attributes of [{}, { 'seek-placement': 'top' }, { 'seek-placement': 'Center' }]) {
      const root = skin({ 'seek-buttons': '5', ...attributes });

      expect(root.querySelectorAll('.video-controls-primary > media-seek-button')).toHaveLength(2);
      expect(root.querySelector('.solad-center')).toBeNull();
    }
  });

  it('removes the captions button, settings item and c hotkey for captions="off"', () => {
    const root = skin({ captions: 'off' });

    expect(root.querySelector('media-captions-button')).toBeNull();
    expect(root.querySelector('media-text[token="menu.captions"]')).toBeNull();
    expect(root.querySelector('media-captions-radio-group')).toBeNull();
    expect(root.querySelector('media-hotkey[action="toggleSubtitles"]')).toBeNull();
    // The other settings items stay.
    expect(root.querySelectorAll('.media-menu-trigger-item').length).toBe(3);
  });

  it('names the captions button "No captions" only while no track exists', () => {
    const button = skin().querySelector<CaptionsButton>('media-captions-button')!;

    expect(button.label({ availability: 'unavailable' })).toEqual({
      key: 'solad.captionsUnavailable',
      text: 'No captions',
    });
    expect(button.label({ availability: 'available' })).toBe('');
  });

  it.each([
    ['ko', '자막 없음'],
    ['en', 'No captions'],
  ])('shows a focusable disabled "No captions" button in a %s player without tracks', async (lang, name) => {
    const i18n = document.createElement('media-i18n');

    i18n.setAttribute('lang', lang);
    i18n.innerHTML = '<video-player><solad-video-skin><video></video></solad-video-skin></video-player>';
    document.body.append(i18n);

    const button = i18n.querySelector('solad-video-skin')!.shadowRoot!.querySelector('media-captions-button')!;

    await vi.waitFor(() => expect(button.getAttribute('aria-label')).toBe(name));
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.getAttribute('tabindex')).toBe('0');
    expect(button.getAttribute('data-availability')).toBe('unavailable');
  });

  it('registers the Solad text beside the built-in packs', () => {
    const text = (locale: string) => i18n.getI18nTranslations(locale);

    expect(text('ko')).toMatchObject({ 'solad.captionsUnavailable': '자막 없음', 'captions.enable': '자막 켜기' });
    expect(text('ja')).toMatchObject({ 'solad.captionsUnavailable': '字幕なし' });
    expect(text('zh-CN')).toMatchObject({ 'solad.captionsUnavailable': '无字幕' });
    expect(text('en')).toMatchObject({ 'solad.captionsUnavailable': 'No captions' });
    expect(text('ko')).toMatchObject({ 'solad.opensInNewTab': ' (새 탭에서 열림)' });
    expect(text('ja')).toMatchObject({ 'solad.opensInNewTab': '（新しいタブで開きます）' });
    expect(text('zh-CN')).toMatchObject({ 'solad.opensInNewTab': '（在新标签页中打开）' });
    expect(text('en')).toMatchObject({ 'solad.opensInNewTab': ' (opens in a new tab)' });
    expect(Object.keys(text('ko')).length).toBeGreaterThan(50);
  });

  describe('logo', () => {
    const logo = {
      src: 'https://host.test/examples/sample-logo.svg',
      position: 'bottom-left',
      margin: 16,
      width: 120,
      opacity: 60,
      href: null,
      alt: null,
      hideDuringAds: true,
      hideWithControls: false,
    };

    type Skin = HTMLElement & { logo: unknown };
    const container = (root: ShadowRoot) => root.querySelector<HTMLElement>('media-container')!;
    const place = (root: ShadowRoot) =>
      [...container(root).children].find((node) => node.matches('.solad-logo')) as HTMLElement | undefined;
    const styles = (root: ShadowRoot) =>
      [
        ...[...(root.adoptedStyleSheets ?? [])].flatMap((sheet) => [...sheet.cssRules].map((rule) => rule.cssText)),
        ...[...root.querySelectorAll('style')].map((style) => style.textContent),
      ].join('\n');

    function withLogo(value: object) {
      const element = document.createElement('solad-video-skin') as Skin;

      document.body.append(element);
      element.logo = value;
      return element.shadowRoot!;
    }

    it('draws no place without a logo', () => {
      expect(place(skin())).toBeUndefined();
    });

    it('puts a decorative image before the controls with its corner, width, margin and opacity', () => {
      const root = withLogo(logo);
      const slot = place(root)!;
      const image = slot.querySelector('img')!;

      expect(slot.nextElementSibling!.localName).toBe('media-controls');
      expect(slot.dataset.position).toBe('bottom-left');
      expect(slot.hasAttribute('data-hide-during-ads')).toBe(true);
      expect(slot.hasAttribute('data-hide-with-controls')).toBe(false);
      expect(container(root).style.getPropertyValue('--solad-logo-width')).toBe('120px');
      expect(container(root).style.getPropertyValue('--solad-logo-margin')).toBe('16px');
      expect(container(root).style.getPropertyValue('--solad-logo-opacity')).toBe('0.6');
      expect(image.getAttribute('src')).toBe(logo.src);
      expect(image.getAttribute('alt')).toBe('');
      expect(slot.querySelector('a')).toBeNull();
    });

    it('wraps the image in a new-tab link named by its alt and the player-language tail', async () => {
      const i18n = document.createElement('media-i18n');

      i18n.setAttribute('lang', 'ko');
      i18n.innerHTML = '<video-player><solad-video-skin><video></video></solad-video-skin></video-player>';
      document.body.append(i18n);

      const element = i18n.querySelector('solad-video-skin') as Skin;

      element.logo = { ...logo, href: 'https://example.com/store', alt: '데모 스토어', hideWithControls: true };

      const slot = place(element.shadowRoot!)!;
      const link = slot.querySelector('a')!;

      expect(link.getAttribute('href')).toBe('https://example.com/store');
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
      expect(link.querySelector('img')!.getAttribute('alt')).toBe('데모 스토어');
      expect(link.querySelector('media-text')!.getAttribute('token')).toBe('solad.opensInNewTab');
      await vi.waitFor(() => expect(link.textContent).toBe(' (새 탭에서 열림)'));
      expect(slot.hasAttribute('data-hide-with-controls')).toBe(true);
      // The link comes before every control in the Tab order.
      expect(slot.compareDocumentPosition(element.shadowRoot!.querySelector('media-play-button')!)).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING
      );
    });

    it('keeps an image without alt text decorative even with a link', () => {
      const slot = place(withLogo({ ...logo, href: 'https://example.com' }))!;

      expect(slot.querySelector('a')).toBeNull();
      expect(slot.querySelector('img')!.getAttribute('alt')).toBe('');
    });

    it('changes in place, keeps the image for the same src and removes the place for null', () => {
      const element = document.createElement('solad-video-skin') as Skin;

      document.body.append(element);
      element.logo = logo;

      const root = element.shadowRoot!;
      const image = place(root)!.querySelector('img');

      element.logo = { ...logo, position: 'top-right', hideDuringAds: false };

      expect(place(root)!.dataset.position).toBe('top-right');
      expect(place(root)!.hasAttribute('data-hide-during-ads')).toBe(false);
      expect(place(root)!.querySelector('img')).toBe(image);

      element.logo = null;

      expect(place(root)).toBeUndefined();
    });

    it('hides the place when its image fails to load', () => {
      const slot = place(withLogo(logo))!;

      slot.querySelector('img')!.dispatchEvent(new Event('error'));

      expect(slot.hidden).toBe(true);
    });

    it('hides during an ad screen and with hidden controls, at the controls timing', () => {
      const css = styles(withLogo(logo)).replace(/\s+/g, ' ');

      expect(css).toContain(':has(> [data-ads-overlay]) > .solad-logo[data-hide-during-ads]');
      expect(css).toContain(':not([data-controls-visible]) > .solad-logo[data-hide-with-controls]');
      expect(css).toContain('--solad-logo-duration: calc(var(--media-duration-controls) / 2)');
      expect(css).toMatch(
        /prefers-reduced-motion: reduce\) \{ :where\(\.media-skin\) \.solad-logo \{ transition-duration: 0s/
      );
    });

    // A2E-02: a wide logo in a narrow player squeezed the title into one or two letters a line.
    it('draws no wider than a quarter of the player and moves the title by that drawn width', () => {
      const root = withLogo({ ...logo, width: 240 });
      const css = styles(root).replace(/\s+/g, ' ');

      expect(container(root).style.getPropertyValue('--solad-logo-width')).toBe('240px');
      expect(css).toContain('--solad-logo-size: min(var(--solad-logo-width), 25cqi)');
      expect(css).toMatch(/\.solad-logo \{ [^}]*width: var\(--solad-logo-size\)/);
      expect(css).toContain(
        'padding-inline-start: calc(var(--solad-logo-margin) + var(--solad-logo-size) + var(--media-spacing) * 2)'
      );
      expect(css).not.toMatch(/(?<!-)width: var\(--solad-logo-width\)/);
    });
  });

  it('reads its attributes once, on the first connect', () => {
    const element = document.createElement('solad-video-skin');

    element.setAttribute('seek-buttons', '5');
    document.body.append(element);
    element.remove();
    element.setAttribute('seek-buttons', '30');
    document.body.append(element);

    expect(
      [...element.shadowRoot!.querySelectorAll('media-seek-button')].map((node) => node.getAttribute('seconds'))
    ).toEqual(['-5', '5']);
  });
});
