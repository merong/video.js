import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import type { Bootstrap } from '../src/api/actions';
import { AdminApi } from '../src/api/client';
import { App } from '../src/app/App';
import { locationFromHash, routesFor } from '../src/app/routes';
import { termHeadingId } from '../src/help';
import { DEFAULT_PLAYER_PRESET } from '../src/player';
import { presetFieldTerm } from '../src/screens/PlayerOptions';

type Host = 'standalone' | 'gnuboard';

interface Reply {
  status?: number;
  body: unknown;
}

type Handler = () => Reply;

function bootstrap(host: Host): Bootstrap {
  return {
    authenticated: true,
    csrfToken: 'token-1',
    capabilities: {
      host,
      manualTargets: host === 'standalone',
      uploads: true,
      loginUrl: host === 'gnuboard' ? '/bbs/login.php' : null,
      siteUrl: host === 'gnuboard' ? 'https://site.test/' : null,
      adminUrl: host === 'gnuboard' ? 'https://site.test/adm/' : null,
    },
    site: { siteId: 'site-1', timeZone: 'Asia/Seoul' },
    playerModuleUrl: '/assets/ads.js',
    limits: { uploadBytes: 8 * 1024 * 1024 },
    user: { displayName: '운영자' },
  };
}

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- any JSON payload the fake API returns.
const ok = (data: unknown): Reply => ({ body: { ok: true, data } });

const PRESET_LIST = {
  revision: 1,
  defaultPresetId: 'default',
  presets: [{ ...DEFAULT_PLAYER_PRESET, builtIn: true, createdAt: null, updatedAt: null }],
};

const ITEM = {
  adId: 'cr-1',
  creativeId: 'cr-1',
  creativeVersion: 1,
  alt: '',
  clickUrl: null,
};

const DRAFT = {
  target: { type: 'site', id: 'site-1' },
  mode: 'replace',
  revision: 2,
  breaks: [
    {
      breakId: 'break-1',
      position: 'pre',
      ads: [{ ...ITEM, itemId: 'item-1', kind: 'video', url: '/media/ad.mp4', mime: 'video/mp4', skipAfterSeconds: 5 }],
    },
    {
      breakId: 'break-2',
      position: 'mid',
      atSeconds: 10,
      ads: [
        {
          ...ITEM,
          itemId: 'item-2',
          kind: 'image',
          url: '/media/ad.png',
          mime: 'image/png',
          skipAfterSeconds: null,
          displaySeconds: 5,
        },
      ],
    },
    {
      breakId: 'break-3',
      position: 'post',
      ads: [
        { ...ITEM, itemId: 'item-3', kind: 'video', url: '/media/ad.mp4', mime: 'video/mp4', skipAfterSeconds: null },
      ],
    },
  ],
};

const TOTALS = {
  starts: 3,
  completes: 2,
  skips: 1,
  clicks: 1,
  clickedStarts: 1,
  errors: 0,
  completionRate: 0.667,
  clickRate: 0.333,
};

function serve(host: Host, handlers: Record<string, Handler> = {}) {
  const fetch = vi.fn(async (input: string) => {
    const action = new URL(input).searchParams.get('action') ?? '';
    const all = new Map<string, Handler>(
      Object.entries({
        bootstrap: () => ok(bootstrap(host)),
        creatives: () => ok({ items: [] }),
        'player-presets': () => ok(PRESET_LIST),
        ...handlers,
      })
    );
    const handler = all.get(action);
    if (!handler) throw new Error(`unexpected action ${action}`);

    const { status = 200, body } = handler();

    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  });

  vi.stubGlobal('fetch', fetch);
  return fetch;
}

function actions(fetch: ReturnType<typeof serve>): string[] {
  return fetch.mock.calls.map(([input]) => new URL(input).searchParams.get('action') ?? '');
}

