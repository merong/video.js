import { type CSSProperties, type RefObject, useEffect, useId, useRef, useState } from 'react';

import { Button, ButtonLink, Field, Segmented, type SegmentedOption, Select, StatusMessage } from '../components';
import type { PlayerPreset } from './preset';
import { resolveHttpUrl } from './url';

import './player.css';

/** Parent → frame: `{type, preset, pageLang?, schedule?, content?, title?}`. The frame validates the preset again. */
export const PREVIEW_MESSAGE = 'ads-player-preview';
/** Parent → frame: `{type, command}`. */
export const PREVIEW_COMMAND_MESSAGE = 'ads-player-preview-command';
/**
 * Frame → parent: `{type, status: 'loading' | 'ready' | 'error' | 'missing-sample', message?, reason?}`; `reason` is
 * `'missing' | 'invalid'` with `missing-sample`.
 */
export const PREVIEW_STATUS_MESSAGE = 'ads-player-preview-status';
/** Frame → parent: `{type, event: {kind, position, at, index, count}}`, one per ad event; `at` is an ISO time. */
export const PREVIEW_EVENT_MESSAGE = 'ads-player-preview-event';

export type PreviewCommand = 'restart' | 'start' | 'before-midroll' | 'before-end';

/**
 * The frame says `loading` as soon as its script runs, before its `load` event. A `load` without that message, on the
 * first or any later navigation, means the page is missing or broken.
 */
const FRAME_SILENCE_MS = 3000;
// The frame's own `message` is not shown; the admin keeps its wording (design PlayerPreview).
const LOADING = '미리보기를 준비하는 중이에요…';
const MISSING_SAMPLE =
  '샘플 미디어가 없어 미리보기를 재생할 수 없어요. 서버에 demo-media/grok-20261018/ 폴더를 넣어 주세요.';
const INVALID_SAMPLE =
  '샘플 편성 파일의 형식이 달라 미리보기를 재생할 수 없어요. demo-media/grok-20261018/schedule.json.js가 원본 raw 편성인지 확인해 주세요.';
const FAILED = '미리보기를 만들지 못했어요. 다시 불러오기를 눌러 주세요.';
const SILENT_FRAME =
  '미리보기 페이지가 응답하지 않아요. examples/preview.html과 샘플 미디어가 설치되어 있는지 확인해 주세요.';
const NOT_READY = '플레이어가 준비되면 쓸 수 있어요.';
const NO_MIDROLL = '이 편성에는 미드롤이 없어서 "미드롤 앞"을 쓸 수 없어요.';

type FrameStatus = 'loading' | 'ready' | 'error' | 'missing-sample';
type WidthView = 'narrow' | 'medium' | 'wide';

const WIDTHS = { narrow: 390, medium: 768 } as const;
// The skin hides its captions button below 32rem, so a narrower room would no longer show the wide player.
const FIT_MIN_WIDTH = 512;
const widthOptions: readonly SegmentedOption<WidthView>[] = [
  { value: 'narrow', label: '좁게 · 390' },
  { value: 'medium', label: '보통 · 768' },
  { value: 'wide', label: '넓게 · 자리 폭' },
];
const sceneButtons: readonly { command: PreviewCommand; label: string }[] = [
  { command: 'start', label: '처음부터' },
  { command: 'before-midroll', label: '미드롤 앞' },
  { command: 'before-end', label: '끝 직전' },
];
// `fr` stands for any other page language, which the player shows in English.
const pageLanguages = [
  { value: 'ko', label: '한국어 (ko)' },
  { value: 'en', label: '영어 (en)' },
  { value: 'ja', label: '일본어 (ja)' },
  { value: 'zh-CN', label: '중국어 간체 (zh-CN)' },
  { value: 'fr', label: '그 밖의 언어 (fr)' },
] as const;
const positionNames = new Map([
  ['pre', '프리롤'],
  ['mid', '미드롤'],
  ['post', '포스트롤'],
]);
const eventNames = new Map([
  ['complete', '끝남'],
  ['skip', '건너뜀'],
  ['click', '클릭'],
  ['error', '오류'],
  ['cancel', '중단'],
]);

const demoIcon = (
  <svg className="sa-ico" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M9 3h4v4M13 3 7.5 8.5M11 9.5V13H3V5h3.5" />
  </svg>
);

type PageLanguage = (typeof pageLanguages)[number]['value'];

/** The part of a resolved schedule the admin reads; the frame gets the whole object. */
export interface PreviewSourceSchedule {
  readonly breaks: readonly { readonly position: string }[];
}

