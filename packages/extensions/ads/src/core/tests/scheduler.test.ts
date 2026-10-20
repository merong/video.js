import { describe, expect, it } from 'vite-plus/test';

import { AdsScheduler, type ScheduledAd } from '../scheduler';
import { loadPlaybackFixture } from './fixture';

function start(scheduler: AdsScheduler, breakId: string): ScheduledAd {
  const attempt = scheduler.startBreak(breakId);

  expect(attempt?.break.breakId).toBe(breakId);

  if (!attempt) throw new Error(`Expected ${breakId} to start.`);

  return attempt;
}

describe('AdsScheduler', () => {
  it('discards an unstarted postroll reservation when initial play restarts from the beginning', () => {
    const scheduler = new AdsScheduler(loadPlaybackFixture());

    scheduler.observe({ type: 'seek', currentTime: 100, ended: true });
    expect(scheduler.observe({ type: 'play', currentTime: 0 })?.breakId).toBe('pre-1');
    scheduler.finishAd(start(scheduler, 'pre-1'), 'complete', 5);
    scheduler.finishAd(scheduler.active!, 'complete', 4);
    expect(scheduler.pending).toBeNull();
    expect(scheduler.isConsumed('post-1')).toBe(false);
  });

  it('prioritizes the first preroll over a reservation made by an initial seek', () => {
    const scheduler = new AdsScheduler(loadPlaybackFixture());

    expect(scheduler.observe({ type: 'seek', currentTime: 25 })?.breakId).toBe('mid-10');
    expect(scheduler.observe({ type: 'play', currentTime: 25 })?.breakId).toBe('pre-1');
    expect(start(scheduler, 'pre-1').ad.itemId).toBe('pre-image');
    expect(scheduler.isConsumed('mid-10')).toBe(false);
  });

  it('narrows a same-time progress reservation when a settled seek follows it', () => {
    const scheduler = new AdsScheduler(loadPlaybackFixture());

    scheduler.observe({ type: 'progress', currentTime: 25 });
    scheduler.observe({ type: 'seek', currentTime: 25 });
    scheduler.finishAd(start(scheduler, 'mid-10'), 'complete', 3);
    expect(scheduler.pending).toBeNull();
  });
  it('waits for play, then skips only the current ad and rejects stale completion', () => {
    const fixture = loadPlaybackFixture();
    const scheduler = new AdsScheduler({
      ...fixture,
      breaks: [{ ...fixture.breaks[0]!, ads: fixture.breaks[0]!.ads.map((ad) => ({ ...ad, skipAfterSeconds: 2 })) }],
    });

    expect(scheduler.pending).toBeNull();
    expect(scheduler.observe({ type: 'progress', currentTime: 0 })).toBeNull();
    expect(scheduler.observe({ type: 'play', currentTime: 0 })?.breakId).toBe('pre-1');
    expect(scheduler.isConsumed('pre-1')).toBe(false);

    const first = start(scheduler, 'pre-1');

    expect(first.ad.itemId).toBe('pre-image');
    expect(scheduler.isConsumed('pre-1')).toBe(true);
    expect(scheduler.startBreak('pre-1')).toBeNull();
    expect(scheduler.finishAd(first, 'skip', 1.999)).toBe(false);
    expect(scheduler.finishAd(first, 'skip', 2)).toBe(true);

    const second = scheduler.active!;

    expect(second.ad.itemId).toBe('pre-video');
    expect(scheduler.finishAd(first, 'complete', 5)).toBe(false);
    expect(scheduler.finishAd(second, 'skip', 0)).toBe(false);
    expect(scheduler.finishAd(second, 'skip', 2)).toBe(true);
    expect(scheduler.active).toBeNull();
    expect(scheduler.observe({ type: 'play', currentTime: 0 })).toBeNull();
  });

  it('completes images only on display elapsed and never skips non-skippable video', () => {
    const scheduler = new AdsScheduler(loadPlaybackFixture());

    scheduler.observe({ type: 'play', currentTime: 0 });
    const image = start(scheduler, 'pre-1');

    expect(scheduler.finishAd(image, 'complete', 4.999)).toBe(false);
    expect(scheduler.finishAd(image, 'complete', 5)).toBe(true);

    const video = scheduler.active!;

    expect(scheduler.finishAd(video, 'skip', 3600)).toBe(false);
    expect(scheduler.finishAd(video, 'error', 0)).toBe(true);
    expect(scheduler.active).toBeNull();
    expect(scheduler.isConsumed('pre-1')).toBe(true);
  });

  it('selects one earliest crossed midroll per forward seek without duplicate or deferred backlog', () => {
    const scheduler = new AdsScheduler(loadPlaybackFixture());

    expect(scheduler.observe({ type: 'seek', currentTime: 25 })?.breakId).toBe('mid-10');
    expect(scheduler.observe({ type: 'seek', currentTime: 25 })?.breakId).toBe('mid-10');
    const first = start(scheduler, 'mid-10');

    expect(scheduler.observe({ type: 'progress', currentTime: 25 })).toBeNull();
    expect(scheduler.finishAd(first, 'skip', 1)).toBe(true);
    expect(scheduler.pending).toBeNull();
    expect(scheduler.observe({ type: 'seek', currentTime: 25 })).toBeNull();
    expect(scheduler.observe({ type: 'progress', currentTime: 26 })).toBeNull();
    expect(scheduler.isConsumed('mid-20')).toBe(false);

    expect(scheduler.observe({ type: 'seek', currentTime: 0 })).toBeNull();
    expect(scheduler.observe({ type: 'progress', currentTime: 15 })).toBeNull();
    expect(scheduler.observe({ type: 'seek', currentTime: 20 })?.breakId).toBe('mid-20');
    const second = start(scheduler, 'mid-20');

    scheduler.finishAd(second, 'error', 0);
    scheduler.observe({ type: 'seek', currentTime: 0 });
    expect(scheduler.observe({ type: 'seek', currentTime: 25 })).toBeNull();
  });

  it('uses chronological order for multiple naturally crossed cues', () => {
    const fixture = loadPlaybackFixture();
    const scheduler = new AdsScheduler({ ...fixture, breaks: [...fixture.breaks].reverse() });

    expect(scheduler.observe({ type: 'progress', currentTime: 25 })?.breakId).toBe('mid-10');
    expect(scheduler.startBreak('mid-20')).toBeNull();
    scheduler.finishAd(start(scheduler, 'mid-10'), 'complete', 3);
    expect(scheduler.pending?.breakId).toBe('mid-20');
    scheduler.finishAd(start(scheduler, 'mid-20'), 'complete', 0.5);
    expect(scheduler.pending).toBeNull();
    expect(scheduler.observe({ type: 'progress', currentTime: 25 })).toBeNull();
  });

  it('does not consume a canceled reservation and clears it on backward seek', () => {
    const scheduler = new AdsScheduler(loadPlaybackFixture());

    scheduler.observe({ type: 'seek', currentTime: 15 });
    scheduler.cancel();
    expect(scheduler.isConsumed('mid-10')).toBe(false);
    expect(scheduler.startBreak('mid-10')).toBeNull();
    expect(scheduler.observe({ type: 'seek', currentTime: 0 })).toBeNull();
    expect(scheduler.observe({ type: 'seek', currentTime: 10 })?.breakId).toBe('mid-10');
    expect(scheduler.observe({ type: 'seek', currentTime: 5 })).toBeNull();
    expect(scheduler.pending).toBeNull();
    expect(scheduler.observe({ type: 'seek', currentTime: 10 })?.breakId).toBe('mid-10');
  });

  it.each(['complete', 'skip', 'error', 'cancel'] as const)(
    'preserves consumed history after %s until a new session',
    (result) => {
      const fixture = loadPlaybackFixture();
      const scheduler = new AdsScheduler(fixture);

      scheduler.observe({ type: 'seek', currentTime: 10 });
      const attempt = start(scheduler, 'mid-10');

      if (result === 'cancel') scheduler.cancel();
      else expect(scheduler.finishAd(attempt, result, 3)).toBe(true);

      scheduler.observe({ type: 'play', currentTime: 0 });
      scheduler.cancel();
      expect(scheduler.observe({ type: 'seek', currentTime: 10 })).toBeNull();
      expect(scheduler.isConsumed('mid-10')).toBe(true);
      const nextSession = new AdsScheduler(fixture);

      expect(nextSession.observe({ type: 'seek', currentTime: 10 })?.breakId).toBe('mid-10');
      expect(scheduler.finishAd(attempt, 'complete', 3)).toBe(false);
    }
  );

  it.each(['seek', 'progress', 'ended'] as const)(
    'prioritizes actual ended over %s compensation and keeps replay history',
    (type) => {
      const scheduler = new AdsScheduler(loadPlaybackFixture());

      scheduler.observe({ type: 'seek', currentTime: 25 });
      expect(scheduler.observe({ type, currentTime: 100, ended: true })?.breakId).toBe('post-1');
      expect(scheduler.isConsumed('mid-10')).toBe(false);
      const post = start(scheduler, 'post-1');

      expect(scheduler.pending).toBeNull();
      expect(scheduler.observe({ type: 'play', currentTime: 0 })).toBeNull();
      expect(scheduler.active).toBe(post);
      expect(scheduler.finishAd(post, 'complete', 2)).toBe(true);
      expect(scheduler.observe({ type: 'ended', currentTime: 100 })).toBeNull();
      expect(scheduler.pending).toBeNull();

      scheduler.observe({ type: 'play', currentTime: 0 });
      scheduler.cancel();
      expect(scheduler.observe({ type: 'progress', currentTime: 10 })?.breakId).toBe('mid-10');
    }
  );

  it('discards missed-midroll compensation at ended even without a postroll', () => {
    const fixture = loadPlaybackFixture();
    const scheduler = new AdsScheduler({
      ...fixture,
      breaks: fixture.breaks.filter((item) => item.position === 'mid'),
    });

    scheduler.observe({ type: 'seek', currentTime: 25 });
    expect(scheduler.observe({ type: 'ended', currentTime: 100 })).toBeNull();
    expect(scheduler.startBreak('mid-10')).toBeNull();
  });

  it('invalidates late metadata without moving cues or losing already consumed history', () => {
    const scheduler = new AdsScheduler(loadPlaybackFixture());

    expect(scheduler.setDuration(NaN)).toEqual([]);
    scheduler.observe({ type: 'play', currentTime: 0 });
    start(scheduler, 'pre-1');
    expect(scheduler.setDuration(20)).toMatchObject([{ path: 'breaks[2].atSeconds' }]);
    expect(scheduler.active).toBeNull();
    expect(scheduler.observe({ type: 'seek', currentTime: 10 })).toBeNull();
    expect(scheduler.isConsumed('pre-1')).toBe(true);
    expect(scheduler.schedule.breaks[2]).toMatchObject({ atSeconds: 20 });
    expect(scheduler.setDuration(undefined)).toMatchObject([{ path: 'breaks[2].atSeconds' }]);
    expect(scheduler.setDuration(100)).toEqual([]);
    scheduler.observe({ type: 'seek', currentTime: 0 });
    expect(scheduler.observe({ type: 'seek', currentTime: 10 })?.breakId).toBe('mid-10');
  });

  it.each([-1, NaN, Infinity])('rejects invalid content and ad elapsed time %s without advancing', (time) => {
    const scheduler = new AdsScheduler(loadPlaybackFixture());

    expect(() => scheduler.observe({ type: 'seek', currentTime: time })).toThrow(RangeError);
    scheduler.observe({ type: 'play', currentTime: 0 });
    const ad = start(scheduler, 'pre-1');

    expect(scheduler.finishAd(ad, 'error', time)).toBe(false);
    expect(scheduler.active).toBe(ad);
  });
});
