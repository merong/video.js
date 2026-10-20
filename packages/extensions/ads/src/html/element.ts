import type { PlayerExtension, PlayerTarget } from '@videojs/core/dom';
import { ReactiveElement, type PropertyValues } from '@videojs/element';
import { ContextConsumer } from '@videojs/element/context';
import { containerContext, extensionContext, type ExtensionContextValue } from '@videojs/html';
import { containsComposed } from '@videojs/utils/dom';
import { isPlainObject } from '@videojs/utils/predicate';

import { parsePlaybackSchedule } from '../core/playback';
import { isAdsUrl } from '../core/url';
import { AdsRuntime, AdsSession, isAdsMedia, reportAdsError, type AdsMedia } from '../dom/controller';
import { AdsSourceLifecycle } from '../dom/source-lifecycle';
import { parseTracking } from '../dom/tracking';
import { observeAdsLocale, resolveAdsLocale, type AdsLabels, type AdsUIOptions } from '../dom/ui';

class AdsExtension implements PlayerExtension {
  readonly #owner: MediaAdsElement;
  constructor(owner: MediaAdsElement) {
    this.#owner = owner;
  }
  attach(target: PlayerTarget): void {
    this.#owner.setPlayerTarget(target);
  }
  detach(): void {
    this.#owner.setPlayerTarget(null);
  }
  get mediaOverride() {
    return this.#owner.runtime?.mediaOverride ?? null;
  }
}

/**
 * Explicit HTML binding. `for` identifies content media; `src` accepts raw C0 JSON or the manager envelope. Same
 * identity reconnects preserve consumption. Changing source/video/target begins another logical session.
 *
 * @internal
 */
export class MediaAdsElement extends ReactiveElement {
  static readonly tagName = 'media-ads';
  static override properties = {
    for: { type: String },
    src: { type: String },
    videoId: { type: String, attribute: 'video-id' },
    skipLabel: { type: String, attribute: 'skip-label' },
    skipCountdownLabel: { type: String, attribute: 'skip-countdown-label' },
    timerLabel: { type: String, attribute: 'timer-label' },
    mediaAlt: { type: String, attribute: 'media-alt' },
  };
  declare for: string;
  declare src: string;
  declare videoId: string;
  declare skipLabel: string | undefined;
  declare skipCountdownLabel: string | undefined;
  declare timerLabel: string | undefined;
  declare mediaAlt: string | undefined;
  /** @internal */
  runtime: AdsRuntime | null = null;
  readonly #extension = new AdsExtension(this);
  #register: ExtensionContextValue['registerExtension'] | null = null;
  #registered: ExtensionContextValue['registerExtension'] | null = null;
  #release: (() => void) | null = null;
  #playerTarget: PlayerTarget | null = null;
  #container: HTMLElement | null = null;
  #session: AdsSession | null = null;
  #sessionMedia: (HTMLElement & AdsMedia) | null = null;
  #sessionKey = '';
  #contentSource = '';
  #fetch: AbortController | null = null;
  #loadingCleanup: (() => void) | null = null;
  #generation = 0;
  #runtimeContainer: HTMLElement | null = null;
  #stopLocale: (() => void) | null = null;

  constructor() {
    super();
    new ContextConsumer(this, {
      context: extensionContext,
      subscribe: true,
      callback: (value) => {
        this.#register = value.registerExtension;
        this.requestUpdate();
      },
    });
    new ContextConsumer(this, {
      context: containerContext,
      subscribe: true,
      callback: (value) => {
        this.#container = value.container;
        this.requestUpdate();
      },
    });
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#stopLocale = observeAdsLocale(this, () => this.requestUpdate());
    this.requestUpdate();
  }

  override disconnectedCallback(): void {
    this.#stop();
    this.#stopLocale?.();
    this.#stopLocale = null;
    this.#release?.();
    this.#release = null;
    this.#registered = this.#register = null;
    this.#container = null;
    this.#playerTarget = null;
    super.disconnectedCallback();
  }

