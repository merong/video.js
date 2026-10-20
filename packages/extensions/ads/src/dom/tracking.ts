import { isPlainObject, isString } from '@videojs/utils/predicate';

import type { ObservedAdEvent } from '../core/events';
import { isAdsUrl } from '../core/url';

/** Transport metadata is never copied into a playback snapshot. @internal */
export interface AdsTracking {
  readonly playbackSessionId: string;
  readonly eventToken: string;
  readonly expiresAt: string;
  readonly eventsUrl: string;
}

/** @internal */
// eslint-disable-next-line anti-slop/no-unknown-parameters -- Parse the API envelope at the network boundary.
export function parseTracking(value: unknown): AdsTracking | null {
  if (!isPlainObject(value)) return null;

  const { playbackSessionId, eventToken, expiresAt, eventsUrl } = value;

  if (
    !isString(playbackSessionId) ||
    !playbackSessionId.trim() ||
    [...playbackSessionId].length > 128 ||
    !isString(eventToken) ||
    !eventToken ||
    eventToken.length > 4096 ||
    !isString(expiresAt) ||
    !Number.isFinite(Date.parse(expiresAt)) ||
    !isAdsUrl(eventsUrl)
  )
    return null;

  return Object.freeze({ playbackSessionId, eventToken, expiresAt, eventsUrl });
}

/** Bounded best-effort delivery: at most 100 waiting facts, 20 per request and three attempts per batch. @internal */
export class AdEventQueue {
  readonly #tracking: AdsTracking;
  #queue: ObservedAdEvent[] = [];
  #timer: ReturnType<typeof setTimeout> | undefined;
  #request: AbortController | null = null;
  #closed = false;
  #failures = 0;

  constructor(tracking: AdsTracking) {
    this.#tracking = tracking;
  }

  enqueue(event: ObservedAdEvent): void {
    if (this.#closed || this.#queue.length >= 100 || Date.now() >= Date.parse(this.#tracking.expiresAt)) return;

    this.#queue.push(event);
    this.#schedule(100);
  }

  destroy(flush = false): void {
    if (this.#closed) return;

    this.#closed = true;
    clearTimeout(this.#timer);
    this.#request?.abort();

    if (flush && this.#queue.length && Date.now() < Date.parse(this.#tracking.expiresAt)) {
      // One small final request includes the most recent terminal/cancel. No retries or owner callbacks survive teardown.
      void fetch(this.#tracking.eventsUrl, {
        method: 'POST',
        mode: 'same-origin',
        credentials: 'same-origin',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: this.#body(this.#queue.slice(-20)),
      }).catch(() => {});
    }

    this.#queue = [];
  }

  #schedule(delay: number): void {
    if (this.#closed || this.#timer || this.#request || !this.#queue.length) return;

    this.#timer = setTimeout(() => {
      this.#timer = undefined;
      void this.#send();
    }, delay);
  }

  async #send(): Promise<void> {
    if (Date.now() >= Date.parse(this.#tracking.expiresAt)) {
      this.destroy();
      return;
    }

    const batch = this.#queue.slice(0, 20);
    const abort = new AbortController();

    this.#request = abort;
    const timeout = setTimeout(() => abort.abort(), 5000);
    let retry = false;

    try {
      const response = await fetch(this.#tracking.eventsUrl, {
        method: 'POST',
        mode: 'same-origin',
        credentials: 'same-origin',
        signal: abort.signal,
        headers: { 'Content-Type': 'application/json' },
        body: this.#body(batch),
      });

      retry = response.status === 429 || response.status >= 500;
    } catch {
      retry = true;
    } finally {
      clearTimeout(timeout);
      this.#request = null;
    }

    if (this.#closed) return;

    if (retry && ++this.#failures < 3) {
      this.#schedule(500 * 2 ** this.#failures);
      return;
    }

    this.#queue.splice(0, batch.length);
    this.#failures = 0;
    this.#schedule(100);
  }

  #body(events: readonly ObservedAdEvent[]): string {
    return JSON.stringify({
      playbackSessionId: this.#tracking.playbackSessionId,
      eventToken: this.#tracking.eventToken,
      events,
    });
  }
}
