import {
  type NativePresetRender,
  type PlayerLanguage,
  type PlayerPreload,
  type PlayerPreset,
  type PresetControllerUI,
  type PresetPlaybackRender,
  presetRender,
  type PresetTimeouts,
  type VideojsPresetRender,
} from './preset';
import { resolveHttpUrl } from './url';

export type SnippetMedia = 'mp4' | 'hls-spf' | 'hls-hlsjs';

export interface InstallSnippetOptions {
  readonly preset: PlayerPreset;
  readonly host: 'standalone' | 'gnuboard';
  /** Fixed video ID used by schedules and stats. */
  readonly videoId: string;
  readonly contentUrl: string;
  /** HLS media is supported only by the Video.js player. */
  readonly media: SnippetMedia;
  /** Address of the manager's `public/assets/`, ending in `/`. Absolute or `/`-rooted. */
  readonly assetsUrl: string;
  /** Address of the manager's `api/index.php`. Absolute or `/`-rooted: `<media-ads src>` rejects relative paths. */
  readonly apiUrl: string;
}

const hlsElements = {
  'hls-spf': 'hls-video',
  'hls-hlsjs': 'hlsjs-video',
} as const;

/** Escape a value for a double-quoted HTML attribute. */
export function escapeAttribute(value: string): string {
  return value.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);
}

/** Serialize a value for an inline module script; `<` cannot close the script element. */
export function scriptValue(value: string | PresetControllerUI | PresetTimeouts): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function attributes(values: Readonly<Record<string, string>>): string {
  return Object.entries(values)
    .map(([name, value]) => ` ${name}="${escapeAttribute(value)}"`)
    .join('');
}

/** `style` text for validated preset values. Names come only from the preset table. */
function styleText(css: Readonly<Record<string, string>>): string {
  return Object.entries(css)
    .map(([name, value]) => `${name}: ${value}`)
    .join('; ');
}

function scheduleUrl(apiUrl: string, videoId: string): string {
  const query = new URLSearchParams({ action: 'schedule', videoId });

  return `${apiUrl}${apiUrl.includes('?') ? '&' : '?'}${query}`;
}

/**
 * Element id suffix for one video: a readable slug plus a 32-bit FNV-1a hash of the exact video ID, so snippets for two
 * videos on one page never share ids, even when their slugs match (`a:1` and `a-1`). The same video twice still would.
 */
function idSuffix(videoId: string): string {
  const slug = videoId
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 24)
    .replace(/^-+|-+$/g, '');
  let hash = 0x811c9dc5;

  for (let index = 0; index < videoId.length; index++) {
    hash ^= videoId.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return slug ? `${slug}-${hash.toString(36)}` : hash.toString(36);
}

