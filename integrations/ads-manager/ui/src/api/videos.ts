import type { AdminApi } from './client';

/** Ffmpeg extras a GnuBoard video post can have (scratchpad MEDIA.md). */
export const VIDEO_FEATURES = ['cover', 'thumbnails', 'highlight'] as const;

export type VideoFeature = (typeof VIDEO_FEATURES)[number];

export const VIDEO_FEATURE_LABELS = {
  cover: '커버',
  thumbnails: '진행바 썸네일',
  highlight: '하이라이트',
} satisfies Record<VideoFeature, string>;

export type VideoSource = 'file' | 'hls_zip' | 'hls_url' | 'url';

export const VIDEO_SOURCE_LABELS = {
  file: '첨부 파일',
  hls_zip: 'HLS 묶음',
  hls_url: 'HLS 주소',
  url: '영상 주소',
} satisfies Record<VideoSource, string>;

/** `internal`: a file uploaded to the site; `external`: an address the post points to (BRIEF-V1). */
export type VideoPlace = 'internal' | 'external';

export const VIDEO_PLACES = ['internal', 'external'] as const satisfies readonly VideoPlace[];

export const VIDEO_PLACE_OF = {
  file: 'internal',
  hls_zip: 'internal',
  hls_url: 'external',
  url: 'external',
} satisfies Record<VideoSource, VideoPlace>;

export interface VideoLocation {
  /** Root-relative path of the site file, or the external URL; `null` when not found or hidden from a read-only account. */
  address: string | null;
  /** The uploaded file's original name. */
  name: string | null;
}

/** `unsupported`: an external address or no local file; `disabled`: switched off in the board settings. */
export type VideoFeatureStatus = 'none' | 'ready' | 'unsupported' | 'disabled' | 'error';

export interface VideoFeatureState {
  status: VideoFeatureStatus;
  /** Root-relative file, present whenever it exists (the thumbnails VTT for `thumbnails`). */
  url: string | null;
  /** The thumbnails sprite. */
  image: string | null;
  /** Why it is unsupported, disabled or failed. */
  message: string | null;
}

export interface UploadedVideo {
  boardId: string;
  boardSubject: string;
  postId: number;
  title: string;
  secret: boolean;
  source: VideoSource;
  /** Seconds, or `null` when the post has none. */
  duration: number | null;
  /** The board's local `YYYY-MM-DD HH:MM:SS`. */
  createdAt: string;
  /** Root-relative address of the post. */
  postUrl: string | null;
  location: VideoLocation;
  features: Record<VideoFeature, VideoFeatureState>;
}

export interface MediaTool {
  /** `null` for an account that cannot write; the server hides it. */
  path: string | null;
  version: string;
}

export interface MediaDetection {
  available: boolean;
  ffmpeg: MediaTool | null;
  ffprobe: MediaTool | null;
  reason: 'proc_open' | 'not_found' | 'ffprobe_not_found' | null;
  message: string | null;
}

export interface VideoBoard {
  id: string;
  subject: string;
  features: VideoFeature[];
  /** The GnuBoard board settings form. */
  formUrl: string | null;
}

export interface UploadedVideoFilters {
  /** `''` lists every video board. */
  boardId: string;
  query: string;
  place: VideoPlace;
}

export interface UploadedVideoPage {
  media: MediaDetection;
  boards: VideoBoard[];
  items: UploadedVideo[];
  page: number;
  pageSize: number;
  total: number;
  /** Per place under the board and title filters; `null` from a server without them. */
  counts: Record<VideoPlace, number> | null;
}

const INVALID_RESPONSE = '업로드 동영상 응답을 읽지 못했어요. 새로고침한 뒤 다시 시도해 주세요.';
const PAGE_SIZE = 20;
const SOURCES = ['file', 'hls_zip', 'hls_url', 'url'] as const satisfies readonly VideoSource[];
const STATUSES = ['none', 'ready', 'unsupported', 'disabled', 'error'] as const satisfies readonly VideoFeatureStatus[];
const REASONS = ['proc_open', 'not_found', 'ffprobe_not_found'] as const;
// One feature of a long video can take minutes on the server.
const GENERATE_TIMEOUT_MS = 600_000;

