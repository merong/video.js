/** Shared form rules ported from the v1 manager; the server remains authoritative for assets and publication. */

export type TargetType = 'site' | 'board' | 'category' | 'video';
export type ScheduleMode = 'inherit' | 'replace' | 'disabled';
export type BreakPosition = 'pre' | 'mid' | 'post';
export type CreativeKind = 'video' | 'image';

export interface Target {
  type: TargetType;
  id: string;
  boardId?: string;
}

export interface Creative {
  creativeId: string;
  version: number;
  name: string;
  kind: CreativeKind;
  url: string;
  mime: string;
  alt: string;
  source: 'url' | 'upload';
  archived: boolean;
  createdAt: string;
}

export interface AdItem {
  itemId: string;
  adId: string;
  creativeId: string;
  creativeVersion: number;
  kind: CreativeKind;
  url: string;
  mime: string;
  alt: string;
  clickUrl: string | null;
  skipAfterSeconds: number | null;
  displaySeconds?: number;
}

export interface AdBreak {
  breakId: string;
  position: BreakPosition;
  atSeconds?: number;
  ads: AdItem[];
}

export interface EditorRecord {
  target: Target;
  mode: ScheduleMode;
  revision: number;
  breaks: AdBreak[];
}

/** The statistics form as typed; `statsFilters` validates it. */
export interface StatsFilterInput {
  from: string;
  to: string;
  adId: string;
  videoId: string;
  boardId: string;
}

export interface StatsFilters {
  from: string;
  to: string;
  adId?: string;
  videoId?: string;
  boardId?: string;
}

export const TARGET_TYPES: readonly TargetType[] = ['site', 'board', 'category', 'video'];
export const SCHEDULE_MODES: readonly ScheduleMode[] = ['inherit', 'replace', 'disabled'];
export const MAX_BREAKS = 100;
export const MAX_ADS_PER_BREAK = 20;

// Contract 4.1: \p{Cc} plus bidirectional embeddings, overrides and isolates. Same set as the preset label rule.
// oxlint-disable-next-line no-control-regex
const VIDEO_ID_CONTROL = /[\u0000-\u001f\u007f-\u009f‪-‮⁦-⁩]/u;

/**
 * Why the server's `Value::videoId` would refuse a fixed video ID, or `null` when it passes: at most 128 characters
 * (code points), no control or bidirectional control characters, not empty or only `String.prototype.trim` spaces.
 * Screens check the value they send, so a gnuboard `게시판:글번호:영상키` ID only gets these string rules here.
 */
export function videoIdProblem(value: string): string | null {
  if (VIDEO_ID_CONTROL.test(value)) {
    return '영상 ID에는 제어 문자나 글자 방향 제어 문자를 쓸 수 없어요. 지우고 다시 입력해 주세요.';
  }

  if ([...value].length > 128) return '영상 ID는 128자 이내로 입력해 주세요.';

  if (!value.trim()) return '영상 ID를 입력해 주세요.';

  return null;
}

