import type { MediaOverride } from '@videojs/core/dom';
import { isFunction } from '@videojs/utils/predicate';

import type { AdEventType, ObservedAdEvent } from '../core/events';
import { parsePlaybackSchedule, type PlaybackSchedule } from '../core/playback';
import { AdsScheduler, type AdResult, type ScheduledAd } from '../core/scheduler';
import { AdsOverlay } from './overlay';
import { AdsSourceLifecycle } from './source-lifecycle';
import { AdEventQueue, type AdsTracking, parseTracking } from './tracking';
import type { AdsUIOptions } from './ui';

/** Native or custom media's narrow playback surface. @internal */
export interface AdsMedia extends EventTarget {
  currentTime: number;
  readonly duration: number;
  readonly paused: boolean;
  readonly ended: boolean;
  readonly seeking: boolean;
  readonly readyState?: number;
  readonly remote?: EventTarget & { readonly state: string };
  readonly src?: string;
  readonly currentSrc?: string;
  muted: boolean;
  volume: number;
  play(): Promise<void>;
  pause(): void;
}

/** @internal */
export interface AdsControllerOptions {
  readonly media: AdsMedia;
  readonly container: HTMLElement;
  readonly schedule: PlaybackSchedule;
  readonly preview?: boolean;
  readonly tracking?: AdsTracking;
  readonly onEvent?: (event: ObservedAdEvent) => void;
  readonly timeouts?: { readonly loadSeconds?: number; readonly stallSeconds?: number };
  readonly ui?: AdsUIOptions;
}

/** @internal */
export interface AdsController {
  destroy(): void;
  /** Replace presentation options without replacing the session, schedule or creative. */
  updateUI(ui: AdsUIOptions): void;
}

/** In-memory logical session, retained by the HTML owner across disconnects. @internal */
export class AdsSession {
  readonly scheduler: AdsScheduler;
  readonly id: string;
  readonly tracking: AdsTracking | null;
  hasPlayed = false;

  constructor(schedule: PlaybackSchedule, tracking?: AdsTracking) {
    this.scheduler = new AdsScheduler(schedule);
    this.tracking = parseTracking(tracking);
    this.id = this.tracking?.playbackSessionId ?? crypto.randomUUID();
  }
}

/** @internal */
export function isAdsMedia(value: Element | null): value is HTMLElement & AdsMedia {
  return (
    value instanceof HTMLElement &&
    'play' in value &&
    isFunction(value.play) &&
    'pause' in value &&
    isFunction(value.pause) &&
    'currentTime' in value &&
    'muted' in value &&
    'volume' in value
  );
}

function boundedSeconds(value: number | undefined, fallback: number, maximum: number): number {
  return value !== undefined && Number.isFinite(value) && value > 0 && value <= maximum ? value : fallback;
}

/** Local operational diagnostics have no fabricated ad/session membership. @internal */
export function reportAdsError(container: HTMLElement, code: string, stage: string): void {
  container.dispatchEvent(
    new CustomEvent('ads-error', { bubbles: true, composed: true, detail: Object.freeze({ code, stage }) })
  );
}

/**
 * Bind an explicit content target. Construction never requests content playback. `onEvent` reports observations;
 * optional delivery is best effort and preview never sends it. Destroy cancels without resuming another source.
 *
 * @internal
 */
export function createAdsController(options: AdsControllerOptions): AdsController {
  const result = parsePlaybackSchedule(options.schedule);

  if (!result.ok) {
    reportAdsError(options.container, 'invalid_schedule', 'schedule');
    return { destroy() {}, updateUI() {} };
  }

  return new AdsRuntime(options, new AdsSession(result.schedule, options.tracking));
}

