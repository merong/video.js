import { describe, expect, it } from 'vite-plus/test';

import {
  type AdItem,
  breakRank,
  type Creative,
  editorPayload,
  type EditorRecord,
  formatRate,
  makeItem,
  safeUrl,
  statsFilters,
  videoIdProblem,
} from '../src/api/model';
import { DEFAULT_PLAYER_PRESET, parsePlayerPreset } from '../src/player';

const video: Creative = {
  creativeId: 'cr-video',
  version: 2,
  name: '영상 광고',
  kind: 'video',
  url: '/media/ad.mp4',
  mime: 'video/mp4',
  alt: '',
  source: 'url',
  archived: false,
  createdAt: '2026-10-20T00:00:00Z',
};

const image: Creative = { ...video, creativeId: 'cr-image', kind: 'image', mime: 'image/png', url: '/media/ad.png' };

function record(breaks: EditorRecord['breaks'], mode: EditorRecord['mode'] = 'replace'): EditorRecord {
  return { target: { type: 'board', id: 'free' }, mode, revision: 3, breaks };
}

function item(creative: Creative, itemId: string, patch: Partial<AdItem> = {}): AdItem {
  return { ...makeItem(creative, itemId), ...patch };
}

describe('safeUrl', () => {
  it('accepts HTTP(S) URLs and root paths only', () => {
    expect(safeUrl('https://cdn.example/ad.mp4')).toBe(true);
    expect(safeUrl('/media/ad.mp4')).toBe(true);
    expect(safeUrl('//cdn.example/ad.mp4')).toBe(false);
    expect(safeUrl('javascript:alert(1)')).toBe(false);
    expect(safeUrl('https://user:pass@cdn.example/')).toBe(false);
    expect(safeUrl('/media/a b.mp4')).toBe(false);
    expect(safeUrl(42)).toBe(false);
  });
});

describe('makeItem', () => {
  it('pins the creative version and gives images a display time', () => {
    expect(makeItem(video, 'item-1')).toMatchObject({ adId: 'cr-video', creativeVersion: 2, skipAfterSeconds: null });
    expect(makeItem(video, 'item-1')).not.toHaveProperty('displaySeconds');
    expect(makeItem(image, 'item-2').displaySeconds).toBe(3);
  });
});

describe('editorPayload', () => {
  it('sorts breaks chronologically and drops positions that do not apply', () => {
    const payload = editorPayload(
      record([
        { breakId: 'post', position: 'post', atSeconds: 9, ads: [item(video, 'a')] },
        { breakId: 'mid-30', position: 'mid', atSeconds: 30, ads: [item(video, 'b')] },
        { breakId: 'pre', position: 'pre', ads: [item(video, 'c', { displaySeconds: 4 })] },
        { breakId: 'mid-10', position: 'mid', atSeconds: 10, ads: [item(image, 'd')] },
      ])
    );

    expect(payload.breaks.map((br) => br.breakId)).toEqual(['pre', 'mid-10', 'mid-30', 'post']);
    expect(payload.breaks[3]).not.toHaveProperty('atSeconds');
    expect(payload.breaks[0]!.ads[0]).not.toHaveProperty('displaySeconds');
  });

  it('keeps a random break and leaves out the default rotation', () => {
    const payload = editorPayload(
      record([
        { breakId: 'pre', position: 'pre', rotation: 'random', ads: [item(image, 'a'), item(image, 'b')] },
        { breakId: 'post', position: 'post', rotation: 'none', ads: [item(video, 'c'), item(video, 'd')] },
      ])
    );

    expect(payload.breaks[0]).toHaveProperty('rotation', 'random');
    expect(payload.breaks[1]).not.toHaveProperty('rotation');
  });

  it('clears breaks unless the mode replaces the schedule', () => {
    expect(editorPayload(record([{ breakId: 'pre', position: 'pre', ads: [] }], 'disabled')).breaks).toEqual([]);
  });

  it('does not change the editor record', () => {
    const input = record([{ breakId: 'post', position: 'post', ads: [item(video, 'a')] }]);
    const before = structuredClone(input);

    editorPayload(input);
    expect(input).toEqual(before);
  });

  it.each<[string, EditorRecord]>([
    ['site inherit', { target: { type: 'site', id: 'site' }, mode: 'inherit', revision: 0, breaks: [] }],
    ['category without board', { target: { type: 'category', id: 'c1' }, mode: 'disabled', revision: 0, breaks: [] }],
    ['empty break', record([{ breakId: 'pre', position: 'pre', ads: [] }])],
    [
      'mid without position',
      record([{ breakId: 'mid', position: 'mid', atSeconds: Number.NaN, ads: [item(video, 'a')] }]),
    ],
    [
      'duplicate mid position',
      record([
        { breakId: 'm1', position: 'mid', atSeconds: 10, ads: [item(video, 'a')] },
        { breakId: 'm2', position: 'mid', atSeconds: 10, ads: [item(video, 'b')] },
      ]),
    ],
    [
      'duplicate item ID',
      record([
        { breakId: 'pre', position: 'pre', ads: [item(video, 'a')] },
        { breakId: 'post', position: 'post', ads: [item(video, 'a')] },
      ]),
    ],
    [
      'unsafe click URL',
      record([{ breakId: 'pre', position: 'pre', ads: [item(video, 'a', { clickUrl: 'javascript:x' })] }]),
    ],
    [
      'fractional skip',
      record([{ breakId: 'pre', position: 'pre', ads: [item(video, 'a', { skipAfterSeconds: 1.5 })] }]),
    ],
    [
      'image skip not shorter than display',
      record([{ breakId: 'pre', position: 'pre', ads: [item(image, 'a', { skipAfterSeconds: 5 })] }]),
    ],
    [
      'random break with one ad',
      record([{ breakId: 'pre', position: 'pre', rotation: 'random', ads: [item(image, 'a')] }]),
    ],
  ])('rejects %s', (_name, input) => {
    expect(() => editorPayload(input)).toThrow(Error);
  });
});

