import type { AdStatus } from '../components';
import type { AdminApi } from './client';

/** GnuBoard request board categories; the category is the processing stage (`request.lib.php`). */
export const REQUEST_STAGES = ['접수', '검토', '보완 요청', '집행 예정', '집행', '종료', '반려'] as const;

export type RequestStage = (typeof REQUEST_STAGES)[number];

/** Stage colors shared with the request board skin; the server sends the same `tone`. */
export const REQUEST_STAGE_TONE = {
  접수: 'draft',
  검토: 'pending',
  '보완 요청': 'paused',
  '집행 예정': 'scheduled',
  집행: 'active',
  종료: 'done',
  반려: 'rejected',
} satisfies Record<RequestStage, AdStatus>;

export interface AdRequestFilters {
  /** `''` lists every stage. */
  status: RequestStage | '';
  /** Part of the title or advertiser, at most 100 characters. */
  query: string;
}

export interface AdRequestItem {
  boardId: string;
  postId: number;
  title: string;
  /** A category outside the stage list counts as `접수` on the server. */
  status: RequestStage;
  advertiser: string | null;
  /** `YYYY-MM-DD`, or `null` when missing or malformed. */
  startDate: string | null;
  endDate: string | null;
  position: string | null;
  impressions: number | null;
  /** UTC ISO. */
  createdAt: string | null;
  comments: number;
  hasMedia: boolean;
  secret: boolean;
  /** Root-relative address of the board post. */
  url: string | null;
}

export interface AdRequestBoard {
  boardId: string;
  name: string;
}

export interface AdRequestPage {
  /** Every board with the request skin; empty when the site has none. */
  boards: AdRequestBoard[];
  items: AdRequestItem[];
  /** Requests per stage plus `all`; only `query` narrows them, so they suit the stage chips as they are. */
  counts: Record<RequestStage | 'all', number>;
  /** Requests matching both the stage and the query. */
  total: number;
  page: number;
  perPage: number;
}

export type AdRequestFileKind = 'video' | 'image' | 'other';

export interface AdRequestFile {
  name: string;
  kind: AdRequestFileKind;
  size: number | null;
  url: string;
  /** The first attachment is the ad creative. */
  media: boolean;
}

export interface AdRequestComment {
  commentId: number;
  createdAt: string | null;
  author: string;
  /** The stage an admin moved the request to with this comment, or `null`. */
  status: RequestStage | null;
  /** Plain text. */
  content: string;
}

export interface AdRequestDetail extends Omit<AdRequestItem, 'comments' | 'hasMedia'> {
  boardName: string | null;
  updatedAt: string | null;
  clickUrl: string | null;
  /** `wr_7`, a creative address given instead of a file. */
  mediaUrl: string | null;
  /** `wr_8`; masked like `010-****-**12` for an account without write access. */
  contact: string | null;
  /** `wr_9`, the board the advertiser would like. */
  targetBoard: AdRequestBoard | null;
  author: { name: string; memberId: string | null; email: string | null };
  /** Plain text with line breaks; never HTML. */
  content: string;
  files: AdRequestFile[];
  /** Processing comments, oldest first. */
  history: AdRequestComment[];
}

export interface AdRequestView {
  request: AdRequestDetail;
  /** The server hid the contact and author details from this read-only account. */
  masked: boolean;
}

const INVALID_RESPONSE = '광고 요청 응답을 읽지 못했어요. 새로고침한 뒤 다시 시도해 주세요.';
const PER_PAGE = 20;
const FILE_KINDS = ['video', 'image', 'other'] as const satisfies readonly AdRequestFileKind[];

