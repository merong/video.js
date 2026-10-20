// @vitest-environment jsdom
import { playbackFeature, PlayerExtensionCoordinator } from '@videojs/core/dom';
import { ReactiveElement } from '@videojs/element';
import { ContextProvider } from '@videojs/element/context';
import { containerContext, createPlayer, extensionContext, PlayButtonElement } from '@videojs/html';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import type { ObservedAdEvent } from '../../core/events';
import { loadPlaybackFixture } from '../../core/tests/fixture';
import { button, contentMedia, mediaState, overlayRoot } from '../../dom/tests/media';
import { MediaAdsElement } from '../define';

class PlayerHost extends ReactiveElement {
  readonly coordinator = new PlayerExtensionCoordinator(() => {});
  readonly containerProvider = new ContextProvider(this, {
    context: containerContext,
    initialValue: { container: this, registerContainer: () => () => {} },
  });
  constructor() {
    super();
    new ContextProvider(this, {
      context: extensionContext,
      initialValue: { registerExtension: this.coordinator.register.bind(this.coordinator) },
    });
  }
}
customElements.define('ads-test-player', PlayerHost);
const { PlayerElement: PlaybackPlayer } = createPlayer({ features: [playbackFeature] });

customElements.define('ads-playback-test-player', PlaybackPlayer);
customElements.define('ads-content-play-button', class extends PlayButtonElement {});

let container: HTMLElement;
let content: HTMLVideoElement;
let element: MediaAdsElement;
let observed: ObservedAdEvent[];

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  container = document.createElement('div');
  document.body.append(container);
  content = contentMedia(container);
  content.id = 'content';
  observed = [];
  element = document.createElement('media-ads');
  element.setAttribute('for', 'content');
  element.setAttribute('src', '/schedule.json');
  element.setAttribute('video-id', 'video-1');
  element.addEventListener('ads-event', (event) => {
    if (event instanceof CustomEvent) observed.push(event.detail);
  });
});

