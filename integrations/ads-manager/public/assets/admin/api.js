import { safeUrl } from './model.js';

export class ApiError extends Error {
  constructor(message, status = 0, code = 'NETWORK', fields = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export class AdminApi {
  constructor(apiUrl) {
    if (!safeUrl(apiUrl)) throw new Error('관리자 API 주소가 올바르지 않습니다.');

    this.apiUrl = apiUrl;
    this.csrfToken = '';
  }

  url(action, query = {}) {
    const url = new URL(this.apiUrl, globalThis.location?.href ?? 'http://localhost/');

    url.searchParams.set('action', action);

    for (const [key, value] of Object.entries(query)) {
      if (value !== null && value !== undefined && value !== '') url.searchParams.set(key, String(value));
    }

    return url.href;
  }

  async request(action, { data, query, csv = false } = {}) {
    const multipart = data instanceof FormData;
    const headers = { Accept: csv ? 'text/csv' : 'application/json' };

    if (data !== undefined) headers['X-CSRF-Token'] = this.csrfToken;

    if (data !== undefined && !multipart) headers['Content-Type'] = 'application/json';

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), multipart ? 180000 : 30000);

    try {
      const options = {
        method: data === undefined ? 'GET' : 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers,
        signal: controller.signal,
      };

      if (data !== undefined) options.body = multipart ? data : JSON.stringify(data);

      const response = await fetch(this.url(action, query), options);
      const nextCsrf = response.headers.get('X-CSRF-Token')?.trim();

      // GnuBoard consumes an admin token even when a mutation fails validation.
      if (nextCsrf) this.csrfToken = nextCsrf;

      if (csv && response.ok && response.headers.get('content-type')?.includes('text/csv'))
        return await response.blob();

      let body;

      try {
        body = await response.json();
      } catch {
        throw new ApiError('서버 응답을 읽지 못했습니다. 연결 상태를 확인한 뒤 다시 시도하세요.', response.status);
      }

      if (!response.ok || body?.ok !== true) {
        throw new ApiError(
          body?.error?.message || '요청을 처리하지 못했습니다.',
          response.status,
          body?.error?.code,
          body?.error?.fields
        );
      }

      if (csv) throw new ApiError('CSV 파일을 받지 못했습니다. 다시 다운로드하세요.', response.status);

      return body.data;
    } catch (error) {
      if (error instanceof ApiError) throw error;

      throw new ApiError(
        controller.signal.aborted
          ? '응답 대기 시간이 지났습니다. 저장 여부를 다시 확인하세요.'
          : '서버에 연결하지 못했습니다. 입력은 유지됩니다.'
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