export function safeUrl(value: unknown): value is string {
  // These URLs cross the JSON/form boundary; reject nonstrings and controls before URL normalization.
  // oxlint-disable-next-line anti-slop/no-runtime-typeof, no-control-regex
  if (typeof value !== 'string' || !value || /[\u0000- \u007f\\]/u.test(value)) return false;

  if (value.startsWith('/')) return !value.startsWith('//');

  try {
    const url = new URL(value);

    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function makeItem(creative: Creative, itemId: string): AdItem {
  const item: AdItem = {
    itemId,
    adId: creative.creativeId,
    creativeId: creative.creativeId,
    creativeVersion: creative.version,
    kind: creative.kind,
    url: creative.url,
    mime: creative.mime,
    alt: creative.alt,
    clickUrl: null,
    skipAfterSeconds: null,
  };

  if (creative.kind === 'image') item.displaySeconds = 5;

  return item;
}

/** Validates an editor record and returns the canonical copy the server accepts. Throws a user-facing `Error`. */
export function editorPayload(record: EditorRecord): EditorRecord {
  const copy = structuredClone(record);
  const fail = (message: string): never => {
    throw new Error(message);
  };

  if (!TARGET_TYPES.includes(copy.target.type) || !validId(copy.target.id)) {
    fail('적용 대상과 128자 이내의 고정 ID를 지정해 주세요.');
  }

  if (copy.target.type === 'category' && !validId(copy.target.boardId)) fail('분류의 게시판 ID를 지정해 주세요.');

  if (!SCHEDULE_MODES.includes(copy.mode)) fail('편성 적용 방식을 선택해 주세요.');

  if (copy.target.type === 'site' && copy.mode === 'inherit') fail('사이트 기본 편성은 상속할 수 없어요.');

  if (!Number.isInteger(copy.revision) || copy.revision < 0) fail('편성을 다시 불러온 뒤 저장해 주세요.');

  if (copy.mode !== 'replace') return { ...copy, breaks: [] };

  if (copy.breaks.length > MAX_BREAKS) fail('광고 구간은 최대 100개예요.');

  const breakIds = new Set<string>();
  const itemIds = new Set<string>();
  const positions = new Set<string>();

  for (const br of copy.breaks) {
    if (!validId(br.breakId) || breakIds.has(br.breakId)) fail('광고 구간 ID가 중복되거나 잘못됐어요.');

    breakIds.add(br.breakId);

    if (!['pre', 'mid', 'post'].includes(br.position)) fail('광고 구간 위치를 선택해 주세요.');

    if (br.position === 'mid' && (!Number.isFinite(br.atSeconds) || (br.atSeconds ?? 0) <= 0)) {
      fail('미드롤 위치는 0보다 큰 본편 재생 초로 입력해 주세요.');
    }

    const position = br.position === 'mid' ? `mid:${br.atSeconds}` : br.position;

    if (positions.has(position)) fail('같은 시점의 광고는 한 구간 안에 순서대로 추가해 주세요.');

    positions.add(position);

    if (br.position !== 'mid') delete br.atSeconds;

    if (!br.ads.length || br.ads.length > MAX_ADS_PER_BREAK) fail('각 광고 구간에는 광고를 1~20개 넣어 주세요.');

    for (const ad of br.ads) validateItem(ad, itemIds, fail);
  }

  copy.breaks.sort((a, b) => breakRank(a) - breakRank(b));
  return copy;
}

function validateItem(ad: AdItem, itemIds: Set<string>, fail: (message: string) => never): void {
  if (!validId(ad.itemId) || itemIds.has(ad.itemId)) fail('광고 항목 ID가 중복되거나 잘못됐어요.');

  itemIds.add(ad.itemId);

  if (!validId(ad.creativeId) || !Number.isInteger(ad.creativeVersion) || ad.creativeVersion < 1) {
    fail('저장된 소재 버전을 선택해 주세요.');
  }

  ad.adId = ad.creativeId;

  if (!safeUrl(ad.url) || (ad.clickUrl !== null && !safeUrl(ad.clickUrl)))
    fail('광고 주소는 HTTP(S) 또는 /로 시작하는 경로여야 해요.');

  const skip = ad.skipAfterSeconds;

  if (skip !== null && (!Number.isInteger(skip) || skip < 1 || skip > 3600)) {
    fail('스킵 대기 시간은 1~3600초의 정수로 입력해 주세요.');
  }

  if (ad.kind === 'image') {
    const display = ad.displaySeconds ?? Number.NaN;

    if (!Number.isFinite(display) || display <= 0 || display > 3600)
      fail('이미지 표시 시간은 0초보다 길고 3600초 이하여야 해요.');

    if (skip !== null && skip >= display) fail('스킵 대기 시간은 이미지 표시 시간보다 짧아야 해요.');
  } else if (ad.kind === 'video') {
    delete ad.displaySeconds;
  } else {
    fail('지원하지 않는 소재 종류예요.');
  }
}

/** Chronological order: pre, ascending mid positions, post. An unfinished mid position sorts at the start. */
export function breakRank(br: AdBreak): number {
  if (br.position === 'pre') return -1;

  if (br.position === 'post') return Infinity;

  return Number.isFinite(br.atSeconds) ? (br.atSeconds ?? 0) : 0;
}

export function statsFilters(values: StatsFilterInput): StatsFilters {
  const date = (value: string): boolean =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value;

  const { from, to } = values;
  if (!date(from) || !date(to) || from > to) throw new Error('시작일과 종료일을 올바르게 지정해 주세요.');

  const filters: StatsFilters = { from, to };

  for (const key of ['adId', 'videoId', 'boardId'] as const) {
    const value = values[key].trim();

    if (value) filters[key] = value;
  }

  return filters;
}

export function formatRate(value: number | null | undefined): string {
  return Number.isFinite(value) && (value ?? -1) >= 0 && (value ?? 2) <= 1
    ? `${new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 }).format((value ?? 0) * 100)}%`
    : '—';
}

export function formatCount(value: number | null | undefined): string {
  return new Intl.NumberFormat('ko-KR').format(value ?? 0);
}

/** Stable IDs for new breaks and items. `randomUUID` needs a secure context; plain-HTTP intranet hosts fall back. */
export function newId(prefix: string): string {
  if (globalThis.crypto?.randomUUID && globalThis.isSecureContext !== false) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }

  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));

  return `${prefix}-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

/** An editor ID the server accepts: non-blank and at most 128 characters. */
function validId(value: string | undefined): value is string {
  return value !== undefined && value.trim().length > 0 && value.length <= 128;
}
