import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { AdminApi } from '../src/api/client';
import { lmsProgressList, lmsSettings, lmsTestToken, rotateLmsKey } from '../src/api/lms';

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- any JSON payload the fake API returns.
function stubFetch(data: unknown) {
  const fetch = vi.fn(
    async (_url: string, _init: RequestInit) =>
      new Response(JSON.stringify({ ok: true, data }), { headers: { 'Content-Type': 'application/json' } })
  );

  vi.stubGlobal('fetch', fetch);
  return fetch;
}

function api() {
  const value = new AdminApi('/api/index.php');

  value.csrfToken = 'token-1';
  return value;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('lmsSettings', () => {
  it('reads missing fields as no key', async () => {
    stubFetch({ installed: true });

    expect(await lmsSettings(api())).toEqual({ installed: true, keySet: false, keyHint: null, rotatedAt: null });
  });
});

describe('rotateLmsKey', () => {
  it('posts an empty object with the CSRF token and rejects a response without a key', async () => {
    const fetch = stubFetch({ key: 'ab'.repeat(32), keyHint: '…abab', rotatedAt: '2026-10-21T17:25:25Z' });

    expect((await rotateLmsKey(api())).keyHint).toBe('…abab');

    const [url, init] = fetch.mock.calls[0]!;

    expect(new URL(url, 'http://localhost/').searchParams.get('action')).toBe('lms-key-rotate');
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('X-CSRF-Token')).toBe('token-1');
    expect(init.body).toBe('{}');

    stubFetch({ keyHint: '…abab' });
    await expect(rotateLmsKey(api())).rejects.toThrow('LMS 응답을 읽지 못했어요.');
  });
});

describe('lmsTestToken', () => {
  it('leaves out an empty video length', async () => {
    const fetch = stubFetch({ token: 'a.b', expiresAt: '2026-10-21T18:25:25Z' });

    expect(await lmsTestToken(api(), { learnerId: 'student-7', minutes: 60 })).toEqual({
      token: 'a.b',
      expiresAt: '2026-10-21T18:25:25Z',
    });
    expect(JSON.parse(String(fetch.mock.calls[0]![1].body))).toEqual({ learnerId: 'student-7', minutes: 60 });
  });
});

describe('lmsProgressList', () => {
  it('sends only set filters and reads a partial response without breaking', async () => {
    const fetch = stubFetch({
      rows: [
        { learner: 'x:student-7', videoId: 'v-1', percent: 42.9, activeSeconds: 'x' },
        { learner: 'g:member', videoId: '' },
        'broken',
      ],
    });
    const result = await lmsProgressList(api(), { videoId: ' v-1 ', learner: '', status: 'all' }, 2);
    const query = new URL(fetch.mock.calls[0]![0], 'http://localhost/').searchParams;

    expect(query.get('videoId')).toBe('v-1');
    expect(query.has('learner')).toBe(false);
    expect(query.get('status')).toBe('all');
    expect(query.get('page')).toBe('2');
    expect(result).toEqual({
      rows: [
        {
          learner: 'x:student-7',
          videoId: 'v-1',
          percent: 42.9,
          completedAt: null,
          activeSeconds: 0,
          position: 0,
          duration: 0,
          updatedAt: null,
        },
      ],
      total: 1,
      page: 2,
      pageSize: 50,
    });
  });
});
