/**
 * Installation code for the demo's current state (contract A2-D 3). `loaderSnippet` mirrors the admin's
 * `ui/src/player/install-snippet.ts` line for line; `tests/admin/examples.test.ts` compares the two over a case table.
 */

const presetIdPattern = /^(default|flat|rounded|accent|lms|p-[a-z0-9]{10})$/;

// Stand-ins and guidance for a lecture preset's lines (ads-lms-spec 4).
const LECTURE_STAND_IN = '/lecture/manifest.json';
const TOKEN_STAND_IN = 'LMS가 학습자마다 서명한 토큰';
const LECTURE_NOTES = [
  '<!-- 강의: data-lecture는 강의마다 자료 매니페스트 주소로 바꿔요. -->',
  '<!-- data-learner-token은 사이트 서버가 학습자마다 만들어 넣어요. 빼면 진도가 이 브라우저에만 저장돼요. -->',
];

/** Escape a value for a double-quoted HTML attribute. */
export function escapeAttribute(value) {
  return value.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);
}

/** Mirrors `resolveHttpUrl` in `ui/src/player/url.ts`. */
function resolveHttpUrl(value, base) {
  // oxlint-disable-next-line no-control-regex
  if (!value || /[\u0000- \u007f\\]/u.test(value) || value.startsWith('//')) return null;

  try {
    const url = new URL(value, base);

    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url : null;
  } catch {
    return null;
  }
}

