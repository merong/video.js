/* eslint-disable anti-slop/no-unknown-parameters, anti-slop/no-unsafe-dictionary-type -- This module is the untrusted JSON parsing boundary. */
import { isNumber, isPlainObject, isString } from '@videojs/utils/predicate';

import { isAdsUrl } from './url';

interface AdPlacement {
  readonly itemId: string;
  readonly adId: string;
  readonly creativeId: string;
  readonly creativeVersion: number;
  readonly url: string;
  readonly alt: string;
  readonly clickUrl: string | null;
  readonly skipAfterSeconds: number | null;
}

/** @internal */
export interface VideoAd extends AdPlacement {
  readonly kind: 'video';
  readonly mime: 'video/mp4' | 'video/webm';
}

/** @internal */
export interface ImageAd extends AdPlacement {
  readonly kind: 'image';
  readonly mime: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
  /** Visible, unpaused seconds after load success; GIF loops are not a clock. */
  readonly displaySeconds: number;
}

/** @internal */
export type PlaybackAd = VideoAd | ImageAd;

interface BreakPlacement {
  readonly breakId: string;
  readonly ads: readonly PlaybackAd[];
}

/** @internal */
export interface MidrollBreak extends BreakPlacement {
  readonly position: 'mid';
  readonly atSeconds: number;
}

/** @internal */
export interface BoundaryBreak extends BreakPlacement {
  readonly position: 'pre' | 'post';
}

/** @internal */
export type PlaybackBreak = MidrollBreak | BoundaryBreak;

/** A resolved, immutable session snapshot. Empty breaks mean no ads, never inheritance. @internal */
export interface PlaybackSchedule {
  readonly schemaVersion: 1;
  readonly siteId: string;
  readonly videoId: string;
  readonly boardId: string | null;
  readonly categoryId: string | null;
  readonly scheduleId: string;
  readonly scheduleVersion: number;
  readonly breaks: readonly PlaybackBreak[];
}

/** @internal */
export interface PlaybackIssue {
  readonly code: 'invalid_schedule' | 'invalid_duration';
  readonly path: string;
  readonly message: string;
}

/** @internal */
export type PlaybackParseResult =
  | { readonly ok: true; readonly schedule: PlaybackSchedule }
  | { readonly ok: false; readonly issues: readonly PlaybackIssue[] };

class InvalidSchedule extends Error {
  constructor(
    readonly path: string,
    message: string
  ) {
    super(message);
  }
}

function invalid(path: string, message: string): never {
  throw new InvalidSchedule(path, message);
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (!isPlainObject(value)) invalid(path, 'Expected a JSON object.');

  return value;
}

function identifier(value: unknown, path: string): string {
  if (!isString(value) || !value.trim() || [...value].length > 128) {
    invalid(path, 'Expected a nonempty ID of at most 128 characters.');
  }

  return value;
}

function nullableId(value: unknown, path: string): string | null {
  return value === null ? null : identifier(value, path);
}

function positive(value: unknown, path: string): number {
  if (!isNumber(value) || !Number.isFinite(value) || value <= 0) {
    invalid(path, 'Expected a finite positive number.');
  }

  return value;
}

function revision(value: unknown, path: string): number {
  const number = positive(value, path);

  if (!Number.isSafeInteger(number)) invalid(path, 'Expected a positive safe integer.');

  return number;
}

function runtimeUrl(value: unknown, path: string): string {
  if (!isAdsUrl(value)) invalid(path, 'Expected an HTTP(S) URL or same-origin absolute path.');

  return value;
}

function parseAd(value: unknown, path: string, itemIds: Set<string>): PlaybackAd {
  const input = record(value, path);
  const itemId = identifier(input.itemId, `${path}.itemId`);

  if (itemIds.has(itemId)) invalid(`${path}.itemId`, 'Item IDs must be unique across the schedule.');

  itemIds.add(itemId);

  const adId = identifier(input.adId, `${path}.adId`);
  const creativeId = identifier(input.creativeId, `${path}.creativeId`);

  if (adId !== creativeId) invalid(`${path}.adId`, 'adId must equal creativeId in schema version 1.');

  const skip = input.skipAfterSeconds === null ? null : revision(input.skipAfterSeconds, `${path}.skipAfterSeconds`);

  if (skip !== null && skip > 3600) invalid(`${path}.skipAfterSeconds`, 'Skip time must be at most 3600 seconds.');

  if (!isString(input.alt)) invalid(`${path}.alt`, 'Expected alternative text as a string.');

  const common: AdPlacement = {
    itemId,
    adId,
    creativeId,
    creativeVersion: revision(input.creativeVersion, `${path}.creativeVersion`),
    url: runtimeUrl(input.url, `${path}.url`),
    alt: input.alt,
    clickUrl: input.clickUrl === null ? null : runtimeUrl(input.clickUrl, `${path}.clickUrl`),
    skipAfterSeconds: skip,
  };

  if (input.kind === 'video') {
    if (input.mime !== 'video/mp4' && input.mime !== 'video/webm') {
      invalid(`${path}.mime`, 'Video MIME must be video/mp4 or video/webm.');
    }

    if ('displaySeconds' in input) invalid(`${path}.displaySeconds`, 'Video ads must use actual media progress.');

    return Object.freeze({ ...common, kind: 'video', mime: input.mime });
  }

  if (input.kind === 'image') {
    const mime = input.mime;

    if (mime !== 'image/jpeg' && mime !== 'image/png' && mime !== 'image/webp' && mime !== 'image/gif') {
      invalid(`${path}.mime`, 'Unsupported image MIME.');
    }

    const displaySeconds = positive(input.displaySeconds, `${path}.displaySeconds`);

    if (displaySeconds > 3600) invalid(`${path}.displaySeconds`, 'Display time must be at most 3600 seconds.');

    if (skip !== null && skip >= displaySeconds) {
      invalid(`${path}.skipAfterSeconds`, 'Image skip time must precede the end of its display time.');
    }

    return Object.freeze({ ...common, kind: 'image', mime, displaySeconds });
  }

  return invalid(`${path}.kind`, 'Expected video or image.');
}