afterEach(() => {
  element.remove();
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function oneImage() {
  const fixture = loadPlaybackFixture();

  return { ...fixture, breaks: [{ ...fixture.breaks[0]!, ads: [fixture.breaks[0]!.ads[0]!] }] };
}

async function attach(): Promise<void> {
  container.append(element);
  await element.updateComplete;
  await vi.advanceTimersByTimeAsync(0);
}

function mountPlaybackPlayer() {
  container.remove();
  const player = new PlaybackPlayer();

  container = player;
  content = contentMedia(player);
  content.id = 'content';
  mediaState(content, { readyState: 4 });
  const media = content;

  vi.mocked(media.play).mockImplementation(async () => {
    if (!media.paused) return;

    mediaState(media, { paused: false });
    queueMicrotask(() => media.dispatchEvent(new Event('play')));
  });
  // Native pause updates the property immediately, then delivers its event after ad interception.
  vi.mocked(media.pause).mockImplementation(() => {
    if (media.paused) return;

    mediaState(media, { paused: true });
    queueMicrotask(() => media.dispatchEvent(new Event('pause')));
  });
  document.body.append(player);
  const control = document.createElement('ads-content-play-button');

  player.append(control);
  return { player, control };
}

describe('MediaAdsElement', () => {
  it.each(['complete', 'skip', 'paused-skip', 'paused-error'] as const)(
    'restores actual content playback state after %s without another ended event or forced play',
    async (ending) => {
      const { player, control } = mountPlaybackPlayer();
      const fixture = oneImage();
      const isPost = ending === 'complete' || ending === 'skip';
      const schedule = {
        ...fixture,
        breaks: [{ ...fixture.breaks[0]!, position: isPost ? 'post' : 'pre' }],
      };

      vi.stubGlobal(
        'fetch',
        vi.fn(async () => Response.json(schedule))
      );
      await attach();
      await content.play();
      const ended = vi.fn();

      content.addEventListener('ended', ended);

      if (isPost) {
        content.pause();
        mediaState(content, { currentTime: 100, ended: true });
        content.dispatchEvent(new Event('ended'));
      }

      const root = overlayRoot(container);
      const image = root.querySelector('img')!;

      image.dispatchEvent(new Event('load'));
      await vi.advanceTimersByTimeAsync(2000);
      expect(player.store.state.paused).toBe(false);
      expect(control.getAttribute('aria-label')).toBe('Pause');
      const plays = vi.mocked(content.play).mock.calls.length;

      if (ending.startsWith('paused')) button(root, 'Play / pause ad').click();

      if (ending === 'complete') await vi.advanceTimersByTimeAsync(3000);
      else if (ending === 'paused-error') image.dispatchEvent(new Event('error'));
      else button(root, 'Skip ad').click();

      await vi.advanceTimersByTimeAsync(0);
      expect(container.querySelector('[data-ads-overlay]')).toBeNull();
      expect(player.store.state.paused).toBe(true);
      expect(player.store.state.ended).toBe(isPost);
      expect(control.getAttribute('aria-label')).toBe(isPost ? 'Replay' : 'Play');
      expect(content.play).toHaveBeenCalledTimes(plays);
      expect(ended).toHaveBeenCalledTimes(isPost ? 1 : 0);
    }
  );

  it.each(['src', 'video-id', 'content-source', 'target', 'config', 'disconnect'] as const)(
    'refreshes playback only for retained content when %s changes during an ad',
    async (change) => {
      const { player, control } = mountPlaybackPlayer();
      let resolveReplacement!: (response: Response) => void;
      const fetch = vi
        .fn(() => new Promise<Response>((resolve) => (resolveReplacement = resolve)))
        .mockResolvedValueOnce(Response.json(oneImage()));

      vi.stubGlobal('fetch', fetch);
      await attach();
      await content.play();
      overlayRoot(container).querySelector('img')!.dispatchEvent(new Event('load'));
      await vi.advanceTimersByTimeAsync(1000);
      expect(control.getAttribute('aria-label')).toBe('Pause');
      const refresh = vi.fn();
      const ended = vi.fn();
      const plays = vi.mocked(content.play).mock.calls.length;

      content.addEventListener('timeupdate', refresh);
      content.addEventListener('ended', ended);

      element.addEventListener('ads-event', (event) => {
        if (!(event instanceof CustomEvent) || event.detail.type !== 'cancel') return;

        if (change === 'content-source') content.src = '/replacement.mp4';
        else if (change === 'target') {
          const replacement = contentMedia(player);

          replacement.id = 'content';
          content.replaceWith(replacement);
        } else if (change === 'config') element.setAttribute('video-id', 'video-2');
        else if (change === 'disconnect') element.remove();
      });

      if (change === 'video-id') element.setAttribute('video-id', 'video-2');
      else element.setAttribute('src', '/replacement-schedule.json');

      await element.updateComplete;
      await vi.advanceTimersByTimeAsync(0);
      expect(container.querySelector('[data-ads-overlay]')).toBeNull();
      expect(content.paused).toBe(true);
      expect(content.play).toHaveBeenCalledTimes(plays);
      expect(ended).not.toHaveBeenCalled();
      expect(observed.map((event) => event.type)).toEqual(['start', 'cancel']);

      if (change === 'src' || change === 'video-id' || change === 'config') {
        expect(refresh).toHaveBeenCalledOnce();
        expect(player.store.state.paused).toBe(true);
        expect(control.getAttribute('aria-label')).toBe('Play');
      } else expect(refresh).not.toHaveBeenCalled();

      if (change === 'disconnect') {
        expect(fetch).toHaveBeenCalledOnce();
        const pauses = vi.mocked(content.pause).mock.calls.length;

        await content.play();
        await vi.advanceTimersByTimeAsync(0);
        expect(content.paused).toBe(false);
        expect(content.pause).toHaveBeenCalledTimes(pauses);
      } else {
        // A presentation update must not discover stale binding identity and issue a third request.
        element.setAttribute('skip-label', 'Continue');
        await element.updateComplete;
        await vi.advanceTimersByTimeAsync(0);
        expect(fetch).toHaveBeenCalledTimes(2);
        resolveReplacement(Response.json({ ...oneImage(), videoId: element.videoId }));
        await vi.advanceTimersByTimeAsync(0);

        if (change === 'target') {
          const pauses = vi.mocked(content.pause).mock.calls.length;

          await content.play();
          await vi.advanceTimersByTimeAsync(0);
          expect(content.paused).toBe(false);
          expect(content.pause).toHaveBeenCalledTimes(pauses);
          const target = player.store.target?.media;

          expect(target instanceof HTMLVideoElement && target.paused).toBe(true);
          expect(container.querySelector('[data-ads-overlay]')).toBeNull();
        }
      }
    }
  );

  it('inherits wrapper language and applies live legacy labels without refetching or replacing the active ad', async () => {
    const fetch = vi.fn(async () => Response.json(oneImage()));

    vi.stubGlobal('fetch', fetch);
    container.lang = 'ko';
    await attach();
    await content.play();
    const root = overlayRoot(container);
    const image = root.querySelector('img')!;

    image.dispatchEvent(new Event('load'));
    vi.advanceTimersByTime(1000);
    expect(root.querySelector('[role=status]')!.textContent).toBe('광고 1/1');
    element.setAttribute('skip-label', '계속 보기');
    element.setAttribute('skip-countdown-label', '{seconds}초 기다리기');
    element.setAttribute('timer-label', '남음 {remaining} / 전체 {duration}');
    element.setAttribute('media-alt', '맞춤 광고 설명');
    await element.updateComplete;
    expect(root.querySelector('img')).toBe(image);
    expect(image.alt).toBe('맞춤 광고 설명');
    expect(root.querySelector('[part=skip]')!.textContent).toBe('1초 기다리기');
    expect(root.querySelector('[part=timer]')!.textContent).toBe('남음 0:04 / 전체 0:05');
    expect(root.querySelector('a')!.textContent).toBe('광고주 사이트');
    container.lang = 'en';
    await vi.advanceTimersByTimeAsync(0);
    expect(root.querySelector('[role=status]')!.textContent).toBe('Advertisement 1 of 1');
    element.lang = 'ko';
    await vi.advanceTimersByTimeAsync(0);
    expect(root.querySelector('[role=status]')!.textContent).toBe('광고 1/1');
    vi.advanceTimersByTime(1000);
    expect(root.querySelector('[part=skip]')!.textContent).toBe('계속 보기');
    expect(fetch).toHaveBeenCalledOnce();
    expect(observed.map((event) => event.type)).toEqual(['start']);
    vi.advanceTimersByTime(3000);
    expect(observed.map((event) => event.type)).toEqual(['start', 'complete']);
    expect(observed[1]?.playbackSessionId).toBe(observed[0]?.playbackSessionId);
  });

  it('binds slotted light-DOM media to an internal shadow container and restores composed focus', async () => {
    container.remove();
    const player = new PlayerHost();

    container = player;
    document.body.append(player);
    const skin = document.createElement('div');

    player.append(skin);
    const shadow = skin.attachShadow({ mode: 'open' });
    const internalContainer = document.createElement('div');
    const slot = document.createElement('slot');
    const trigger = document.createElement('button');

    internalContainer.append(slot, trigger);
    shadow.append(internalContainer);
    content = contentMedia(skin);
    content.id = 'content';
    expect(internalContainer.contains(content)).toBe(false);
    player.coordinator.attach({ media: content, container: internalContainer });
    // The player's actual container context points into its skin, as in shipped video-skin.
    player.containerProvider.setValue({ container: internalContainer, registerContainer: () => () => {} });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(oneImage()))
    );
    trigger.focus();
    await attach();
    await content.play();
    const root = overlayRoot(internalContainer);

    root.querySelector('img')!.dispatchEvent(new Event('load'));
    expect(observed[0]?.type).toBe('start');
    expect(trigger.inert).toBe(true);
    expect(root.activeElement?.tagName).toBe('BUTTON');
    element.remove();
    expect(trigger.inert).toBeFalsy();
    expect(shadow.activeElement).toBe(trigger);
    player.coordinator.destroy();
  });

  it('fetches a raw schedule, waits for play and retains consumption across disconnect/reconnect', async () => {
    const fetch = vi.fn(async () => Response.json(oneImage()));

    vi.stubGlobal('fetch', fetch);
    await attach();
    expect(fetch).toHaveBeenCalledOnce();
    expect(content.play).not.toHaveBeenCalled();
    await content.play();
    overlayRoot(container).querySelector('img')!.dispatchEvent(new Event('load'));
    element.remove();
    expect(observed.map((event) => event.type)).toEqual(['start', 'cancel']);
    expect(container.querySelector('[data-ads-overlay]')).toBeNull();
    await attach();
    await content.play();
    expect(fetch).toHaveBeenCalledOnce();
    expect(container.querySelector('[data-ads-overlay]')).toBeNull();
  });

  it('uses manager transport credentials and forwards actual events to the collector', async () => {
    const fetch = vi.fn(async (url: string) =>
      url === '/events'
        ? new Response(null, { status: 204 })
        : Response.json({
            ok: true,
            data: {
              schedule: oneImage(),
              playbackSessionId: 'issued',
              eventToken: 'credential',
              expiresAt: '2099-01-01T00:00:00Z',
              eventsUrl: '/events',
            },
          })
    );

    vi.stubGlobal('fetch', fetch);
    await attach();
    await content.play();
    overlayRoot(container).querySelector('img')!.dispatchEvent(new Event('load'));
    await vi.advanceTimersByTimeAsync(100);
    expect(observed[0]?.playbackSessionId).toBe('issued');
    expect(fetch.mock.calls[1]?.[0]).toBe('/events');
  });

  it('holds an early play request while loading, then fails open on request timeout', async () => {
    const fetch = vi.fn(
      (_url: string, options: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          options.signal!.addEventListener('abort', () => reject(new Error('aborted')));
        })
    );

    vi.stubGlobal('fetch', fetch);
    const error = vi.fn();

    element.addEventListener('ads-error', error);
    await attach();
    await content.play();
    expect(content.paused).toBe(true);
    await vi.advanceTimersByTimeAsync(5000);
    expect(content.paused).toBe(false);
    expect(error).toHaveBeenCalledOnce();
    expect(observed).toEqual([]);
  });

  it.each([['loadstart'], ['emptied', 'durationchange', 'loadstart']])(
    'keeps one pending schedule and held play intent through initial %j',
    async (...initialEvents) => {
      let resolve!: (response: Response) => void;
      const fetch = vi.fn(
        (_url: string, _options: RequestInit) =>
          new Promise<Response>((done) => {
            resolve = done;
          })
      );

      vi.stubGlobal('fetch', fetch);
      content.src = '/content.mp4';
      mediaState(content, { duration: Number.NaN, readyState: 0 });
      await attach();
      await content.play();
      expect(content.paused).toBe(true);

      for (const type of initialEvents) content.dispatchEvent(new Event(type));

      await element.updateComplete;
      expect(fetch).toHaveBeenCalledOnce();
      expect(fetch.mock.calls[0]![1].signal!.aborted).toBe(false);
      resolve(
        Response.json({
          ok: true,
          data: {
            schedule: oneImage(),
            playbackSessionId: 'issued-once',
            eventToken: 'credential',
            expiresAt: '2099-01-01T00:00:00Z',
            eventsUrl: '/events',
          },
        })
      );
      await vi.advanceTimersByTimeAsync(0);
      overlayRoot(container).querySelector('img')!.dispatchEvent(new Event('load'));
      expect(observed.map((event) => [event.type, event.playbackSessionId])).toEqual([['start', 'issued-once']]);
    }
  );

  it('refetches an actual same-source reload after metadata while its schedule is pending', async () => {
    let resolveOld!: (response: Response) => void;
    const fetch = vi
      .fn()
      .mockReturnValueOnce(
        new Promise<Response>((resolve) => {
          resolveOld = resolve;
        })
      )
      .mockImplementation(async () => Response.json({ ...oneImage(), scheduleVersion: 2 }));

    vi.stubGlobal('fetch', fetch);
    content.src = '/content.mp4';
    await attach();
    content.dispatchEvent(new Event('loadedmetadata'));
    mediaState(content, { readyState: 0, duration: Number.NaN });
    content.dispatchEvent(new Event('emptied'));
    await element.updateComplete;
    content.dispatchEvent(new Event('loadstart'));
    await element.updateComplete;
    resolveOld(Response.json(oneImage()));
    await vi.advanceTimersByTimeAsync(0);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0]![1].signal.aborted).toBe(true);
    await content.play();
    overlayRoot(container).querySelector('img')!.dispatchEvent(new Event('load'));
    expect(observed[0]?.scheduleVersion).toBe(2);
  });

  it('ignores an old request after src changes and loads the new snapshot', async () => {
    let resolveOld!: (response: Response) => void;
    const fetch = vi
      .fn()
      .mockReturnValueOnce(
        new Promise<Response>((resolve) => {
          resolveOld = resolve;
        })
      )
      .mockImplementation(async () => Response.json({ ...oneImage(), scheduleVersion: 2 }));

    vi.stubGlobal('fetch', fetch);
    await attach();
    element.setAttribute('src', '/new-schedule.json');
    await element.updateComplete;
    await vi.advanceTimersByTimeAsync(0);
    resolveOld(Response.json(oneImage()));
    await vi.advanceTimersByTimeAsync(0);
    await content.play();
    overlayRoot(container).querySelector('img')!.dispatchEvent(new Event('load'));
    expect(observed[0]?.scheduleVersion).toBe(2);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('refetches source replacement and does not reuse consumed history from the previous source', async () => {
    const fetch = vi.fn(async () => Response.json(oneImage()));

    vi.stubGlobal('fetch', fetch);
    await attach();
    await content.play();
    overlayRoot(container).querySelector('img')!.dispatchEvent(new Event('load'));
    content.src = '/replacement.mp4';
    content.dispatchEvent(new Event('emptied'));
    await element.updateComplete;
    await vi.advanceTimersByTimeAsync(0);
    expect(fetch).toHaveBeenCalledTimes(2);
    await content.play();
    overlayRoot(container).querySelector('img')!.dispatchEvent(new Event('load'));
    expect(observed.map((event) => event.type)).toEqual(['start', 'cancel', 'start']);
    expect(observed[0]?.playbackSessionId).not.toBe(observed[2]?.playbackSessionId);
  });

  it('does not fall back to another video when its explicit target is missing', async () => {
    const fetch = vi.fn(async () => Response.json(oneImage()));

    vi.stubGlobal('fetch', fetch);
    element.setAttribute('for', 'missing');
    await attach();
    await content.play();
    expect(fetch).not.toHaveBeenCalled();
    expect(content.paused).toBe(false);
    expect(container.querySelector('[data-ads-overlay]')).toBeNull();
  });

  it('registers through exported contexts and isolates player-facade seek/pause during ads', async () => {
    container.remove();
    const player = new PlayerHost();

    container = player;
    document.body.append(player);
    content = contentMedia(player);
    content.id = 'content';
    player.coordinator.attach({ media: content, container: player });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(oneImage()))
    );
    await attach();
    expect(player.coordinator.size).toBe(1);
    const facade = player.coordinator.getStoreMedia(content);

    await facade.play();
    overlayRoot(container).querySelector('img')!.dispatchEvent(new Event('load'));
    facade.currentTime = 50;
    expect(content.currentTime).toBe(0);
    facade.pause();
    vi.advanceTimersByTime(6000);
    expect(observed.map((event) => event.type)).toEqual(['start']);
    expect(facade.paused).toBe(true);
    await facade.play();
    vi.advanceTimersByTime(5000);
    expect(observed.map((event) => event.type)).toEqual(['start', 'complete']);
    element.remove();
    expect(player.coordinator.size).toBe(0);
    mediaState(content, { currentTime: 10 });
    expect(facade.currentTime).toBe(10);
    player.coordinator.destroy();
  });

  it('keeps the first registered class on duplicate module evaluation', async () => {
    const first = customElements.get('media-ads');

    vi.resetModules();
    await import('../define');
    expect(customElements.get('media-ads')).toBe(first);
  });
});