function isInstallUrl(value) {
  return (
    (/^https?:\/\//i.test(value) || value.startsWith('/')) && resolveHttpUrl(value, 'https://install.invalid/') !== null
  );
}

/**
 * The loader installation HTML: a placeholder and the loader line. Same options and output as the admin's
 * `loaderSnippet`.
 *
 * @throws RangeError for empty required values, relative addresses or a malformed preset id.
 */
export function loaderSnippet(options) {
  if (!options.videoId.trim()) throw new RangeError('고정 영상 ID를 입력해 주세요.');

  if (!options.contentUrl.trim()) throw new RangeError('본편 주소를 입력해 주세요.');

  const optional = [
    [options.posterUrl, 'data-poster', '포스터 주소'],
    [options.thumbnailsUrl, 'data-thumbnails', '미리보기 이미지 목록 주소'],
    [options.captionsUrl, 'data-captions', '자막 주소'],
    [options.lms?.lectureUrl, 'data-lecture', '강의 자료 주소'],
  ];

  for (const [value, label] of [
    [options.contentUrl, '본편 주소'],
    [options.loaderUrl, '로더 주소'],
    ...optional.filter(([value]) => value?.trim()).map(([value, , label]) => [value, label]),
  ]) {
    if (!isInstallUrl(value)) throw new RangeError(`${label}는 http(s):// 주소나 /로 시작하는 경로로 입력해 주세요.`);
  }

  const values = [
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

  const lines = ['<!-- 솔애드 광고 플레이어 -->'];

  if (options.host === 'gnuboard') lines.push('<!-- 그누보드 영상 ID는 게시판:글번호:영상키 형식이에요. -->');

  if (options.lms) lines.push(...LECTURE_NOTES);

  return [
    ...lines,
    '<div data-solad-player',
    ...values.map(
      ([name, value], index) =>
        `     ${name}="${escapeAttribute(value)}"${index === values.length - 1 ? '></div>' : ''}`
    ),
    '<!-- 아래 로더 줄은 페이지에 한 번만 넣어요. -->',
    `<script type="module" src="${escapeAttribute(options.loaderUrl)}"></script>`,
  ].join('\n');
}

/**
 * Loader options for the demo's state over the selected preset's render (`render` from `presetRender`): only values
 * that differ from the preset are written, and `data-preset` only for a preset other than the site preset. What
 * `data-*` cannot say (an emptied language, a display the preset hides) is returned as `overrides` for the JS API.
 */
export function installOptions(state, { render, sitePresetId, video, loaderUrl, host = 'standalone' }) {
  const playback = {};
  const controls = {};
  const overrides = {};
  const videojs = render.playerType === 'videojs';
  const autoplay = state.autoplay ?? render.playback.autoplay;

  for (const key of ['autoplay', 'loop', 'preload'])
    if (state[key] !== undefined && state[key] !== render.playback[key]) playback[key] = state[key];

  // The loader starts autoplay muted whatever data-muted says, so the demo locks it and the code leaves it out.
  if (!autoplay && state.muted !== undefined && state.muted !== render.playback.muted) playback.muted = state.muted;

  let lang;

  if (state.language !== undefined && state.language !== render.language) {
    if (state.language === null) overrides.language = null;
    else lang = state.language;
  }

  // Like the display values, the controls are preset values that `data-*` cannot say; the native player has none.
  if (videojs)
    for (const key of ['seekButtons', 'captions'])
      if (state[key] !== undefined && state[key] !== render.controls[key]) controls[key] = state[key];

  if (Object.keys(controls).length) overrides.controls = controls;

  const showPoster = state.poster ?? render.display.poster;
  const showTitle = videojs && (state.title ?? render.display.title);

  if (showPoster && !render.display.poster && video.posterUrl) overrides.display = { poster: true };

  if (showTitle && !render.display.title && video.title) overrides.display = { ...overrides.display, title: true };

  return {
    snippet: {
      host,
      videoId: video.videoId,
      contentUrl: video.contentUrl,
      posterUrl: showPoster ? video.posterUrl || undefined : undefined,
      title: showTitle ? video.title || undefined : undefined,
      thumbnailsUrl: videojs ? video.thumbnailsUrl || undefined : undefined,
      captionsUrl: videojs ? video.captionsUrl || undefined : undefined,
      loaderUrl,
      presetId: state.preset && state.preset !== sitePresetId ? state.preset : undefined,
      engine: video.hls && render.playerType === 'videojs' ? state.engine : undefined,
      playback: Object.keys(playback).length ? playback : undefined,
      lang,
      lms: render.lms ? { lectureUrl: video.lectureUrl, learnerToken: video.learnerToken } : undefined,
    },
    overrides: Object.keys(overrides).length ? overrides : null,
  };
}

/** Serialize a value for an inline script; `<` cannot close the script element. */
function scriptValue(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

/** The JS API (`mount`) example for the same options, with `overrides` when `data-*` cannot express the state. */
export function apiExample({ snippet, overrides }) {
  const lines = [
    `import { mount } from ${scriptValue(snippet.loaderUrl)};`,
    '',
    "// 자리 요소: <div id=\"player\" data-solad-player data-solad-manual></div>",
    "const handle = await mount(document.getElementById('player'), {",
    `  videoId: ${scriptValue(snippet.videoId)},`,
    `  src: ${scriptValue(snippet.contentUrl)},`,
  ];

  if (snippet.posterUrl) lines.push(`  poster: ${scriptValue(snippet.posterUrl)},`);

  if (snippet.title) lines.push(`  title: ${scriptValue(snippet.title)},`);

  if (snippet.thumbnailsUrl) lines.push(`  thumbnails: ${scriptValue(snippet.thumbnailsUrl)},`);

  if (snippet.captionsUrl) lines.push(`  captions: ${scriptValue(snippet.captionsUrl)},`);

  if (snippet.presetId) lines.push(`  preset: ${scriptValue(snippet.presetId)},`);

  if (snippet.engine === 'hlsjs') lines.push("  engine: 'hlsjs',");

  if (snippet.lang) lines.push(`  lang: ${scriptValue(snippet.lang)},`);

  if (snippet.lms) {
    lines.push(`  lecture: ${scriptValue(snippet.lms.lectureUrl || LECTURE_STAND_IN)}, // 매니페스트 주소나 객체`);
    lines.push(`  learnerToken: ${scriptValue(snippet.lms.learnerToken || TOKEN_STAND_IN)},`);
  }

  const playback = snippet.playback;
  const extra = { ...(playback ? { playback } : {}), ...overrides };

  if (Object.keys(extra).length) lines.push(`  overrides: ${scriptValue(extra)},`);

  lines.push(
    '  onEvent(event) {}, // ads-event의 detail',
    '  onError(error) {}, // { code, message }',
    '});',
    '',
    'handle.player; // <video-player> 또는 <video>',
    'handle.destroy();'
  );

  return lines.join('\n');
}