/** A schedule the frame plays instead of the Grok sample, such as a `schedule-preview` response. */
export interface PreviewSource {
  /** Resolved schedule object, sent as it is. */
  readonly schedule: PreviewSourceSchedule;
  /** Absolute content address, as the loader's `data-src` takes it; other origins are allowed. */
  readonly content: string;
  /**
   * Content title, as the loader's `data-title` takes it: trimmed, no control characters. Left out when unknown; the
   * frame then shows the schedule's video ID.
   */
  readonly title?: string | undefined;
}

/** "데모에서 열기": only a saved preset without unsaved input can open the demo. */
export interface PreviewDemo {
  /** Saved preset id; `null` for a new preset or a copy that was never saved. */
  readonly presetId: string | null;
  readonly unsaved: boolean;
}

export interface ThemePreviewProps {
  /** Edited preset, applied before it is saved. */
  preset: PlayerPreset;
  /** Public examples directory on the admin page's origin, e.g. `/examples/`. */
  examplesUrl: string | null | undefined;
  /** Plays this schedule and content instead of the Grok sample. */
  source?: PreviewSource | undefined;
  /** Shows "데모에서 열기" for this preset. */
  demo?: PreviewDemo | undefined;
  /**
   * Inside a wide dialog (`sa-dialog.is-wide`), narrows the stage's room until the dialog body fits the dialog's
   * tallest size, but not below 512px; a lower window scrolls the body instead.
   */
  fitHeight?: boolean | undefined;
}

interface PreviewMessage {
  readonly type: typeof PREVIEW_MESSAGE;
  readonly preset: PlayerPreset;
  pageLang?: PageLanguage;
  schedule?: unknown;
  content?: string;
  title?: string;
}

interface FrameState {
  readonly src: string;
  readonly status: FrameStatus;
  readonly message: string;
}

/** One `ads-player-preview-event` detail, read at the message boundary. */
interface AdEvent {
  readonly kind: string;
  readonly position: string;
  /** ISO time; anything else is ignored when shown. */
  readonly at: string;
  /** Place of the ad in its break, from 1; 0 when unknown. */
  readonly index: number;
  readonly count: number;
}

interface AdProgress {
  /** The frame address it came from, so a new frame starts with no event. */
  readonly src: string;
  readonly line: string;
  /** ISO time from the event; empty when it sent none. */
  readonly at: string;
}

type Examples = { readonly url: URL; readonly reason: '' } | { readonly url: null; readonly reason: string };

/** The examples directory, ending in `/`, or why the admin cannot use it. */
function examplesBase(examplesUrl: string | null | undefined): Examples {
  const url = resolveHttpUrl(examplesUrl, document.baseURI);
  if (!url) return { url: null, reason: '예제 주소가 없어 미리보기를 열 수 없어요. 관리자 설치 경로를 확인해 주세요.' };

  if (url.origin !== location.origin)
    return { url: null, reason: '미리보기는 관리자와 같은 출처의 예제 페이지에서만 열 수 있어요.' };

  if (!url.pathname.endsWith('/')) url.pathname += '/';

  url.search = '';
  url.hash = '';

  return { url, reason: '' };
}

/** The demo page opened with a saved preset ("데모에서 열기"), or empty when the examples directory cannot be used. */
export function demoAddress(examplesUrl: string | null | undefined, presetId: string): string {
  const examples = examplesBase(examplesUrl);

  return examples.url ? `${new URL('index.html', examples.url).href}?${new URLSearchParams({ preset: presetId })}` : '';
}

/** Frame address; only the player type is in it, so only it reloads the frame. */
function frameAddress(examples: URL, preset: PlayerPreset): string {
  const url = new URL('preview.html', examples);

  url.searchParams.set('type', preset.playerType);

  return url.href;
}

function demoReason(demo: PreviewDemo): string {
  if (demo.presetId === null) return '새 프리셋은 저장한 뒤 데모에서 열 수 있어요.';

  return demo.unsaved ? '저장하지 않은 입력이 있어요. 저장하면 데모에서 열 수 있어요.' : '';
}

/** A title under the loader's `data-title` rule (trimmed, not empty, no control characters), or empty. */
function contentTitle(value: string | undefined): string {
  const title = value?.trim() ?? '';
  // oxlint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f-\u009f]/u.test(title)) return '';

  return title;
}

/** A positive whole number from the frame, or 0. */
function place(value: number): number {
  return Number.isInteger(value) && value > 0 ? value : 0;
}

