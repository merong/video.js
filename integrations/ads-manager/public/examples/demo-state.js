/**
 * Demo state (contract A2-D 3): the address query, the preset list and what the loader receives. Nothing is saved; the
 * state lives in the address (`history.replaceState`).
 */
import { LOGO_DEFAULTS, readPresetRender } from '../player/preset.js';
import { DEMO_HLS_URL, SAMPLE_CONTENT_URL, SAMPLE_SCHEDULE_URL, SAMPLE_TITLE, SAMPLE_VIDEO_ID } from './sample.js';

const here = import.meta.url;
const api = new URL('../api/index.php', here);
const presetIdPattern = /^(default|flat|rounded|accent|p-[a-z0-9]{10})$/;
// oxlint-disable-next-line no-control-regex
const controlPattern = /[\u0000-\u001f\u007f-\u009f]/u;
const languages = ['ko', 'en', 'ja', 'zh-CN'];
// `fr` shows how any other page language falls back to English (contract 4.4).
const pageLanguages = [...languages, 'fr'];
const booleans = { true: true, false: false };
const corners = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
const logoSamples = { 'sample-svg': 'sample-logo.svg', 'sample-png': 'sample-logo.png' };
// Logo state key → `logo.*` field.
const logoFields = {
  logoPosition: 'position',
  logoWidth: 'width',
  logoOpacity: 'opacity',
  logoMargin: 'margin',
  logoHref: 'href',
  logoAlt: 'alt',
  logoHideDuringAds: 'hideDuringAds',
  logoHideWithControls: 'hideWithControls',
};

export const BUILT_IN_PRESETS = [
  { id: 'default', name: '기본' },
  { id: 'flat', name: '플랫' },
  { id: 'rounded', name: '둥근 테두리' },
  { id: 'accent', name: '강조색' },
  { id: 'lms', name: '강의' },
];

/**
 * The demo's starting state. `undefined` playback, language, display, control and logo layout values mean "the preset's
 * value"; a `null` language empties it so the player follows `pageLang`, and a `null` `seekButtons` hides the buttons.
 * `logo` is the preview image: `''`, a sample id, `'custom'` before an address is given, or that address.
 */
export const DEMO_DEFAULTS = Object.freeze({
  preset: null,
  autoplay: undefined,
  muted: undefined,
  loop: undefined,
  preload: undefined,
  language: undefined,
  pageLang: 'ko',
  poster: undefined,
  posterUrl: '',
  title: undefined,
  titleText: '',
  thumbnails: '',
  seekButtons: undefined,
  captions: undefined,
  captionsUrl: '',
  logo: '',
  logoPosition: undefined,
  logoWidth: undefined,
  logoOpacity: undefined,
  logoMargin: undefined,
  logoHref: undefined,
  logoAlt: undefined,
  logoHideDuringAds: undefined,
  logoHideWithControls: undefined,
  media: 'mp4',
  engine: 'spf',
});

