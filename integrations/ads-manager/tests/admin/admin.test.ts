import { execFileSync } from 'node:child_process';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import schedule from '../../contract/playback-v1.json';
const template = execFileSync(
  'php',
  ['-r', '$adsPage = ["apiUrl" => "/customer/ads/api/index.php"]; include "integrations/ads-manager/admin/index.php";'],
  { encoding: 'utf8' }
);
const get = (name) => document.getElementById(`ads-${name}`);
const form = (name) => {
  const element = get(name);
  if (!(element instanceof HTMLFormElement)) throw new Error(`Missing form: ${name}`);

  return element;
};
const calls: Array<{ action: string; payload: any; url: URL }> = [];
let saveStatus = 200;
let published = false;
let csrf = 'session-csrf';
let authenticated = true;
let host = 'standalone';
let playerModuleUrl: string | null = null;

// Isolated wire fixture. This does not assert real authentication, persistence or playback.
async function respond(input, init) {
  const url = new URL(input);
  const action = url.searchParams.get('action');
  const payload = init.body && !(init.body instanceof FormData) ? JSON.parse(init.body) : init.body;

  calls.push({ action, payload, url });
  const creative = {
    creativeId: 'creative-image',
    version: 1,
    name: '<img src=x onerror=alert(1)>',
    kind: 'image',
    url: '/a.png',
    mime: 'image/png',
    alt: '광고',
    source: 'url',
    archived: false,
    createdAt: '2026-10-18T00:00:00Z',
  };
  const draft = {
    target: { type: 'site', id: 'site-local' },
    mode: 'replace',
    revision: 2,
    breaks: structuredClone(schedule.breaks),
  };
  let data;

  switch (action) {
    case 'bootstrap':
      data = {
        authenticated,
        csrfToken: csrf,
        apiUrl: '/customer/ads/api/index.php',
        site: { siteId: 'site-local', timeZone: 'Asia/Seoul' },
        playerModuleUrl,
        limits: { uploadBytes: 104857600 },
        capabilities: {
          host,
          manualTargets: host === 'standalone',
          uploads: true,
          loginUrl: host === 'gnuboard' ? '/bbs/login.php' : null,
        },
      };
      break;
    case 'login':
      authenticated = true;
      csrf = 'rotated-csrf';
      data = { authenticated };
      break;
    case 'creatives':
      data = { items: [creative] };
      break;
    case 'schedule-draft':
      data = { draft, publishedVersion: published ? 5 : 4, resolvedFrom: draft.target };
      break;
    case 'schedule-save':
      if (saveStatus !== 200)
        return new Response(JSON.stringify({ ok: false, error: { code: 'CONFLICT', message: 'revision conflict' } }), {
          status: saveStatus,
        });

      data = { draft: { ...payload, revision: 3 }, publishedVersion: 4, resolvedFrom: draft.target };
      break;
    case 'schedule-publish':
      published = true;
      data = { scheduleId: 'schedule-site', scheduleVersion: 5 };
      break;
    case 'schedule-preview':
      data = { schedule };
      break;
    case 'video-context-save':
      data = { saved: true };
      break;
    case 'stats':
      data = {
        totals: {
          starts: 0,
          completes: 0,
          skips: 0,
          clicks: 0,
          clickedStarts: 0,
          errors: 2,
          completionRate: null,
          clickRate: null,
        },
        rows: [],
        timeZone: 'Asia/Seoul',
        asOf: '2026-10-18T01:00:00Z',
      };
      break;
    case 'targets':
      data = { items: [{ target: { type: 'board', id: 'verified-board' }, label: '확인된 게시판' }] };
      break;
    default:
      throw new Error(`Unexpected fixture API action: ${action}`);
  }

  return new Response(JSON.stringify({ ok: true, data }), { headers: { 'content-type': 'application/json' } });
}

async function idle() {
  await vi.waitFor(() => expect(get('workspace').inert).toBe(false));
}
async function submit(name) {
  form(name).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await idle();
}
function change(element, value, type = 'change') {
  element.value = value;
  element.dispatchEvent(new Event(type, { bubbles: true }));
}
async function loadDraft() {
  document.querySelector<HTMLButtonElement>('[data-page="schedule"]').click();
  await submit('target-form');
}

beforeEach(async () => {
  vi.resetModules();
  calls.length = 0;
  saveStatus = 200;
  published = false;
  csrf = 'session-csrf';
  authenticated = true;
  host = 'standalone';
  playerModuleUrl = null;
  document.open();
  document.write(template);
  document.close();
  vi.stubGlobal('fetch', vi.fn(respond));
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  await import('../../public/assets/admin/admin.js');
  await idle();
});

