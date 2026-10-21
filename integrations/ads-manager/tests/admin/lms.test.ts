import { describe, expect, it } from 'vitest';

import {
  addSegment,
  mergeSegments,
  parseVtt,
  percentOf,
  progressDetail,
  rateSteps,
  readManifest,
  resumeTime,
  stepRate,
} from '../../public/player/lms.js';

describe('mergeSegments', () => {
  it('sorts, joins overlaps and gaps under 0.5 seconds, and drops invalid parts', () => {
    expect(
      mergeSegments([
        [10, 20],
        [0, 5],
        [5.3, 8],
        [19, 25],
        [30, 30],
        [Number.NaN, 2],
      ])
    ).toEqual([
      [0, 8],
      [10, 25],
    ]);
  });

  it('keeps a gap of 0.5 seconds or more apart', () => {
    expect(addSegment([[0, 5]], 5.6, 7)).toEqual([
      [0, 5],
      [5.6, 7],
    ]);
  });
});

describe('percentOf', () => {
  it('rounds down and caps at 100', () => {
    expect(percentOf([[0, 71.9]], 80)).toBe(89);
    expect(percentOf([[0, 80]], 80)).toBe(100);
    expect(percentOf([[0, 10]], 0)).toBe(0);
  });
});

describe('stepRate', () => {
  it('lists rates up to the cap', () => {
    expect(rateSteps(1.5)).toEqual([0.2, 0.5, 0.7, 1, 1.2, 1.5]);
  });

  it('stops at both ends instead of wrapping', () => {
    expect(stepRate(1.2, 1, 1.5)).toBe(1.5);
    expect(stepRate(1.5, 1, 1.5)).toBe(1.5);
    expect(stepRate(0.2, -1, 2)).toBe(0.2);
  });

  it('moves a rate outside the list to its neighbour', () => {
    expect(stepRate(1.1, 1, 2)).toBe(1.2);
    expect(stepRate(1.1, -1, 2)).toBe(1);
    expect(stepRate(1.75, 1, 1.5)).toBe(1.5);
  });
});

describe('resumeTime', () => {
  it('resumes from 5 seconds until 10 seconds before the end', () => {
    expect(resumeTime(4, 80)).toBeNull();
    expect(resumeTime(30, 80)).toBe(30);
    expect(resumeTime(70, 80)).toBeNull();
  });
});

describe('readManifest', () => {
  it('keeps valid items and counts the dropped ones', () => {
    const manifest = readManifest({
      version: 1,
      chapters: [
        { start: 0, title: '들어가며' },
        { start: 10, title: '둘' },
        { start: 5, title: '거꾸로' },
        { start: 20 },
      ],
      slides: [
        { start: 10, image: '/s/2.svg', alt: '둘째' },
        { start: 0, image: '/s/1.svg', alt: '첫째', title: '표지' },
        { start: 3, image: 'javascript:alert(1)', alt: 'x' },
      ],
      files: [{ title: 'PDF', url: '/s/slides.pdf' }],
      transcript: { src: '/s/t.vtt', lang: 'ko' },
    });

    expect(manifest).toEqual({
      chapters: [
        { start: 0, title: '들어가며' },
        { start: 10, title: '둘' },
      ],
      slides: [
        { start: 0, image: '/s/1.svg', alt: '첫째', title: '표지' },
        { start: 10, image: '/s/2.svg', alt: '둘째', title: '' },
      ],
      files: [{ title: 'PDF', url: '/s/slides.pdf', size: '' }],
      transcript: { src: '/s/t.vtt', lang: 'ko' },
      dropped: 3,
      failed: false,
    });
  });

  it('fails on another version or a non-object', () => {
    expect(readManifest({ version: 2 })).toMatchObject({ failed: true, chapters: [] });
    expect(readManifest(null)).toMatchObject({ failed: true });
  });
});

describe('parseVtt', () => {
  it('reads cues without tags, notes or invalid times', () => {
    const text = [
      'WEBVTT',
      '',
      'NOTE 메모',
      '',
      '2',
      '00:00:05.000 --> 00:00:09.000 align:start',
      '<v 강사>둘째 &amp; 줄',
      '',
      '00:01.000 --> 00:04.500',
      '첫째',
      '',
      '00:00:10.000 --> 00:00:09.000',
      '거꾸로',
    ].join('\n');

    expect(parseVtt(text)).toEqual([
      { start: 1, end: 4.5, text: '첫째' },
      { start: 5, end: 9, text: '둘째 & 줄' },
    ]);
    expect(parseVtt('not vtt')).toEqual([]);
  });
});

describe('progressDetail', () => {
  it('builds the solad-lms-progress detail', () => {
    const detail = progressDetail({
      videoId: 'v',
      sessionId: 's',
      seq: 3,
      reason: 'pause',
      position: 12.34567,
      duration: 80,
      rate: 1.5,
      segments: [
        [0, 10],
        [12, 20.0004],
      ],
      percent: 22,
      completion: 90,
      maxWatched: 20.0004,
      activeSeconds: 19.5,
      completedAt: null,
    });

    expect(detail).toEqual({
      videoId: 'v',
      sessionId: 's',
      seq: 3,
      reason: 'pause',
      position: 12.346,
      duration: 80,
      rate: 1.5,
      segments: [
        [0, 10],
        [12, 20],
      ],
      playedSegments: '0.000[.]10.000[,]12.000[.]20.000',
      progress: 0.225,
      percent: 22,
      threshold: 0.9,
      maxWatched: 20,
      activeSeconds: 19.5,
      completed: false,
    });
  });
});
