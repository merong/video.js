import { describe, expect, it, vi } from 'vitest';

import { AdminApi, ApiError } from '../../public/assets/admin/api.js';

describe('AdminApi', () => {
  it.each([
    [200, JSON.stringify({ ok: true, data: { saved: true } })],
    [403, JSON.stringify({ ok: false, error: { code: 'csrf', message: '토큰 확인 필요' } })],
    [500, '<html>Invalid JSON response</html>'],
  ])('adopts rotated CSRF before handling HTTP %s and never automatically repeats a mutation', async (status, body) => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(body, { status, headers: { 'X-CSRF-Token': 'next-token' } }));

    vi.stubGlobal('fetch', fetch);
    const api = new AdminApi('/api/index.php');

    api.csrfToken = 'consumed-token';
    const request = api.request('schedule-save', { data: { revision: 2 } });

    if (status === 200) await expect(request).resolves.toEqual({ saved: true });
    else await expect(request).rejects.toBeInstanceOf(ApiError);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(api.csrfToken).toBe('next-token');
    fetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, data: { saved: true } }), { headers: { 'X-CSRF-Token': '' } })
    );
    await api.request('schedule-save', { data: { revision: 3 } });
    expect(fetch.mock.calls[1][1].headers['X-CSRF-Token']).toBe('next-token');
    expect(api.csrfToken).toBe('next-token');
  });

  it('uses the host subpath, read-only GET, JSON writes and the current CSRF token', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, data: { saved: true } })));

    vi.stubGlobal('fetch', fetch);
    const api = new AdminApi('/customer/ads/api/index.php');

    api.csrfToken = 'rotated-token';
    await api.request('schedule-save', { data: { revision: 2 } });
    expect(fetch.mock.calls[0][0]).toContain('/customer/ads/api/index.php?action=schedule-save');
    expect(fetch.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'X-CSRF-Token': 'rotated-token', 'Content-Type': 'application/json' },
      body: '{"revision":2}',
    });
    fetch.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, data: { items: [] } })));
    await api.request('targets', { query: { type: 'category', boardId: 'a&b' } });
    expect(fetch.mock.calls[1][0]).toContain('boardId=a%26b');
    expect(fetch.mock.calls[1][1].method).toBe('GET');
    expect(fetch.mock.calls[1][1].headers).not.toHaveProperty('X-CSRF-Token');
  });

  it('lets the browser generate multipart boundaries for an upload', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, data: { creative: {} } })));

    vi.stubGlobal('fetch', fetch);
    const api = new AdminApi('/api/index.php');
    const data = new FormData();

    data.append('file', new File(['image'], 'image.png', { type: 'image/png' }));
    await api.request('creative-upload', { data });
    expect(fetch.mock.calls[0][1].headers).not.toHaveProperty('Content-Type');
    expect(fetch.mock.calls[0][1].body).toBe(data);
  });

  it('preserves conflict status and field messages without treating a failed envelope as success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            ok: false,
            error: { code: 'CONFLICT', message: '충돌', fields: { revision: '최신 초안 필요' } },
          }),
          { status: 409 }
        )
      )
    );
    const api = new AdminApi('/api/index.php');

    await expect(api.request('schedule-save', { data: {} })).rejects.toMatchObject({
      status: 409,
      code: 'CONFLICT',
      fields: { revision: '최신 초안 필요' },
    });
  });

  it('does not download an HTML login page or a successful JSON envelope as a CSV', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('<html>login</html>', { headers: { 'content-type': 'text/html' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, data: {} })));

    vi.stubGlobal('fetch', fetch);
    const api = new AdminApi('/api/index.php');

    await expect(api.request('stats-csv', { csv: true })).rejects.toBeInstanceOf(ApiError);
    await expect(api.request('stats-csv', { csv: true })).rejects.toThrow('CSV');
  });

  it('returns the server CSV unchanged after authenticated filter encoding', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response('\ufeff광고,시작\n광고1,2', { headers: { 'content-type': 'text/csv; charset=utf-8' } })
        )
    );
    const result = await new AdminApi('/api/index.php').request('stats-csv', {
      csv: true,
      query: { from: '2026-10-01', to: '2026-10-18' },
    });

    const content = await new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsText(result);
    });

    expect(content).toContain('광고1,2');
  });
});