afterEach(() => {
  window.dispatchEvent(new Event('pagehide'));
});

describe('admin/index.php', () => {
  it('previews saved media without requiring a new file or losing unsaved form input', () => {
    change(form('creative-form').elements.namedItem('name'), '작성 중 소재', 'input');
    get('creatives-list').querySelector('button').click();
    expect(get('creative-media').querySelector('img').getAttribute('src')).toBe('/a.png');
    expect(form('creative-form').elements.namedItem('name').value).toBe('작성 중 소재');
    expect(calls.some((call) => call.action === 'events')).toBe(false);
  });

  it('refreshes rotated login CSRF before the next write while preserving a draft', async () => {
    await loadDraft();
    change(document.querySelector('#ads-item-pre-image [data-click]'), '/keep-this', 'input');
    authenticated = false;
    get('reconnect').click();
    await idle();
    form('login-form').elements.namedItem('username').value = 'admin';
    form('login-form').elements.namedItem('password').value = ' password with spaces ';
    await submit('login-form');
    expect(calls.find((call) => call.action === 'login').payload.password).toBe(' password with spaces ');
    expect(form('login-form').elements.namedItem('password').value).toBe('');
    expect(document.querySelector<HTMLInputElement>('#ads-item-pre-image [data-click]').value).toBe('/keep-this');
    await submit('schedule-form');
    const request = vi.mocked(fetch).mock.calls.find(([url]) => String(url).includes('action=schedule-save'));

    expect(request[1].headers['X-CSRF-Token']).toBe('rotated-csrf');
  });

  it('uses host subpath assets and renders creative labels as text', () => {
    expect(document.querySelector('script[type="module"]').getAttribute('src')).toBe(
      '/customer/ads/assets/admin/admin.js'
    );
    expect(get('creatives-list').textContent).toContain('<img src=x onerror=alert(1)>');
    expect(get('creatives-list').querySelector('img')).toBeNull();
    expect(form('target-form').elements.namedItem('targetId').value).toBe('site-local');
  });

  it('reorders a mixed pod, saves a new draft without publishing, then posts the saved revision', async () => {
    await loadDraft();
    document.querySelector<HTMLButtonElement>('#ads-break-pre-1 [data-down]').click();
    expect(get('publish').disabled).toBe(true);
    await submit('schedule-form');
    const save = calls.find((call) => call.action === 'schedule-save');

    expect(save.payload.breaks[0].ads.map((ad) => ad.itemId)).toEqual(['pre-video', 'pre-image']);
    expect(calls.some((call) => call.action === 'schedule-publish')).toBe(false);
    expect(get('live-state').textContent).toBe('게시 v4');
    expect(get('publish').disabled).toBe(false);
    get('publish').click();
    await idle();
    expect(calls.find((call) => call.action === 'schedule-publish').payload).toEqual({
      target: { type: 'site', id: 'site-local' },
      revision: 3,
    });
    expect(get('live-state').textContent).toBe('게시 v5');
  });

  it('preserves edited input and published version on a revision conflict', async () => {
    await loadDraft();
    const click = document.querySelector<HTMLInputElement>('#ads-item-pre-image [data-click]');

    change(click, '/new-offer', 'input');
    saveStatus = 409;
    await submit('schedule-form');
    expect(click.value).toBe('/new-offer');
    expect(get('draft-state').textContent).toContain('저장하지 않은');
    expect(get('live-state').textContent).toBe('게시 v4');
    expect(get('conflict-reload').hidden).toBe(false);
    expect(get('schedule-status').textContent).toContain('현재 입력은 보존');
  });

  it('explicit disabled suppresses stale hidden required controls and submits an empty replacement payload', async () => {
    await loadDraft();
    change(document.querySelector('#ads-item-pre-image [data-duration]'), '', 'input');
    change(get('mode'), 'disabled');
    expect(form('schedule-form').checkValidity()).toBe(true);
    await submit('schedule-form');
    const save = calls.find((call) => call.action === 'schedule-save');

    expect(save.payload.mode).toBe('disabled');
    expect(save.payload.breaks).toEqual([]);
    expect(get('live-state').textContent).toBe('게시 v4');
  });

  it('rejects image skip at its end before any save request', async () => {
    await loadDraft();
    change(document.querySelector('#ads-item-pre-image [data-skip]'), '5', 'input');
    await submit('schedule-form');
    expect(calls.some((call) => call.action === 'schedule-save')).toBe(false);
    expect(get('schedule-status').textContent).toContain('표시 시간보다 짧아야');
  });

  it('sends trusted standalone video membership only through the admin action', async () => {
    const context = form('context-form');

    for (const [key, value] of Object.entries({
      videoId: 'content-stable',
      label: '강의 1',
      boardId: 'course',
      categoryId: 'basic',
    }))
      context.elements.namedItem(key).value = value;

    await submit('context-form');
    expect(calls.find((call) => call.action === 'video-context-save').payload).toEqual({
      videoId: 'content-stable',
      label: '강의 1',
      boardId: 'course',
      categoryId: 'basic',
    });
  });

  it('shows no-start ratios and empty filtered stats without inventing playback data', async () => {
    const stats = form('stats-form');

    stats.elements.namedItem('from').value = '2026-10-01';
    stats.elements.namedItem('to').value = '2026-10-18';
    stats.elements.namedItem('boardId').value = 'board-1';
    await submit('stats-form');
    const query = calls.find((call) => call.action === 'stats').url.searchParams;

    expect(query.get('boardId')).toBe('board-1');
    expect(get('metrics').textContent).toContain('완료율—');
    expect(get('metrics').textContent).toContain('오류2');
    expect(get('stats-status').textContent).toContain('기록이 없습니다');
  });

  it('marks preview unavailable when the bootstrap has no player bundle', async () => {
    await loadDraft();
    expect(get('preview-open').disabled).toBe(true);
    expect(get('preview-open').title).toContain('아직 연결되지');
    expect(calls.some((call) => call.action === 'schedule-preview' || call.action === 'events')).toBe(false);
  });

  it('renders preview observations and retained diagnostics, then stops updates on close without collecting events', async () => {
    // jsdom checks the rendered form and observation binding, not native dialog focus or media playback.
    const dialog = get('preview-dialog');

    dialog.showModal = () => {
      dialog.open = true;
    };
    dialog.close = () => {
      dialog.open = false;
      dialog.dispatchEvent(new Event('close'));
    };
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
    playerModuleUrl = '/integrations/ads-manager/tests/admin/fixtures/player.js';
    get('reconnect').click();
    await idle();
    await loadDraft();
    get('preview-open').click();
    form('preview-form').elements.namedItem('contentUrl').value = '/actual-content.mp4';
    form('preview-form').elements.namedItem('videoId').value = 'video-1';
    form('preview-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(get('preview-context').textContent).toContain('영상 video-1'));
    const player = await import('./fixtures/player.js');
    const instance = player.calls.at(-1)!;

    expect(get('preview-settings').open).toBe(false);
    expect(instance.options).toMatchObject({ preview: true });
    expect(instance.options).not.toHaveProperty('tracking');
    expect(get('preview-status').dataset.phase).toBe('loading');
    instance.options.onEvent({ type: 'start', adId: 'creative-image', breakId: 'pre-1', itemId: 'pre-image' });
    expect(get('preview-status').textContent).toContain('광고 1/2 진행 중');
    instance.options.onEvent({ type: 'error', adId: 'creative-image', code: 'creative_load_failed' });
    get('preview-video').dispatchEvent(new Event('playing'));
    expect(get('preview-status').textContent).toContain('본편');
    expect(get('preview-notice').textContent).toContain('광고 소재를 불러오지 못했습니다');
    expect(get('preview-events').textContent).toContain('본편 복귀');
    get('preview-close').click();
    const text = get('preview-status').textContent;

    instance.options.onEvent({ type: 'start', adId: 'late-ad' });
    expect(get('preview-status').textContent).toBe(text);
    expect(instance.destroyed).toBe(true);
    expect(calls.filter((call) => call.action === 'schedule-preview')).toHaveLength(1);
    expect(calls.some((call) => call.action === 'events')).toBe(false);
  });

  it('uses host login and verified target lookup instead of standalone membership in GnuBoard mode', async () => {
    host = 'gnuboard';
    authenticated = false;
    get('reconnect').click();
    await idle();
    expect(get('login-form').hidden).toBe(true);
    expect(get('host-login').getAttribute('href')).toBe('/bbs/login.php');
    authenticated = true;
    get('reconnect').click();
    await idle();
    change(form('target-form').elements.namedItem('targetType'), 'board');
    expect(get('manual-target-label').hidden).toBe(true);
    expect(get('context-panel').hidden).toBe(true);
    expect(get('logout').hidden).toBe(true);
    get('target-search').click();
    await idle();
    change(form('target-form').elements.namedItem('choice'), '0');
    await submit('target-form');
    expect(calls.find((call) => call.action === 'schedule-draft').url.searchParams.get('targetId')).toBe(
      'verified-board'
    );
  });
});
