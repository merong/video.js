import type { AdminApi } from './client';
import type { BreakPosition, Creative, EditorRecord, StatsFilters, Target, TargetType } from './model';

export type HostKind = 'standalone' | 'gnuboard';

export interface Capabilities {
  host: HostKind;
  manualTargets: boolean;
  uploads: boolean;
  loginUrl: string | null;
  /** GnuBoard site home and host admin; `null` (or absent on an older API) hides the link. */
  siteUrl?: string | null;
  adminUrl?: string | null;
  /**
   * Whether the LMS tables exist; absent on an older API, which reads as not installed. `false` on a host without
   * lectures (GnuBoard).
   */
  lms?: { installed: boolean } | false;
  /** GnuBoard request boards; absent on an older API or the standalone host, which hides the screen. */
  adRequests?: boolean;
  /** The logo library actions; absent on an older API, which offers the sample logo only. */
  logos?: boolean;
}

export interface Bootstrap {
  authenticated: boolean;
  csrfToken: string;
  apiUrl?: string;
  capabilities: Capabilities;
  site?: { siteId: string; timeZone: string };
  playerModuleUrl?: string | null;
  /** Where uploaded files are served, `/data/media` in the GnuBoard package; absent on an older API. */
  uploadUrl?: string;
  limits?: { uploadBytes: number };
  /** `canWrite` is absent on an older API, which only signs in accounts that can write. */
  user?: { displayName: string; canWrite?: boolean };
}

/** The authenticated bootstrap subset the workspace depends on. */
export interface Session {
  capabilities: Capabilities;
  site: { siteId: string; timeZone: string };
  playerModuleUrl: string | null;
  /** Upload address without a trailing slash, for input hints. */
  uploadUrl: string;
  limits: { uploadBytes: number };
  displayName: string;
  /** `false` for a read-only admin (GnuBoard `r` only); the server still refuses writes on its own. */
  canWrite: boolean;
}

export interface TargetChoice {
  target: Target;
  label: string;
}

export interface DraftResponse {
  draft: EditorRecord;
  publishedVersion: number | null;
  resolvedFrom: Target | null;
}

export interface PreviewRequest extends EditorRecord {
  videoId: string;
  boardId: string | null;
  categoryId: string | null;
}

/** The resolved schedule the player preview frame plays; only the fields the admin reads are typed. */
export interface PreviewSchedule {
  videoId: string;
  breaks: { breakId: string; position: BreakPosition; ads: { itemId: string }[] }[];
}

export interface StatsMetrics {
  starts: number;
  completes: number;
  skips: number;
  clicks: number;
  clickedStarts: number;
  errors: number;
  completionRate: number | null;
  clickRate: number | null;
}

export interface StatsRow extends StatsMetrics {
  adId: string | null;
  videoId: string | null;
  boardId: string | null;
}

export interface StatsResponse {
  totals: StatsMetrics;
  rows: StatsRow[];
  timeZone: string;
  asOf: string;
}

export interface CreativeUrlInput {
  name: string;
  url: string;
  mime: string;
  alt: string;
  creativeId?: string | undefined;
}

export interface VideoContextInput {
  videoId: string;
  label: string;
  boardId: string | null;
  categoryId: string | null;
}

/** Reads bootstrap and adopts its token; a later response header can still rotate it. */
export async function loadBootstrap(api: AdminApi): Promise<Bootstrap> {
  const data = await api.request<Bootstrap>('bootstrap');

  api.csrfToken = data.csrfToken || api.csrfToken;
  return data;
}

export function toSession(data: Bootstrap): Session | null {
  if (!data.authenticated || !data.site || !data.limits) return null;

  return {
    capabilities: data.capabilities,
    site: data.site,
    playerModuleUrl: data.playerModuleUrl ?? null,
    uploadUrl: (data.uploadUrl || '/media').replace(/\/+$/u, ''),
    limits: data.limits,
    displayName: data.user?.displayName || '',
    canWrite: data.user?.canWrite !== false,
  };
}

export async function login(api: AdminApi, username: string, password: string): Promise<boolean> {
  const result = await api.request<{ authenticated: boolean }>('login', { data: { username, password } });

  return result.authenticated;
}

export async function logout(api: AdminApi): Promise<void> {
  await api.request('logout', { data: {} });
}

export async function listCreatives(api: AdminApi): Promise<Creative[]> {
  return (await api.request<{ items: Creative[] }>('creatives')).items;
}

export async function saveCreativeUrl(api: AdminApi, input: CreativeUrlInput): Promise<Creative> {
  return (await api.request<{ creative: Creative }>('creative-save', { data: input })).creative;
}

export async function uploadCreative(api: AdminApi, data: FormData): Promise<Creative> {
  return (await api.request<{ creative: Creative }>('creative-upload', { data })).creative;
}

export async function archiveCreative(api: AdminApi, creativeId: string): Promise<void> {
  await api.request('creative-archive', { data: { creativeId } });
}

export async function searchTargets(
  api: AdminApi,
  query: { type: TargetType; query: string; boardId?: string }
): Promise<TargetChoice[]> {
  return (await api.request<{ items: TargetChoice[] }>('targets', { query })).items;
}

export async function saveVideoContext(api: AdminApi, input: VideoContextInput): Promise<void> {
  await api.request('video-context-save', { data: input });
}

export function loadDraft(api: AdminApi, target: Target): Promise<DraftResponse> {
  return api.request<DraftResponse>('schedule-draft', {
    query: { targetType: target.type, targetId: target.id, boardId: target.boardId },
  });
}

export function saveDraft(api: AdminApi, record: EditorRecord): Promise<DraftResponse> {
  return api.request<DraftResponse>('schedule-save', { data: record });
}

export function publishDraft(
  api: AdminApi,
  target: Target,
  revision: number
): Promise<{ scheduleId: string; scheduleVersion: number }> {
  return api.request('schedule-publish', { data: { target, revision } });
}

export async function previewSchedule(api: AdminApi, request: PreviewRequest): Promise<PreviewSchedule> {
  return (await api.request<{ schedule: PreviewSchedule }>('schedule-preview', { data: request })).schedule;
}

export function loadStats(api: AdminApi, filters: StatsFilters): Promise<StatsResponse> {
  return api.request<StatsResponse>('stats', { query: { ...filters } });
}

export function downloadStatsCsv(api: AdminApi, filters: StatsFilters): Promise<Blob> {
  return api.request('stats-csv', { query: { ...filters }, csv: true });
}