/** "프리롤 1/2 재생 중" while an ad plays, "미드롤 1/1 · 끝남" after; parts the event lacks are left out. */
function progressLine(event: AdEvent): string {
  const index = place(event.index);
  const total = place(event.count);
  const ad = [positionNames.get(event.position) ?? event.position, index && total ? `${index}/${total}` : '']
    .filter(Boolean)
    .join(' ');

  if (!event.kind) return '';

  if (event.kind === 'start') return `${ad} 재생 중`.trim();

  return [ad, eventNames.get(event.kind) ?? event.kind].filter(Boolean).join(' · ');
}

/** `10:12:08` in local time for an ISO time, or empty for anything else. */
function clockTime(at: string): string {
  const time = new Date(at);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(at) || Number.isNaN(time.getTime())) return '';

  return [time.getHours(), time.getMinutes(), time.getSeconds()].map((part) => String(part).padStart(2, '0')).join(':');
}

function scaleNote(view: WidthView, width: number, scale: number, fitted: boolean): string {
  const room = fitted ? '높이에 맞춘 자리 폭' : '자리 폭';

  if (view === 'wide') return width ? `${room} ${Math.round(width)}px · 실제 크기예요` : `${room} · 실제 크기예요`;

  return scale < 1
    ? `보이는 폭 ${width}px · 실제의 ${Math.round(scale * 100)}%로 줄여 보여요`
    : `보이는 폭 ${width}px · 실제 크기예요`;
}

/** The view's content width, or 0 before it is measured (and where `ResizeObserver` is missing). */
function useRoomWidth(view: RefObject<HTMLDivElement | null>): number {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = view.current;
    if (!element || !('ResizeObserver' in window)) return;

    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });

    observer.observe(element);

    return () => observer.disconnect();
  }, [view]);

  return width;
}

/**
 * The widest room (16:9, so its height follows) that lets the dialog body around `view` fit the dialog's `max-height`,
 * at least `FIT_MIN_WIDTH`; 0 while the body's own width already fits or outside a wide dialog.
 */
