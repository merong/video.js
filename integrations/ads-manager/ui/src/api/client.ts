import { safeUrl } from './model';

const JSON_TIMEOUT_MS = 30_000;
const UPLOAD_TIMEOUT_MS = 180_000;

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: Record<string, unknown>;

  constructor(message: string, status = 0, code = 'NETWORK', fields: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export interface RequestOptions {
  /** A body makes the request a POST write; `undefined` keeps it a read-only GET. */
  data?: unknown;
  query?: Record<string, string | number | null | undefined>;
  csv?: boolean;
}

interface Envelope {
  ok?: unknown;
  data?: unknown;
  error?: { code?: unknown; message?: unknown; fields?: unknown };
}

/**
 * V1 administrator API transport. Writes are sent exactly once: an ambiguous network failure is reported to the caller
 * instead of retried, because GnuBoard consumes its single-use admin token on every verified write.
 */
export class AdminApi {
  readonly apiUrl: string;
  csrfToken = '';

  constructor(apiUrl: string) {
    if (!safeUrl(apiUrl)) throw new Error('관리자 API 주소가 올바르지 않아요.');

    this.apiUrl = apiUrl;
  }

  url(action: string, query: RequestOptions['query'] = {}): string {
    const url = new URL(this.apiUrl, globalThis.location?.href ?? 'http://localhost/');

    url.searchParams.set('action', action);

    for (const [key, value] of Object.entries(query)) {
      if (value !== null && value !== undefined && value !== '') url.searchParams.set(key, String(value));
    }

    return url.href;
  }

  request(action: string, options: RequestOptions & { csv: true }): Promise<Blob>;
  request<T>(action: string, options?: RequestOptions): Promise<T>;
  async request<T>(action: string, { data, query, csv = false }: RequestOptions = {}): Promise<T | Blob> {
    const write = data !== undefined;
    const multipart = data instanceof FormData;
    const headers = new Headers({ Accept: csv ? 'text/csv' : 'application/json' });

    if (write) headers.set('X-CSRF-Token', this.csrfToken);

    if (write && !multipart) headers.set('Content-Type', 'application/json');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), multipart ? UPLOAD_TIMEOUT_MS : JSON_TIMEOUT_MS);

    try {
      const init: RequestInit = {
        method: write ? 'POST' : 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        headers,
        signal: controller.signal,
      };

      if (multipart) init.body = withCsrfField(data, this.csrfToken);
      else if (write) init.body = JSON.stringify(data);

      const response = await fetch(this.url(action, query), init);
      const nextCsrf = response.headers.get('X-CSRF-Token')?.trim();

      // GnuBoard consumes an admin token even when a mutation fails validation, so adopt it before reading the body.
      if (nextCsrf) this.csrfToken = nextCsrf;

      if (csv && response.ok && response.headers.get('content-type')?.includes('text/csv'))
        return await response.blob();

      let body: Envelope | null;

      try {
        // SAFETY: every `Envelope` field is optional `unknown`; `ok` and the `error` fields are checked before use below.
        body = (await response.json()) as Envelope | null;
      } catch {
        throw new ApiError('서버 응답을 읽지 못했어요. 연결 상태를 확인한 뒤 다시 시도해 주세요.', response.status);
      }

      if (!response.ok || body?.ok !== true) {
        const error = body?.error;

        throw new ApiError(
          isText(error?.message) ? error.message : '요청을 처리하지 못했어요.',
          response.status,
          isText(error?.code) ? error.code : 'UNKNOWN',
          isRecord(error?.fields) ? error.fields : {}
        );
      }

      if (csv) throw new ApiError('CSV 파일을 받지 못했어요. 다시 다운로드해 주세요.', response.status);

      // SAFETY: only the envelope is checked (`ok === true`). `T` is the caller's claim about the action's `data` shape
      // from ads-contract-v1, which the same-origin admin API owns; nothing here validates the payload against it.
      return body.data as T;
    } catch (error) {
      if (error instanceof ApiError) throw error;

      throw new ApiError(
        controller.signal.aborted
          ? '응답 대기 시간이 지났어요. 저장됐는지 다시 확인해 주세요.'
          : '서버에 연결하지 못했어요. 입력은 그대로 남아 있어요.'
      );
    } finally {
      clearTimeout(timer);
    }
  }
}

// Multipart writes also carry the token as a field; copy so the caller's FormData stays reusable after a failure.
function withCsrfField(data: FormData, token: string): FormData {
  const copy = new FormData();

  for (const [key, value] of data) {
    if (key !== 'csrfToken') copy.append(key, value);
  }

  copy.append('csrfToken', token);
  return copy;
}

function isText(value: unknown): value is string {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- response bodies are untrusted JSON.
  return typeof value === 'string' && value.length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- response bodies are untrusted JSON.
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