export async function adRequests(api: AdminApi, filters: AdRequestFilters, page: number): Promise<AdRequestPage> {
  const data = await api.request<unknown>('ad-requests', {
    query: { status: filters.status || null, query: filters.query.trim() || null, page },
  });
  if (!isRecord(data)) throw new Error(INVALID_RESPONSE);

  const items = Array.isArray(data.items) ? data.items.flatMap(requestItem) : [];
  const countsInput = isRecord(data.counts) ? data.counts : {};
  // SAFETY: the entries cover `all` and every stage exactly once.
  const counts = Object.fromEntries(
    (['all', ...REQUEST_STAGES] as const).map((stage) => [stage, count(countsInput[stage], 0)])
  ) as Record<RequestStage | 'all', number>;

  return {
    boards: Array.isArray(data.boards) ? data.boards.flatMap(board) : [],
    items,
    counts,
    total: count(data.total, items.length),
    page: Math.max(1, count(data.page, page)),
    perPage: Math.max(1, count(data.perPage, PER_PAGE)),
  };
}

export async function adRequest(api: AdminApi, boardId: string, postId: number): Promise<AdRequestView> {
  const data = await api.request<unknown>('ad-request', { query: { boardId, postId } });
  const request = isRecord(data) && isRecord(data.request) ? data.request : null;
  const item = request ? requestItem(request)[0] : undefined;
  if (!isRecord(data) || !request || !item) throw new Error(INVALID_RESPONSE);

  const author = isRecord(request.author) ? request.author : {};

  return {
    request: {
      ...item,
      boardName: text(request.boardName),
      updatedAt: text(request.updatedAt),
      clickUrl: text(request.clickUrl),
      mediaUrl: text(request.mediaUrl),
      contact: text(request.contact),
      targetBoard: board(request.targetBoard)[0] ?? null,
      author: { name: text(author.name) ?? '', memberId: text(author.memberId), email: text(author.email) },
      content: text(request.content) ?? '',
      files: Array.isArray(request.files) ? request.files.flatMap(requestFile) : [],
      history: Array.isArray(request.history) ? request.history.flatMap(requestComment) : [],
    },
    masked: data.masked === true,
  };
}

/** One request; a row without a board, post number or title is dropped. */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- one untrusted list item.
function requestItem(value: unknown): AdRequestItem[] {
  if (!isRecord(value)) return [];

  const boardId = text(value.boardId);
  const postId = count(value.postId, 0);
  const title = text(value.title);
  if (boardId === null || !postId || title === null) return [];

  return [
    {
      boardId,
      postId,
      title,
      status: stageOf(value.status) ?? '접수',
      advertiser: text(value.advertiser),
      startDate: text(value.startDate),
      endDate: text(value.endDate),
      position: text(value.position),
      impressions: positive(value.impressions),
      createdAt: text(value.createdAt),
      comments: count(value.comments, 0),
      hasMedia: value.hasMedia === true,
      secret: value.secret === true,
      url: text(value.url),
    },
  ];
}

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- one untrusted list item.
function board(value: unknown): AdRequestBoard[] {
  const boardId = isRecord(value) ? text(value.boardId) : null;
  if (!isRecord(value) || boardId === null) return [];

  return [{ boardId, name: text(value.name) ?? boardId }];
}

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- one untrusted list item.
function requestFile(value: unknown): AdRequestFile[] {
  if (!isRecord(value)) return [];

  const url = text(value.url);
  if (url === null) return [];

  return [
    {
      name: text(value.name) ?? url,
      kind: FILE_KINDS.find((kind) => kind === value.kind) ?? 'other',
      size: positive(value.size),
      url,
      media: value.media === true,
    },
  ];
}

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- one untrusted list item.
function requestComment(value: unknown, index: number): AdRequestComment[] {
  if (!isRecord(value)) return [];

  return [
    {
      commentId: count(value.commentId, index),
      createdAt: text(value.createdAt),
      author: text(value.author) ?? '',
      status: stageOf(value.status),
      content: text(value.content) ?? '',
    },
  ];
}

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- untrusted JSON.
function stageOf(value: unknown): RequestStage | null {
  return REQUEST_STAGES.find((stage) => stage === value) ?? null;
}

/** A positive number, or `null`. */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- untrusted JSON.
function positive(value: unknown): number | null {
  const number = count(value, 0);

  return number > 0 ? number : null;
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
