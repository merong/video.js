import { safeUrl } from '../api/model';

/** Values the PHP shell prints into `#ads-config`. */
export interface AdminConfig {
  apiUrl: string;
  assetUrl?: string;
}

export function readConfig(element: Element | null): AdminConfig {
  if (!element?.textContent) throw new Error('관리자 화면 설정을 찾지 못했어요.');

  const value: unknown = JSON.parse(element.textContent);
  if (!isConfig(value)) throw new Error('관리자 API 주소가 올바르지 않아요.');

  return value;
}

function isConfig(value: unknown): value is AdminConfig {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- the shell config is parsed JSON.
  if (typeof value !== 'object' || value === null || !('apiUrl' in value)) return false;

  const assetUrl = 'assetUrl' in value ? value.assetUrl : undefined;

  return safeUrl(value.apiUrl) && (assetUrl === undefined || safeUrl(assetUrl));
}

/**
 * The public web root that holds `api/`, `examples/` and `demo-media/`. It keeps a host's path prefix
 * (`/ads/api/index.php` → `/ads/`).
 */
export function publicBase(apiUrl: string): string {
  const url = new URL(apiUrl, globalThis.location?.href ?? 'http://localhost/');

  url.search = '';
  url.hash = '';
  url.pathname = url.pathname.replace(/api\/index\.php$/u, '');
  return apiUrl.startsWith('/') ? url.pathname : url.href;
}

/** Generated Grok demo content (not tracked in Git); operators replace it with real content. */
export const DEFAULT_CONTENT_PATH = 'demo-media/grok-20261018/content-scene-01.mp4';