export async function uploadedVideos(
  api: AdminApi,
  filters: UploadedVideoFilters,
  page: number,
  refresh = false
): Promise<UploadedVideoPage> {
  const data = await api.request<unknown>('uploaded-videos', {
    query: {
      boardId: filters.boardId || null,
      query: filters.query.trim() || null,
      place: filters.place,
      page,
      refresh: refresh ? 1 : null,
    },
  });
  if (!isRecord(data)) throw new Error(INVALID_RESPONSE);

  const items = Array.isArray(data.items) ? data.items.flatMap(videoItem) : [];

  return {
    media: detection(data.media),
    boards: Array.isArray(data.boards) ? data.boards.flatMap(videoBoard) : [],
    items,
    page: Math.max(1, count(data.page, page)),
    pageSize: Math.max(1, count(data.pageSize, PAGE_SIZE)),
    total: count(data.total, items.length),
    counts: isRecord(data.counts)
      ? { internal: count(data.counts.internal, 0), external: count(data.counts.external, 0) }
      : null,
  };
}

export async function uploadedVideo(api: AdminApi, boardId: string, postId: number): Promise<UploadedVideo> {
  return item(await api.request<unknown>('uploaded-video', { query: { boardId, postId } }));
}

/** Generates one feature, or every feature the board switched on; `failed` lists the ones that did not finish. */
export async function generateVideoMedia(
  api: AdminApi,
  video: Pick<UploadedVideo, 'boardId' | 'postId'>,
  feature: VideoFeature | 'all'
): Promise<{ item: UploadedVideo; failed: VideoFeature[] }> {
  const data = await api.request<unknown>('uploaded-video-generate', {
    data: { boardId: video.boardId, postId: video.postId, feature },
    timeoutMs: GENERATE_TIMEOUT_MS,
  });
  const failed = isRecord(data) && Array.isArray(data.failed) ? data.failed.filter(isFeature) : [];

  return { item: item(data), failed };
}

export async function deleteVideoMedia(
  api: AdminApi,
  video: Pick<UploadedVideo, 'boardId' | 'postId'>,
  feature: VideoFeature | 'all'
): Promise<UploadedVideo> {
  return item(
    await api.request<unknown>('uploaded-video-delete', {
      data: { boardId: video.boardId, postId: video.postId, feature },
    })
  );
}

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- untrusted JSON.
function item(data: unknown): UploadedVideo {
  const video = isRecord(data) ? videoItem(data.item)[0] : undefined;
  if (!video) throw new Error(INVALID_RESPONSE);

  return video;
}

/** One video row; a row without a board, post number or title is dropped. */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- one untrusted list item.
function videoItem(value: unknown): UploadedVideo[] {
  if (!isRecord(value)) return [];

  const boardId = text(value.boardId);
  const postId = count(value.postId, 0);
  const title = text(value.title);
  if (boardId === null || !postId || title === null) return [];

  const features = isRecord(value.features) ? value.features : {};
  const location = isRecord(value.location) ? value.location : {};
  const duration = count(value.duration, 0);

  return [
    {
      boardId,
      boardSubject: text(value.boardSubject) ?? boardId,
      postId,
      title,
      secret: value.secret === true,
      source: SOURCES.find((source) => source === value.source) ?? 'file',
      duration: duration > 0 ? duration : null,
      createdAt: text(value.createdAt) ?? '',
      postUrl: text(value.postUrl),
      location: { address: text(location.address), name: text(location.name) },
      // SAFETY: the entries cover every feature exactly once.
      features: Object.fromEntries(VIDEO_FEATURES.map((name) => [name, featureState(features[name])])) as Record<
        VideoFeature,
        VideoFeatureState
      >,
    },
  ];
}

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- untrusted JSON.
function featureState(value: unknown): VideoFeatureState {
  const state = isRecord(value) ? value : {};

  return {
    status: STATUSES.find((status) => status === state.status) ?? 'none',
    url: text(state.url),
    image: text(state.image),
    message: text(state.message),
  };
}

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- untrusted JSON.
function detection(value: unknown): MediaDetection {
  const media = isRecord(value) ? value : {};

  return {
    available: media.available === true,
    ffmpeg: tool(media.ffmpeg),
    ffprobe: tool(media.ffprobe),
    reason: REASONS.find((reason) => reason === media.reason) ?? null,
    message: text(media.message),
  };
}

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- untrusted JSON.
function tool(value: unknown): MediaTool | null {
  if (!isRecord(value)) return null;

  const path = text(value.path);
  const version = text(value.version) ?? '';

  return path !== null || version ? { path, version } : null;
}

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- one untrusted list item.
function videoBoard(value: unknown): VideoBoard[] {
  const id = isRecord(value) ? text(value.id) : null;
  if (!isRecord(value) || id === null) return [];

  return [
    {
      id,
      subject: text(value.subject) ?? id,
      features: Array.isArray(value.features) ? value.features.filter(isFeature) : [],
      formUrl: text(value.formUrl),
    },
  ];
}

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- untrusted JSON.
function isFeature(value: unknown): value is VideoFeature {
  return VIDEO_FEATURES.some((feature) => feature === value);
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
