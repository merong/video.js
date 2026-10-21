// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import type { ObservedAdEvent } from '../../core/events';
import type { PlaybackSchedule } from '../../core/playback';
import { loadPlaybackFixture } from '../../core/tests/fixture';
import { createAdsController, type AdsController } from '../controller';
import { button, contentMedia, mediaState, overlayRoot } from './media';

let container: HTMLDivElement;
let content: HTMLVideoElement;
let controller: AdsController | undefined;
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
  controller = undefined;
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function bind(schedule: PlaybackSchedule = loadPlaybackFixture()): void {
  controller = createAdsController({ media: content, container, schedule, onEvent: (event) => events.push(event) });
}

function videoOnly(): PlaybackSchedule {
  const fixture = loadPlaybackFixture();

  return { ...fixture, breaks: [{ ...fixture.breaks[0]!, ads: [fixture.breaks[0]!.ads[1]!] }] };
}

describe('createAdsController', () => {
  it.each(['pip', 'remote'] as const)(
    'reports unsupported %s transition without claiming ad completion',
    async (kind) => {
      const remote = Object.assign(new EventTarget(), { state: 'disconnected' });

      Object.defineProperty(content, 'remote', { configurable: true, value: remote });
      bind(videoOnly());
      await content.play();
      overlayRoot(container).querySelector('video')!.dispatchEvent(new Event('playing'));

      if (kind === 'pip') content.dispatchEvent(new Event('enterpictureinpicture'));
      else {
        remote.state = 'connected';
        remote.dispatchEvent(new Event('connect'));
      }

      expect(events.map((event) => event.type)).toEqual(['start', 'error']);
      expect(events[1]).toMatchObject({
        stage: 'content',
        code: kind === 'pip' ? 'unsupported_picture_in_picture' : 'unsupported_remote_playback',
      });
      expect(content.paused).toBe(false);
      expect(container.querySelector('[data-ads-overlay]')).toBeNull();
    }
  );

  it.each([['loadstart'], ['emptied', 'durationchange', 'loadstart']])(
    'keeps issued tracking through initial %j before metadata and playback',
    async (...initialEvents) => {
      const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));

      vi.stubGlobal('fetch', fetch);
      content.src = '/content.mp4';
      content.load();
      mediaState(content, { duration: Number.NaN, readyState: 0 });
      controller = createAdsController({
        media: content,
        container,
        schedule: videoOnly(),
        tracking: {
          playbackSessionId: 'issued-session',
          eventToken: 'issued-token',
          expiresAt: '2099-01-01T00:00:00Z',
          eventsUrl: '/events',
        },
        onEvent: (event) => events.push(event),
      });

      for (const type of initialEvents) content.dispatchEvent(new Event(type));

      mediaState(content, { duration: 100, readyState: 1 });
      content.dispatchEvent(new Event('loadedmetadata'));
      await content.play();
      overlayRoot(container).querySelector('video')!.dispatchEvent(new Event('playing'));
      await vi.advanceTimersByTimeAsync(100);
      expect(events[0]?.playbackSessionId).toBe('issued-session');
      expect(JSON.parse(fetch.mock.calls[0]![1].body)).toMatchObject({
        playbackSessionId: 'issued-session',
        eventToken: 'issued-token',
      });
    }
  );

  it.each(['already loaded', 'metadata', 'played', 'source replacement'] as const)(
    'invalidates the imperative session on reload after %s',
    async (activity) => {
      content.src = '/content.mp4';
      mediaState(content, { readyState: activity === 'already loaded' ? 1 : 0 });
      bind(videoOnly());

      if (activity === 'metadata') content.dispatchEvent(new Event('loadedmetadata'));

      if (activity === 'played') {
        await content.play();
        overlayRoot(container).querySelector('video')!.dispatchEvent(new Event('playing'));
      }

      if (activity === 'source replacement') content.src = '/replacement.mp4';

      mediaState(content, { readyState: 0, duration: Number.NaN });
      content.dispatchEvent(new Event('emptied'));
      content.dispatchEvent(new Event('loadstart'));
      mediaState(content, { readyState: 1, duration: 100 });
      content.dispatchEvent(new Event('loadedmetadata'));
      await content.play();
      expect(container.querySelector('[data-ads-overlay]')).toBeNull();
      expect(events.map((event) => event.type)).toEqual(activity === 'played' ? ['start', 'cancel'] : []);
    }
  );

  it.each(['destroy', 'source'] as const)(
    'attempts outbound cancel on immediate %s with stable observation IDs',
    async (action) => {
      const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));

      vi.stubGlobal('fetch', fetch);
      controller = createAdsController({
        media: content,
        container,
        schedule: videoOnly(),
        tracking: {
          playbackSessionId: 'issued-session',
          eventToken: 'issued-token',
          expiresAt: '2099-01-01T00:00:00Z',
          eventsUrl: '/events',
        },
        onEvent: (event) => events.push(event),
      });
      await content.play();
      overlayRoot(container).querySelector('video')!.dispatchEvent(new Event('playing'));

      if (action === 'destroy') controller.destroy();
      else {
        content.src = '/replacement.mp4';
        content.dispatchEvent(new Event('loadstart'));
      }

      expect(fetch).toHaveBeenCalledOnce();
      const request = fetch.mock.calls[0]![1];

      expect(request).toMatchObject({ method: 'POST', mode: 'same-origin', keepalive: true });
      expect(JSON.parse(request.body).events.map((event: ObservedAdEvent) => [event.type, event.eventId])).toEqual(
        events.map((event) => [event.type, event.eventId])
      );
      expect(events.map((event) => event.type)).toEqual(['start', 'cancel']);
      await vi.advanceTimersByTimeAsync(60000);
      expect(fetch).toHaveBeenCalledOnce();
    }
  );

  it('allows an observer to destroy during start without later completion or exceptions', async () => {
    controller = createAdsController({
      media: content,
      container,
      schedule: loadPlaybackFixture(),
      onEvent: (event) => {
        events.push(event);

        if (event.type === 'start') controller?.destroy();
      },
    });
    await content.play();
    overlayRoot(container).querySelector('img')!.dispatchEvent(new Event('load'));
    expect(events.map((event) => event.type)).toEqual(['start', 'cancel']);
    vi.advanceTimersByTime(60000);
    expect(container.querySelector('[data-ads-overlay]')).toBeNull();
  });

  it('holds a mixed preroll, starts on image display, skips current only, then observes real video completion', async () => {
    bind();
    expect(container.querySelector('[data-ads-overlay]')).toBeNull();
    await content.play();
    const root = overlayRoot(container);

    expect(content.paused).toBe(true);
    expect(container.querySelectorAll('video')).toHaveLength(1);
    expect(content.inert).toBe(true);
    expect(events).toEqual([]);
    root.querySelector('img')!.dispatchEvent(new Event('load'));
    expect(events.map((event) => event.type)).toEqual(['start']);
    expect(button(root, 'Skip in 2s').disabled).toBe(true);
    vi.advanceTimersByTime(2000);
    button(root, 'Skip ad').click();
    const adVideo = root.querySelector('video')!;

    expect(adVideo).not.toBeNull();
    expect(events.map((event) => event.type)).toEqual(['start', 'skip']);
    expect(root.querySelector('a')!.hidden).toBe(true);
    adVideo.dispatchEvent(new Event('playing'));
    mediaState(adVideo, { currentTime: 4, duration: 4, ended: true });
    adVideo.dispatchEvent(new Event('ended'));
    expect(events.map((event) => event.type)).toEqual(['start', 'skip', 'start', 'complete']);
    expect(events.map((event) => event.sequence)).toEqual([1, 2, 1, 2]);
    expect(events[0]?.breakAttemptId).toBe(events[2]?.breakAttemptId);
    expect(events[0]?.adAttemptId).not.toBe(events[2]?.adAttemptId);
    expect(events[3]).toMatchObject({ adElapsedSeconds: 4, contentTimeSeconds: 0 });
    expect(content.paused).toBe(false);
    expect(content.inert).toBeFalsy();
    expect(container.querySelector('[data-ads-overlay]')).toBeNull();
  });

  it('counts image/GIF only while visible, loaded and unpaused; click is a distinct observation', async () => {
    const fixture = loadPlaybackFixture();

    bind({
      ...fixture,
      breaks: [{ ...fixture.breaks[0]!, ads: [{ ...fixture.breaks[1]!.ads[0]!, clickUrl: '/offer' }] }],
    });
    await content.play();
    const root = overlayRoot(container);

    vi.advanceTimersByTime(1000);
    expect(events).toEqual([]);
    root.querySelector('img')!.dispatchEvent(new Event('load'));
    root.querySelector('a')!.addEventListener('click', (event) => event.preventDefault());
    root.querySelector('a')!.click();
    vi.advanceTimersByTime(1000);
    button(root, 'Play / pause ad').click();
    vi.advanceTimersByTime(6000);
    expect(events.map((event) => event.type)).toEqual(['start', 'click']);
    button(root, 'Play / pause ad').click();
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(10000);
    expect(events).toHaveLength(2);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(2000);
    expect(events.map((event) => event.type)).toEqual(['start', 'click', 'complete']);
    expect(events[2]?.adElapsedSeconds).toBeCloseTo(3);
  });

  it('does not start ads on never-played paused seek and prioritizes preroll on the first play', async () => {
    bind();
    mediaState(content, { currentTime: 25, seeking: true });
    content.dispatchEvent(new Event('seeking'));
    content.dispatchEvent(new Event('timeupdate'));
    mediaState(content, { seeking: false });
    content.dispatchEvent(new Event('seeked'));
    expect(container.querySelector('[data-ads-overlay]')).toBeNull();
    await content.play();
    const root = overlayRoot(container);

    root.querySelector('img')!.dispatchEvent(new Event('load'));
    expect(events[0]).toMatchObject({ breakId: 'pre-1', contentTimeSeconds: 25 });
  });

  it('ignores seeking timeupdates and runs one earliest midroll after final seek', async () => {
    const fixture = loadPlaybackFixture();

    bind({ ...fixture, breaks: fixture.breaks.filter((item) => item.position === 'mid') });
    await content.play();
    mediaState(content, { currentTime: 25, seeking: true });
    content.dispatchEvent(new Event('seeking'));
    content.dispatchEvent(new Event('timeupdate'));
    expect(container.querySelector('[data-ads-overlay]')).toBeNull();
    mediaState(content, { seeking: false });
    content.dispatchEvent(new Event('seeked'));
    const root = overlayRoot(container);

    root.querySelector('img')!.dispatchEvent(new Event('load'));
    vi.advanceTimersByTime(3000);
    content.dispatchEvent(new Event('seeked'));
    content.dispatchEvent(new Event('timeupdate'));
    expect(events.map((event) => [event.type, event.breakId])).toEqual([
      ['start', 'mid-10'],
      ['complete', 'mid-10'],
    ]);
    expect(container.querySelector('[data-ads-overlay]')).toBeNull();
  });

  it('keeps a metadata-ready paused midroll beyond the load deadline until explicit play', async () => {
    const fixture = loadPlaybackFixture();

    bind({ ...fixture, breaks: [fixture.breaks[2]!] });
    await content.play();
    content.pause();
    mediaState(content, { currentTime: 25 });
    content.dispatchEvent(new Event('seeked'));
    const root = overlayRoot(container);
    const video = root.querySelector('video')!;

    mediaState(video, { duration: 8 });
    video.dispatchEvent(new Event('loadedmetadata'));
    vi.advanceTimersByTime(7000);
    expect(events).toEqual([]);
    expect(root.querySelector('video')).toBe(video);
    button(root, 'Play / pause ad').click();
    video.dispatchEvent(new Event('playing'));
    video.dispatchEvent(new Event('playing'));
    expect(events.map((event) => event.type)).toEqual(['start']);
  });

  it('waits after NotAllowedError with ready media and counts only a subsequent real playing event', async () => {
    vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(new DOMException('Blocked', 'NotAllowedError'));
    bind(videoOnly());
    await content.play();
    const root = overlayRoot(container);
    const video = root.querySelector('video')!;

    mediaState(video, { duration: 8 });
    video.dispatchEvent(new Event('loadedmetadata'));
    await Promise.resolve();
    vi.advanceTimersByTime(7000);
    expect(events).toEqual([]);
    button(root, 'Play / pause ad').click();
    expect(events).toEqual([]);
    video.dispatchEvent(new Event('playing'));
    expect(events.map((event) => event.type)).toEqual(['start']);
  });

  it('times out missing media and stalled video as errors, advances the pod, and releases content', async () => {
    bind();
    await content.play();
    vi.advanceTimersByTime(5000);
    const video = overlayRoot(container).querySelector('video')!;

    video.dispatchEvent(new Event('playing'));
    vi.advanceTimersByTime(10000);
    expect(events.map((event) => event.type)).toEqual(['error', 'start', 'error']);
    expect(events[0]).toMatchObject({ code: 'creative_load_timeout', stage: 'load' });
    expect(events[2]).toMatchObject({ code: 'creative_stall_timeout', stage: 'stall' });
    expect(content.paused).toBe(false);
  });

  it('prioritizes postroll at ended, ignores replay while active, and retains history on later replay', async () => {
    const fixture = loadPlaybackFixture();

    bind({ ...fixture, breaks: fixture.breaks.filter((item) => item.position !== 'pre') });
    await content.play();
    mediaState(content, { currentTime: 100, ended: true });
    content.pause();
    content.dispatchEvent(new Event('seeked'));
    const root = overlayRoot(container);

    root.querySelector('img')!.dispatchEvent(new Event('load'));
    mediaState(content, { currentTime: 0, ended: false });
    await content.play();
    expect(content.currentTime).toBe(100);
    expect(content.paused).toBe(true);
    vi.advanceTimersByTime(2000);
    expect(events.map((event) => [event.type, event.breakId])).toEqual([
      ['start', 'post-1'],
      ['complete', 'post-1'],
    ]);
    expect(content.paused).toBe(true);
    mediaState(content, { currentTime: 0, ended: false });
    await content.play();
    mediaState(content, { currentTime: 100, ended: true });
    content.dispatchEvent(new Event('ended'));
    expect(container.querySelector('[data-ads-overlay]')).toBeNull();
  });

  // A looping element seeks back to the start instead of ending, and `ended` stays false while `loop` is set.
  it('runs a midroll on the first loop only and never starts postroll while looping', async () => {
    const fixture = loadPlaybackFixture();

    bind({
      ...fixture,
      breaks: fixture.breaks.filter((item) => item.breakId === 'mid-10' || item.position === 'post'),
    });
    content.loop = true;
    await content.play();

    for (const lap of [1, 2, 3]) {
      mediaState(content, { currentTime: 12 });
      content.dispatchEvent(new Event('timeupdate'));

      if (lap === 1) {
        overlayRoot(container).querySelector('img')!.dispatchEvent(new Event('load'));
        vi.advanceTimersByTime(3000);
      }

      expect(container.querySelector('[data-ads-overlay]')).toBeNull();
      mediaState(content, { currentTime: 99.9 });
      content.dispatchEvent(new Event('timeupdate'));
      mediaState(content, { currentTime: 0, seeking: true });
      content.dispatchEvent(new Event('seeking'));
      mediaState(content, { seeking: false });
      content.dispatchEvent(new Event('seeked'));
      content.dispatchEvent(new Event('timeupdate'));
      expect(container.querySelector('[data-ads-overlay]')).toBeNull();
    }

    expect(events.map((event) => [event.type, event.breakId])).toEqual([
      ['start', 'mid-10'],
      ['complete', 'mid-10'],
    ]);
  });

  it('keeps postroll playing through the content pause queued after seeked at the actual end', async () => {
    let resolvePlay!: () => void;
    let rejectPlay!: (error: DOMException) => void;
    const play = vi.mocked(HTMLMediaElement.prototype.play).mockReturnValueOnce(
      new Promise<void>((resolve, reject) => {
        resolvePlay = resolve;
        rejectPlay = reject;
      })
    );
    const pause = vi.mocked(HTMLMediaElement.prototype.pause).mockImplementation(() => {
      rejectPlay(new DOMException('The play() request was interrupted by a call to pause()', 'AbortError'));
    });
    const fixture = videoOnly();

    bind({ ...fixture, breaks: [{ ...fixture.breaks[0]!, position: 'post' }] });
    await content.play();
    mediaState(content, { currentTime: 100, seeking: true });
    content.dispatchEvent(new Event('seeking'));
    mediaState(content, { seeking: false, ended: true, paused: true });
    content.dispatchEvent(new Event('seeked'));
    const video = overlayRoot(container).querySelector('video')!;

    expect(play).toHaveBeenCalledOnce();
    // Native state changes before its queued pause/ended events; this pause is not an ad control command.
    content.dispatchEvent(new Event('pause'));
    content.dispatchEvent(new Event('ended'));
    await Promise.resolve();
    expect(pause).not.toHaveBeenCalled();
    expect(events).toEqual([]);
    resolvePlay();
    video.dispatchEvent(new Event('playing'));
    mediaState(video, { currentTime: 4, duration: 4, ended: true });
    video.dispatchEvent(new Event('ended'));
    await Promise.resolve();
    expect(events.map((event) => event.type)).toEqual(['start', 'complete']);
    expect(content.paused).toBe(true);
    expect(container.querySelector('[data-ads-overlay]')).toBeNull();
  });

  it('honors explicit postroll pause while play is pending and waits for a new user play', async () => {
    let rejectPlay!: (error: DOMException) => void;
    const play = vi.mocked(HTMLMediaElement.prototype.play).mockReturnValueOnce(
      new Promise<void>((_, reject) => {
        rejectPlay = reject;
      })
    );

    vi.mocked(HTMLMediaElement.prototype.pause).mockImplementation(() => {
      rejectPlay(new DOMException('Interrupted by pause', 'AbortError'));
    });
    const fixture = videoOnly();

    bind({ ...fixture, breaks: [{ ...fixture.breaks[0]!, position: 'post' }] });
    await content.play();
    mediaState(content, { currentTime: 100, ended: true, paused: true });
    content.dispatchEvent(new Event('ended'));
    const root = overlayRoot(container);
    const video = root.querySelector('video')!;

    mediaState(video, { duration: 4, readyState: 1 });
    video.dispatchEvent(new Event('loadedmetadata'));
    button(root, 'Play / pause ad').click();
    await vi.advanceTimersByTimeAsync(6000);
    expect(events).toEqual([]);
    expect(play).toHaveBeenCalledOnce();
    expect(root.querySelector('video')).toBe(video);
    button(root, 'Play / pause ad').click();
    video.dispatchEvent(new Event('playing'));
    expect(play).toHaveBeenCalledTimes(2);
    expect(events.map((event) => event.type)).toEqual(['start']);
  });

  it('still reports an unsolicited play AbortError without an explicit pause or teardown', async () => {
    vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(
      new DOMException('Unexpected abort', 'AbortError')
    );
    bind(videoOnly());
    await content.play();
    await Promise.resolve();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'error', code: 'creative_play_failed' });
  });

  it('cancels source work and stale play rejections without resuming replacement content', async () => {
    let rejectPlay!: (reason: Error) => void;

    vi.mocked(HTMLMediaElement.prototype.play).mockReturnValueOnce(
      new Promise((_, reject) => {
        rejectPlay = reject;
      })
    );
    bind(videoOnly());
    await content.play();
    const oldVideo = overlayRoot(container).querySelector('video')!;

    content.src = '/replacement.mp4';
    content.dispatchEvent(new Event('emptied'));
    rejectPlay(new Error('Old playback failed'));
    await Promise.resolve();
    oldVideo.dispatchEvent(new Event('playing'));
    oldVideo.dispatchEvent(new Event('ended'));
    expect(events.map((event) => event.type)).toEqual(['cancel']);
    expect(content.paused).toBe(true);
    expect(container.querySelector('[data-ads-overlay]')).toBeNull();
    await content.play();
    expect(container.querySelector('[data-ads-overlay]')).toBeNull();
  });

  it('inherits mute/volume, keeps latest pause intent and restores focus on teardown', async () => {
    content.muted = true;
    content.volume = 0.3;
    const trigger = document.createElement('button');

    container.append(trigger);
    trigger.focus();
    bind(videoOnly());
    await content.play();
    const root = overlayRoot(container);
    const video = root.querySelector('video')!;

    expect(video.muted).toBe(true);
    expect(video.volume).toBe(0.3);
    video.dispatchEvent(new Event('playing'));
    button(root, 'Mute ad').click();
    expect(content.muted).toBe(false);
    button(root, 'Play / pause ad').click();
    video.dispatchEvent(new Event('error'));
    expect(content.paused).toBe(true);
    expect(trigger.inert).toBeFalsy();
    expect(document.activeElement).toBe(trigger);
    expect(events.map((event) => event.type)).toEqual(['start', 'error']);
  });

  it('fails open on invalid schedule without creating fake ad observations', async () => {
    const diagnostic = vi.fn();

    container.addEventListener('ads-error', diagnostic);
    const input = loadPlaybackFixture();

    Reflect.set(input, 'schemaVersion', 2);
    bind(input);
    await content.play();
    expect(content.paused).toBe(false);
    expect(events).toEqual([]);
    expect(diagnostic).toHaveBeenCalledOnce();
    expect(container.querySelector('[data-ads-overlay]')).toBeNull();
  });

  it('never tracks preview observations over the network', async () => {
    const fetch = vi.fn();

    vi.stubGlobal('fetch', fetch);
    controller = createAdsController({
      media: content,
      container,
      schedule: videoOnly(),
      preview: true,
      tracking: { playbackSessionId: 's', eventToken: 't', expiresAt: '2099-01-01T00:00:00Z', eventsUrl: '/events' },
      onEvent: (event) => events.push(event),
    });
    await content.play();
    overlayRoot(container).querySelector('video')!.dispatchEvent(new Event('playing'));
    vi.advanceTimersByTime(200);
    expect(events.map((event) => event.type)).toEqual(['start']);
    expect(fetch).not.toHaveBeenCalled();
  });
});