/** Browser owner of actual creative observations, distinct from content scheduling. @internal */
export class AdsRuntime implements AdsController {
  readonly #options: AdsControllerOptions;
  readonly #media: AdsMedia;
  readonly #listeners = new AbortController();
  readonly #loadMs: number;
  readonly #stallMs: number;
  #session: AdsSession;
  #queue: AdEventQueue | null = null;
  #overlay: AdsOverlay | null = null;
  #creative: HTMLVideoElement | HTMLImageElement | null = null;
  #adListeners: AbortController | null = null;
  #attempt: ScheduledAd | null = null;
  #breakAttemptId = '';
  #adAttemptId = '';
  #sequence = 0;
  #started = false;
  #terminal = false;
  #elapsed = 0;
  #imageElapsedMs = 0;
  #contentTime = 0;
  #desiredPlaying = false;
  #adPaused = false;
  #loaded = false;
  #blocked = false;
  #waiting = false;
  #ui: AdsUIOptions;
  #visible: boolean;
  #lastTick = 0;
  #lastProgress = 0;
  #loadDeadline = 0;
  #playDeadline = 0;
  #playPending = false;
  #playRequest = 0;
  #tickTimer: ReturnType<typeof setInterval> | undefined;
  #seeking = false;
  #syncingPlayback = false;
  #suppressedPauses = 0;
  #destroyed = false;
  #metadataInvalid = false;
  readonly #source: AdsSourceLifecycle;
  readonly #sourceChanged: (() => void) | undefined;

