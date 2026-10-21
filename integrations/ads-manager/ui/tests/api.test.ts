import { describe, expect, it, vi } from 'vite-plus/test';

import { AdminApi, ApiError } from '../src/api/client';

interface Reply {
  status?: number;
  body?: unknown;
  token?: string;
  contentType?: string;
}

function stubFetch(...replies: Reply[]) {
  const fetch = vi.fn(async (_url: string, _init: RequestInit) => {
    const reply = replies.shift() ?? {};
    const headers = new Headers({ 'Content-Type': reply.contentType ?? 'application/json' });

    if (reply.token) headers.set('X-CSRF-Token', reply.token);

    const body =
      reply.contentType === 'text/csv' ? String(reply.body) : JSON.stringify(reply.body ?? { ok: true, data: {} });

    return new Response(body, { status: reply.status ?? 200, headers });
  });

  vi.stubGlobal('fetch', fetch);
  return fetch;
}

/**
 * Depending on the Node version, the test `Response` returns either a Node Blob or a jsdom Blob, and jsdom's Blob has
 * no `text()`. jsdom's `FileReader` reads its own Blobs; Node Blobs keep their native `text()`.
 */
function readText(blob: Blob): Promise<string> {
  if ('text' in blob) return blob.text();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

function call(fetch: ReturnType<typeof stubFetch>, index = 0) {
  const args = fetch.mock.calls[index];
  if (!args) throw new Error(`fetch call ${index} was not made`);

  const [url, init] = args;

  return { url: new URL(url), init, headers: new Headers(init.headers) };
}

describe('AdminApi', () => {
  it('rejects an unsafe API URL', () => {
    expect(() => new AdminApi('javascript:alert(1)')).toThrow();
    expect(() => new AdminApi('//evil.example/api/index.php')).toThrow();
  });

  it('reads with GET, no token and no body, skipping empty query values', async () => {
    const fetch = stubFetch({ body: { ok: true, data: { items: [] } } });
    const api = new AdminApi('/api/index.php');

    api.csrfToken = 'secret';

    await expect(api.request('targets', { query: { type: 'board', query: '', boardId: undefined } })).resolves.toEqual({
      items: [],
    });

    const { url, init, headers } = call(fetch);

    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
    expect(headers.has('X-CSRF-Token')).toBe(false);
    expect(url.searchParams.get('action')).toBe('targets');
    expect(url.searchParams.get('type')).toBe('board');
    expect(url.searchParams.has('query')).toBe(false);
    expect(url.searchParams.has('boardId')).toBe(false);
  });

  it('sends a JSON write once with the current token and adopts the rotated token', async () => {
    const fetch = stubFetch({ body: { ok: true, data: { saved: true } }, token: ' next ' });
    const api = new AdminApi('/api/index.php');

    api.csrfToken = 'first';

    await api.request('schedule-save', { data: { mode: 'replace' } });

    const { init, headers } = call(fetch);

    expect(init.method).toBe('POST');
    expect(headers.get('X-CSRF-Token')).toBe('first');
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(init.body).toBe('{"mode":"replace"}');
    expect(api.csrfToken).toBe('next');
  });

  it('adopts a rotated token from an error response', async () => {
    stubFetch({
      status: 422,
      token: 'rotated',
      body: {
        ok: false,
        error: { code: 'VALIDATION', message: '입력을 확인해 주세요.', fields: { name: '이름을 입력해 주세요.' } },
      },
    });
    const api = new AdminApi('/api/index.php');

    api.csrfToken = 'used';

    const error = await api.request('creative-save', { data: {} }).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 422, code: 'VALIDATION', fields: { name: '이름을 입력해 주세요.' } });
    expect(api.csrfToken).toBe('rotated');
  });

  it('reports 409 as a conflict status without retrying', async () => {
    const fetch = stubFetch({ status: 409, body: { ok: false, error: { code: 'CONFLICT', message: 'stale' } } });
    const api = new AdminApi('/api/index.php');

    await expect(api.request('schedule-save', { data: {} })).rejects.toMatchObject({ status: 409, code: 'CONFLICT' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('does not retry a write after a network failure', async () => {
    const fetch = vi.fn(async (_url: string, _init: RequestInit) => {
      throw new TypeError('Failed to fetch');
    });

    vi.stubGlobal('fetch', fetch);

    const api = new AdminApi('/api/index.php');

    await expect(api.request('schedule-publish', { data: {} })).rejects.toMatchObject({ status: 0, code: 'NETWORK' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('adds the token as a multipart field without changing the caller’s FormData', async () => {
    const fetch = stubFetch({});
    const api = new AdminApi('/api/index.php');
    const data = new FormData();

    data.append('name', 'clip');
    data.append('csrfToken', 'stale');
    api.csrfToken = 'fresh';

    await api.request('creative-upload', { data });

    const { init, headers } = call(fetch);
    const sent = init.body;
    if (!(sent instanceof FormData)) throw new Error('multipart body expected');

    expect(headers.get('X-CSRF-Token')).toBe('fresh');
    // The browser sets the multipart boundary itself.
    expect(headers.has('Content-Type')).toBe(false);
    expect(sent.getAll('csrfToken')).toEqual(['fresh']);
    expect(sent.get('name')).toBe('clip');
    expect(data.getAll('csrfToken')).toEqual(['stale']);
  });

  it('returns CSV as a Blob', async () => {
    stubFetch({ contentType: 'text/csv', body: 'a,b\n1,2\n' });
    const api = new AdminApi('/api/index.php');
    const blob = await api.request('stats-csv', { query: { from: '2026-10-01', to: '2026-10-20' }, csv: true });

    expect(blob.type).toBe('text/csv');
    expect(await readText(blob)).toBe('a,b\n1,2\n');
  });

  it('turns an unreadable body into an ApiError with the HTTP status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<html>', { status: 500, headers: { 'Content-Type': 'text/html' } }))
    );

    await expect(new AdminApi('/api/index.php').request('bootstrap')).rejects.toMatchObject({ status: 500 });
  });

  it('reports a timeout once and does not retry the write', async () => {
    vi.useFakeTimers();

    try {
      const fetch = vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
          })
      );

      vi.stubGlobal('fetch', fetch);

      const api = new AdminApi('/api/index.php');
      const result = expect(api.request('creative-save', { data: { name: 'clip' } })).rejects.toMatchObject({
        message: '응답 대기 시간이 지났어요. 저장됐는지 다시 확인해 주세요.',
        code: 'NETWORK',
      });

      await vi.advanceTimersByTimeAsync(30_000);
      await result;
      expect(fetch).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
