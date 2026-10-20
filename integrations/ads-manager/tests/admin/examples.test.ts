import { readFileSync } from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

import { configureExampleLinks } from '../../public/examples/context.js';

describe('configureExampleLinks', () => {
  it.each(['videojs', 'player'])('preserves host video/source and engine through the real %s page links', (page) => {
    document.body.innerHTML = readFileSync(`integrations/ads-manager/public/examples/${page}.html`, 'utf8');
    const current = new URL(`https://host.test/customer/ads/examples/${page}.html`);

    current.search = new URLSearchParams({
      video: 'free:1:main',
      media: 'hls',
      engine: 'hlsjs',
      content: '/media/master.m3u8?token=a&part=2',
      retained: 'yes',
    }).toString();
    const result = configureExampleLinks(document, current.href);

    expect(result).toMatchObject({
      videoId: 'free:1:main',
      media: 'hls',
      engine: 'hlsjs',
      content: 'https://host.test/media/master.m3u8?token=a&part=2',
    });

    for (const link of document.querySelectorAll<HTMLAnchorElement>('[data-example-link]')) {
      const destination = new URL(link.href);

      expect(destination.pathname).toContain('/customer/ads/examples/');
      expect(destination.searchParams.get('video')).toBe('free:1:main');
      expect(destination.searchParams.get('content')).toBe('/media/master.m3u8?token=a&part=2');
      expect(destination.searchParams.get('retained')).toBe('yes');
      expect(destination.searchParams.get('media')).toBe(link.dataset.media || 'hls');
      expect(destination.searchParams.get('engine')).toBe(link.dataset.engine || 'hlsjs');
    }

    expect(document.querySelector('[data-media="mp4"]')?.hasAttribute('aria-current')).toBe(false);
    expect(document.querySelector('[data-media="hls"]')?.getAttribute('aria-current')).toBe('true');
  });

  it('resolves the default source within the host installation and rejects executable source URLs', () => {
    document.body.replaceChildren();
    expect(
      configureExampleLinks(document, 'https://host.test/nested/ads/examples/videojs.html?media=hls').content
    ).toBe('https://host.test/nested/ads/demo-media/content-master.m3u8');
    expect(() =>
      configureExampleLinks(document, 'https://host.test/examples/player.html?content=javascript:alert(1)')
    ).toThrow('HTTP(S)');
  });
});

describe('example page lifecycle', () => {
  it('reloads a restored BFCache page to acquire a fresh ad session, but not an ordinary pageshow', async () => {
    document.body.innerHTML = readFileSync('integrations/ads-manager/public/examples/player.html', 'utf8');
    const reload = vi.fn();
    const events = vi.spyOn(window, 'addEventListener');

    // Reject the source before loading external player bundles; this checks the actual page lifecycle binding only.
    vi.stubGlobal('location', {
      href: 'https://host.test/ads/examples/player.html?content=javascript:invalid',
      reload,
    });

    try {
      await import('../../public/examples/example.js');
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: false }));
      expect(reload).not.toHaveBeenCalled();
      window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
      expect(reload).not.toHaveBeenCalled();
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
      expect(reload).toHaveBeenCalledTimes(1);
    } finally {
      for (const [type, listener] of events.mock.calls) {
        if (type === 'pageshow' || type === 'pagehide') window.removeEventListener(type, listener);
      }
    }
  });
});
