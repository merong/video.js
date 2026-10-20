import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import type { ObservedAdEvent } from '../../core/events';
import { AdEventQueue, parseTracking } from '../tracking';

const tracking = {
  playbackSessionId: 'session',
  eventToken: 'token',
  expiresAt: '2099-01-01T00:00:00Z',
  eventsUrl: '/events',
};

function event(id: string): ObservedAdEvent {
  return Object.freeze({
    schemaVersion: 1,
    eventId: id,
    playbackSessionId: 'session',
    breakAttemptId: 'break-attempt',
    adAttemptId: 'ad-attempt',
    breakId: 'pre-1',
    itemId: 'pre-image',
    adId: 'creative-image',
    creativeId: 'creative-image',
    creativeVersion: 1,
    scheduleId: 'schedule-site',
    scheduleVersion: 1,
    sequence: 1,
    occurredAt: '2026-10-18T00:00:00Z',
    contentTimeSeconds: 0,
    adElapsedSeconds: 0,
    type: 'start',
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('parseTracking', () => {
  it('accepts transport metadata separately and rejects unsafe collector or incomplete credentials', () => {
    expect(parseTracking(tracking)).toEqual(tracking);
    expect(parseTracking({ ...tracking, eventsUrl: '//collector.test/events' })).toBeNull();
    expect(parseTracking({ ...tracking, eventToken: '' })).toBeNull();
    expect(parseTracking({ ...tracking, expiresAt: 'not-a-date' })).toBeNull();
  });
});

describe('AdEventQueue', () => {
  it('retries the exact batch and IDs, then stops after success', async () => {
    vi.useFakeTimers();
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValue(new Response(null, { status: 204 }));

    vi.stubGlobal('fetch', fetch);
    const queue = new AdEventQueue(tracking);

    queue.enqueue(event('one'));
    await vi.advanceTimersByTimeAsync(2000);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0]![1].body).toBe(fetch.mock.calls[1]![1].body);
    expect(JSON.parse(fetch.mock.calls[1]![1].body).events[0].eventId).toBe('one');
    await vi.advanceTimersByTimeAsync(60000);
    expect(fetch).toHaveBeenCalledTimes(2);
    queue.destroy();
  });

  it('caps the waiting queue, batches and retries under persistent failure', async () => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockRejectedValue(new Error('offline'));

    vi.stubGlobal('fetch', fetch);
    const queue = new AdEventQueue(tracking);

    for (let index = 0; index < 105; index++) queue.enqueue(event(String(index)));

    await vi.advanceTimersByTimeAsync(60000);
    expect(fetch).toHaveBeenCalledTimes(15);
    const batches: ObservedAdEvent[][] = fetch.mock.calls.map((call) => JSON.parse(call[1].body).events);

    expect(batches.every((batch) => batch.length === 20)).toBe(true);
    expect(new Set(batches.flat().map((item) => item.eventId)).size).toBe(100);
    queue.destroy();
  });

  it('aborts a hung request after five seconds and stops all retries on destroy', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const fetch = vi.fn((_url: string, options: RequestInit) => {
      signal = options.signal ?? undefined;
      return new Promise<Response>((_resolve, reject) =>
        signal!.addEventListener('abort', () => reject(new Error('aborted')))
      );
    });

    vi.stubGlobal('fetch', fetch);
    const queue = new AdEventQueue(tracking);

    queue.enqueue(event('one'));
    await vi.advanceTimersByTimeAsync(5100);
    expect(signal?.aborted).toBe(true);
    queue.destroy();
    await vi.advanceTimersByTimeAsync(60000);
    expect(fetch).toHaveBeenCalledOnce();
  });
});