/** `<media-ads src>` accepts only `http(s)://` URLs and `/` paths (ads `core/url.ts`), so the snippet uses the same. */
function isInstallUrl(value: string): boolean {
  return (
    (/^https?:\/\//i.test(value) || value.startsWith('/')) && resolveHttpUrl(value, 'https://install.invalid/') !== null
  );
}

function notes(options: { readonly host: InstallSnippetOptions['host'] }, legacy = true): string[] {
  const lines = [legacy ? '<!-- 솔애드 광고 플레이어(이전 방식) -->' : '<!-- 솔애드 광고 플레이어 -->'];

  if (options.host === 'gnuboard') lines.push('<!-- 그누보드 영상 ID는 게시판:글번호:영상키 형식이에요. -->');

  return lines;
}

/** Media attributes for the render's playback values. Autoplay always starts muted, as the loader does after merging. */
function playbackAttributes({ autoplay, muted, loop, preload }: PresetPlaybackRender): string {
  return ` playsinline preload="${preload}"${autoplay ? ' autoplay' : ''}${muted || autoplay ? ' muted' : ''}${loop ? ' loop' : ''}`;
}

function videojsSnippet(options: InstallSnippetOptions, render: VideojsPresetRender): string {
  const { videoId, contentUrl, media, assetsUrl, apiUrl } = options;
  const videojs = `${assetsUrl}videojs/`;
  const mediaTag = media === 'mp4' ? 'video' : hlsElements[media];
  const style = styleText(render.css);
  const mediaId = `ads-content-${idSuffix(videoId)}`;
  const lines = [
    ...notes(options),
    `<link rel="stylesheet" href="${escapeAttribute(videojs + render.styles.css)}" />`,
    `<script type="module" src="${escapeAttribute(videojs + render.styles.js)}"></script>`,
  ];

  if (media !== 'mp4') {
    lines.push(`<script type="module" src="${escapeAttribute(`${videojs}media/${mediaTag}.js`)}"></script>`);
  }

  // A preset language wraps the player in `<media-i18n>`; without one the player follows the page `lang`.
  const indent = render.language ? '  ' : '';

  lines.push(`<script type="module" src="${escapeAttribute(`${assetsUrl}ads.js`)}"></script>`);

  if (render.language) lines.push(`<media-i18n lang="${render.language}">`);

  lines.push(
    `${indent}<video-player>`,
    `${indent}  <${render.skinTag}${style ? ` style="${escapeAttribute(style)}"` : ''}>`,
    `${indent}    <${mediaTag} id="${mediaId}" src="${escapeAttribute(contentUrl)}"${playbackAttributes(render.playback)}></${mediaTag}>`,
    `${indent}    <media-ads for="${mediaId}" src="${escapeAttribute(scheduleUrl(apiUrl, videoId))}" video-id="${escapeAttribute(videoId)}"${attributes(render.attributes)}></media-ads>`,
    `${indent}  </${render.skinTag}>`,
    `${indent}</video-player>`
  );

  if (render.language) lines.push('</media-i18n>');

  return lines.join('\n');
}

function nativeSnippet(options: InstallSnippetOptions, render: NativePresetRender): string {
  const { videoId, contentUrl, assetsUrl, apiUrl } = options;
  const style = styleText({ position: 'relative', 'aspect-ratio': '16 / 9', ...render.css });
  const suffix = idSuffix(videoId);
  const playerId = `ads-player-${suffix}`;
  const mediaId = `ads-content-${suffix}`;
  const extra: string[] = [];

  extra.push(`      ui: ${scriptValue(render.ui)},`);

  if (render.timeouts) extra.push(`      timeouts: ${scriptValue(render.timeouts)},`);

  return [
    ...notes(options),
    `<div id="${playerId}" style="${escapeAttribute(style)}">`,
    `  <video id="${mediaId}" src="${escapeAttribute(contentUrl)}" controls${playbackAttributes(render.playback)} style="width: 100%; height: 100%"></video>`,
    '</div>',
    '<script type="module">',
    `  import { createAdsController } from ${scriptValue(`${assetsUrl}ads.js`)};`,
    '',
    `  const endpoint = new URL(${scriptValue(apiUrl)}, location.href);`,
    '',
    "  endpoint.searchParams.set('action', 'schedule');",
    `  endpoint.searchParams.set('videoId', ${scriptValue(videoId)});`,
    "  const response = await fetch(endpoint, { credentials: 'same-origin', cache: 'no-store' }).catch(() => null);",
    '  // An error page is not JSON, so the body is read only after a successful response.',
    '  const payload = response?.ok ? await response.json().catch(() => null) : null;',
    '',
    '  // Without a schedule the content still plays.',
    '  if (payload?.ok) {',
    '    const { schedule, ...tracking } = payload.data;',
    '    const controller = createAdsController({',
    `      media: document.getElementById(${scriptValue(mediaId)}),`,
    `      container: document.getElementById(${scriptValue(playerId)}),`,
    '      schedule,',
    '      tracking,',
    ...extra,
    '    });',
    '',
    "    window.addEventListener('pagehide', () => controller.destroy(), { once: true });",
    '  }',
    '</script>',
  ].join('\n');
}

/**
 * Static installation HTML for one preset, the way pages were installed before the loader ("이전 방식"). The preset is
 * copied into the code when generated, so later preset changes do not reach it. Attribute values are HTML-escaped and
 * script values are JSON with `<` escaped.
 *
 * @throws RangeError for HLS with the native player, empty required values or relative addresses.
 */
export function installSnippet(options: InstallSnippetOptions): string {
  if (!options.videoId.trim()) throw new RangeError('고정 영상 ID를 입력해 주세요.');

  if (!options.contentUrl.trim()) throw new RangeError('본편 주소를 입력해 주세요.');

  for (const [value, label] of [
    [options.contentUrl, '본편 주소'],
    [options.assetsUrl, '플레이어 파일 주소'],
    [options.apiUrl, 'API 주소'],
  ] as const) {
    if (!isInstallUrl(value)) throw new RangeError(`${label}는 http(s):// 주소나 /로 시작하는 경로로 입력해 주세요.`);
  }

  if (options.preset.playerType === 'native' && options.media !== 'mp4')
    throw new RangeError('HLS는 Video.js 플레이어에서만 쓸 수 있어요. MP4를 고르거나 Video.js 프리셋을 골라 주세요.');

  const render = presetRender(options.preset);

  return render.playerType === 'videojs' ? videojsSnippet(options, render) : nativeSnippet(options, render);
}

/** Placeholder playback values; only the ones given are written. */
export interface LoaderSnippetPlayback {
  readonly autoplay?: boolean | undefined;
  readonly muted?: boolean | undefined;
  readonly loop?: boolean | undefined;
  readonly preload?: PlayerPreload | undefined;
}

export interface LoaderSnippetOptions {
  readonly host: 'standalone' | 'gnuboard';
  /** Fixed video ID used by schedules and stats. */
  readonly videoId: string;
  readonly contentUrl: string;
  readonly posterUrl?: string | undefined;
  readonly title?: string | undefined;
  /** WebVTT thumbnail track for the seek bar. */
  readonly thumbnailsUrl?: string | undefined;
  /** WebVTT subtitles, added in the player language and off until the viewer turns them on. */
  readonly captionsUrl?: string | undefined;
  /** Address of the manager's `player/loader.js`. Absolute or `/`-rooted. */
  readonly loaderUrl: string;
  /**
   * `data-preset`, for a preset other than the site preset. The admin leaves it out (spec decision 28); the public demo
   * (`public/examples/install-code.js`) writes it and must produce the same text.
   */
  readonly presetId?: string | undefined;
  /** `data-engine`; written only for `hlsjs`, since `spf` is the loader default. */
  readonly engine?: 'spf' | 'hlsjs' | undefined;
  readonly playback?: LoaderSnippetPlayback | undefined;
  /** `data-lang`. */
  readonly lang?: PlayerLanguage | undefined;
  /**
   * A lecture preset (ads-lms-spec 4): writes `data-lecture` and `data-learner-token` with a guidance comment. Without
   * values the lines carry stand-ins the site replaces per lecture and learner.
   */
  readonly lms?: LoaderSnippetLecture | undefined;
}

export interface LoaderSnippetLecture {
  /** Lecture manifest JSON. Absolute or `/`-rooted. */
  readonly lectureUrl?: string | undefined;
  /** Learner token signed by the site's LMS. */
  readonly learnerToken?: string | undefined;
}

const presetIdPattern = /^(default|flat|rounded|accent|lms|p-[a-z0-9]{10})$/;

// Stand-ins and guidance for a lecture preset's lines (ads-lms-spec 4).
const LECTURE_STAND_IN = '/lecture/manifest.json';
const TOKEN_STAND_IN = 'LMS가 학습자마다 서명한 토큰';
const LECTURE_NOTES = [
  '<!-- 강의: data-lecture는 강의마다 자료 매니페스트 주소로 바꿔요. -->',
  '<!-- data-learner-token은 사이트 서버가 학습자마다 만들어 넣어요. 빼면 진도가 이 브라우저에만 저장돼요. -->',
];

/**
 * Installation HTML for the loader (spec 3.1): a placeholder with the video's values and the loader line, which a page
 * needs only once. The site preset applies when the page loads, so preset changes need no new code. Attribute values
 * are HTML-escaped. Optional values are written in a fixed order, after the video's own values.
 *
 * @throws RangeError for empty required values or relative addresses.
 */
export function loaderSnippet(options: LoaderSnippetOptions): string {
  if (!options.videoId.trim()) throw new RangeError('고정 영상 ID를 입력해 주세요.');

  if (!options.contentUrl.trim()) throw new RangeError('본편 주소를 입력해 주세요.');

  const optional = [
    [options.posterUrl, 'data-poster', '포스터 주소'],
    [options.thumbnailsUrl, 'data-thumbnails', '미리보기 이미지 목록 주소'],
    [options.captionsUrl, 'data-captions', '자막 주소'],
    [options.lms?.lectureUrl, 'data-lecture', '강의 자료 주소'],
  ] as const;

  for (const [value, label] of [
    [options.contentUrl, '본편 주소'],
    [options.loaderUrl, '로더 주소'],
    ...optional.filter(([value]) => value?.trim()).map(([value, , label]) => [value!, label] as const),
  ] as const) {
    if (!isInstallUrl(value)) throw new RangeError(`${label}는 http(s):// 주소나 /로 시작하는 경로로 입력해 주세요.`);
  }

  const values: [string, string][] = [
    ['data-video-id', options.videoId],
    ['data-src', options.contentUrl],
  ];

  if (options.posterUrl?.trim()) values.push(['data-poster', options.posterUrl]);

  if (options.title?.trim()) values.push(['data-title', options.title.trim()]);

  if (options.thumbnailsUrl?.trim()) values.push(['data-thumbnails', options.thumbnailsUrl]);

  if (options.captionsUrl?.trim()) values.push(['data-captions', options.captionsUrl]);

  if (options.presetId !== undefined) {
    if (!presetIdPattern.test(options.presetId)) throw new RangeError('프리셋 id 형식이 맞지 않아요.');

    values.push(['data-preset', options.presetId]);
  }

  if (options.engine === 'hlsjs') values.push(['data-engine', 'hlsjs']);

  const { autoplay, muted, loop, preload } = options.playback ?? {};

  if (autoplay !== undefined) values.push(['data-autoplay', String(autoplay)]);

  // Autoplay always starts muted (loader contract 4.2), so a muted value next to it says nothing.
  if (muted !== undefined && !autoplay) values.push(['data-muted', String(muted)]);

  if (loop !== undefined) values.push(['data-loop', String(loop)]);

  if (preload !== undefined) values.push(['data-preload', preload]);

  if (options.lang !== undefined) values.push(['data-lang', options.lang]);

  if (options.lms) {
    values.push(['data-lecture', options.lms.lectureUrl?.trim() || LECTURE_STAND_IN]);
    values.push(['data-learner-token', options.lms.learnerToken?.trim() || TOKEN_STAND_IN]);
  }

  return [
    ...notes(options, false),
    ...(options.lms ? LECTURE_NOTES : []),
    '<div data-solad-player',
    ...values.map(
      ([name, value], index) =>
        `     ${name}="${escapeAttribute(value)}"${index === values.length - 1 ? '></div>' : ''}`
    ),
    '<!-- 아래 로더 줄은 페이지에 한 번만 넣어요. -->',
    `<script type="module" src="${escapeAttribute(options.loaderUrl)}"></script>`,
  ].join('\n');
}