  constructor(
    options: AdsControllerOptions,
    session: AdsSession,
    binding?: { readonly source?: AdsSourceLifecycle | undefined; readonly onSourceChange?: () => void }
  ) {
    this.#options = options;
    this.#media = options.media;
    this.#session = session;
    this.#ui = options.ui ?? {};
    this.#sourceChanged = binding?.onSourceChange;
    this.#source = binding?.source ?? new AdsSourceLifecycle(options.media, session.hasPlayed);
    this.#visible = options.container.ownerDocument.visibilityState !== 'hidden';
    this.#loadMs = 1000 * boundedSeconds(options.timeouts?.loadSeconds, 5, 60);
    this.#stallMs = 1000 * boundedSeconds(options.timeouts?.stallSeconds, 10, 120);
    this.#queue = !options.preview && session.tracking ? new AdEventQueue(session.tracking) : null;
    const signal = this.#listeners.signal;
    const media = this.#media;

    media.addEventListener('play', this.#onPlay, { signal });
    media.addEventListener('pause', this.#onPause, { signal });
    media.addEventListener('seeking', this.#onSeeking, { signal });
    media.addEventListener('seeked', this.#onSeeked, { signal });
    media.addEventListener('timeupdate', this.#onProgress, { signal });
    media.addEventListener('ended', this.#onEnded, { signal });
    media.addEventListener('durationchange', this.#onMetadata, { signal });
    media.addEventListener('loadedmetadata', this.#onMetadata, { signal });
    media.addEventListener('volumechange', this.#syncVolume, { signal });
    media.addEventListener('loadstart', this.#onSource, { signal });
    media.addEventListener('emptied', this.#onSource, { signal });
    media.addEventListener('enterpictureinpicture', this.#unsupported, { signal });
    media.remote?.addEventListener('connect', this.#onRemote, { signal });
    media.remote?.addEventListener('connecting', this.#onRemote, { signal });
    options.container.ownerDocument.addEventListener('visibilitychange', this.#onVisibility, { signal });
    this.#onMetadata();

    // Attaching after a genuine play already started must not let a late schedule bypass its preroll.
    if (!media.paused && !media.ended) this.#onPlay();
  }

  get mediaOverride(): MediaOverride | null {
    if (!this.#attempt) return null;

    // eslint-disable-next-line typescript/no-this-alias -- Accessor `this` is the facade object, not this runtime.
    const runtime = this;

    return {
      play: async () => runtime.#requestPlay(),
      pause: () => runtime.#requestPause(),
      get paused() {
        return runtime.#adPaused;
      },
      get ended() {
        return false;
      },
      get currentTime() {
        return runtime.#contentTime;
      },
      set currentTime(_value: number) {
        /* Content seeking is isolated for the active pod. */
      },
    };
  }

  destroy(): void {
    if (this.#destroyed) return;

    this.#destroyed = true;
    this.#listeners.abort();
    this.#cancel();
    this.#queue?.destroy(true);
  }

  updateUI(ui: AdsUIOptions): void {
    if (this.#destroyed) return;

    this.#ui = { ...ui, labels: ui.labels ? { ...ui.labels } : undefined };
    this.#overlay?.updateUI(this.#ui);
  }

  #onPlay = (): void => {
    if (this.#destroyed) return;

    if (!this.#source.matches()) {
      this.#onSource();
      return;
    }

    this.#source.settle();

    if (this.#attempt) {
      this.#pauseContent();
      this.#restoreContentTime();

      if (this.#attempt.break.position !== 'post') this.#requestPlay();

      return;
    }

    this.#desiredPlaying = true;
    this.#session.hasPlayed = true;
    this.#observe('play');
  };

  #onPause = (): void => {
    if (this.#suppressedPauses) {
      this.#suppressedPauses--;
      return;
    }

    // At native end, seeked/timeupdate can start postroll before the queued content pause arrives.
    // Explicit ad controls call #requestPause directly and still pause the postroll.
    if (this.#media.ended && this.#attempt?.break.position === 'post') return;

    this.#desiredPlaying = false;

    if (this.#attempt) this.#requestPause();
  };

  #onSeeking = (): void => {
    this.#seeking = true;

    if (this.#attempt) this.#restoreContentTime();
  };

  #onSeeked = (): void => {
    this.#seeking = false;

    if (this.#attempt) {
      this.#restoreContentTime();
      return;
    }

    this.#observe('seek');
  };

  #onProgress = (): void => {
    if (this.#syncingPlayback || this.#attempt || this.#seeking || this.#media.seeking || !this.#session.hasPlayed)
      return;

    this.#observe('progress');
  };

  #onEnded = (): void => {
    if (!this.#attempt && this.#session.hasPlayed) this.#observe('ended');
  };

  #observe(type: 'play' | 'seek' | 'progress' | 'ended'): void {
    const time = this.#media.currentTime;
    if (!Number.isFinite(time) || time < 0) return;

    this.#session.scheduler.observe({ type, currentTime: time, ended: this.#media.ended });

    if (this.#session.hasPlayed) this.#startPending();
  }

  #onMetadata = (event?: Event): void => {
    this.#source.observeMetadata(event);

    const issues = this.#session.scheduler.setDuration(this.#media.duration);

    if (issues.length) {
      if (!this.#metadataInvalid) reportAdsError(this.#options.container, 'invalid_duration', 'metadata');

      this.#metadataInvalid = true;
      const wasActive = !!this.#attempt;

      this.#cancel('invalid_duration');

      if (wasActive) this.#resumeContent();
    } else this.#metadataInvalid = false;
  };

  #onSource = (event?: Event): void => {
    if (this.#destroyed) return;

    if (event && this.#source.acceptInitial(event)) return;

    // A source/reload invalidates the resolved schedule and issued credentials. The HTML owner may resolve anew;
    // an imperative host must create a new controller with its new schedule instead of silently reusing this one.
    this.destroy();
    this.#sourceChanged?.();
  };

  #unsupported = (): void => {
    reportAdsError(this.#options.container, 'unsupported_picture_in_picture', 'content');
    this.#cancel('unsupported_picture_in_picture');
    this.#resumeContent();
  };

  #onRemote = (): void => {
    reportAdsError(this.#options.container, 'unsupported_remote_playback', 'content');
    this.#cancel('unsupported_remote_playback');
    this.#resumeContent();
  };

  #startPending(): void {
    const scheduler = this.#session.scheduler;
    if (this.#destroyed || this.#attempt || !scheduler.pending) return;

    if (this.#media.remote?.state === 'connected' || this.#media.remote?.state === 'connecting') {
      this.#onRemote();
      return;
    }

    if (
      this.#media instanceof Element &&
      this.#options.container.ownerDocument.pictureInPictureElement === this.#media
    ) {
      this.#unsupported();
      return;
    }

    const attempt = scheduler.startBreak(scheduler.pending.breakId);
    if (!attempt) return;

    this.#contentTime = this.#media.currentTime;
    this.#breakAttemptId = crypto.randomUUID();
    this.#pauseContent();
    this.#overlay ??= new AdsOverlay(
      this.#options.container,
      {
        playPause: () => (this.#adPaused ? this.#requestPlay() : this.#requestPause()),
        skip: () => this.#finish('skip'),
        mute: () => {
          this.#media.muted = !this.#media.muted;
          this.#syncVolume();
        },
        volume: (value) => {
          this.#media.volume = value;
          this.#syncVolume();
        },
        click: () => {
          if (this.#started && !this.#terminal) this.#emit('click');
        },
      },
      this.#ui
    );
    this.#beginAd(attempt);
  }

  #beginAd(attempt: ScheduledAd): void {
    this.#attempt = attempt;
    this.#adAttemptId = crypto.randomUUID();
    this.#sequence = 0;
    this.#started = this.#terminal = this.#loaded = false;
    this.#blocked = this.#waiting = false;
    this.#elapsed = 0;
    this.#imageElapsedMs = 0;
    this.#playPending = false;
    this.#adPaused = !this.#desiredPlaying && attempt.break.position !== 'post';
    this.#lastTick = this.#lastProgress = performance.now();
    this.#loadDeadline = this.#lastTick + this.#loadMs;
    const creative = this.#overlay!.show(attempt.ad, attempt.adIndex, attempt.break.ads.length);

    this.#creative = creative;
    const signal = (this.#adListeners = new AbortController()).signal;

    creative.addEventListener('error', () => this.#finish('error', 'creative_load_failed', 'load'), { signal });

    if (creative instanceof HTMLImageElement) {
      creative.addEventListener(
        'load',
        () => {
          this.#loaded = true;
          this.#tick();
        },
        { signal }
      );
    } else {
      creative.muted = this.#media.muted;
      creative.volume = this.#media.volume;
      creative.addEventListener(
        'loadedmetadata',
        () => {
          if (!Number.isFinite(creative.duration) || creative.duration <= 0)
            this.#finish('error', 'invalid_ad_duration', 'metadata');
          else {
            this.#loaded = true;
            this.#render();
          }
        },
        { signal }
      );
      creative.addEventListener(
        'playing',
        () => {
          if (this.#adPaused) {
            creative.pause();
            return;
          }

          this.#playPending = false;
          this.#blocked = this.#waiting = false;
          this.#loaded = true;
          this.#lastProgress = performance.now();
          this.#startObservation();
          this.#render();
        },
        { signal }
      );
      creative.addEventListener(
        'waiting',
        () => {
          this.#waiting = true;
          this.#render();
        },
        { signal }
      );
      creative.addEventListener(
        'ended',
        () => {
          this.#readVideoTime();

          if (this.#started) this.#finish('complete');
          else this.#finish('error', 'unobserved_playback', 'play');
        },
        { signal }
      );
    }

    creative.src = attempt.ad.url;
    this.#tickTimer = setInterval(() => this.#tick(), 50);

    if (creative instanceof HTMLVideoElement && !this.#adPaused) this.#playVideo(creative, attempt);

    this.#render();
  }

  #startObservation(): void {
    if (this.#started || this.#terminal || !this.#attempt) return;

    this.#started = true;
    this.#lastTick = performance.now();
    this.#emit('start');
  }

  #readVideoTime(): void {
    if (!(this.#creative instanceof HTMLVideoElement)) return;

    const value = this.#creative.currentTime;

    if (Number.isFinite(value) && value >= 0) {
      if (value > this.#elapsed) this.#lastProgress = performance.now();

      this.#elapsed = value;
    }
  }

  #tick(): void {
    if (!this.#attempt || this.#destroyed) return;

    const now = performance.now();

    if (this.#creative instanceof HTMLImageElement && this.#loaded && !this.#adPaused && this.#visible) {
      if (this.#started) {
        this.#imageElapsedMs += Math.max(0, now - this.#lastTick);
        this.#elapsed = this.#imageElapsedMs / 1000;
      } else this.#startObservation();
    } else this.#readVideoTime();

    if (!this.#attempt || this.#destroyed) return;

    this.#lastTick = now;

    if (!this.#loaded && now >= this.#loadDeadline) {
      this.#finish('error', 'creative_load_timeout', 'load');
      return;
    }

    if (this.#loaded && this.#playPending && !this.#adPaused && now >= this.#playDeadline) {
      this.#finish('error', 'creative_play_timeout', 'play');
      return;
    }

    if (
      this.#creative instanceof HTMLVideoElement &&
      this.#started &&
      !this.#adPaused &&
      now - this.#lastProgress >= this.#stallMs
    ) {
      this.#finish('error', 'creative_stall_timeout', 'stall');
      return;
    }

    if (this.#attempt.ad.kind === 'image' && this.#started && this.#elapsed >= this.#attempt.ad.displaySeconds) {
      this.#elapsed = this.#attempt.ad.displaySeconds;
      this.#finish('complete');
      return;
    }

    this.#render();
  }

  #onVisibility = (): void => {
    this.#tick();
    this.#visible = this.#options.container.ownerDocument.visibilityState !== 'hidden';
    this.#lastTick = performance.now();
  };

  #requestPause(): void {
    this.#tick();
    this.#desiredPlaying = false;
    this.#adPaused = true;
    this.#blocked = false;
    this.#playPending = false;
    this.#playRequest++;

    if (this.#creative instanceof HTMLVideoElement) this.#creative.pause();

    this.#render();
  }

  #requestPlay(): void {
    if (!this.#attempt) return;

    this.#desiredPlaying = true;
    this.#adPaused = false;
    this.#blocked = false;
    this.#lastTick = this.#lastProgress = performance.now();

    if (this.#creative instanceof HTMLVideoElement) this.#playVideo(this.#creative, this.#attempt);
    else this.#tick();

    this.#render();
  }

  #playVideo(video: HTMLVideoElement, attempt: ScheduledAd): void {
    const request = ++this.#playRequest;

    this.#playPending = true;
    this.#playDeadline = performance.now() + this.#loadMs;
    // eslint-disable-next-line anti-slop/no-unknown-parameters -- Native play rejection is an external error boundary.
    void video.play().catch((error: unknown) => {
      // A later explicit pause/play supersedes this promise; unrelated current failures still fail open.
      if (this.#destroyed || this.#attempt !== attempt || request !== this.#playRequest) return;

      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        this.#adPaused = true;
        this.#blocked = true;
        this.#playPending = false;
        this.#render();
      } else this.#finish('error', 'creative_play_failed', 'play');
    });
  }

  #syncVolume = (): void => {
    if (this.#creative instanceof HTMLVideoElement) {
      this.#creative.muted = this.#media.muted;
      this.#creative.volume = this.#media.volume;
    }

    this.#render();
  };

  #render(): void {
    const attempt = this.#attempt;
    if (!attempt) return;

    const duration =
      attempt.ad.kind === 'image'
        ? attempt.ad.displaySeconds
        : this.#creative instanceof HTMLVideoElement &&
            Number.isFinite(this.#creative.duration) &&
            this.#creative.duration > 0
          ? this.#creative.duration
          : null;
    const phase = this.#blocked
      ? 'blocked'
      : this.#adPaused
        ? 'paused'
        : !this.#started || this.#waiting || this.#playPending
          ? 'loading'
          : 'playing';

    this.#overlay?.update({
      elapsed: this.#elapsed,
      duration,
      started: this.#started,
      paused: this.#adPaused,
      phase,
      muted: this.#media.muted,
      volume: this.#media.volume,
    });
  }

  #finish(result: AdResult, code = '', stage = ''): void {
    const attempt = this.#attempt;
    if (!attempt || this.#terminal || (result !== 'error' && !this.#started)) return;

    this.#readVideoTime();

    if (!this.#session.scheduler.finishAd(attempt, result, this.#elapsed)) return;

    this.#terminal = true;
    this.#emit(result, code, stage);

    if (this.#destroyed || this.#attempt !== attempt) return;

    this.#clearCreative();
    this.#attempt = null;
    const next = this.#session.scheduler.active;

    if (next) {
      this.#beginAd(next);
      return;
    }

    if (this.#session.scheduler.pending) {
      this.#startPending();
      return;
    }

    this.#overlay?.destroy();
    this.#overlay = null;

    if (attempt.break.position !== 'post') this.#resumeContent();

    this.#syncPlayback();
  }

  #cancel(errorCode?: string): void {
    const wasActive = !!this.#attempt;

    if (this.#attempt && !this.#terminal) {
      this.#terminal = true;
      this.#emit(errorCode ? 'error' : 'cancel', errorCode ?? '', 'content');
    }

    this.#clearCreative();
    this.#attempt = null;
    this.#session.scheduler.cancel();
    this.#overlay?.destroy();
    this.#overlay = null;

    if (wasActive) this.#syncPlayback();
  }

  #syncPlayback(): void {
    if (this.#destroyed) return;

    // Re-read actual content state after releasing the facade; do not fabricate another ended/play event.
    // This extension notification must not schedule another break or survive source teardown.
    this.#syncingPlayback = true;

    try {
      this.#media.dispatchEvent(new Event('timeupdate'));
    } finally {
      this.#syncingPlayback = false;
    }
  }

  #clearCreative(): void {
    clearInterval(this.#tickTimer);
    this.#adListeners?.abort();
    this.#adListeners = null;

    if (this.#creative instanceof HTMLVideoElement) {
      this.#creative.pause();
      this.#creative.removeAttribute('src');
      this.#creative.load();
    } else this.#creative?.removeAttribute('src');

    this.#creative = null;
  }

  #pauseContent(): void {
    if (this.#media.paused) return;

    this.#suppressedPauses++;
    this.#media.pause();
  }

  #restoreContentTime(): void {
    if (this.#media.currentTime !== this.#contentTime) this.#media.currentTime = this.#contentTime;
  }

  #resumeContent(): void {
    if (this.#destroyed || !this.#desiredPlaying || this.#media.ended || !this.#source.matches()) return;

    void this.#media.play().catch(() => {
      if (!this.#destroyed) reportAdsError(this.#options.container, 'content_play_rejected', 'resume');
    });
  }

  #emit(type: AdEventType, code = '', stage = ''): void {
    const attempt = this.#attempt;
    if (!attempt) return;

    const schedule = this.#session.scheduler.schedule;
    const common = {
      schemaVersion: 1 as const,
      eventId: crypto.randomUUID(),
      playbackSessionId: this.#session.id,
      breakAttemptId: this.#breakAttemptId,
      adAttemptId: this.#adAttemptId,
      breakId: attempt.break.breakId,
      itemId: attempt.ad.itemId,
      adId: attempt.ad.adId,
      creativeId: attempt.ad.creativeId,
      creativeVersion: attempt.ad.creativeVersion,
      scheduleId: schedule.scheduleId,
      scheduleVersion: schedule.scheduleVersion,
      sequence: ++this.#sequence,
      occurredAt: new Date().toISOString(),
      contentTimeSeconds: this.#contentTime,
      adElapsedSeconds: this.#elapsed,
    };
    const event: ObservedAdEvent = Object.freeze(
      type === 'error' ? { ...common, type, code, stage } : { ...common, type }
    );

    this.#queue?.enqueue(event);

    try {
      this.#options.onEvent?.(event);
    } catch {
      reportAdsError(this.#options.container, 'observation_callback_failed', 'callback');
    }
  }
}
