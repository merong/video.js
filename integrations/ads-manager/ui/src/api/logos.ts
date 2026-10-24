import type { AdminApi } from './client';

/** The built-in logo; it cannot be deleted and is the only one the site player draws for now. */
export const SAMPLE_LOGO_ID = 'sample';

export interface LogoItem {
  /** `sample` or a 32-character hex id. */
  logoId: string;
  name: string;
  url: string;
  mime: string;
  bytes: number | null;
  /** Read by the server; `null` for the sample and an SVG without size or `viewBox`. */
  width: number | null;
  height: number | null;
  builtIn: boolean;
  /** A saved player setting uses it as `logo.assetId`, so the server refuses to delete it. */
  inUse: boolean;
  createdAt: string | null;
}

export interface LogoLimits {
  bytes: number;
  count: number;
  mimes: string[];
}

export interface LogoLibrary {
  items: LogoItem[];
  limits: LogoLimits;
}

const INVALID_RESPONSE = '로고 보관함 응답을 읽지 못했어요. 새로고침한 뒤 다시 시도해 주세요.';
const DEFAULT_LIMITS: LogoLimits = {
  bytes: 1024 * 1024,
  count: 50,
  mimes: ['image/png', 'image/svg+xml', 'image/gif', 'image/webp', 'image/jpeg'],
};

export async function logos(api: AdminApi): Promise<LogoLibrary> {
  return library(await api.request<unknown>('logos'));
}

export async function uploadLogo(
  api: AdminApi,
  file: File,
  name = ''
): Promise<LogoLibrary & { logo: LogoItem | null }> {
  const data = new FormData();

  data.set('file', file);

  if (name.trim()) data.set('name', name.trim());

  const result = await api.request<unknown>('logo-upload', { data });
  const logo = isRecord(result) ? (logoItem(result.logo)[0] ?? null) : null;

  return { ...library(result), logo };
}

export async function deleteLogo(api: AdminApi, logoId: string): Promise<LogoLibrary> {
  return library(await api.request<unknown>('logo-delete', { data: { logoId } }));
}

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- untrusted JSON.
function library(data: unknown): LogoLibrary {
  if (!isRecord(data) || !Array.isArray(data.items)) throw new Error(INVALID_RESPONSE);

  const limits = isRecord(data.limits) ? data.limits : {};
  const mimes = Array.isArray(limits.mimes) ? limits.mimes.flatMap((mime) => text(mime) ?? []) : [];

  return {
    items: data.items.flatMap(logoItem),
    limits: {
      bytes: positive(limits.bytes) ?? DEFAULT_LIMITS.bytes,
      count: positive(limits.count) ?? DEFAULT_LIMITS.count,
      mimes: mimes.length ? mimes : DEFAULT_LIMITS.mimes,
    },
  };
}

/** One library item; an item without an id or address is dropped. */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- one untrusted list item.
function logoItem(value: unknown): LogoItem[] {
  if (!isRecord(value)) return [];

  const logoId = text(value.logoId);
  const url = text(value.url);
  if (logoId === null || url === null) return [];

  return [
    {
      logoId,
      name: text(value.name) ?? logoId,
      url,
      mime: text(value.mime) ?? '',
      bytes: positive(value.bytes),
      width: positive(value.width),
      height: positive(value.height),
      builtIn: value.builtIn === true || logoId === SAMPLE_LOGO_ID,
      inUse: value.inUse === true,
      createdAt: text(value.createdAt),
    },
  ];
}

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- untrusted JSON.
function positive(value: unknown): number | null {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- untrusted JSON.
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
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
