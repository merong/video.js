// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import type { ObservedAdEvent } from '../../core/events';
import { loadPlaybackFixture } from '../../core/tests/fixture';
import { createAdsController, type AdsController } from '../controller';
import { button, contentMedia, mediaState, overlayRoot } from './media';

let container: HTMLElement;
let content: HTMLVideoElement;
let controller: AdsController;
let events: ObservedAdEvent[];

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  container = document.createElement('div');
  document.body.append(container);
  content = contentMedia(container);
  events = [];
});

afterEach(() => {
  controller?.destroy();
  container.remove();

  for (const key of ['fullscreenEnabled', 'fullscreenElement', 'exitFullscreen']) Reflect.deleteProperty(document, key);

  vi.restoreAllMocks();
  vi.useRealTimers();
});

function bind(video = false): void {
  const fixture = loadPlaybackFixture();
  const schedule = video
    ? { ...fixture, breaks: [{ ...fixture.breaks[0]!, ads: [fixture.breaks[0]!.ads[1]!] }] }
    : fixture;

  controller = createAdsController({ media: content, container, schedule, onEvent: (event) => events.push(event) });
}

function key(target: Element, value: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: value, bubbles: true, composed: true, cancelable: true });

  target.dispatchEvent(event);
  return event;
}

describe('createAdsController', () => {
  it('updates locale and text templates without replacing media, advancing time or issuing another start', async () => {
    container.lang = 'ko-KR';
    bind();
    await content.play();
    const root = overlayRoot(container);
    const image = root.querySelector('img')!;

    image.dispatchEvent(new Event('load'));
    vi.advanceTimersByTime(1000);
    expect(root.querySelector('[role=status]')!.textContent).toBe('광고 1/2');
    controller.updateUI({
      locale: 'en',
      labels: { skip: '<b>Continue</b>', timer: 'Remaining {remaining}', mediaAlt: 'Sponsor art' },
    });
    expect(root.querySelector('img')).toBe(image);
    expect(image.alt).toBe('Sponsor art');
    expect(root.querySelector('[part=timer]')!.textContent).toBe('Remaining 0:04');
    vi.advanceTimersByTime(1000);
    const skip = button(root, '<b>Continue</b>');

    expect(skip.querySelector('b')).toBeNull();
    expect(skip.disabled).toBe(false);
    expect(events.map((event) => event.type)).toEqual(['start']);
    controller.updateUI({});
    expect(root.querySelector('[role=status]')!.textContent).toBe('광고 1/2');
    expect(image.alt).toBe('이미지 광고');
    skip.click();
    expect(events.map((event) => event.type)).toEqual(['start', 'skip']);
    expect(events[1]?.adElapsedSeconds).toBe(2);
    expect(events[1]?.playbackSessionId).toBe(events[0]?.playbackSessionId);
  });

  it('shows unknown video duration, blocked/loading/playing/paused states, and a quiet live region', async () => {
    vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(new DOMException('Blocked', 'NotAllowedError'));
    bind(true);
    await content.play();
    const root = overlayRoot(container);
    const video = root.querySelector('video')!;
    const status = root.querySelector('[role=status]')!;

    expect(root.querySelector('[part=timer]')!.textContent).toBe('0:00 / –:––');
    await Promise.resolve();
    expect(status.textContent).toContain('Press Play to continue');
    mediaState(video, { duration: 10 });
    video.dispatchEvent(new Event('loadedmetadata'));
    button(root, 'Play / pause ad').click();
    expect(status.textContent).toContain('Loading');
    video.dispatchEvent(new Event('playing'));
    expect(status.textContent).toBe('Advertisement 1 of 1');
    const mutations = vi.fn();
    const observer = new MutationObserver(mutations);

    observer.observe(status, { childList: true, characterData: true, subtree: true });
    mediaState(video, { currentTime: 2.5 });
    await vi.advanceTimersByTimeAsync(1000);
    expect(root.querySelector('[part=timer]')!.textContent).toBe('0:02 / 0:10');
    expect(mutations).not.toHaveBeenCalled();
    button(root, 'Play / pause ad').click();
    expect(status.textContent).toContain('paused');
    expect(button(root, 'Play / pause ad').getAttribute('aria-pressed')).toBe('false');
    observer.disconnect();
  });

  it.each(['skip', 'cta'] as const)(
    'moves focus from %s when the next ad hides it, then restores the original control',
    async (focusedPart) => {
      const trigger = document.createElement('button');

      container.append(trigger);
      trigger.focus();
      bind();
      await content.play();
      const root = overlayRoot(container);

      root.querySelector('img')!.dispatchEvent(new Event('load'));
      vi.advanceTimersByTime(2000);
      root.querySelector<HTMLElement>(`[part=${focusedPart}]`)!.focus();
      expect(root.activeElement?.getAttribute('part')).toBe(focusedPart);

      if (focusedPart === 'skip') button(root, 'Skip ad').click();
      else vi.advanceTimersByTime(3000);

      expect(root.activeElement).toBe(button(root, 'Play / pause ad'));
      expect(root.querySelector<HTMLButtonElement>('[part=skip]')!.hidden).toBe(true);
      expect(root.querySelector<HTMLAnchorElement>('a')!.hidden).toBe(true);
      controller.destroy();
      expect(document.activeElement).toBe(trigger);
    }
  );

  it('scopes shortcuts to ads, preserves native range/button keys and blocks content seek keys', async () => {
    bind();
    await content.play();
    const root = overlayRoot(container);
    const image = root.querySelector('img')!;

    image.dispatchEvent(new Event('load'));
    const play = button(root, 'Play / pause ad');
    const parentKey = vi.fn();

    container.addEventListener('keydown', parentKey);
    expect(key(play, 'k').defaultPrevented).toBe(true);
    vi.advanceTimersByTime(2000);
    expect(events).toHaveLength(1);
    expect(play.getAttribute('aria-pressed')).toBe('false');
    key(play, 'm');
    expect(content.muted).toBe(true);
    key(play, 'ArrowDown');
    expect(content.volume).toBeCloseTo(0.95);
    expect(key(play, 'ArrowRight').defaultPrevented).toBe(true);
    expect(content.currentTime).toBe(0);
    const range = root.querySelector('input')!;

    for (const nativeKey of ['ArrowLeft', 'ArrowRight', 'Home', 'End'])
      expect(key(range, nativeKey).defaultPrevented).toBe(false);

    expect(key(play, ' ').defaultPrevented).toBe(false);
    expect(parentKey).not.toHaveBeenCalled();
    key(play, 'k');
    expect(play.getAttribute('aria-pressed')).toBe('true');
  });

  it('uses only container fullscreen, observes exit, and fails without changing playback', async () => {
    Object.defineProperties(document, {
      fullscreenEnabled: { configurable: true, value: true },
      fullscreenElement: { configurable: true, writable: true, value: null },
    });
    const enter = vi.fn(async () => {
      Object.defineProperty(document, 'fullscreenElement', { configurable: true, writable: true, value: container });
      document.dispatchEvent(new Event('fullscreenchange'));
    });
    const exit = vi.fn(async () => {
      Object.defineProperty(document, 'fullscreenElement', { configurable: true, writable: true, value: null });
      document.dispatchEvent(new Event('fullscreenchange'));
    });

    Object.defineProperty(container, 'requestFullscreen', { configurable: true, value: enter });
    Object.defineProperty(document, 'exitFullscreen', { configurable: true, value: exit });
    bind();
    await content.play();
    const root = overlayRoot(container);
    const image = root.querySelector('img')!;

    image.dispatchEvent(new Event('load'));
    button(root, 'Enter fullscreen').click();
    await Promise.resolve();
    expect(enter).toHaveBeenCalledOnce();
    button(root, 'Exit fullscreen').click();
    await Promise.resolve();
    expect(exit).toHaveBeenCalledOnce();
    enter.mockRejectedValueOnce(new Error('Denied'));
    key(button(root, 'Enter fullscreen'), 'f');
    await Promise.resolve();
    expect(root.querySelector('[role=status]')!.textContent).toContain('Fullscreen unavailable');
    expect(root.querySelector('img')).toBe(image);
    expect(events.map((event) => event.type)).toEqual(['start']);
    controller.destroy();
    document.dispatchEvent(new Event('fullscreenchange'));
    expect(container.querySelector('[data-ads-overlay]')).toBeNull();
  });

  it('hides fullscreen without container support and never calls media-only fullscreen', async () => {
    const enter = vi.fn();

    Object.defineProperty(content, 'requestFullscreen', { configurable: true, value: enter });
    bind();
    await content.play();
    const root = overlayRoot(container);

    expect(root.querySelector<HTMLButtonElement>('[part=fullscreen]')!.hidden).toBe(true);
    key(button(root, 'Play / pause ad'), 'f');
    expect(enter).not.toHaveBeenCalled();
  });

  it.each(['play', 'volume'] as const)(
    'exits container fullscreen with Escape from %s without entering or resuming a paused ad',
    async (focusedPart) => {
      Object.defineProperties(document, {
        fullscreenEnabled: { configurable: true, value: true },
        fullscreenElement: { configurable: true, writable: true, value: null },
      });
      const enter = vi.fn();
      const exit = vi.fn(async () => {
        Object.defineProperty(document, 'fullscreenElement', { configurable: true, writable: true, value: null });
        document.dispatchEvent(new Event('fullscreenchange'));
      });

      Object.defineProperty(container, 'requestFullscreen', { configurable: true, value: enter });
      Object.defineProperty(document, 'exitFullscreen', { configurable: true, value: exit });
      bind();
      await content.play();
      const root = overlayRoot(container);
      const image = root.querySelector('img')!;

      image.dispatchEvent(new Event('load'));
      vi.advanceTimersByTime(1000);
      key(button(root, 'Play / pause ad'), 'k');
      const control = root.querySelector<HTMLElement>(`[part=${focusedPart}]`)!;

      control.focus();
      key(control, 'Escape');
      expect(enter).not.toHaveBeenCalled();
      expect(exit).not.toHaveBeenCalled();
      Object.defineProperty(document, 'fullscreenElement', { configurable: true, writable: true, value: container });
      document.dispatchEvent(new Event('fullscreenchange'));
      expect(key(control, 'Escape').defaultPrevented).toBe(true);
      await Promise.resolve();
      expect(exit).toHaveBeenCalledOnce();
      expect(document.fullscreenElement).toBeNull();
      key(control, 'Escape');
      Object.defineProperty(document, 'fullscreenElement', { configurable: true, writable: true, value: content });
      key(control, 'Escape');
      vi.advanceTimersByTime(3000);
      expect(enter).not.toHaveBeenCalled();
      expect(exit).toHaveBeenCalledOnce();
      expect(root.activeElement).toBe(control);
      expect(button(root, 'Play / pause ad').getAttribute('aria-pressed')).toBe('false');
      expect(root.querySelector('[part=timer]')!.textContent).toBe('0:01 / 0:05');
      expect(root.querySelector('img')).toBe(image);
      expect(events.map((event) => event.type)).toEqual(['start']);
    }
  );
});