function useFitWidth(view: RefObject<HTMLDivElement | null>, enabled: boolean): number {
  const [fit, setFit] = useState(0);

  useEffect(() => {
    const element = view.current;
    const body = element?.closest<HTMLElement>('.sa-dialog-b');
    const dialog = body?.closest('dialog');
    if (!enabled || !element || !body || !dialog || !('ResizeObserver' in window)) return;

    const measure = () => {
      const tallest = Number.parseFloat(getComputedStyle(dialog).maxHeight);
      const style = getComputedStyle(body);
      const inner = body.clientWidth - Number.parseFloat(style.paddingLeft) - Number.parseFloat(style.paddingRight);
      // Head, footer and borders stay; everything in the body but the view keeps its height at any room width.
      const chrome = dialog.getBoundingClientRect().height - body.clientHeight;
      const rest = body.scrollHeight - element.getBoundingClientRect().height;
      const height = Math.floor(tallest - chrome - rest);
      const width = Math.max(FIT_MIN_WIDTH, Math.floor((height * 16) / 9));

      setFit(Number.isFinite(width) && width < inner ? width : 0);
    };
    const observer = new ResizeObserver(measure);

    observer.observe(body);

    for (const child of body.children) observer.observe(child);

    window.addEventListener('resize', measure);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [view, enabled]);

  return fit;
}

/**
 * The player preview (design PlayerPreview, PlayerStage): a same-origin iframe of `examples/preview.html` playing the
 * Grok sample's raw schedule, or `source`, so nothing is recorded. The whole preset (plus page language and source)
 * goes to the frame by `postMessage` after each `load` and again on every change; the frame decides what to rebuild,
 * and only a different player type changes its address.
 *
 * It renders the inside of a `sa-ppv` card; the caller owns the card and its heading.
 */
export function ThemePreview({ preset, examplesUrl, source, demo, fitHeight = false }: ThemePreviewProps) {
  const ids = useId();
  const frame = useRef<HTMLIFrameElement>(null);
  const view = useRef<HTMLDivElement>(null);
  const [pageLang, setPageLang] = useState<PageLanguage>('ko');
  const latest = useRef({ preset, pageLang, source });
  const loaded = useRef(false);
  // Whether the document behind the latest `load` said `loading`; reset at every `load`.
  const heard = useRef(false);
  const silence = useRef<ReturnType<typeof setTimeout>>(undefined);
  const examples = examplesBase(examplesUrl);
  const src = examples.url ? frameAddress(examples.url, preset) : '';
  const [state, setState] = useState<FrameState>({ src, status: 'loading', message: '' });
  // Live regions announce changes, not their first content, so the status text goes in a task after mount.
  const [announcing, setAnnouncing] = useState(false);
  const [widthView, setWidthView] = useState<WidthView>('wide');
  const [progress, setProgress] = useState<AdProgress>({ src, line: '', at: '' });
  const room = useRoomWidth(view);
  const fit = useFitWidth(view, fitHeight);

  // Another frame address is another player, also when it comes back to an earlier one; its line starts afresh.
  if (progress.src !== src) setProgress({ src, line: '', at: '' });

  const current: FrameState = state.src === src ? state : { src, status: 'loading', message: '' };
  const shown = progress.src === src ? progress : null;
  const broken = current.status === 'error' || current.status === 'missing-sample';
  const ready = current.status === 'ready';
  // The Grok sample has a midroll; a played schedule may not.
  const midroll = source ? source.schedule.breaks.some((item) => item.position === 'mid') : true;
  const width = widthView === 'wide' ? room : WIDTHS[widthView];
  const scale = width && room ? Math.min(1, room / width) : 1;

  function post() {
    const { preset: value, pageLang: lang, source: played } = latest.current;
    const message: PreviewMessage = { type: PREVIEW_MESSAGE, preset: value };

    // The page language only matters while the preset leaves the language empty.
    if (value.language === null) message.pageLang = lang;

    if (played) {
      message.schedule = played.schedule;
      message.content = played.content;

      const title = contentTitle(played.title);

      if (title) message.title = title;
    }

    frame.current?.contentWindow?.postMessage(message, location.origin);
  }

  function command(name: PreviewCommand) {
    frame.current?.contentWindow?.postMessage({ type: PREVIEW_COMMAND_MESSAGE, command: name }, location.origin);
  }

  function restart() {
    setProgress({ src, line: '', at: '' });
    command('restart');
  }

  useEffect(() => {
    const timer = setTimeout(() => setAnnouncing(true));

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    latest.current = { preset, pageLang, source };

    if (loaded.current) post();
  }, [preset, pageLang, source]);

  useEffect(() => {
    if (!src) return;

    loaded.current = false;
    heard.current = false;

    const onMessage = (event: MessageEvent) => {
      const data: unknown = event.data;

      if (event.origin !== location.origin || !frame.current || event.source !== frame.current.contentWindow) return;

      if (!(data instanceof Object) || !('type' in data)) return;

      if (data.type === PREVIEW_EVENT_MESSAGE) {
        const detail = 'event' in data && data.event instanceof Object ? data.event : null;
        if (!detail) return;

        const ad: AdEvent = {
          kind: 'kind' in detail ? String(detail.kind) : '',
          position: 'position' in detail ? String(detail.position) : '',
          at: 'at' in detail ? String(detail.at) : '',
          index: 'index' in detail ? Number(detail.index) : 0,
          count: 'count' in detail ? Number(detail.count) : 0,
        };
        const line = progressLine(ad);

        if (line) setProgress({ src, line, at: ad.at });

        return;
      }

      if (data.type !== PREVIEW_STATUS_MESSAGE) return;

      const status = 'status' in data ? data.status : null;

      // `loading` means the frame builds a new player. A change it restyles on the playing one sends only `ready`,
      // so that line stays.
      if (status === 'loading') {
        heard.current = true;
        setProgress({ src, line: '', at: '' });
      }

      clearTimeout(silence.current);

      if (status === 'ready' || status === 'loading') setState({ src, status, message: '' });
      else if (status === 'error') setState({ src, status, message: FAILED });
      else if (status === 'missing-sample') {
        const invalid = 'reason' in data && data.reason === 'invalid';

        setState({ src, status, message: invalid ? INVALID_SAMPLE : MISSING_SAMPLE });
      }
    };

    window.addEventListener('message', onMessage);

    return () => {
      window.removeEventListener('message', onMessage);
      clearTimeout(silence.current);
      loaded.current = false;
    };
  }, [src]);

  function onLoad() {
    const spoke = heard.current;

    loaded.current = true;
    heard.current = false;
    post();
    clearTimeout(silence.current);

    if (spoke) return;

    silence.current = setTimeout(() => {
      setState({ src, status: 'error', message: SILENT_FRAME });
    }, FRAME_SILENCE_MS);
  }

  if (!src) return <p className="sa-help">{examples.reason}</p>;

  // SAFETY: React passes custom properties through `style`; `CSSProperties` only lacks their names.
  const frameStyle = room ? ({ '--_w': `${width}px`, '--_s': String(scale) } as CSSProperties) : undefined;
  const viewVars: Record<string, string> = {};

  if (room) viewVars['--_h'] = `${Math.round((width * 9) / 16) * scale}px`;

  // `--_fit` narrows the room in a wide dialog (bundle.css `.sa-dialog.is-wide`).
  if (fit) viewVars['--_fit'] = `${fit}px`;

  // SAFETY: as above.
  const viewStyle = viewVars as CSSProperties;
  const time = shown ? clockTime(shown.at) : '';
  const reason = demo ? demoReason(demo) : '';
  const demoHref = demo?.presetId && !reason ? demoAddress(examplesUrl, demo.presetId) : '';

  return (
    <>
      <StatusMessage tone={current.status === 'missing-sample' ? 'warn' : 'info'}>
        {announcing && current.status === 'loading'
          ? LOADING
          : current.status === 'missing-sample'
            ? current.message
            : ''}
      </StatusMessage>
      <StatusMessage tone="bad">{current.status === 'error' ? current.message : ''}</StatusMessage>
      <div className="sa-stage">
        <div className="sa-stage-bar" hidden={broken}>
          <Segmented
            label="폭 보기"
            value={widthView}
            options={widthOptions}
            onChange={setWidthView}
            describedBy={`${ids}-scale`}
          />
          <p className="sa-small" id={`${ids}-scale`}>
            {scaleNote(widthView, width, scale, fit > 0)}
          </p>
        </div>
        <div ref={view} className={broken ? 'sa-stage-view is-empty' : 'sa-stage-view'} style={viewStyle}>
          <div className="sa-stage-frame" style={frameStyle}>
            <iframe
              ref={frame}
              title="플레이어 미리보기 화면"
              src={src}
              allowFullScreen
              hidden={broken}
              onLoad={onLoad}
            />
          </div>
        </div>
        <div className="sa-stage-tools">
          <span className="sa-label" id={`${ids}-scenes`}>
            장면 바로가기
          </span>
          <div
            className="sa-row"
            role="group"
            aria-labelledby={`${ids}-scenes`}
            aria-describedby={ready ? undefined : `${ids}-not-ready`}
          >
            {sceneButtons.map((scene) => {
              const noMidroll = ready && !midroll && scene.command === 'before-midroll';

              return (
                <Button
                  key={scene.command}
                  size="sm"
                  disabled={!ready || noMidroll}
                  aria-describedby={noMidroll ? `${ids}-no-midroll` : undefined}
                  onClick={() => command(scene.command)}
                >
                  {scene.label}
                </Button>
              );
            })}
            <Button size="sm" onClick={restart}>
              다시 불러오기
            </Button>
          </div>
          {ready ? null : (
            <span className="sa-help" id={`${ids}-not-ready`}>
              {NOT_READY}
            </span>
          )}
          {ready && !midroll ? (
            <span className="sa-help" id={`${ids}-no-midroll`}>
              {NO_MIDROLL}
            </span>
          ) : null}
        </div>
        <p className="sa-stage-now">
          <span>최근 광고 진행</span>
          <span>{shown?.line || '아직 광고가 나오지 않았어요'}</span>
          {time ? <time dateTime={shown?.at}>{time}</time> : null}
        </p>
      </div>
      {preset.language === null ? (
        <Field
          label="페이지 언어"
          help="플레이어 화면 언어를 비워서 페이지 lang을 따라요. 미리보기에서만 바꿔 보고 저장하지 않아요."
        >
          <Select
            value={pageLang}
            onChange={(event) => {
              const value = pageLanguages.find((option) => option.value === event.currentTarget.value);

              if (value) setPageLang(value.value);
            }}
          >
            {pageLanguages.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      {demo ? (
        <div className="sa-ppv-f">
          {/* One link either way, so focus stays on it when it is blocked or freed. */}
          <span className="sa-btn-why">
            {demoHref ? (
              <ButtonLink href={demoHref} target="_blank" rel="noopener noreferrer" icon={demoIcon}>
                데모에서 열기<span className="sa-sr"> (새 창)</span>
              </ButtonLink>
            ) : (
              <ButtonLink icon={demoIcon} aria-disabled="true" aria-describedby={`${ids}-demo-why`}>
                데모에서 열기<span className="sa-sr"> (새 창)</span>
              </ButtonLink>
            )}
            {demoHref ? null : (
              <span className="sa-help" id={`${ids}-demo-why`}>
                {reason}
              </span>
            )}
          </span>
        </div>
      ) : null}
    </>
  );
}
