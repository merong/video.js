// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { DEFAULT_PLAYER_PRESET, type PlayerPreset, ThemePreview } from '../src/player';

const brand: PlayerPreset = { ...DEFAULT_PLAYER_PRESET, id: null, name: '브랜드' };

function frame(): HTMLIFrameElement {
  // SAFETY: the title query returns the preview iframe, the only element with this title.
  return screen.getByTitle('플레이어 미리보기 화면') as HTMLIFrameElement;
}

function spyPost() {
  return vi.spyOn(frame().contentWindow!, 'postMessage');
}

/** What `preview.html` posts to the admin page. */
interface FrameStatus {
  readonly type: string;
  readonly status?: string;
  readonly message?: string;
  readonly reason?: string;
  readonly event?: {
    readonly kind: string;
    readonly position: string;
    readonly at?: unknown;
    readonly index?: number;
    readonly count?: number;
  };
}

/** Let the status live region fill after its empty first render. */
async function announce() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve));
  });
}

function fromFrame(data: FrameStatus, source: Window | null = frame().contentWindow, origin = location.origin) {
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data, origin, source }));
  });
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('ThemePreview', () => {
  it('opens the same-origin preview page with only the player type in its address', async () => {
    render(<ThemePreview preset={brand} examplesUrl="/examples" />);

    const src = new URL(frame().src);

    // Mounted empty so that screen readers announce the text that follows.
    expect(screen.getByRole('status').textContent).toBe('');

    await announce();

    expect(src.origin).toBe(location.origin);
    expect(src.pathname).toBe('/examples/preview.html');
    expect(Object.fromEntries(src.searchParams)).toEqual({ type: 'videojs' });
    expect(screen.getByRole('status').textContent).toBe('미리보기를 준비하는 중이에요…');
  });

  it('sends the preset after load and every edit without reloading', () => {
    const { rerender } = render(<ThemePreview preset={brand} examplesUrl="/examples/" />);
    const post = spyPost();
    const src = frame().src;

    post.mockClear();
    fireEvent.load(frame());

    // The preset has no language, so the page language it follows goes along.
    expect(post).toHaveBeenCalledWith({ type: 'ads-player-preview', preset: brand, pageLang: 'ko' }, location.origin);

    const edited: PlayerPreset = {
      ...brand,
      theme: { ...brand.theme, accentColor: '#ff6600' },
      language: 'en',
      playback: { ...brand.playback, autoplay: true, muted: true },
      display: { ...brand.display, title: false },
      ads: { ...brand.ads, labels: { ...brand.ads.labels, skip: 'Skip' } },
    };

    rerender(<ThemePreview preset={edited} examplesUrl="/examples/" />);

    expect(frame().src).toBe(src);
    expect(post).toHaveBeenLastCalledWith({ type: 'ads-player-preview', preset: edited }, location.origin);
  });

  it('waits for the frame load before sending', () => {
    const { rerender } = render(<ThemePreview preset={brand} examplesUrl="/examples/" />);
    const post = spyPost();

    post.mockClear();
    rerender(<ThemePreview preset={{ ...brand, name: '바뀐 이름' }} examplesUrl="/examples/" />);

    expect(post).not.toHaveBeenCalled();
  });

  it('reloads the frame only when the player type changes', async () => {
    const { rerender } = render(<ThemePreview preset={brand} examplesUrl="/examples/" />);
    const src = frame().src;

    await announce();

    fireEvent.load(frame());
    fromFrame({ type: 'ads-player-preview-status', status: 'ready' });
    rerender(
      <ThemePreview
        preset={{ ...brand, language: 'zh-CN', theme: { ...brand.theme, borderRadius: 4 } }}
        examplesUrl="/examples/"
      />
    );

    expect(frame().src).toBe(src);

    rerender(<ThemePreview preset={{ ...brand, playerType: 'native' }} examplesUrl="/examples/" />);

    expect(Object.fromEntries(new URL(frame().src).searchParams)).toEqual({ type: 'native' });
    // The new page starts over until it reports again.
    expect(screen.getByRole('status').textContent).toBe('미리보기를 준비하는 중이에요…');
  });

  it('shows the frame status and ignores messages from other windows', async () => {
    render(<ThemePreview preset={brand} examplesUrl="/examples/" />);
    await announce();

    fromFrame({ type: 'ads-player-preview-status', status: 'error', message: '남의 창' }, window);
    fromFrame(
      { type: 'ads-player-preview-status', status: 'error', message: '다른 출처' },
      undefined,
      'https://evil.example'
    );

    expect(screen.queryByRole('alert')?.textContent).toBe('');

    fromFrame({ type: 'ads-player-preview-status', status: 'ready' });

    // Ready needs no words: the player is on screen.
    expect(screen.getByRole('status').textContent).toBe('');
    expect(frame().hidden).toBe(false);

    fromFrame({ type: 'ads-player-preview-status', status: 'error', message: 'TypeError: x is undefined' });

    // The frame's own message stays out of the admin; the copy table's sentence is shown instead.
    expect(screen.getByRole('alert').textContent).toBe('미리보기를 만들지 못했어요. 다시 불러오기를 눌러 주세요.');
    expect(screen.getByRole('status').textContent).toBe('');
    // A broken frame is hidden, so it neither shows a blank player nor takes focus.
    expect(frame().hidden).toBe(true);

    fromFrame({ type: 'ads-player-preview-status', status: 'ready' });

    expect(frame().hidden).toBe(false);
  });

  it('explains a missing preview page when the loaded frame stays silent', () => {
    vi.useFakeTimers();
    render(<ThemePreview preset={brand} examplesUrl="/examples/" />);
    fireEvent.load(frame());
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.getByRole('alert').textContent).toMatch(/examples\/preview\.html/);
  });

  it('times out when a later load of the same frame stays silent', () => {
    vi.useFakeTimers();
    render(<ThemePreview preset={brand} examplesUrl="/examples/" />);
    fromFrame({ type: 'ads-player-preview-status', status: 'loading' });
    fireEvent.load(frame());
    fromFrame({ type: 'ads-player-preview-status', status: 'ready' });
    // The frame navigated again (for example, reloaded) and the new document never spoke.
    fireEvent.load(frame());
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.getByRole('alert').textContent).toMatch(/examples\/preview\.html/);
    expect(frame().hidden).toBe(true);
  });

  it('counts only the loading message as a new document speaking', () => {
    vi.useFakeTimers();
    render(<ThemePreview preset={brand} examplesUrl="/examples/" />);
    fromFrame({ type: 'ads-player-preview-status', status: 'ready' });
    fireEvent.load(frame());
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.getByRole('alert').textContent).toMatch(/examples\/preview\.html/);
  });

  it('does not time out once the frame has spoken', () => {
    vi.useFakeTimers();
    render(<ThemePreview preset={brand} examplesUrl="/examples/" />);
    fromFrame({ type: 'ads-player-preview-status', status: 'loading' });
    fireEvent.load(frame());
    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(screen.getByRole('alert').textContent).toBe('');
  });

  it('cleans up its listener and timer on unmount', () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    const schedule = vi.spyOn(globalThis, 'setTimeout');
    const clear = vi.spyOn(globalThis, 'clearTimeout');
    const { unmount } = render(<ThemePreview preset={brand} examplesUrl="/examples/" />);

    fireEvent.load(frame());
    const silence = schedule.mock.results[schedule.mock.calls.findIndex(([, delay]) => delay === 3000)]?.value;

    expect(silence).toBeDefined();

    unmount();

    expect(clear).toHaveBeenCalledWith(silence);
    expect(remove).toHaveBeenCalledWith('message', expect.any(Function));
  });

  it.each([
    ['https://other.example/examples/', '같은 출처'],
    ['', '예제 주소가 없어'],
  ])('shows why there is no frame for examplesUrl %j', (examplesUrl, reason) => {
    render(<ThemePreview preset={brand} examplesUrl={examplesUrl} />);

    expect(screen.queryByTitle('플레이어 미리보기 화면')).toBeNull();
    expect(screen.getByText(new RegExp(reason))).toBeTruthy();
  });

  it('sends scene commands once the frame is ready, and reloads at any time', () => {
    render(<ThemePreview preset={brand} examplesUrl="/examples/" />);
    const post = spyPost();
    const group = screen.getByRole('group', { name: '장면 바로가기' });
    const midroll = screen.getByRole('button', { name: '미드롤 앞' });

    // Blocked, with the reason on the group, until the player exists; reloading is always there.
    expect(midroll.matches(':disabled')).toBe(true);
    expect(document.getElementById(group.getAttribute('aria-describedby')!)?.textContent).toBe(
      '플레이어가 준비되면 쓸 수 있어요.'
    );

    post.mockClear();
    fireEvent.click(screen.getByRole('button', { name: '다시 불러오기' }));

    expect(post).toHaveBeenLastCalledWith({ type: 'ads-player-preview-command', command: 'restart' }, location.origin);

    fireEvent.load(frame());
    fromFrame({ type: 'ads-player-preview-status', status: 'ready' });
    post.mockClear();

    for (const [name, command] of [
      ['처음부터', 'start'],
      ['미드롤 앞', 'before-midroll'],
      ['끝 직전', 'before-end'],
      ['다시 불러오기', 'restart'],
    ] as const) {
      fireEvent.click(screen.getByRole('button', { name }));
      expect(post).toHaveBeenLastCalledWith({ type: 'ads-player-preview-command', command }, location.origin);
    }

    expect(group.hasAttribute('aria-describedby')).toBe(false);
    expect(midroll.matches(':disabled')).toBe(false);
  });

  it('blocks "미드롤 앞" for a played schedule without a midroll', () => {
    const source = { schedule: { videoId: 'v', breaks: [{ position: 'pre', ads: [] }] }, content: '/a.mp4' };

    render(<ThemePreview preset={brand} examplesUrl="/examples/" source={source} />);
    fromFrame({ type: 'ads-player-preview-status', status: 'ready' });

    const midroll = screen.getByRole('button', { name: '미드롤 앞' });

    expect(midroll.matches(':disabled')).toBe(true);
    expect(document.getElementById(midroll.getAttribute('aria-describedby')!)?.textContent).toBe(
      '이 편성에는 미드롤이 없어서 "미드롤 앞"을 쓸 수 없어요.'
    );
    expect(screen.getByRole('button', { name: '처음부터' }).matches(':disabled')).toBe(false);
  });

  it('shows the latest ad event from its own frame only, with its place in the break and time', () => {
    render(<ThemePreview preset={brand} examplesUrl="/examples/" />);
    const now = () => document.querySelector('.sa-stage-now');
    const at = '2026-10-21T01:12:08.000Z';
    const local = new Date(at);
    const clock = [local.getHours(), local.getMinutes(), local.getSeconds()]
      .map((part) => String(part).padStart(2, '0'))
      .join(':');
    const event = {
      type: 'ads-player-preview-event',
      event: { kind: 'start', position: 'pre', at, index: 1, count: 2 },
    };

    expect(now()?.textContent).toBe('최근 광고 진행아직 광고가 나오지 않았어요');

    fromFrame(event, window);
    fromFrame(event, undefined, 'https://evil.example');

    expect(now()?.textContent).toBe('최근 광고 진행아직 광고가 나오지 않았어요');

    fromFrame(event);

    expect(now()?.querySelectorAll('span')[1]?.textContent).toBe('프리롤 1/2 재생 중');
    expect(now()?.querySelector('time')?.getAttribute('datetime')).toBe(at);
    expect(now()?.querySelector('time')?.textContent).toBe(clock);

    fromFrame({ ...event, event: { kind: 'complete', position: 'mid', at, index: 1, count: 1 } });
    expect(now()?.querySelectorAll('span')[1]?.textContent).toBe('미드롤 1/1 · 끝남');

    // An older frame's number time, or a missing place, leaves those parts out.
    fromFrame({ ...event, event: { kind: 'cancel', position: 'post', at: 12 } });
    expect(now()?.querySelectorAll('span')[1]?.textContent).toBe('포스트롤 · 중단');
    expect(now()?.querySelector('time')).toBeNull();
  });

  describe('the latest ad line of a new player', () => {
    const line = () => document.querySelector('.sa-stage-now')?.querySelectorAll('span')[1]?.textContent;
    const event = {
      type: 'ads-player-preview-event',
      event: { kind: 'start', position: 'pre', at: '2026-10-21T01:12:08.000Z', index: 1, count: 2 },
    };

    it('starts afresh when the frame says loading, and stays when it only says ready', () => {
      render(<ThemePreview preset={brand} examplesUrl="/examples/" />);
      fromFrame({ type: 'ads-player-preview-status', status: 'loading' });
      fromFrame({ type: 'ads-player-preview-status', status: 'ready' });
      fromFrame(event);

      expect(line()).toBe('프리롤 1/2 재생 중');

      // A theme change restyles the playing player.
      fromFrame({ type: 'ads-player-preview-status', status: 'ready' });

      expect(line()).toBe('프리롤 1/2 재생 중');
      expect(document.querySelector('.sa-stage-now time')).not.toBeNull();

      fromFrame({ type: 'ads-player-preview-status', status: 'loading' });

      expect(line()).toBe('아직 광고가 나오지 않았어요');
      expect(document.querySelector('.sa-stage-now time')).toBeNull();
    });

    it('starts afresh on "다시 불러오기" before the frame answers', () => {
      render(<ThemePreview preset={brand} examplesUrl="/examples/" />);
      fromFrame({ type: 'ads-player-preview-status', status: 'ready' });
      fromFrame(event);
      fireEvent.click(screen.getByRole('button', { name: '다시 불러오기' }));

      expect(line()).toBe('아직 광고가 나오지 않았어요');
    });

    it('starts afresh when the player type changes the frame address, also back to an earlier one', () => {
      const { rerender } = render(<ThemePreview preset={brand} examplesUrl="/examples/" />);

      fromFrame({ type: 'ads-player-preview-status', status: 'ready' });
      fromFrame(event);
      rerender(<ThemePreview preset={{ ...brand, playerType: 'native' }} examplesUrl="/examples/" />);

      expect(line()).toBe('아직 광고가 나오지 않았어요');

      // Back before the other player sent anything: the first player's line is gone too.
      rerender(<ThemePreview preset={brand} examplesUrl="/examples/" />);

      expect(line()).toBe('아직 광고가 나오지 않았어요');
    });
  });

  it('explains a missing sample without the frame', () => {
    render(<ThemePreview preset={brand} examplesUrl="/examples/" />);
    fromFrame({ type: 'ads-player-preview-status', status: 'missing-sample', message: 'sample.json 404' });

    const status = screen.getByRole('status');

    expect(status.textContent).toBe(
      '샘플 미디어가 없어 미리보기를 재생할 수 없어요. 서버에 demo-media/grok-20261018/ 폴더를 넣어 주세요.'
    );
    expect(status.classList.contains('is-warn')).toBe(true);
    expect(screen.getByRole('alert').textContent).toBe('');
    expect(frame().hidden).toBe(true);
    expect(document.querySelector<HTMLElement>('.sa-stage-bar')?.hidden).toBe(true);
  });

  it.each([
    [
      'invalid',
      '샘플 편성 파일의 형식이 달라 미리보기를 재생할 수 없어요. demo-media/grok-20261018/schedule.json.js가 원본 raw 편성인지 확인해 주세요.',
    ],
    ['missing', '샘플 미디어가 없어 미리보기를 재생할 수 없어요. 서버에 demo-media/grok-20261018/ 폴더를 넣어 주세요.'],
    ['later', '샘플 미디어가 없어 미리보기를 재생할 수 없어요. 서버에 demo-media/grok-20261018/ 폴더를 넣어 주세요.'],
  ])('reads the missing-sample reason %j', (reason, text) => {
    render(<ThemePreview preset={brand} examplesUrl="/examples/" />);
    fromFrame({ type: 'ads-player-preview-status', status: 'missing-sample', message: 'sample', reason });

    expect(screen.getByRole('status').textContent).toBe(text);
    expect(frame().hidden).toBe(true);
  });

  it('offers the page language only while the preset language is empty', () => {
    const { rerender } = render(<ThemePreview preset={brand} examplesUrl="/examples/" />);
    const post = spyPost();
    const select = screen.getByLabelText<HTMLSelectElement>('페이지 언어');

    expect([...select.options].map((option) => option.text)).toEqual([
      '한국어 (ko)',
      '영어 (en)',
      '일본어 (ja)',
      '중국어 간체 (zh-CN)',
      '그 밖의 언어 (fr)',
    ]);

    fireEvent.load(frame());
    fireEvent.change(select, { target: { value: 'ja' } });

    expect(post).toHaveBeenLastCalledWith(
      { type: 'ads-player-preview', preset: brand, pageLang: 'ja' },
      location.origin
    );

    const english: PlayerPreset = { ...brand, language: 'en' };

    rerender(<ThemePreview preset={english} examplesUrl="/examples/" />);

    expect(screen.queryByLabelText('페이지 언어')).toBeNull();
    expect(post).toHaveBeenLastCalledWith({ type: 'ads-player-preview', preset: english }, location.origin);

    // Emptied again, it comes back with the last pick.
    rerender(<ThemePreview preset={brand} examplesUrl="/examples/" />);

    expect(screen.getByLabelText<HTMLSelectElement>('페이지 언어').value).toBe('ja');
  });

  it('sends a given schedule and content with the preset, content from another origin too', () => {
    const source = { schedule: { videoId: 'vid-1', breaks: [] }, content: 'https://cdn.example/media/a.mp4' };

    render(<ThemePreview preset={brand} examplesUrl="/examples/" source={source} />);
    const post = spyPost();

    fireEvent.load(frame());

    expect(post).toHaveBeenCalledWith(
      { type: 'ads-player-preview', preset: brand, pageLang: 'ko', ...source },
      location.origin
    );
    expect(screen.queryByRole('button', { name: '데모에서 열기' })).toBeNull();
    expect(document.querySelector('.sa-ppv-f')).toBeNull();
  });

  it.each([
    ['  가을 특집 1화 ', '가을 특집 1화'],
    ['제목\u0007벨', undefined],
    ['   ', undefined],
    [undefined, undefined],
  ])('sends the content title %j under the loader data-title rule', (title, sent) => {
    const source = { schedule: { videoId: 'vid-1', breaks: [] }, content: '/media/a.mp4', title };

    render(<ThemePreview preset={brand} examplesUrl="/examples/" source={source} />);
    const post = spyPost();

    fireEvent.load(frame());

    const [message] = post.mock.lastCall ?? [];

    expect(message).toMatchObject({ schedule: source.schedule, content: '/media/a.mp4' });
    expect(Object.hasOwn(message, 'title')).toBe(sent !== undefined);
    expect(message.title).toBe(sent);
  });

  it('sends no title with the Grok sample', () => {
    render(<ThemePreview preset={brand} examplesUrl="/examples/" />);
    const post = spyPost();

    fireEvent.load(frame());

    expect(Object.hasOwn(post.mock.lastCall?.[0], 'title')).toBe(false);
  });

  it.each([
    [300, 'narrow', '보이는 폭 390px · 실제의 77%로 줄여 보여요', '390px', '0.7692307692307693'],
    [300, 'medium', '보이는 폭 768px · 실제의 39%로 줄여 보여요', '768px', '0.390625'],
    [1000, 'narrow', '보이는 폭 390px · 실제 크기예요', '390px', '1'],
    [300, 'wide', '자리 폭 300px · 실제 크기예요', '300px', '1'],
  ] as const)('draws a %ipx view at the %s width and says how much it shrinks', (room, view, text, width, scale) => {
    let report: ((entries: { contentRect: { width: number } }[]) => void) | undefined;

    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: typeof report) {
          report = callback;
        }
        observe() {}
        disconnect() {}
      }
    );
    render(<ThemePreview preset={brand} examplesUrl="/examples/" />);
    act(() => report?.([{ contentRect: { width: room } }]));

    const label = { narrow: '좁게 · 390', medium: '보통 · 768', wide: '넓게 · 자리 폭' }[view];

    fireEvent.click(screen.getByRole('radio', { name: label }));

    const frameBox = document.querySelector<HTMLElement>('.sa-stage-frame')!;
    const viewBox = document.querySelector<HTMLElement>('.sa-stage-view')!;
    const note = screen.getByText(text);

    expect(screen.getByRole('radiogroup', { name: '폭 보기' }).getAttribute('aria-describedby')).toContain(note.id);
    expect(frameBox.style.getPropertyValue('--_w')).toBe(width);
    expect(frameBox.style.getPropertyValue('--_s')).toBe(scale);
    expect(viewBox.style.getPropertyValue('--_h')).toBe(
      `${Math.round((Number.parseInt(width) * 9) / 16) * Number(scale)}px`
    );
    expect(frame().src).toMatch(/preview\.html\?type=videojs$/);
  });

  describe('in a wide dialog with fitHeight', () => {
    let reports: ((entries: { contentRect: { width: number } }[]) => void)[] = [];

    /** A dialog box with jsdom-free sizes: the body's content height counts the view's measured height. */
    function layout(sizes: { tallest: number; dialog: number; client: number; content: number; view: number }) {
      const view = document.querySelector<HTMLElement>('.sa-stage-view')!;
      const body = view.closest<HTMLElement>('.sa-dialog-b')!;
      const dialog = body.closest('dialog')!;

      dialog.style.maxHeight = `${sizes.tallest}px`;
      Object.defineProperty(dialog, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({ height: sizes.dialog }),
      });
      Object.defineProperty(view, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({ height: sizes.view }),
      });
      Object.defineProperty(body, 'clientWidth', { configurable: true, value: 738 });
      Object.defineProperty(body, 'clientHeight', { configurable: true, value: sizes.client });
      Object.defineProperty(body, 'scrollHeight', { configurable: true, value: sizes.content });

      return view;
    }

    function measured(room: number) {
      act(() => {
        for (const report of reports) report([{ contentRect: { width: room } }]);
      });
    }

    function open(fitHeight: boolean) {
      reports = [];
      vi.stubGlobal(
        'ResizeObserver',
        class {
          constructor(callback: (typeof reports)[number]) {
            reports.push(callback);
          }
          observe() {}
          disconnect() {}
        }
      );
      render(
        <dialog open style={{ maxHeight: '768px' }}>
          <div className="sa-dialog-b" style={{ padding: '18px' }}>
            <ThemePreview preset={brand} examplesUrl="/examples/" fitHeight={fitHeight} />
          </div>
        </dialog>
      );
    }

    it('narrows the room until the body fits the tallest dialog and says the width is fitted', () => {
      open(true);

      // 1280×800 with a Note and 페이지 언어: 768 tall, head and footer 130, the rest of the body 328 besides the view.
      const view = layout({ tallest: 768, dialog: 768, client: 638, content: 723, view: 395 });

      measured(702);

      expect(view.style.getPropertyValue('--_fit')).toBe('551px');

      measured(551);

      expect(screen.getByText('높이에 맞춘 자리 폭 551px · 실제 크기예요')).toBeTruthy();
      expect(view.style.getPropertyValue('--_h')).toBe('310px');
      expect(document.querySelector<HTMLElement>('.sa-stage-frame')?.style.getPropertyValue('--_w')).toBe('551px');

      // A taller window gives the room back once the body's own width fits.
      layout({ tallest: 968, dialog: 768, client: 638, content: 638, view: 310 });
      act(() => window.dispatchEvent(new Event('resize')));

      expect(view.style.getPropertyValue('--_fit')).toBe('');

      measured(702);

      expect(screen.getByText('자리 폭 702px · 실제 크기예요')).toBeTruthy();
    });

    it('stops at 512px and leaves the rest to the body scroll', () => {
      open(true);

      // 1280×720 with a Note: 688 tall leaves 230px for the view, which would be 408px wide.
      const view = layout({ tallest: 688, dialog: 688, client: 558, content: 723, view: 395 });

      measured(702);

      expect(view.style.getPropertyValue('--_fit')).toBe('512px');
    });

    it('keeps the full room without fitHeight', () => {
      open(false);

      const view = layout({ tallest: 768, dialog: 768, client: 638, content: 723, view: 395 });

      measured(702);

      expect(view.style.getPropertyValue('--_fit')).toBe('');
      expect(screen.getByText('자리 폭 702px · 실제 크기예요')).toBeTruthy();
    });
  });

  it('starts at the full room width before it is measured', () => {
    render(<ThemePreview preset={brand} examplesUrl="/examples/" />);

    expect(screen.getByRole<HTMLInputElement>('radio', { name: '넓게 · 자리 폭' }).checked).toBe(true);
    expect(screen.getByText('자리 폭 · 실제 크기예요')).toBeTruthy();
    expect(document.querySelector<HTMLElement>('.sa-stage-frame')?.style.getPropertyValue('--_s')).toBe('');
  });

  it('opens a saved preset in the demo and explains why it cannot otherwise', () => {
    const { rerender } = render(
      <ThemePreview preset={brand} examplesUrl="/examples" demo={{ presetId: 'p-brand00001', unsaved: false }} />
    );
    const link = screen.getByRole('link', { name: '데모에서 열기 (새 창)' });
    const href = new URL(link.getAttribute('href')!);

    expect(href.pathname).toBe('/examples/index.html');
    expect(Object.fromEntries(href.searchParams)).toEqual({ preset: 'p-brand00001' });
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link.closest('.sa-ppv-f')).not.toBeNull();

    for (const [demo, reason] of [
      [{ presetId: 'p-brand00001', unsaved: true }, '저장하지 않은 입력이 있어요. 저장하면 데모에서 열 수 있어요.'],
      [{ presetId: null, unsaved: true }, '처음 저장한 뒤 데모에서 열 수 있어요.'],
    ] as const) {
      rerender(<ThemePreview preset={brand} examplesUrl="/examples/" demo={demo} />);

      const blocked = screen.getByRole('link', { name: '데모에서 열기 (새 창)' });

      // The same link, kept focusable so the reason can be reached, but it goes nowhere.
      expect(blocked).toBe(link);
      expect(blocked.hasAttribute('href')).toBe(false);
      expect(blocked.hasAttribute('target')).toBe(false);
      expect(blocked.getAttribute('aria-disabled')).toBe('true');
      expect(blocked.tabIndex).toBe(0);
      expect(document.getElementById(blocked.getAttribute('aria-describedby') ?? '')?.textContent).toBe(reason);
      expect(screen.queryByRole('button', { name: /데모에서 열기/ })).toBeNull();
    }
  });

  it('ignores presses on a blocked "데모에서 열기" and keeps focus on it once saved', () => {
    const { rerender } = render(
      <ThemePreview preset={brand} examplesUrl="/examples/" demo={{ presetId: 'p-brand00001', unsaved: true }} />
    );
    const link = screen.getByRole('link', { name: '데모에서 열기 (새 창)' });

    link.focus();

    // `fireEvent` returns false when the default action was prevented.
    expect(fireEvent.keyDown(link, { key: 'Enter' })).toBe(false);
    expect(fireEvent.keyDown(link, { key: ' ' })).toBe(false);
    expect(fireEvent.click(link)).toBe(false);
    expect(fireEvent.keyDown(link, { key: 'Tab' })).toBe(true);

    rerender(
      <ThemePreview preset={brand} examplesUrl="/examples/" demo={{ presetId: 'p-brand00001', unsaved: false }} />
    );

    expect(document.activeElement).toBe(link);
    expect(new URL(link.getAttribute('href')!).search).toBe('?preset=p-brand00001');
    expect(link.hasAttribute('aria-disabled')).toBe(false);
    expect(link.hasAttribute('role')).toBe(false);
    expect(link.hasAttribute('tabindex')).toBe(false);
    expect(link.hasAttribute('aria-describedby')).toBe(false);
  });
});
