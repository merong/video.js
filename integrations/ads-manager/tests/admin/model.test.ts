import { describe, expect, it } from 'vitest';

import schedule from '../../contract/playback-v1.json';
import { editorPayload, formatRate, makeItem, safeUrl, statsFilters } from '../../public/assets/admin/model.js';

// Shared contract fixture: isolated form validation, not server or media playback proof.
const draft = () => ({
  target: { type: 'site', id: 'site-local' },
  mode: 'replace',
  revision: 3,
  breaks: structuredClone(schedule.breaks),
});

describe('editorPayload', () => {
  it('preserves mixed pod order and media versions, normalizes cue order without changing the editor', () => {
    const input = draft();

    input.breaks.reverse();
    const payload = editorPayload(input);

    expect(payload.breaks.map((br) => br.breakId)).toEqual(['pre-1', 'mid-10', 'mid-20', 'post-1']);
    expect(payload.breaks[0].ads.map((ad) => ad.itemId)).toEqual(['pre-image', 'pre-video']);
    expect(payload.breaks[0].ads.map((ad) => ad.creativeVersion)).toEqual([1, 1]);
    expect(input.breaks[0].breakId).toBe('post-1');
  });

  it('keeps explicit disabled, inheritance and an empty direct schedule distinct', () => {
    expect(editorPayload({ ...draft(), mode: 'disabled' }).breaks).toEqual([]);
    expect(editorPayload({ ...draft(), target: { type: 'board', id: 'free' }, mode: 'inherit' }).mode).toBe('inherit');
    expect(() => editorPayload({ ...draft(), mode: 'inherit' })).toThrow('상속');
    expect(editorPayload({ ...draft(), breaks: [] })).toMatchObject({ mode: 'replace', breaks: [] });
  });

  it.each([
    [
      'zero skip',
      (input) => {
        input.breaks[0].ads[0].skipAfterSeconds = 0;
      },
    ],
    [
      'fractional skip',
      (input) => {
        input.breaks[0].ads[0].skipAfterSeconds = 1.5;
      },
    ],
    [
      'skip at image end',
      (input) => {
        input.breaks[0].ads[0].skipAfterSeconds = 5;
      },
    ],
    [
      'infinite image duration',
      (input) => {
        input.breaks[0].ads[0].displaySeconds = Infinity;
      },
    ],
    [
      'duplicate mid cue',
      (input) => {
        input.breaks[2].atSeconds = 10;
      },
    ],
    [
      'duplicate placement',
      (input) => {
        input.breaks[1].ads[0].itemId = 'pre-image';
      },
    ],
    [
      'empty pod',
      (input) => {
        input.breaks[0].ads = [];
      },
    ],
    [
      'unsafe click URL',
      (input) => {
        input.breaks[0].ads[0].clickUrl = 'javascript:alert(1)';
      },
    ],
  ])('rejects %s before submitting', (_, change) => {
    const input = draft();

    change(input);
    expect(() => editorPayload(input)).toThrow();
  });

  it('uses the creative identity for adId and never sends an image timer on a video', () => {
    const input = draft();

    input.breaks[0].ads[1].adId = 'unrelated';
    input.breaks[0].ads[1].displaySeconds = 10;
    const video = editorPayload(input).breaks[0].ads[1];

    expect(video.adId).toBe('creative-video');
    expect(video).not.toHaveProperty('displaySeconds');
  });
});

describe('safeUrl', () => {
  it.each([
    'javascript:alert(1)',
    '//other.test/a',
    '/\\other.test/a',
    'data:text/html,test',
    'https://a.test/\nfile',
    'https://user:password@example.test/a',
  ])('rejects unsafe reference %s', (value) => {
    expect(safeUrl(value)).toBe(false);
  });

  it.each(['/media/a.mp4', 'https://example.test/ad.webp?version=2', 'http://localhost/ad.webm'])(
    'accepts runtime URL %s',
    (value) => {
      expect(safeUrl(value)).toBe(true);
    }
  );
});

describe('makeItem', () => {
  it('gives image/GIF placements a display duration while leaving video completion media-driven', () => {
    const image = makeItem(
      { creativeId: 'gif', version: 2, kind: 'image', url: '/a.gif', mime: 'image/gif', alt: '광고' },
      'p1'
    );
    const video = makeItem(
      { creativeId: 'video', version: 1, kind: 'video', url: '/a.mp4', mime: 'video/mp4', alt: '' },
      'p2'
    );

    expect(image).toMatchObject({ adId: 'gif', creativeVersion: 2, displaySeconds: 5, skipAfterSeconds: null });
    expect(video).not.toHaveProperty('displaySeconds');
  });
});

describe('statsFilters', () => {
  it('carries identical inclusive date and identity values for query and CSV without empty filters', () => {
    expect(statsFilters({ from: '2026-10-01', to: '2026-10-18', adId: ' a ', videoId: '', boardId: 'free' })).toEqual({
      from: '2026-10-01',
      to: '2026-10-18',
      adId: 'a',
      boardId: 'free',
    });
  });

  it.each([
    ['2026-02-30', '2026-03-01'],
    ['2026-10-19', '2026-10-18'],
    ['', '2026-10-18'],
  ])('rejects invalid range %s to %s', (from, to) => {
    expect(() => statsFilters({ from, to })).toThrow();
  });
});

describe('formatRate', () => {
  it('formats API ratios and leaves undefined/no-start rates unavailable instead of zero', () => {
    expect(formatRate(0.125)).toBe('12.5%');
    expect(formatRate(0)).toBe('0%');

    for (const value of [null, undefined, NaN, Infinity, 1.2]) expect(formatRate(value)).toBe('—');
  });
});