function go(hash: string) {
  act(() => {
    location.hash = hash;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}

async function open(hash: string, heading: string) {
  history.replaceState(null, '', `/${hash}`);
  render(<App api={new AdminApi('http://admin.test/ads/api/index.php')} publicBase="/ads/" />);
  await screen.findByRole('heading', { level: 1, name: heading });
}

const href = (name: string) => screen.getByRole('link', { name }).getAttribute('href');

/** Names of the links and buttons in the top bar, in document order; the menu sits in the side bar. */
function topActions(): string[] {
  const banner = screen.getByRole('banner');

  expect(within(banner).queryByRole('navigation')).toBeNull();

  return [...banner.querySelectorAll('a, button')].map((element) => element.textContent?.trim() ?? '');
}

const focusedId = () => document.activeElement?.id;

const shown = (element: Element) => !element.closest('[hidden]');

/** Every help link on the shown screen as `<name> → <href>`, in document order. */
function helpLinks(): string[] {
  return [...document.querySelectorAll('main a[href^="#/help/"]')]
    .filter(shown)
    .map((link) => `${link.getAttribute('aria-label') ?? link.textContent} → ${link.getAttribute('href')}`);
}

/** Text as a screen reader reads it inside a description: a node's `aria-label` replaces its content. */
function spoken(node: Node): string {
  if (node instanceof Element && node.hasAttribute('aria-label')) return node.getAttribute('aria-label') ?? '';

  return node.nodeType === Node.TEXT_NODE ? (node.textContent ?? '') : [...node.childNodes].map(spoken).join('');
}

/** The descriptions screen readers attach to the shown controls; a help link must not end up in one. */
function descriptions(): string[] {
  return [...document.querySelectorAll('main [aria-describedby]')].filter(shown).map((element) =>
    (element.getAttribute('aria-describedby') ?? '')
      .split(' ')
      .map((id) => {
        const target = document.getElementById(id);

        return target ? spoken(target) : '';
      })
      .join(' ')
  );
}

beforeEach(() => {
  history.replaceState(null, '', '/');
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('locationFromHash', () => {
  it('keeps a known help term and drops anything else', () => {
    const routes = routesFor('standalone');

    expect(locationFromHash('#/help', routes, 'creatives')).toEqual({ id: 'help', path: '' });
    expect(locationFromHash('#/help/skip-offset', routes, 'creatives')).toEqual({ id: 'help', path: 'skip-offset' });
    expect(locationFromHash('#/help/no-such-term', routes, 'creatives')).toEqual({ id: 'help', path: '' });
    expect(locationFromHash('#/help/skip-offset/extra', routes, 'creatives')).toEqual({ id: 'help', path: '' });
  });

  it('ignores a query and one trailing slash', () => {
    const routes = routesFor('standalone');

    expect(locationFromHash('#/help?x=1', routes, 'creatives')).toEqual({ id: 'help', path: '' });
    expect(locationFromHash('#/help/skip-offset?x=1', routes, 'creatives')).toEqual({
      id: 'help',
      path: 'skip-offset',
    });
    expect(locationFromHash('#/help/skip-offset/', routes, 'creatives')).toEqual({ id: 'help', path: 'skip-offset' });
    expect(locationFromHash('#/help/skip-offset//', routes, 'creatives')).toEqual({ id: 'help', path: '' });
    expect(locationFromHash('#/players/new/', routes, 'creatives')).toEqual({ id: 'players', path: 'new' });
    expect(locationFromHash('#/players/edit/default/', routes, 'creatives')).toEqual({
      id: 'players',
      path: 'edit/default',
    });
    expect(locationFromHash('#/schedule/', routes, 'creatives')).toEqual({ id: 'schedule', path: '' });
  });

  it.each([
    ['standalone', 'house-ad'],
    ['standalone', 'ad-request'],
    ['gnuboard', 'advertiser'],
    ['gnuboard', 'video-context'],
  ] as const)('drops a term %s hides (%s)', (host, termId) => {
    expect(locationFromHash(`#/help/${termId}`, routesFor(host), 'x')).toEqual({ id: 'help', path: '' });
  });

  it('keeps a term the host shows', () => {
    expect(locationFromHash('#/help/house-ad', routesFor('gnuboard'), 'x')).toEqual({ id: 'help', path: 'house-ad' });
    expect(locationFromHash('#/help/advertiser', routesFor('standalone'), 'x')).toEqual({
      id: 'help',
      path: 'advertiser',
    });
  });

  it('keeps help out of the menu on both hosts', () => {
    for (const host of ['standalone', 'gnuboard'] as const) {
      expect(routesFor(host).find((route) => route.id === 'help')).toMatchObject({ nav: false, label: '도움말' });
    }
  });
});

describe('App help', () => {
  it('puts 도움말 before 집행 만들기 in the standalone top bar', async () => {
    serve('standalone');
    await open('#/creatives', '소재');

    const names = topActions();

    expect(names.slice(0, 2)).toEqual(['도움말', '집행 만들기']);
    expect(href('도움말')).toBe('#/help');
    expect(
      within(screen.getByRole('navigation', { name: '주 메뉴' })).queryByRole('link', { name: '도움말' })
    ).toBeNull();
  });

  it('puts 도움말 before 사이트 보기 in the gnuboard top bar', async () => {
    serve('gnuboard');
    await open('#/house', '하우스 광고');

    expect(topActions().slice(0, 2)).toEqual(['도움말', '사이트 보기']);
    expect(
      within(screen.getByRole('navigation', { name: '광고 관리 메뉴' })).queryByRole('link', { name: '도움말' })
    ).toBeNull();
  });

  it.each(['standalone', 'gnuboard'] as const)(
    'opens help without API requests besides bootstrap (%s)',
    async (host) => {
      const fetch = serve(host);

      await open('#/help', '도움말');
      expect(screen.getByRole('link', { name: '도움말' }).getAttribute('aria-current')).toBe('page');
      await waitFor(() => expect(focusedId()).toBe('aa-title-help'));

      // Give any request an effect would start a chance to show up.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
      });
      expect(actions(fetch)).toEqual(['bootstrap']);
    }
  );

  it.each(['standalone', 'gnuboard'] as const)('focuses the term heading on direct entry (%s)', async (host) => {
    serve(host);
    await open('#/help/skip-offset', '도움말');

    await waitFor(() => expect(focusedId()).toBe(termHeadingId('skip-offset')));
    expect(location.hash).toBe('#/help/skip-offset');
  });

  it('opens an unknown term as the help start page', async () => {
    serve('standalone');
    await open('#/help/no-such-term', '도움말');

    await waitFor(() => expect(location.hash).toBe('#/help'));
    await waitFor(() => expect(focusedId()).toBe('aa-title-help'));
  });

  it('focuses the page title for a term the host does not show', async () => {
    serve('standalone');
    await open('#/help/house-ad', '도움말');

    expect(document.getElementById(termHeadingId('house-ad'))).toBeNull();
    await waitFor(() => expect(focusedId()).toBe('aa-title-help'));
    // A hidden term is an unknown term on this host, so the address becomes the start page too.
    await waitFor(() => expect(location.hash).toBe('#/help'));
  });

  it('rewrites a gnuboard-hidden term to the start page', async () => {
    serve('gnuboard');
    await open('#/help/advertiser', '도움말');

    await waitFor(() => expect(location.hash).toBe('#/help'));
    await waitFor(() => expect(focusedId()).toBe('aa-title-help'));
  });

  it('opens a term behind a query or a trailing slash', async () => {
    serve('standalone');
    await open('#/help/skip-offset/', '도움말');

    // The workspace mounts after the bootstrap fetch, outside act(); it rewrites the hash in a passive effect.
    await waitFor(() => expect(location.hash).toBe('#/help/skip-offset'));
    await waitFor(() => expect(focusedId()).toBe(termHeadingId('skip-offset')));
  });

  it('keeps the players page and preset input across a help visit', async () => {
    serve('standalone');
    await open('#/players/new', '플레이어');
    fireEvent.change(screen.getByLabelText('이름'), { target: { value: '작성 중' } });

    go('#/help/player-preset');
    await waitFor(() => expect(focusedId()).toBe(termHeadingId('player-preset')));

    go('#/players/new');
    expect(document.getElementById('aa-title-players-page')?.textContent).toBe('새 프리셋');
    expect(screen.getByLabelText('이름')).toHaveProperty('value', '작성 중');
  });

  it('moves focus to the same term again after leaving help', async () => {
    serve('standalone');
    await open('#/help/skip-offset', '도움말');
    await waitFor(() => expect(focusedId()).toBe(termHeadingId('skip-offset')));

    go('#/dashboard');
    await waitFor(() => expect(focusedId()).not.toBe(termHeadingId('skip-offset')));

    go('#/help/skip-offset');
    await waitFor(() => expect(focusedId()).toBe(termHeadingId('skip-offset')));
  });

  it('moves focus between terms inside help and back to the title for the start page', async () => {
    serve('standalone');
    await open('#/help/skip-offset', '도움말');

    go('#/help/ad-break');
    await waitFor(() => expect(focusedId()).toBe(termHeadingId('ad-break')));

    go('#/help');
    await waitFor(() => expect(focusedId()).toBe('aa-title-help'));
  });

  it('follows a field HelpLink to its term', async () => {
    serve('standalone');
    await open('#/creatives', '소재');

    const link = screen.getByRole('link', { name: '대체텍스트 도움말' });

    expect(link.getAttribute('href')).toBe('#/help/alt-text');
    go(link.getAttribute('href') ?? '');
    await waitFor(() => expect(focusedId()).toBe(termHeadingId('alt-text')));
  });
});

describe('HelpLink placement', () => {
  it('links the creative fields', async () => {
    serve('standalone');
    await open('#/creatives', '소재');

    expect(helpLinks()).toEqual([
      '보관 도움말 → #/help/archive',
      '소재 도움말 → #/help/creative',
      '등록 방식 도움말 → #/help/creative-source',
      '대체텍스트 도움말 → #/help/alt-text',
    ]);
    expect(descriptions().filter((text) => text.includes('도움말'))).toEqual([]);
    // The archive link sits in the toolbar, so the 상태 column keeps its own name.
    expect(screen.getByRole('columnheader', { name: '상태' })).toBeTruthy();
  });

  it('links 하우스 광고 only on gnuboard', async () => {
    serve('gnuboard');
    await open('#/house', '하우스 광고');

    expect(href('하우스 광고 도움말')).toBe('#/help/house-ad');
  });

  it('links every schedule, break and playback position', async () => {
    serve('standalone', {
      creatives: () => ok({ items: [] }),
      'schedule-draft': () => ok({ draft: DRAFT, publishedVersion: 4, resolvedFrom: { type: 'site', id: 'site-1' } }),
    });
    await open('#/schedule', '지면 편성');
    fireEvent.click(screen.getByRole('button', { name: '편성 불러오기' }));
    await screen.findByText('게시 v4');

    // The mid-roll heading has no link; its position field links the term instead.
    expect(helpLinks()).toEqual([
      '적용 단위 도움말 → #/help/target-scope',
      '게시본과 게시 버전 도움말 → #/help/publish-version',
      '초안 revision 도움말 → #/help/draft-revision',
      '직접 편성 · 전체 대체 도움말 → #/help/replace',
      '광고 구간 도움말 → #/help/ad-break',
      '프리롤 도움말 → #/help/pre-roll',
      '클릭 목적지 URL 도움말 → #/help/click-through-url',
      '이 광고의 스킵 도움말 → #/help/ad-skip',
      '스킵 대기 도움말 → #/help/skip-offset',
      '광고 항목과 순서 도움말 → #/help/ad-item',
      '미드롤 도움말 → #/help/mid-roll',
      '클릭 목적지 URL 도움말 → #/help/click-through-url',
      '이 광고의 스킵 도움말 → #/help/ad-skip',
      '이미지 · GIF 표시 시간 도움말 → #/help/image-display-time',
      '광고 항목과 순서 도움말 → #/help/ad-item',
      '포스트롤 도움말 → #/help/post-roll',
      '클릭 목적지 URL 도움말 → #/help/click-through-url',
      '이 광고의 스킵 도움말 → #/help/ad-skip',
      '광고 항목과 순서 도움말 → #/help/ad-item',
      '초안 도움말 → #/help/draft',
      '게시 도움말 → #/help/publish',
      '고정 영상 ID 도움말 → #/help/fixed-video-id',
      // The preview card's heading, then its "적용할 프리셋" pick, which the test links use too.
      '게시 전 미리보기 도움말 → #/help/preview',
      '프리셋 도움말 → #/help/player-preset',
      '게시본 재생 테스트 도움말 → #/help/play-test',
    ]);
    expect(descriptions().filter((text) => text.includes('도움말'))).toEqual([]);
    // A help link sits beside the label, so the control keeps its name.
    expect(screen.getByLabelText('스킵 대기 (초)')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('이 대상의 광고'), { target: { value: 'inherit' } });
    expect(href('상위 설정 상속 도움말')).toBe('#/help/inherit');
    fireEvent.change(screen.getByLabelText('이 대상의 광고'), { target: { value: 'disabled' } });
    expect(href('광고 비활성화 · 상속 중단 도움말')).toBe('#/help/disabled');

    // The standalone video context form shows for a video target only.
    fireEvent.change(screen.getByLabelText('적용 단위'), { target: { value: 'video' } });
    expect(href('영상 소속 연결 도움말')).toBe('#/help/video-context');
  });

  it('links the draft conflict reload', async () => {
    serve('standalone', {
      'schedule-draft': () => ok({ draft: DRAFT, publishedVersion: 4, resolvedFrom: { type: 'site', id: 'site-1' } }),
      'schedule-save': () => ({ status: 409, body: { ok: false, error: { code: 'revision_conflict', message: 'x' } } }),
    });
    await open('#/schedule', '지면 편성');
    fireEvent.click(screen.getByRole('button', { name: '편성 불러오기' }));
    await screen.findByText('게시 v4');
    fireEvent.click(screen.getByRole('button', { name: '초안 저장' }));

    expect((await screen.findByRole('link', { name: '초안 충돌 도움말' })).getAttribute('href')).toBe(
      '#/help/revision-conflict'
    );
  });

  it('has no video context link on gnuboard', async () => {
    serve('gnuboard', {
      'schedule-draft': () => ok({ draft: DRAFT, publishedVersion: 4, resolvedFrom: { type: 'site', id: 'site-1' } }),
    });
    await open('#/schedule', '지면 편성');

    expect(screen.queryByRole('link', { name: '영상 소속 연결 도움말' })).toBeNull();
  });

  it('links the stats terms beside the CSV button, not in the start date description', async () => {
    serve('gnuboard', { stats: () => ok({ totals: TOTALS, rows: [], timeZone: 'Asia/Seoul', asOf: '2026-10-20' }) });
    await open('#/stats', '통계');

    expect(helpLinks()).toEqual(['조회 조건과 CSV 도움말 → #/help/stats-csv']);
    expect(screen.getByLabelText('시작일').getAttribute('aria-describedby')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '통계 조회' }));

    expect((await screen.findByRole('link', { name: '시작' })).getAttribute('href')).toBe('#/help/start');
    expect(href('완료와 완료율')).toBe('#/help/completion');
    expect(href('클릭')).toBe('#/help/click');
    expect(href('클릭률')).toBe('#/help/click-through-rate');
  });

  it('links the standalone report stats', async () => {
    serve('standalone');
    await open('#/reports', '리포트');

    expect(href('조회 조건과 CSV 도움말')).toBe('#/help/stats-csv');
  });

  it('links every preset editor, list and setup position', async () => {
    serve('standalone');
    await open('#/players/new', '플레이어');

    expect(helpLinks()).toEqual([
      '프리셋 도움말 → #/help/player-preset',
      '플레이어 종류 도움말 → #/help/player-type',
      '테마 속성 도움말 → #/help/player-theme-property',
      '강조색 도움말 → #/help/player-accent-color',
      '강조색 도움말 → #/help/player-accent-color',
      '화면 채우기 도움말 → #/help/player-object-fit',
      '진도율 도움말 → #/help/lms-progress-rate',
      '본 곳까지만 도움말 → #/help/lms-seek-limit',
      '완료 기준 도움말 → #/help/lms-completion',
      '플레이어 화면 언어 도움말 → #/help/player-ad-language',
      '광고 화면 도움말 → #/help/player-ad-overlay',
      '광고 화면 도움말 → #/help/player-ad-overlay',
    ]);
    expect(descriptions().filter((text) => text.includes('도움말'))).toEqual([]);

    go('#/players');
    await screen.findByRole('link', { name: '사이트 적용 프리셋 도움말' });
    expect(helpLinks()).toEqual([
      '프리셋 도움말 → #/help/player-preset',
      '사이트 적용 프리셋 도움말 → #/help/player-default-preset',
    ]);

    go('#/players/setup');
    await screen.findByRole('link', { name: '로더 도움말' });
    expect(helpLinks()).toEqual([
      '로더 도움말 → #/help/player-loader',
      '자리 요소 도움말 → #/help/player-placeholder',
      '고정 영상 ID 도움말 → #/help/fixed-video-id',
      // The data-lang row of the 자리 요소 속성 table.
      '플레이어 화면 언어 도움말 → #/help/player-ad-language',
      '예전 정적 코드 도움말 → #/help/player-install-snippet',
      '프리셋 도움말 → #/help/player-preset',
      '미디어 형식 도움말 → #/help/player-media-engine',
    ]);
    expect(descriptions().filter((text) => text.includes('도움말'))).toEqual([]);
    // The media link sits beside the legend, outside the group's name and description.
    const media = screen.getByRole('group', { name: '미디어' });

    expect(spoken(document.getElementById(media.getAttribute('aria-describedby') ?? '')!)).toBe(
      'HLS는 Video.js 플레이어에서만 쓸 수 있어요.'
    );
  });

  it('links each option row to the term for its preset field', async () => {
    serve('standalone');
    await open('#/players/options', '플레이어');

    expect(screen.getAllByRole('link', { name: '강조색 도움말' }).length).toBeGreaterThan(0);
    expect(presetFieldTerm('theme.accentTextColor')).toBe('player-accent-color');
    expect(presetFieldTerm('theme.borderRadius')).toBe('player-theme-property');
    expect(presetFieldTerm('theme.objectFit')).toBe('player-object-fit');
    expect(presetFieldTerm('language')).toBe('player-ad-language');
    expect(presetFieldTerm('ads.labels')).toBe('player-ad-overlay');
    expect(presetFieldTerm('ads.accentColor')).toBe('player-ad-overlay');
    expect(presetFieldTerm('ads.timeouts.loadSeconds')).toBe('player-type');
    expect(presetFieldTerm('ads.timeouts.stallSeconds')).toBe('player-type');
    expect(presetFieldTerm(undefined)).toBeUndefined();
  });
});