describe('breakRank', () => {
  it('orders pre, mid by time, then post; an unfinished mid sorts first among mids', () => {
    expect(breakRank({ breakId: 'a', position: 'pre', ads: [] })).toBe(-1);
    expect(breakRank({ breakId: 'b', position: 'mid', atSeconds: Number.NaN, ads: [] })).toBe(0);
    expect(breakRank({ breakId: 'c', position: 'mid', atSeconds: 12, ads: [] })).toBe(12);
    expect(breakRank({ breakId: 'd', position: 'post', ads: [] })).toBe(Infinity);
  });
});

describe('statsFilters', () => {
  it('keeps trimmed optional filters', () => {
    expect(statsFilters({ from: '2026-10-01', to: '2026-10-20', adId: ' cr-1 ', videoId: '', boardId: '  ' })).toEqual({
      from: '2026-10-01',
      to: '2026-10-20',
      adId: 'cr-1',
    });
  });

  it('rejects impossible or reversed dates', () => {
    const ids = { adId: '', videoId: '', boardId: '' };

    expect(() => statsFilters({ ...ids, from: '2026-02-30', to: '2026-03-01' })).toThrow();
    expect(() => statsFilters({ ...ids, from: '2026-10-20', to: '2026-10-01' })).toThrow();
  });
});

describe('formatRate', () => {
  it('formats ratios as percentages and hides missing values', () => {
    expect(formatRate(0.1234)).toBe('12.3%');
    expect(formatRate(null)).toBe('—');
    expect(formatRate(1.5)).toBe('—');
  });
});

describe('videoIdProblem', () => {
  it.each([
    ['a plain ID', 'vid-1'],
    ['a gnuboard ID', 'free:12:main'],
    ['128 characters', '가'.repeat(128)],
    ['128 astral characters', '😀'.repeat(128)],
    ['inner spaces', 'my video 1'],
    // Out of contract 4.1: direction marks and zero-width characters stay allowed.
    ['LRM U+200E', 'vid\u200e1'],
    ['ALM U+061C', 'vid\u061c1'],
    ['ZWSP U+200B', 'vid\u200b1'],
  ])('accepts %s', (_name, value) => {
    expect(videoIdProblem(value)).toBeNull();
  });

  it.each([
    ['RLO U+202E', '\u202evid-1', /제어 문자/u],
    ['LRI U+2066', '\u2066vid-1\u2069', /제어 문자/u],
    ['C1 NEL U+0085', 'vid\u00851', /제어 문자/u],
    ['NUL', 'vid\u00001', /제어 문자/u],
    ['129 characters', 'a'.repeat(129), /128자 이내/u],
    ['only ideographic spaces', '\u3000\u3000', /입력해 주세요/u],
    ['only a BOM', '\ufeff', /입력해 주세요/u],
    ['empty', '', /입력해 주세요/u],
  ])('refuses %s like Value::videoId', (_name, value, message) => {
    expect(videoIdProblem(value)).toMatch(message);
  });

  it('refuses the same control characters as the preset label rule', () => {
    const codePoints = [
      ...Array.from({ length: 0x100 }, (_, index) => index),
      ...Array.from({ length: 0x70 }, (_, index) => 0x2000 + index),
    ];
    const differing = codePoints.filter((codePoint) => {
      const value = `a${String.fromCodePoint(codePoint)}b`;
      const result = parsePlayerPreset({ ...DEFAULT_PLAYER_PRESET, name: value });
      const presetControl =
        !result.ok && result.errors.some((error) => error.path === 'name' && error.code === 'control');

      return presetControl !== (videoIdProblem(value) !== null);
    });

    expect(differing).toEqual([]);
  });
});