function parseBreaks(value: unknown): readonly PlaybackBreak[] {
  if (!Array.isArray(value) || value.length > 100) invalid('breaks', 'Expected at most 100 breaks.');

  const breakIds = new Set<string>();
  const itemIds = new Set<string>();
  const cues = new Set<number>();
  const boundaries = new Set<string>();
  const breaks = value.map((entry, index): PlaybackBreak => {
    const path = `breaks[${index}]`;
    const input = record(entry, path);
    const breakId = identifier(input.breakId, `${path}.breakId`);

    if (breakIds.has(breakId)) invalid(`${path}.breakId`, 'Break IDs must be unique.');

    breakIds.add(breakId);

    if (!Array.isArray(input.ads) || input.ads.length === 0 || input.ads.length > 20) {
      invalid(`${path}.ads`, 'Each break must contain 1 to 20 ads.');
    }

    const ads = Object.freeze(input.ads.map((ad, i) => parseAd(ad, `${path}.ads[${i}]`, itemIds)));

    if (input.position === 'mid') {
      const atSeconds = positive(input.atSeconds, `${path}.atSeconds`);

      if (cues.has(atSeconds)) invalid(`${path}.atSeconds`, 'Midroll positions must be unique.');

      cues.add(atSeconds);

      return Object.freeze({ breakId, position: 'mid', atSeconds, ads });
    }

    if (input.position !== 'pre' && input.position !== 'post') {
      invalid(`${path}.position`, 'Expected pre, mid or post.');
    }

    if ('atSeconds' in input) invalid(`${path}.atSeconds`, 'Only midrolls have a content position.');

    if (boundaries.has(input.position)) invalid(`${path}.position`, 'Only one pre and one post break are allowed.');

    boundaries.add(input.position);

    return Object.freeze({ breakId, position: input.position, ads });
  });

  return Object.freeze(breaks.sort((a, b) => breakOrder(a) - breakOrder(b)));
}

function breakOrder(value: PlaybackBreak): number {
  return value.position === 'mid' ? value.atSeconds : value.position === 'pre' ? -1 : Infinity;
}

/**
 * Parse the resolved C0 DTO into a detached, deeply frozen snapshot. Unknown properties are discarded; malformed ads
 * reject the whole schedule rather than silently changing a published pod. The controller must fail open on errors.
 *
 * @internal
 */
export function parsePlaybackSchedule(value: unknown): PlaybackParseResult {
  try {
    const input = record(value, 'schedule');

    if (input.schemaVersion !== 1) invalid('schemaVersion', 'Only schemaVersion 1 is supported.');

    const schedule: PlaybackSchedule = Object.freeze({
      schemaVersion: 1,
      siteId: identifier(input.siteId, 'siteId'),
      videoId: identifier(input.videoId, 'videoId'),
      boardId: nullableId(input.boardId, 'boardId'),
      categoryId: nullableId(input.categoryId, 'categoryId'),
      scheduleId: identifier(input.scheduleId, 'scheduleId'),
      scheduleVersion: revision(input.scheduleVersion, 'scheduleVersion'),
      breaks: parseBreaks(input.breaks),
    });

    return Object.freeze({ ok: true, schedule });
  } catch (error) {
    if (!(error instanceof InvalidSchedule)) throw error;

    return Object.freeze({
      ok: false,
      issues: Object.freeze([
        Object.freeze({ code: 'invalid_schedule' as const, path: error.path, message: error.message }),
      ]),
    });
  }
}

/** Validate cues once finite duration is known. Unknown/NaN/infinite duration defers validation. @internal */
export function validateScheduleDuration(
  schedule: PlaybackSchedule,
  duration: number | null | undefined
): readonly PlaybackIssue[] {
  const issues: PlaybackIssue[] = [];

  if (isNumber(duration) && Number.isFinite(duration)) {
    if (duration < 0) {
      issues.push({ code: 'invalid_duration', path: 'duration', message: 'Content duration cannot be negative.' });
    } else {
      for (const [index, item] of schedule.breaks.entries()) {
        if (item.position === 'mid' && item.atSeconds >= duration) {
          issues.push({
            code: 'invalid_duration',
            path: `breaks[${index}].atSeconds`,
            message: 'Midroll position must precede content duration.',
          });
        }
      }
    }
  }

  return Object.freeze(issues.map((issue) => Object.freeze(issue)));
}
