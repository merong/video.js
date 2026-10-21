import { readFileSync } from 'node:fs';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { BUILT_IN_PRESETS } from '../../public/examples/demo-state.js';
import { readPlayTestQuery, startPlayTestPage } from '../../public/examples/play-test.js';

const page = readFileSync('integrations/ads-manager/public/examples/play-test.html', 'utf8');
const schedule = {
  videoId: 'free:1:main',
  breaks: [{ breakId: 'pre', position: 'pre', ads: [{ itemId: 'a' }] }],
};
const renders = new Map([
  ['default', { render: { playerType: 'videojs' } }],
  ['rounded', { render: { playerType: 'videojs' } }],
  ['accent', { render: { playerType: 'native' } }],
]);

interface AdEvent {
  type: string;
  breakId: string;
  itemId: string;
  occurredAt: string;
}

type PlayTestQuery = ReturnType<typeof readPlayTestQuery>;

interface StartOptions {
  preset: string | null;
  onError: (error: { code: string; message: string }) => void;
  onEvent: (event: AdEvent) => void;
}

/** Run the page on the real markup with fake preset API, loader and schedule. */
async function run(search: string, { fail = false } = {}) {
  const parsed = new DOMParser().parseFromString(page, 'text/html');
  // Like the loader: an unknown id reports `preset_not_found` and plays the built-in default.
  const start = vi.fn(async (_element: HTMLElement, _query: PlayTestQuery, options: StartOptions) => {
    if (fail) throw new Error('load_failed');

    const missing = options.preset !== null && !renders.has(options.preset);

    if (missing) options.onError({ code: 'preset_not_found', message: '프리셋을 찾지 못했습니다.' });

    return { schedule: null, fallback: missing };
  });
  const loadPreset = vi.fn(async (id: string) => renders.get(id) ?? { missing: true });

  document.body.replaceChildren(...parsed.body.childNodes);

  const result = await startPlayTestPage(document, `https://host.test/examples/play-test.html${search}`, {
    loadPresets: async () => ({
      items: BUILT_IN_PRESETS.map((item) => ({ ...item, site: item.id === 'rounded', builtIn: true })),
      siteId: 'rounded',
      signedIn: false,
    }),
    loadPreset,
    start,
    loadSchedule: async () => schedule,
  });

  return { result, start, loadPreset };
}

const $ = (id: string) => document.getElementById(id)!;

afterEach(() => {
  document.body.replaceChildren();
});

describe('startPlayTestPage', () => {
  it('shows the empty state without a video and mounts nothing', async () => {
    const { start } = await run('');

    expect(start).not.toHaveBeenCalled();
    expect($('stage-empty').hidden).toBe(false);
    expect($('stage-view').classList.contains('is-empty')).toBe(true);
    expect($('conditions').hidden).toBe(true);
  });

  it('plays the site preset without asking for it by id, and lists the conditions', async () => {
    const { start } = await run('?video=free:1:main&preset=rounded');

    expect(start.mock.calls[0]![2]).toMatchObject({ preset: null });
    expect($('cond-preset').textContent).toBe('둥근 테두리 (사이트 적용)');
    expect($('cond-video').textContent).toBe('free:1:main');
    expect($('cond-src').textContent).toMatch(/\/demo-media\/content\.mp4$/);
    expect($('preset-note').hidden).toBe(true);
  });

  it('passes an unknown id to the loader and notes its default fallback', async () => {
    const { start } = await run('?video=v&preset=p-abcdefghij');

    expect(start.mock.calls[0]![2]).toMatchObject({ preset: 'p-abcdefghij' });
    expect($('preset-note').hidden).toBe(false);
    expect($('preset-note').textContent).toBe(
      '프리셋을 찾지 못했어요(p-abcdefghij). 설치한 페이지와 같이 기본 설정으로 재생해요.'
    );
    expect($('status').textContent).toBe('');
  });

  it('warns about a preset for the other player and still passes it to the loader', async () => {
    const { start } = await run('?video=v&preset=accent');

    expect(start.mock.calls[0]![2]).toMatchObject({ preset: 'accent' });
    expect($('preset-note').hidden).toBe(false);
    expect($('preset-note').textContent).toBe(
      '‘강조색’ 프리셋은 기본 video용이에요. Video.js에서는 이 프리셋 대신 기본값으로 재생해요. 로더도 같은 규칙이에요.'
    );
  });

  it('notes ignored address values', async () => {
    await run('?video=v&type=flash');

    expect($('query-note').hidden).toBe(false);
    expect($('query-note').textContent).toBe('주소의 값 1개를 무시했어요. type=flash · 기본값으로 재생해요.');
  });

  it('labels progress from the published schedule', async () => {
    const { start } = await run('?video=free:1:main');

    start.mock.calls[0]![2].onEvent({
      type: 'start',
      breakId: 'pre',
      itemId: 'a',
      occurredAt: '2026-10-21T03:04:05.000Z',
    });

    expect($('now').textContent).toContain('프리롤 1/1 재생 중');
    expect([...$('log').querySelectorAll('li > span')].map((item) => item.textContent)).toEqual(['프리롤 1/1 · 시작']);
  });

  it('shows the failure with a reload button', async () => {
    await run('?video=v', { fail: true });

    expect($('status').textContent).toBe('플레이어를 만들지 못했어요. 다시 불러오기를 눌러 주세요.');
    expect($('status').getAttribute('role')).toBe('alert');
    expect($('restart').hidden).toBe(false);
  });
});
