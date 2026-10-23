// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vite-plus/test';

import { HelpLink, HelpScreen, helpTerms, termHeadingId, termsFor } from '../src/help';
import { HELP_MOTIONS, motionFor } from '../src/help/motions';
import { HELP_TERMS } from '../src/help/terms';

const hosts = ['standalone', 'gnuboard'] as const;

function stubReducedMotion(matches: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: matches && query.includes('reduce'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

function controls(termId: (typeof helpTerms)[number]) {
  const figure = document.getElementById(termHeadingId(termId))?.closest('article')?.querySelector('figure');
  if (!figure) throw new Error(`no figure for ${termId}`);

  return figure;
}

describe('helpTerms', () => {
  it('has no duplicate ids and a term and motion for each', () => {
    expect(new Set(helpTerms).size).toBe(helpTerms.length);

    for (const id of helpTerms) {
      expect(HELP_TERMS[id], id).toBeTruthy();
      expect(HELP_MOTIONS[id], id).toBeTruthy();
    }
  });
});

describe('HelpScreen', () => {
  let fetchSpy: MockInstance<typeof globalThis.fetch>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    cleanup();
  });

  it.each(hosts)('renders the guide and dictionary on %s without requests', (host) => {
    render(<HelpScreen host={host} />);

    expect(screen.getByRole('heading', { level: 1, name: '도움말' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: '기능 안내' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: '용어 사전' })).toBeTruthy();
    expect(screen.getByRole('list', { name: '기본 작업 순서' })).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('uses each host’s menus and terms', () => {
    render(<HelpScreen host="standalone" />);

    expect(screen.getByRole('link', { name: '소재 등록' })).toBeTruthy();
    expect(screen.getByRole('link', { name: '리포트' })).toBeTruthy();
    expect(document.getElementById(termHeadingId('campaign'))).toBeTruthy();
    expect(document.getElementById(termHeadingId('ad-request'))).toBeNull();
    cleanup();

    render(<HelpScreen host="gnuboard" />);

    expect(screen.getByRole('link', { name: '하우스 광고 등록' })).toBeTruthy();
    expect(screen.getByRole('link', { name: '광고 요청' })).toBeTruthy();
    expect(document.getElementById(termHeadingId('ad-request'))).toBeTruthy();
    expect(document.getElementById(termHeadingId('campaign'))).toBeNull();
    expect(document.getElementById(termHeadingId('video-context'))).toBeNull();
  });

  it.each(hosts)('lists the player menu after 지면 편성 and the player terms on %s', (host) => {
    render(<HelpScreen host={host} />);

    const menu = document.querySelector('a[href="#/players"]');
    const schedule = document.querySelector('a[href="#/schedule"]');
    if (!menu || !schedule) throw new Error('menu cards missing');

    expect(menu.textContent).toContain('플레이어');
    expect(schedule.compareDocumentPosition(menu) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.click(
      within(screen.getByRole('group', { name: '용어 분류' })).getByRole('button', { name: /^플레이어/ })
    );

    const shown = [...document.querySelectorAll('.sa-term h4')].map((heading) => heading.id);
    // GnuBoard keeps one player setting, which is always the site's.
    const hidden = host === 'gnuboard' ? ['player-default-preset'] : [];

    expect(shown).toEqual(
      helpTerms.filter((id) => id.startsWith('player-') && !hidden.includes(id)).map(termHeadingId)
    );
    expect(shown).toHaveLength(16 - hidden.length);
  });

  it('has no lecture terms and names the one player setting on gnuboard', () => {
    render(<HelpScreen host="gnuboard" />);

    expect(document.querySelector('a[href="#/lms"]')).toBeNull();
    expect(termsFor('gnuboard').filter((id) => id.startsWith('lms-'))).toEqual([]);
    expect(
      within(screen.getByRole('group', { name: '용어 분류' })).queryByRole('button', { name: /^강의/ })
    ).toBeNull();
    expect(document.getElementById(termHeadingId('player-preset'))?.textContent).toBe('플레이어 설정');
    expect(document.querySelector('a[href="#/players"]')?.textContent).toContain('플레이어 설정');
  });

  it('links related terms, such as the video id, the placeholder and the old static code', () => {
    render(<HelpScreen host="gnuboard" />);

    const article = document.getElementById(termHeadingId('fixed-video-id'))?.closest('article');
    if (!article) throw new Error('no fixed-video-id card');

    expect(within(article).getByRole('link', { name: '자리 요소' }).getAttribute('href')).toBe(
      '#/help/player-placeholder'
    );
    expect(within(article).getByRole('link', { name: '예전 정적 코드' }).getAttribute('href')).toBe(
      '#/help/player-install-snippet'
    );

    const install = document.getElementById(termHeadingId('player-install-snippet'))?.closest('article');

    expect(install?.textContent).toContain('준비 중');
    expect(install?.textContent).toContain('게시판:글번호:영상키');
  });

  it('has one card per term across both hosts and no duplicate element ids', () => {
    const seen = new Set<string>();

    for (const host of hosts) {
      const { container } = render(<HelpScreen host={host} />);
      const ids = [...container.querySelectorAll('[id]')].map((element) => element.id);

      expect(new Set(ids).size, host).toBe(ids.length);

      for (const id of termsFor(host)) {
        const heading = document.getElementById(termHeadingId(id));

        expect(heading?.tagName, id).toBe('H4');
        expect(heading?.closest('article')?.querySelector('[role="img"]')?.getAttribute('aria-label'), id).toBeTruthy();
        seen.add(id);
      }

      cleanup();
    }

    expect([...seen].sort()).toEqual([...helpTerms].sort());
  });

  it('marks mock and unbuilt terms with their state', () => {
    render(<HelpScreen host="standalone" />);

    const card = (id: (typeof helpTerms)[number]) => document.getElementById(termHeadingId(id))?.closest('article');

    expect(card('mid-roll')?.querySelector('.sa-badge')?.textContent).toBe('지금 동작');
    expect(card('campaign')?.querySelector('.sa-badge')?.textContent).toBe('목업');
    expect(card('approval')?.querySelector('.sa-badge')?.textContent).toBe('준비 중');
  });

  it('focuses the requested term heading', () => {
    render(<HelpScreen host="standalone" termId="mid-roll" />);

    expect(document.activeElement).toBe(document.getElementById(termHeadingId('mid-roll')));
  });

  it('ignores unknown terms and terms of the other host', () => {
    const { rerender } = render(<HelpScreen host="standalone" termId="no-such-term" />);

    expect(document.activeElement).toBe(document.body);

    rerender(<HelpScreen host="standalone" termId="ad-request" />);

    expect(document.activeElement).toBe(document.body);
  });

  it('clears a category filter that hides the requested term', () => {
    const { rerender } = render(<HelpScreen host="standalone" />);

    fireEvent.click(within(screen.getByRole('group', { name: '용어 분류' })).getByRole('button', { name: /^통계/ }));

    expect(document.getElementById(termHeadingId('mid-roll'))).toBeNull();

    rerender(<HelpScreen host="standalone" termId="mid-roll" />);

    expect(document.activeElement).toBe(document.getElementById(termHeadingId('mid-roll')));
    expect(screen.getByRole('button', { name: /^전체/ }).getAttribute('aria-pressed')).toBe('true');
  });

  describe('a link to the open term', () => {
    afterEach(() => {
      window.location.hash = '';
    });

    it('scrolls back and focuses the term heading', () => {
      window.location.hash = '#/help/fixed-video-id';
      render(<HelpScreen host="standalone" termId="fixed-video-id" />);

      const heading = document.getElementById(termHeadingId('fixed-video-id'));
      const install = document.getElementById(termHeadingId('player-install-snippet'))?.closest('article');
      if (!heading || !install) throw new Error('cards missing');

      heading.blur();
      expect(document.activeElement).toBe(document.body);

      const link = within(install).getByRole('link', { name: HELP_TERMS['fixed-video-id'].name });

      expect(fireEvent.click(link)).toBe(false);
      expect(document.activeElement).toBe(heading);
    });

    it('drops a category filter that hides the term', () => {
      window.location.hash = '#/help/draft';
      render(<HelpScreen host="standalone" termId="draft" />);

      fireEvent.click(within(screen.getByRole('group', { name: '용어 분류' })).getByRole('button', { name: /^통계/ }));
      expect(document.getElementById(termHeadingId('draft'))).toBeNull();

      fireEvent.click(screen.getByRole('link', { name: '초안 저장' }));

      expect(screen.getByRole('button', { name: /^전체/ }).getAttribute('aria-pressed')).toBe('true');
      expect(document.activeElement).toBe(document.getElementById(termHeadingId('draft')));
    });
  });

  it('filters the dictionary by category', () => {
    render(<HelpScreen host="gnuboard" />);

    const chip = within(screen.getByRole('group', { name: '용어 분류' })).getByRole('button', {
      name: /^그누보드 전용/,
    });

    fireEvent.click(chip);

    expect(chip.getAttribute('aria-pressed')).toBe('true');
    expect(document.getElementById(termHeadingId('house-ad'))).toBeTruthy();
    expect(document.getElementById(termHeadingId('mid-roll'))).toBeNull();
  });

  it('offers pause and replay for looping motions and replay only for one-shot motions', () => {
    stubReducedMotion(false);
    render(<HelpScreen host="standalone" />);

    for (const id of termsFor('standalone')) {
      const names = within(controls(id))
        .getAllByRole('button')
        .map((button) => button.textContent);

      expect(names, id).toEqual(motionFor(id).once ? ['다시 보기'] : ['일시정지', '다시 보기']);
    }
  });

  it('pauses with aria-pressed and replays from the start', () => {
    stubReducedMotion(false);
    render(<HelpScreen host="standalone" />);

    const figure = controls('skip-offset');
    const pause = within(figure).getByRole('button', { name: '일시정지' });
    const stage = figure.querySelector('.sa-motion-stage');

    expect(pause.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(pause);

    expect(pause.getAttribute('aria-pressed')).toBe('true');
    expect(figure.classList.contains('is-paused')).toBe(true);

    fireEvent.click(within(figure).getByRole('button', { name: '다시 보기' }));

    expect(pause.getAttribute('aria-pressed')).toBe('false');
    expect(figure.classList.contains('is-paused')).toBe(false);
    expect(figure.querySelector('.sa-motion-stage')).not.toBe(stage);
  });

  it('drops the motion controls when reduced motion is requested', () => {
    stubReducedMotion(true);
    render(<HelpScreen host="gnuboard" />);

    expect(screen.queryAllByRole('button', { name: '일시정지' })).toHaveLength(0);
    expect(screen.queryAllByRole('button', { name: '다시 보기' })).toHaveLength(0);
    expect(screen.getByText(/움직임 줄이기 설정/)).toBeTruthy();
  });
});

describe('HelpMotion', () => {
  afterEach(() => {
    cleanup();
  });

  it('follows a reduced-motion change made while the screen is open', () => {
    let matches = false;
    const listeners = new Set<() => void>();

    vi.stubGlobal('matchMedia', (query: string) => ({
      get matches() {
        return matches && query.includes('reduce');
      },
      media: query,
      addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
    }));
    render(<HelpScreen host="standalone" />);

    expect(screen.getAllByRole('button', { name: '다시 보기' }).length).toBeGreaterThan(0);

    matches = true;
    act(() => {
      for (const listener of listeners) listener();
    });

    expect(screen.queryAllByRole('button', { name: '다시 보기' })).toHaveLength(0);
    expect(screen.getByText(/움직임 줄이기 설정/)).toBeTruthy();
  });

  it('pauses a motion scrolled out of view and resumes it on return', () => {
    const observed = new Map<Element, (entries: { isIntersecting: boolean }[]) => void>();

    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(private readonly callback: (entries: { isIntersecting: boolean }[]) => void) {}
        observe(node: Element) {
          observed.set(node, this.callback);
        }
        disconnect() {}
      }
    );
    render(<HelpScreen host="standalone" />);

    const figure = controls('mid-roll');
    const notify = observed.get(figure);
    if (!notify) throw new Error('figure not observed');

    act(() => notify([{ isIntersecting: false }]));
    expect(figure.classList.contains('is-offscreen')).toBe(true);

    act(() => notify([{ isIntersecting: true }]));
    expect(figure.classList.contains('is-offscreen')).toBe(false);
  });
});

describe('HelpLink', () => {
  afterEach(() => {
    cleanup();
  });

  it('leaves links to another term to the browser', () => {
    window.location.hash = '#/help/mid-roll';
    render(<HelpLink termId="publish" />);

    expect(fireEvent.click(screen.getByRole('link', { name: '게시 도움말' }))).toBe(true);
    window.location.hash = '';
  });

  it('links to the term as a named "?"', () => {
    render(<HelpLink termId="mid-roll" />);

    const link = screen.getByRole('link', { name: '미드롤 도움말' });

    expect(link.getAttribute('href')).toBe('#/help/mid-roll');
    expect(link.textContent).toBe('?');
    expect(link.className).toBe('sa-help-link');
  });

  it('uses its children as the name when given', () => {
    render(<HelpLink termId="publish">게시가 뭔가요?</HelpLink>);

    const link = screen.getByRole('link', { name: '게시가 뭔가요?' });

    expect(link.getAttribute('href')).toBe('#/help/publish');
    expect(link.getAttribute('aria-label')).toBeNull();
    expect(link.className).toBe('sa-link');
  });
});
