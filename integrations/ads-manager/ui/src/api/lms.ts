import type { AdminApi } from './client';

/** `lms-settings`. A server without the LMS tables answers `installed: false` instead of 503. */
export interface LmsSettings {
  installed: boolean;
  keySet: boolean;
  /** Last four characters of the key, e.g. `…dbf9`; `null` without a key. */
  keyHint: string | null;
  /** ISO 8601 UTC of the last create or rotate. */
  rotatedAt: string | null;
}

/** `lms-key-rotate`: the only response that carries the full key. */
export interface LmsKey {
  key: string;
  keyHint: string | null;
  rotatedAt: string | null;
}

export interface LmsTestTokenInput {
  learnerId: string;
  minutes: number;
  /** Video length in seconds, optional. */
  dur?: number | undefined;
}

export interface LmsTestToken {
  token: string;
  expiresAt: string | null;
}

export type LmsProgressStatus = 'all' | 'done' | 'doing';

export interface LmsProgressFilters {
  videoId: string;
  learner: string;
  status: LmsProgressStatus;
}

export interface LmsProgressRow {
  /** `g:<member>` or `x:<external id>`. */
  learner: string;
  videoId: string;
  percent: number;
  completedAt: string | null;
  activeSeconds: number;
  position: number;
  duration: number;
  updatedAt: string | null;
}

export interface LmsProgressPage {
  rows: LmsProgressRow[];
  total: number;
  page: number;
  pageSize: number;
}

const INVALID_RESPONSE = 'LMS 응답을 읽지 못했어요. 새로고침한 뒤 다시 시도해 주세요.';
const PAGE_SIZE = 50;

export async function lmsSettings(api: AdminApi): Promise<LmsSettings> {
  const data = await api.request<unknown>('lms-settings');
  if (!isRecord(data)) throw new Error(INVALID_RESPONSE);

  return {
    installed: data.installed === true,
    keySet: data.keySet === true,
    keyHint: text(data.keyHint),
    rotatedAt: text(data.rotatedAt),
  };
}

/** Creates the key, or replaces it; every learner token signed with the old key stops working. */
export async function rotateLmsKey(api: AdminApi): Promise<LmsKey> {
  const data = await api.request<unknown>('lms-key-rotate', { data: {} });
  const key = isRecord(data) ? text(data.key) : null;
  if (!isRecord(data) || key === null) throw new Error(INVALID_RESPONSE);

  return { key, keyHint: text(data.keyHint), rotatedAt: text(data.rotatedAt) };
}

export async function lmsTestToken(api: AdminApi, input: LmsTestTokenInput): Promise<LmsTestToken> {
  const data = await api.request<unknown>('lms-test-token', {
    data: input.dur === undefined ? { learnerId: input.learnerId, minutes: input.minutes } : input,
  });
  const token = isRecord(data) ? text(data.token) : null;
  if (!isRecord(data) || token === null) throw new Error(INVALID_RESPONSE);

  return { token, expiresAt: text(data.expiresAt) };
}

export async function lmsProgressList(
  api: AdminApi,
  filters: LmsProgressFilters,
  page: number
): Promise<LmsProgressPage> {
  const data = await api.request<unknown>('lms-progress-list', { query: progressQuery(filters, page) });
  if (!isRecord(data)) throw new Error(INVALID_RESPONSE);

  const rows = Array.isArray(data.rows) ? data.rows.flatMap(progressRow) : [];

  return {
    rows,
    total: count(data.total, rows.length),
    page: Math.max(1, count(data.page, page)),
    pageSize: Math.max(1, count(data.pageSize, PAGE_SIZE)),
  };
}

/** The CSV of every row the filters match, not only the page on screen. */
export function downloadLmsProgressCsv(api: AdminApi, filters: LmsProgressFilters): Promise<Blob> {
  return api.request('lms-progress-csv', { query: progressQuery(filters), csv: true });
}

function progressQuery({ videoId, learner, status }: LmsProgressFilters, page?: number) {
  return { videoId: videoId.trim() || null, learner: learner.trim() || null, status, page };
}

/** One row; a row without a learner or video is dropped, and a missing number reads as 0. */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- one untrusted list item.
function progressRow(value: unknown): LmsProgressRow[] {
  if (!isRecord(value)) return [];

  const learner = text(value.learner);
  const videoId = text(value.videoId);
  if (learner === null || videoId === null) return [];

  return [
    {
      learner,
      videoId,
      percent: Math.min(100, count(value.percent, 0)),
      completedAt: text(value.completedAt),
      activeSeconds: count(value.activeSeconds, 0),
      position: count(value.position, 0),
      duration: count(value.duration, 0),
      updatedAt: text(value.updatedAt),
    },
  ];
}

/** A finite, non-negative number, or `fallback`. */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- untrusted JSON.
function count(value: unknown, fallback: number): number {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- untrusted JSON.
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- untrusted JSON.
function text(value: unknown): string | null {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- untrusted JSON.
  return typeof value === 'string' && value ? value : null;
}

// oxlint-disable-next-line anti-slop/no-unknown-parameters, anti-slop/no-unsafe-dictionary-type -- untrusted JSON.
function isRecord(value: unknown): value is Record<string, unknown> {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- untrusted JSON.
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