  /** Player lifecycle, not an application-facing media discovery API. @internal */
  setPlayerTarget(target: PlayerTarget | null): void {
    if (this.#playerTarget?.media !== target?.media) this.#stop();

    this.#playerTarget = target;
    this.requestUpdate();
  }

  protected override update(changed: PropertyValues): void {
    super.update(changed);

    if (!this.isConnected) return;

    if (this.#registered !== this.#register) {
      this.#release?.();
      this.#registered = this.#register;
      this.#release = this.#register?.(this.#extension) ?? null;
    }

    const root = this.getRootNode();
    if (!(root instanceof Document) && !(root instanceof ShadowRoot)) return;

    const media = this.for ? root.getElementById(this.for) : null;

    if (!isAdsMedia(media) || (this.#register && this.#playerTarget?.media !== media)) {
      this.#stop();

      if (!media) reportAdsError(this, 'missing_media_target', 'binding');

      return;
    }

    const container = this.#container ?? this.#playerTarget?.container ?? media.parentElement;

    if (!container || container === media || !containsComposed(container, media)) {
      this.#stop();
      return;
    }

    const key = JSON.stringify([this.videoId, this.src, this.for]);
    const source = media.src || media.currentSrc || '';
    const sessionChanged = this.#sessionKey !== key || this.#sessionMedia !== media || this.#contentSource !== source;

    if (sessionChanged || (this.runtime && this.#runtimeContainer !== container)) {
      const refreshPlayback =
        sessionChanged &&
        !!this.runtime?.mediaOverride &&
        this.#sessionMedia === media &&
        this.#contentSource === source;

      this.#stop();

      if (sessionChanged) this.#session = null;

      const bindingIsCurrent = () =>
        this.isConnected &&
        media.isConnected &&
        this.getRootNode() === root &&
        root.getElementById(this.for) === media &&
        (!this.#register || this.#playerTarget?.media === media) &&
        (this.#container ?? this.#playerTarget?.container ?? media.parentElement) === container &&
        containsComposed(container, media) &&
        source === (media.src || media.currentSrc || '');

      // The extension remains registered across ad configuration changes; refresh only the retained binding.
      if (refreshPlayback && bindingIsCurrent()) media.dispatchEvent(new Event('timeupdate'));

      // Cancel/refresh listeners can replace the binding synchronously. Never load or hold play from this snapshot.
      if (!bindingIsCurrent() || key !== JSON.stringify([this.videoId, this.src, this.for])) {
        // ReactiveElement ignores requestUpdate during update; retry only after this turn and while connected.
        if (this.isConnected)
          queueMicrotask(() => {
            if (this.isConnected) this.requestUpdate();
          });

        return;
      }

      this.#sessionKey = key;
      this.#sessionMedia = media;
      this.#contentSource = source;
    }

    if (this.runtime) {
      this.runtime.updateUI(this.#ui());
      return;
    }

    if (this.#fetch) return;

    if (this.#session) this.#attach(media, container);
    else void this.#load(media, container);
  }

  async #load(media: HTMLElement & AdsMedia, container: HTMLElement): Promise<void> {
    if (!this.videoId?.trim() || !isAdsUrl(this.src)) {
      reportAdsError(this, 'invalid_schedule_reference', 'schedule');
      return;
    }

    const generation = ++this.#generation;
    const request = new AbortController();
    const source = new AdsSourceLifecycle(media);

    this.#fetch = request;
    let intendedPlay = !media.paused;
    let ownPause = false;
    const hold = () => {
      intendedPlay = true;

      if (!media.paused) {
        ownPause = true;
        media.pause();
      }
    };
    const pause = () => {
      if (ownPause) ownPause = false;
      else intendedPlay = false;
    };
    const metadata = (event: Event) => source.observeMetadata(event);
    const playing = () => source.settle();
    const sourceChange = (event: Event) => {
      if (source.acceptInitial(event)) return;

      this.#session = null;
      this.#stop();
      this.requestUpdate();
    };

    media.addEventListener('play', hold);
    media.addEventListener('pause', pause);
    media.addEventListener('loadstart', sourceChange);
    media.addEventListener('emptied', sourceChange);
    media.addEventListener('loadedmetadata', metadata);
    media.addEventListener('durationchange', metadata);
    media.addEventListener('playing', playing);
    this.#loadingCleanup = () => {
      media.removeEventListener('play', hold);
      media.removeEventListener('pause', pause);
      media.removeEventListener('loadstart', sourceChange);
      media.removeEventListener('emptied', sourceChange);
      media.removeEventListener('loadedmetadata', metadata);
      media.removeEventListener('durationchange', metadata);
      media.removeEventListener('playing', playing);
    };

    if (intendedPlay) hold();

    const timeout = setTimeout(() => request.abort(), 5000);

    try {
      const response = await fetch(this.src, { credentials: 'same-origin', signal: request.signal });
      if (!response.ok) throw new Error('schedule_request_failed');

      const json: unknown = await response.json();

      if (generation !== this.#generation || !this.isConnected) return;

      const envelope = isPlainObject(json) && json.ok === true && isPlainObject(json.data) ? json.data : null;
      const parsed = parsePlaybackSchedule(envelope ? envelope.schedule : json);
      if (!parsed.ok || parsed.schedule.videoId !== this.videoId) throw new Error('invalid_schedule');

      const tracking = envelope ? parseTracking(envelope) : null;
      if (envelope && !tracking) throw new Error('invalid_tracking');

      this.#session = new AdsSession(parsed.schedule, tracking ?? undefined);
    } catch {
      if (generation === this.#generation && this.isConnected) reportAdsError(this, 'schedule_unavailable', 'schedule');
    } finally {
      clearTimeout(timeout);

      if (generation === this.#generation) {
        this.#fetch = null;
        this.#loadingCleanup?.();
        this.#loadingCleanup = null;

        if (this.#session && this.isConnected) this.#attach(media, container, source);

        if (
          intendedPlay &&
          this.isConnected &&
          media === this.#sessionMedia &&
          this.#contentSource === (media.src || media.currentSrc || '')
        ) {
          void media.play().catch(() => reportAdsError(this, 'content_play_rejected', 'resume'));
        }
      }
    }
  }

  #attach(media: HTMLElement & AdsMedia, container: HTMLElement, source?: AdsSourceLifecycle): void {
    if (!this.#session) return;

    this.#runtimeContainer = container;
    this.runtime = new AdsRuntime(
      {
        media,
        container,
        schedule: this.#session.scheduler.schedule,
        ui: this.#ui(),
        onEvent: (event) =>
          this.dispatchEvent(new CustomEvent('ads-event', { bubbles: true, composed: true, detail: event })),
      },
      this.#session,
      {
        source,
        onSourceChange: () => {
          this.#session = null;
          this.#stop();
          this.requestUpdate();
        },
      }
    );
  }

  #ui(): AdsUIOptions {
    const labels: Partial<AdsLabels> = {};

    if (this.skipLabel) labels.skip = this.skipLabel;

    if (this.skipCountdownLabel) labels.skipCountdown = this.skipCountdownLabel;

    if (this.timerLabel) labels.timer = this.timerLabel;

    if (this.mediaAlt) labels.mediaAlt = this.mediaAlt;

    return { locale: resolveAdsLocale(this), labels };
  }

  #stop(): void {
    this.#generation++;
    this.#fetch?.abort();
    this.#fetch = null;
    this.#loadingCleanup?.();
    this.#loadingCleanup = null;
    this.runtime?.destroy();
    this.runtime = null;
    this.#runtimeContainer = null;
  }
}