const isAddress = (value) => /^(\/|https?:\/\/)/i.test(value) && !controlPattern.test(value);
const isText = (value) => value.trim() !== '' && !controlPattern.test(value) && [...value].length <= 200;
// The preset rules for `logo.href` (an absolute http(s) URL) and `logo.alt` (a label of at most 80 characters).
const isLink = (value) =>
  /^https?:\/\/[^/?#]+/i.test(value) && !/\s/u.test(value) && !controlPattern.test(value) && value.length <= 2048;
const isAlt = (value) => !controlPattern.test(value) && [...value.trim()].length <= 80;
const whole = (min, max) => (value) => {
  const number = /^\d{1,3}$/.test(value) ? Number(value) : NaN;

  return number >= min && number <= max ? number : undefined;
};
const empty = (read) => (value) => (value === '' ? null : read(value));

// Query key → [state key, read]; `read` returns `undefined` for an invalid value.
const readers = {
  preset: (value) => (presetIdPattern.test(value) ? value : undefined),
  autoplay: (value) => booleans[value],
  muted: (value) => booleans[value],
  loop: (value) => booleans[value],
  preload: (value) => (['none', 'metadata', 'auto'].includes(value) ? value : undefined),
  language: (value) => (value === '' ? null : languages.includes(value) ? value : undefined),
  pageLang: (value) => (pageLanguages.includes(value) ? value : undefined),
  poster: (value) => booleans[value],
  posterUrl: (value) => (isAddress(value) ? value : undefined),
  title: (value) => booleans[value],
  titleText: (value) => (isText(value) ? value.trim() : undefined),
  thumbnails: (value) => (isAddress(value) ? value : undefined),
  seekButtons: empty((value) => (['5', '10', '15', '30'].includes(value) ? Number(value) : undefined)),
  captions: (value) => booleans[value],
  captionsUrl: (value) => (isAddress(value) ? value : undefined),
  logo: (value) => (Object.hasOwn(logoSamples, value) || value === 'custom' || isAddress(value) ? value : undefined),
  logoPosition: (value) => (corners.includes(value) ? value : undefined),
  logoWidth: whole(24, 240),
  logoOpacity: whole(10, 100),
  logoMargin: whole(0, 48),
  logoHref: empty((value) => (isLink(value) ? value : undefined)),
  logoAlt: empty((value) => (isAlt(value) ? value.trim() || null : undefined)),
  logoHideDuringAds: (value) => booleans[value],
  logoHideWithControls: (value) => booleans[value],
  media: (value) => (['mp4', 'hls'].includes(value) ? value : undefined),
  engine: (value) => (['spf', 'hlsjs'].includes(value) ? value : undefined),
};

/** Read the demo state from a query; invalid values are dropped and their keys listed in `ignored`. */
export function readDemoQuery(search) {
  const query = new URLSearchParams(search);
  const state = { ...DEMO_DEFAULTS };
  const ignored = [];

  for (const [key, read] of Object.entries(readers)) {
    if (!query.has(key)) continue;

    const value = read(query.get(key));

    if (value === undefined) ignored.push(key);
    else state[key] = value;
  }

  return { state, ignored };
}

/** One query value read as `readDemoQuery` reads it; `undefined` when it is invalid. */
export function readDemoValue(key, value) {
  return readers[key]?.(value);
}

/** The query for a state: only values that differ from `DEMO_DEFAULTS`, in `readers` order. */
export function writeDemoQuery(state) {
  const query = new URLSearchParams();

  for (const key of Object.keys(readers)) {
    const value = state[key];

    if (value === undefined || value === DEMO_DEFAULTS[key]) continue;

    query.set(key, value === null ? '' : String(value));
  }

  return query.toString();
}

/** Why muted cannot be changed, or `''`: autoplay always starts muted, as the loader does. */
export function mutedLock(state, render) {
  return (state.autoplay ?? render.playback.autoplay)
    ? '자동재생은 음소거로 시작해야 해서 음소거를 켠 채 잠가요. 로더도 같은 규칙으로 재생해요.'
    : '';
}

/**
 * Preset-field overrides for the loader; `null` when the state keeps every preset value. `preset` (the parsed preset)
 * gives the logo values the state keeps.
 */
export function demoOverrides(state, render, preset = null) {
  const playback = {};
  const display = {};
  const controls = {};
  const logo = {};
  const result = {};
  const videojs = render.playerType === 'videojs';

  for (const key of ['autoplay', 'loop', 'preload']) if (state[key] !== undefined) playback[key] = state[key];

  // A muted false next to autoplay would make the loader drop every override (contract 4.2), so the lock wins.
  if (mutedLock(state, render)) {
    if (state.muted !== undefined) playback.muted = true;
  } else if (state.muted !== undefined) playback.muted = state.muted;

  if (state.poster !== undefined) display.poster = state.poster;

  // The native player has no title, controls or logo, and its presets refuse those fields.
  if (state.title !== undefined && videojs) display.title = state.title;

  if (videojs) for (const key of ['seekButtons', 'captions']) if (state[key] !== undefined) controls[key] = state[key];

  // Without an image the player draws no logo, so its layout values are not sent.
  if (videojs && logoChoice(state)) {
    for (const [key, field] of Object.entries(logoFields)) if (state[key] !== undefined) logo[field] = state[key];

    // A link without a name would make the loader drop every override (`logo.alt` required); the image shows unlinked.
    if (logoValue(state, 'logoHref', preset) && !logoValue(state, 'logoAlt', preset)) logo.href = null;
  }

  if (Object.keys(playback).length) result.playback = playback;

  if (Object.keys(display).length) result.display = display;

  if (Object.keys(controls).length) result.controls = controls;

  if (Object.keys(logo).length) result.logo = logo;

  if (state.language !== undefined) result.language = state.language;

  return Object.keys(result).length ? result : null;
}

/** The query pairs `readDemoQuery` ignored, as `key=value` text for the notice. */
export function ignoredText(search, ignored) {
  const query = new URLSearchParams(search);

  return ignored.map((key) => `${key}=${query.get(key)}`).join(', ');
}

// State keys that hold a preset field; `undefined` keeps the preset's value.
const presetKeys = [
  'autoplay',
  'muted',
  'loop',
  'preload',
  'language',
  'poster',
  'title',
  'seekButtons',
  'captions',
  ...Object.keys(logoFields),
];

/**
 * The preset's own value for a state key. The render has no logo layout until an image is given, so logo keys read
 * the parsed `preset` with the render defaults.
 */
export function presetValue(key, render, preset = null) {
  if (key === 'language') return render.language;

  if (key === 'poster' || key === 'title') return render.display[key] ?? false;

  if (key === 'seekButtons') return render.controls?.seekButtons ?? null;

  if (key === 'captions') return render.controls?.captions ?? true;

  if (Object.hasOwn(logoFields, key)) return preset?.logo?.[logoFields[key]] ?? LOGO_DEFAULTS[logoFields[key]];

  return render.playback[key];
}

function logoValue(state, key, preset) {
  return state[key] !== undefined ? state[key] : (preset?.logo?.[logoFields[key]] ?? LOGO_DEFAULTS[logoFields[key]]);
}

/** The logo image choice: `''` (none), `'sample-svg'`, `'sample-png'` or `'custom'`. */
export function logoChoice(state) {
  return state.logo === '' || Object.hasOwn(logoSamples, state.logo) ? state.logo : 'custom';
}

/**
 * The preview logo image for the state as a root path or address, or `''`. Samples sit beside the demo page, so their
 * paths come from `page` (the page address).
 */
export function demoLogoUrl(state, page = here) {
  if (Object.hasOwn(logoSamples, state.logo)) return new URL(logoSamples[state.logo], page).pathname;

  return state.logo === 'custom' ? '' : state.logo;
}

/** The Korean sample captions beside the demo page, as a root path ("샘플 자막 쓰기"). */
export function sampleCaptionsUrl(page = here) {
  return new URL('sample-captions.vtt', page).pathname;
}

/** How many preset values the state changes. */
export function changedCount(state) {
  return presetKeys.filter((key) => state[key] !== undefined).length;
}

/** The state with every preset value back to the preset's ("프리셋 값으로 되돌리기"). */
export function resetToPreset(state) {
  return { ...state, ...Object.fromEntries(presetKeys.map((key) => [key, undefined])) };
}

/** The state with `key` set; a value equal to the preset's is stored as `undefined`, so it follows the preset. */
export function changeValue(state, key, value, render, preset = null) {
  const next = { ...state, [key]: value };

  return alignToPreset(next, render, preset);
}

/** Drop the values a (newly chosen) preset already has. */
export function alignToPreset(state, render, preset = null) {
  const next = { ...state };

  for (const key of presetKeys)
    if (next[key] !== undefined && next[key] === presetValue(key, render, preset)) next[key] = undefined;

  return next;
}

/**
 * The video the demo plays and installs: the Grok sample, or the demo HLS content with the same schedule. The native
 * player plays neither HLS nor thumbnails, so for it the state's values stay but MP4 and no thumbnails are used.
 */
export function demoVideo(state, render) {
  const videojs = render?.playerType !== 'native';
  const hls = videojs && state.media === 'hls';

  return {
    videoId: SAMPLE_VIDEO_ID,
    contentUrl: new URL(hls ? DEMO_HLS_URL : SAMPLE_CONTENT_URL).pathname,
    posterUrl: state.posterUrl,
    title: state.titleText || SAMPLE_TITLE,
    thumbnailsUrl: videojs ? state.thumbnails : '',
    captionsUrl: videojs ? state.captionsUrl : '',
    hls,
  };
}

/**
 * `mount` options for the demo player over the chosen preset (`source` from `loadPresetSource`). The preview plays the
 * sample schedule, so nothing is recorded, and takes the preset object, so the loader asks for no preset itself. The
 * logo image goes in `preview.logo`; `page` is the page address the sample logos sit beside.
 */
export function demoMountOptions(state, source, schedule = SAMPLE_SCHEDULE_URL, page = here) {
  const { render } = source;
  const video = demoVideo(state, render);
  const options = {
    videoId: video.videoId,
    src: video.contentUrl,
    title: video.title,
    engine: state.engine,
    preview: { schedule, preset: source.preset },
  };

  if (video.posterUrl) options.poster = video.posterUrl;

  if (video.thumbnailsUrl) options.thumbnails = video.thumbnailsUrl;

  if (video.captionsUrl) options.captions = video.captionsUrl;

  const overrides = demoOverrides(state, render, source.preset);
  const logo = render.playerType === 'videojs' ? demoLogoUrl(state, page) : '';

  if (overrides) options.overrides = overrides;

  if (logo) options.preview.logo = logo;

  return options;
}

async function getJson(action, signal, params = {}) {
  const url = new URL(api);

  url.searchParams.set('action', action);

  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', signal });
  const payload = await response.json().catch(() => null);

  return { status: response.status, payload };
}

/**
 * The presets the demo offers (decision D-2). Everyone gets the three built-ins and the site preset; a signed-in
 * admin on this origin gets every saved preset from `player-presets`. A 401 or 403 there quietly keeps the public
 * list; any other failure keeps it with a `notice`. Items: `{ id, name, site, builtIn }`.
 */
export async function loadPresetList({ signal } = {}) {
  const items = BUILT_IN_PRESETS.map((preset) => ({ ...preset, site: false, builtIn: true }));
  let siteId = 'default';
  let notice = '';

  try {
    const { payload } = await getJson('player-preset', signal);
    const id = payload?.ok ? payload.data?.id : null;

    if (typeof id === 'string' && presetIdPattern.test(id)) siteId = id;
  } catch (error) {
    if (signal?.aborted) throw error;
  }

  try {
    const { status, payload } = await getJson('player-presets', signal);

    if (status === 401 || status === 403) return publicList(items, siteId, notice);

    if (!payload?.ok || !Array.isArray(payload.data?.presets)) throw new Error('player-presets');

    const site = presetIdPattern.test(payload.data.defaultPresetId ?? '') ? payload.data.defaultPresetId : siteId;
    const list = payload.data.presets
      .filter((preset) => typeof preset?.id === 'string' && presetIdPattern.test(preset.id))
      .map((preset) => ({
        id: preset.id,
        name: typeof preset.name === 'string' && preset.name ? preset.name : preset.id,
        site: preset.id === site,
        builtIn: Boolean(preset.builtIn) || BUILT_IN_PRESETS.some((item) => item.id === preset.id),
      }));

    return { items: list, siteId: site, signedIn: true, notice };
  } catch (error) {
    if (signal?.aborted) throw error;

    notice = '저장 프리셋 목록을 불러오지 못했어요. 내장 프리셋과 사이트 적용 프리셋만 보여요. 새로고침하면 다시 불러와요.';
  }

  return publicList(items, siteId, notice);
}

/**
 * The chosen preset's public render (`player-preset&id=`) as `{ render, preset }`, the values the demo compares and
 * the object the loader's preview takes. `{ missing: true }` for an unknown id; any other failure rejects.
 */
export async function loadPresetSource(id, { signal } = {}) {
  const { status, payload } = await getJson('player-preset', signal, { id });

  if (status === 404) return { missing: true };

  const read = payload?.ok ? readPresetRender(payload.data) : null;

  if (!read?.ok) throw new Error(`player-preset ${status}`);

  return { render: read.render, preset: read.preset };
}

/** Built-ins plus the site preset, which is named only "사이트 적용 프리셋" to visitors. */
function publicList(items, siteId, notice) {
  const builtIn = items.find((item) => item.id === siteId);

  if (builtIn) builtIn.site = true;
  else items.push({ id: siteId, name: '사이트 적용 프리셋', site: true, builtIn: false });

  return { items, siteId, signedIn: false, notice };
}

/** The list label: a signed-in admin sees "(사이트 적용)" after the site preset's own name. */
export function presetLabel(item, signedIn) {
  if (!item.site) return item.name;

  return signedIn || item.builtIn ? `${item.name} (사이트 적용)` : item.name;
}
