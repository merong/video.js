import { describe, expect, it } from 'vite-plus/test';

import { parsePlaybackSchedule, validateScheduleDuration } from '../playback';
import { loadPlaybackFixture } from './fixture';

describe('parsePlaybackSchedule', () => {
  it('accepts the shared wire fixture, orders breaks and preserves mixed pod order', () => {
    const input = loadPlaybackFixture();
    const result = parsePlaybackSchedule({ ...input, breaks: [...input.breaks].reverse() });

    expect(result.ok).toBe(true);

    if (!result.ok) return;

    expect(result.schedule.breaks.map((item) => item.breakId)).toEqual(['pre-1', 'mid-10', 'mid-20', 'post-1']);
    expect(result.schedule.breaks[0]?.ads.map((ad) => [ad.itemId, ad.kind])).toEqual([
      ['pre-image', 'image'],
      ['pre-video', 'video'],
    ]);
    expect(result.schedule.breaks[1]?.ads[0]).toMatchObject({ kind: 'image', mime: 'image/gif', displaySeconds: 3 });
    expect(result.schedule.breaks[2]?.ads[0]).toMatchObject({ kind: 'video', mime: 'video/webm' });
  });

  it('detaches and freezes session data and excludes transport metadata', () => {
    const fixture = loadPlaybackFixture();
    const ad = { ...fixture.breaks[0]!.ads[0]! };
    const ads = [ad];
    const input = { ...fixture, eventToken: 'transport-only', breaks: [{ ...fixture.breaks[0]!, ads }] };
    const result = parsePlaybackSchedule(input);

    expect(result.ok).toBe(true);

    if (!result.ok) return;

    ad.url = '/replaced.png';
    ads.pop();
    input.breaks.pop();
    expect(result.schedule.breaks[0]?.ads[0]?.url).toBe('https://example.test/ad.png');
    expect(result.schedule).not.toHaveProperty('eventToken');
    expect(Reflect.set(result.schedule.breaks[0]!.ads[0]!, 'url', '/mutated.png')).toBe(false);
    expect(Reflect.set(result.schedule.breaks[0]!.ads, 'length', 0)).toBe(false);
    expect(Reflect.set(result.schedule.breaks[0]!, 'breakId', 'replacement')).toBe(false);
    expect(Reflect.set(result.schedule.breaks, 'length', 0)).toBe(false);
    expect(Reflect.set(result.schedule, 'scheduleVersion', 2)).toBe(false);
  });

  it('accepts an explicitly disabled empty schedule and nullable context', () => {
    const result = parsePlaybackSchedule({ ...loadPlaybackFixture(), boardId: null, categoryId: null, breaks: [] });

    expect(result).toMatchObject({ ok: true, schedule: { breaks: [], boardId: null, categoryId: null } });
  });

  it.each([
    ['schemaVersion', 2],
    ['siteId', ''],
    ['videoId', '   '],
    ['scheduleId', 'x'.repeat(129)],
    ['boardId', undefined],
    ['categoryId', 1],
    ['scheduleVersion', 0],
    ['scheduleVersion', 1.5],
    ['scheduleVersion', Infinity],
    ['breaks', null],
  ])('rejects invalid schedule field %s = %s', (field, value) => {
    const result = parsePlaybackSchedule({ ...loadPlaybackFixture(), [field]: value });

    expect(result).toMatchObject({ ok: false, issues: [{ code: 'invalid_schedule', path: field }] });
  });

  it.each([null, [], 'schedule', 1])('rejects non-object input %s without throwing', (value) => {
    expect(parsePlaybackSchedule(value)).toMatchObject({ ok: false, issues: [{ path: 'schedule' }] });
  });

  it.each([
    [{ breakId: '' }, 'breakId'],
    [{ position: 'unknown' }, 'position'],
    [{ atSeconds: 0 }, 'atSeconds'],
    [{ atSeconds: -1 }, 'atSeconds'],
    [{ atSeconds: NaN }, 'atSeconds'],
    [{ atSeconds: Infinity }, 'atSeconds'],
    [{ atSeconds: '10' }, 'atSeconds'],
    [{ ads: [] }, 'ads'],
  ])('rejects invalid break fields %j', (fields, path) => {
    const fixture = loadPlaybackFixture();
    const result = parsePlaybackSchedule({ ...fixture, breaks: [{ ...fixture.breaks[1]!, ...fields }] });

    expect(result).toMatchObject({ ok: false, issues: [{ path: `breaks[0].${path}` }] });
  });

  it.each(['pre', 'post'])('rejects a content cue on a %s break', (position) => {
    const fixture = loadPlaybackFixture();

    expect(parsePlaybackSchedule({ ...fixture, breaks: [{ ...fixture.breaks[1]!, position }] })).toMatchObject({
      ok: false,
      issues: [{ path: 'breaks[0].atSeconds' }],
    });
  });

  it.each([
    [{ breakId: 'mid-10' }, 'breakId'],
    [{ atSeconds: 10 }, 'atSeconds'],
  ])('rejects duplicate midroll identity or cue %j', (fields, path) => {
    const fixture = loadPlaybackFixture();

    expect(
      parsePlaybackSchedule({ ...fixture, breaks: [fixture.breaks[1], { ...fixture.breaks[2]!, ...fields }] })
    ).toMatchObject({ ok: false, issues: [{ path: `breaks[1].${path}` }] });
  });

  it.each(['pre', 'post'])('rejects a second %s break with distinct IDs', (position) => {
    const fixture = loadPlaybackFixture();
    const ad = fixture.breaks[0]!.ads[0]!;

    expect(
      parsePlaybackSchedule({
        ...fixture,
        breaks: [
          { breakId: 'a', position, ads: [ad] },
          { breakId: 'b', position, ads: [{ ...ad, itemId: 'other' }] },
        ],
      })
    ).toMatchObject({ ok: false, issues: [{ path: 'breaks[1].position' }] });
  });

  it('rejects reused item IDs across different pods even for the same creative', () => {
    const fixture = loadPlaybackFixture();
    const breaks = fixture.breaks.map((item) =>
      item.position === 'post' ? { ...item, ads: [{ ...item.ads[0]!, itemId: 'pre-image' }] } : item
    );

    expect(parsePlaybackSchedule({ ...fixture, breaks })).toMatchObject({
      ok: false,
      issues: [{ path: 'breaks[3].ads[0].itemId' }],
    });
  });

  it('enforces break and pod limits without confusing them with duplicate IDs', () => {
    const fixture = loadPlaybackFixture();
    const ad = fixture.breaks[0]!.ads[0]!;
    const breaks = Array.from({ length: 100 }, (_, i) => ({
      breakId: `break-${i}`,
      position: 'mid',
      atSeconds: i + 1,
      ads: [{ ...ad, itemId: `item-${i}` }],
    }));

    expect(parsePlaybackSchedule({ ...fixture, breaks }).ok).toBe(true);
    expect(parsePlaybackSchedule({ ...fixture, breaks: [...breaks, breaks[0]] })).toMatchObject({
      ok: false,
      issues: [{ path: 'breaks' }],
    });

    const ads = Array.from({ length: 20 }, (_, i) => ({ ...ad, itemId: `item-${i}` }));

    expect(parsePlaybackSchedule({ ...fixture, breaks: [{ ...fixture.breaks[0]!, ads }] }).ok).toBe(true);
    expect(parsePlaybackSchedule({ ...fixture, breaks: [{ ...fixture.breaks[0]!, ads: [...ads, ad] }] })).toMatchObject(
      { ok: false, issues: [{ path: 'breaks[0].ads' }] }
    );
  });

  it.each([
    [{ itemId: '' }, 'itemId'],
    [{ adId: 'other-ad' }, 'adId'],
    [{ creativeId: '' }, 'creativeId'],
    [{ creativeVersion: 0 }, 'creativeVersion'],
    [{ creativeVersion: 1.5 }, 'creativeVersion'],
    [{ kind: 'html' }, 'kind'],
    [{ mime: 'video/mp4' }, 'mime'],
    [{ mime: 'image/svg+xml' }, 'mime'],
    [{ alt: null }, 'alt'],
    [{ skipAfterSeconds: 0 }, 'skipAfterSeconds'],
    [{ skipAfterSeconds: 1.5 }, 'skipAfterSeconds'],
    [{ skipAfterSeconds: 3601 }, 'skipAfterSeconds'],
    [{ skipAfterSeconds: 5 }, 'skipAfterSeconds'],
    [{ skipAfterSeconds: undefined }, 'skipAfterSeconds'],
    [{ displaySeconds: 0 }, 'displaySeconds'],
    [{ displaySeconds: -1 }, 'displaySeconds'],
    [{ displaySeconds: 3601 }, 'displaySeconds'],
    [{ displaySeconds: NaN }, 'displaySeconds'],
    [{ displaySeconds: Infinity }, 'displaySeconds'],
    [{ displaySeconds: undefined }, 'displaySeconds'],
  ])('rejects invalid ad fields %j', (fields, path) => {
    const fixture = loadPlaybackFixture();
    const ad = { ...fixture.breaks[0]!.ads[0]!, ...fields };
    const result = parsePlaybackSchedule({ ...fixture, breaks: [{ ...fixture.breaks[0]!, ads: [ad] }] });

    expect(result).toMatchObject({ ok: false, issues: [{ path: `breaks[0].ads[0].${path}` }] });
  });

  it.each(['url', 'clickUrl'])('rejects unsafe or non-absolute references in %s', (field) => {
    const fixture = loadPlaybackFixture();

    for (const url of [
      '//other.test/ad',
      'javascript:alert(1)',
      'data:image/png;base64,a',
      'ad.png',
      '',
      'https://',
      '/\\other.test/ad',
      'https://example.test/\nad.png',
      ' https://example.test/ad',
      '/ad\u007f.png',
    ]) {
      const ad = { ...fixture.breaks[0]!.ads[0]!, [field]: url };

      expect(parsePlaybackSchedule({ ...fixture, breaks: [{ ...fixture.breaks[0]!, ads: [ad] }] }), url).toMatchObject({
        ok: false,
        issues: [{ path: `breaks[0].ads[0].${field}` }],
      });
    }
  });

  it.each(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])(
    'accepts %s with explicit fractional display time',
    (mime) => {
      const fixture = loadPlaybackFixture();
      const ad = { ...fixture.breaks[0]!.ads[0]!, mime, url: '/media/ad', displaySeconds: 0.5, skipAfterSeconds: null };

      expect(parsePlaybackSchedule({ ...fixture, breaks: [{ ...fixture.breaks[0]!, ads: [ad] }] }).ok).toBe(true);
    }
  );

  it('accepts video without duration but rejects image timing and MIME on video', () => {
    const fixture = loadPlaybackFixture();
    const ad = { ...fixture.breaks[0]!.ads[1]!, alt: '', url: 'http://example.test/video', skipAfterSeconds: 3600 };
    const parse = (fields: { displaySeconds?: number; mime?: string }) =>
      parsePlaybackSchedule({ ...fixture, breaks: [{ ...fixture.breaks[0]!, ads: [{ ...ad, ...fields }] }] });

    expect(parse({}).ok).toBe(true);
    expect(parse({ displaySeconds: 5 })).toMatchObject({
      ok: false,
      issues: [{ path: 'breaks[0].ads[0].displaySeconds' }],
    });
    expect(parse({ mime: 'image/gif' })).toMatchObject({ ok: false, issues: [{ path: 'breaks[0].ads[0].mime' }] });
  });
});

describe('validateScheduleDuration', () => {
  it.each([null, undefined, NaN, Infinity])('defers unknown duration %s', (duration) => {
    expect(validateScheduleDuration(loadPlaybackFixture(), duration)).toEqual([]);
  });

  it('rejects cues at and beyond finite duration without clamping the snapshot', () => {
    const schedule = loadPlaybackFixture();

    expect(validateScheduleDuration(schedule, 10)).toMatchObject([
      { code: 'invalid_duration', path: 'breaks[1].atSeconds' },
      { code: 'invalid_duration', path: 'breaks[2].atSeconds' },
    ]);
    expect(schedule.breaks[1]).toMatchObject({ atSeconds: 10 });
    expect(schedule.breaks[2]).toMatchObject({ atSeconds: 20 });
    expect(validateScheduleDuration(schedule, 20.01)).toEqual([]);
  });

  it('reports a negative duration as invalid metadata', () => {
    expect(validateScheduleDuration(loadPlaybackFixture(), -1)).toMatchObject([
      { code: 'invalid_duration', path: 'duration' },
    ]);
  });
});
