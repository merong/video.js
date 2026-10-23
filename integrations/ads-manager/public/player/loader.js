/**
 * Solad player loader (`.agents/plans/ads-player-schema-v2.md` section 4). Installed as `/ads/player/loader.js`, it
 * turns every `[data-solad-player]` placeholder into a Video.js or native player with ads, using the site preset from
 * the manager API on the same origin. `mount` is the JS API for placeholders marked `data-solad-manual`.
 */
import {
  applyMediaAdsAttributes,
  applyPresetCss,
  defaultRender,
  isGroup,
  parsePlayerPreset,
  presetRender,
  readPresetRender,
} from './preset.js';

// Read through a variable so bundler-aware test runners keep the real file URLs.
const here = import.meta.url;
const api = new URL('../api/index.php', here);
const SELECTOR = '[data-solad-player]';
const PRESET_TIMEOUT = 3000;
const presetIdPattern = /^(default|flat|rounded|accent|lms|p-[a-z0-9]{10})$/;
// Video ID client rule (ads-admin-player-facts 1.4): not blank, no C0/C1 controls, at most 128 characters.
// oxlint-disable-next-line no-control-regex
const controlPattern = /[\u0000-\u001f\u007f-\u009f]/u;
const booleans = { true: true, false: false };
const preloads = ['none', 'metadata', 'auto'];
const languages = ['ko', 'en', 'ja', 'zh-CN'];
// Subtitle track labels in the player language (ads-a2e-spec 3.3).
const languageNames = { ko: '한국어', en: 'English', ja: '日本語', 'zh-CN': '中文(简体)' };
// The render contract still names the stock skin; the ad skin replaces it (ads-a2e-spec 3).
const skinTags = { 'video-skin': 'solad-video-skin' };
const engines = ['spf', 'hlsjs'];
const seekTargets = ['start', 'before-midroll', 'before-end'];
// Seconds a scene shortcut lands before its midroll or the content end.
const SEEK_LEAD = 2;

// One request per preset id per page; `''` is the site preset.
const presets = new Map();
const mounts = new WeakMap();
const automatic = new WeakSet();
let mediaCount = 0;

const warn = (message) => console.warn(`[solad] ${message}`);

/** `/path` or an absolute HTTP(S) URL, resolved against the page; anything else is `null`. */
function pageUrl(value) {
  if (typeof value !== 'string' || !/^(\/|https?:\/\/)/i.test(value.trim())) return null;

  try {
    const url = new URL(value.trim(), document.baseURI);

    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function presetError(code, message) {
  return { code, message };
}

/** Fetch and validate one public render; `error` is set when the page must fall back to the built-in default. */
async function fetchPreset(id, signal) {
  const url = new URL(api);

  url.searchParams.set('action', 'player-preset');

  if (id) url.searchParams.set('id', id);

  // No `cache` option: the API answers `no-cache` with an ETag, so the browser revalidates.
  const response = await fetch(url, { credentials: 'same-origin', signal });

  if (response.status === 404)
    return { error: presetError('preset_not_found', `프리셋을 찾지 못했습니다${id ? `(${id})` : ''}.`) };

  if (!response.ok)
    return { error: presetError('preset_unavailable', `프리셋을 받지 못했습니다(HTTP ${response.status}).`) };

  const payload = await response.json().catch(() => null);
  const result = readPresetRender(payload?.ok ? payload.data : null);
  if (!result.ok) return { error: presetError('preset_invalid', '프리셋 값이 올바르지 않습니다.') };

  return { render: result.render, preset: result.preset, error: null };
}

/** One request per preset id with a 3-second limit; a failure warns once for the whole page. */
async function requestPreset(id) {
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), PRESET_TIMEOUT);
  let result;

  try {
    result = await fetchPreset(id, timeout.signal);
  } catch {
    result = {
      error: presetError(
        'preset_unavailable',
        timeout.signal.aborted ? '프리셋 응답이 3초 안에 오지 않았습니다.' : '프리셋을 받지 못했습니다.'
      ),
    };
  } finally {
    clearTimeout(timer);
  }

  if (result.error) warn(`${result.error.message} 기본 설정으로 재생합니다.`);

  return result;
}

function loadPreset(id) {
  const key = id ?? '';

  if (!presets.has(key)) presets.set(key, requestPreset(id));

  return presets.get(key);
}

/** Merge validated partial presets; later sources win and groups merge key by key. */
function merge(base, extra) {
  const result = { ...base };

  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined) result[key] = isGroup(value) && isGroup(base[key]) ? merge(base[key], value) : value;
  }

  return result;
}

/** Normalize a page language to a player locale (contract 4.4). */
function playerLanguage(value) {
  const tag = value.trim().toLowerCase();
  const primary = tag.split('-')[0];
  if (['ko', 'en', 'ja'].includes(primary)) return primary;

  if (['zh', 'zh-cn', 'zh-sg'].includes(tag) || tag === 'zh-hans' || tag.startsWith('zh-hans-')) return 'zh-CN';

  return 'en';
}

/** The nearest non-empty `lang` from the placeholder up, then the document's. */
function pageLanguage(element) {
  for (let node = element; node; node = node.parentElement) {
    if (node.getAttribute('lang')?.trim()) return node.getAttribute('lang');
  }

  return document.documentElement.lang || '';
}

/**
 * Read the placeholder's values, with JS options taking precedence. Invalid optional values are dropped with a warning;
 * the required video ID and source are reported by the caller.
 */
function readPlaceholder(element, options) {
  const data = element.dataset;
  const pick = (option, name) =>
    options[option] !== undefined && options[option] !== null ? options[option] : data[name];
  const ignore = (name, value) => warn(`${name}="${value}" 값은 쓸 수 없어 무시합니다.`);
  const local = { playback: {} };

  for (const key of ['autoplay', 'muted', 'loop']) {
    const value = data[key];
    if (value === undefined) continue;

    if (Object.hasOwn(booleans, value)) local.playback[key] = booleans[value];
    else ignore(`data-${key}`, value);
  }

  if (data.preload !== undefined) {
    if (preloads.includes(data.preload)) local.playback.preload = data.preload;
    else ignore('data-preload', data.preload);
  }

  const lang = options.lang ?? data.lang;

  if (lang !== undefined) {
    if (languages.includes(lang)) local.language = lang;
    else ignore(options.lang === undefined ? 'data-lang' : 'lang', lang);
  }

  const url = (option, name, attribute) => {
    const value = pick(option, name);
    if (value === undefined) return null;

    const href = pageUrl(value);

    if (!href) ignore(attribute, value);

    return href;
  };
  const text = (option, name, attribute) => {
    const value = pick(option, name);
    if (value === undefined) return null;

    if (typeof value === 'string' && value.trim() && !controlPattern.test(value)) return value.trim();

    ignore(attribute, value);
    return null;
  };
  let engine = pick('engine', 'engine') ?? 'spf';

  if (!engines.includes(engine)) {
    ignore('engine', engine);
    engine = 'spf';
  }

  let preset = pick('preset', 'preset') ?? null;
  let learnerToken = pick('learnerToken', 'learnerToken') ?? null;

  // A learner token is opaque to the player: a string the external LMS signed (ads-lms-spec 2.1).
  if (learnerToken !== null && (typeof learnerToken !== 'string' || !learnerToken || learnerToken.length > 1024)) {
    ignore(options.learnerToken === undefined ? 'data-learner-token' : 'learnerToken', '…');
    learnerToken = null;
  }

  if (preset !== null && !presetIdPattern.test(preset)) {
    ignore('preset', preset);
    preset = null;
  }

  return {
    videoId: pick('videoId', 'videoId'),
    src: pick('src', 'src'),
    poster: url('poster', 'poster', 'data-poster'),
    title: text('title', 'title', 'data-title'),
    thumbnails: url('thumbnails', 'thumbnails', 'data-thumbnails'),
    captions: url('captions', 'captions', 'data-captions'),
    // The `lecture` option is a manifest object; `data-lecture` is its URL.
    lecture: isGroup(options.lecture) ? options.lecture : url('lecture', 'lecture', 'data-lecture'),
    learnerToken,
    engine,
    preset,
    local,
  };
}

/** The required values, as a `solad-error` detail when one is missing or malformed. */
function requiredError({ videoId, src }) {
  if (typeof videoId !== 'string' || !videoId.trim())
    return presetError('missing_video_id', 'data-video-id가 없어 플레이어를 만들지 않았습니다.');

  if (controlPattern.test(videoId) || [...videoId].length > 128)
    return presetError('missing_video_id', 'data-video-id 형식이 맞지 않아 플레이어를 만들지 않았습니다.');

  if (typeof src !== 'string' || !src.trim())
    return presetError('missing_src', 'data-src가 없어 플레이어를 만들지 않았습니다.');

  if (!pageUrl(src)) return presetError('invalid_src', 'data-src는 /경로 또는 http(s):// 주소여야 합니다.');

  return null;
}

/**
 * Apply page values over the preset (contract 4.2). Invalid `overrides` are dropped as a whole and reported. Autoplay
 * always starts muted. `logo` is the preview logo image; it wins over the preset's built-in one.
 */
function settle(base, revision, local, overrides, report, logo = null) {
  const playerType = base.playerType;
  const empty = {};
  let extra = empty;

  if (overrides !== undefined && overrides !== null) {
    const fixed = isGroup(overrides) ? ['id', 'name', 'playerType'].filter((key) => Object.hasOwn(overrides, key)) : [];
    const checked =
      isGroup(overrides) && !fixed.length && parsePlayerPreset({ ...overrides, name: '덮어쓰기', playerType });

    if (checked?.ok) extra = overrides;
    else
      report(
        presetError(
          'invalid_overrides',
          `overrides 값이 올바르지 않아 모두 무시합니다(${fixed[0] ?? checked?.errors?.[0]?.path ?? 'overrides'}).`
        )
      );
  }

  const build = (values) => {
    const input = merge(merge(base, local), values);

    if (input.playback.autoplay) {
      // Only a page value can ask for an unmuted start; the preset cannot store one with autoplay.
      if (merge(local, values).playback?.muted === false) warn('자동재생은 음소거로 시작해야 해서 muted를 켭니다.');

      input.playback = { ...input.playback, muted: true };
    }

    return parsePlayerPreset(input);
  };
  let parsed = build(extra);

  // Each source is valid alone; a cross-field rule can still fail once they meet.
  if (!parsed.ok && extra !== empty) {
    report(
      presetError('invalid_overrides', `overrides 값이 프리셋과 맞지 않아 모두 무시합니다(${parsed.errors[0].path}).`)
    );
    parsed = build(empty);
  }

  if (!parsed.ok) return presetRender(base, revision, logo);

  return presetRender(parsed.preset, revision, logo);
}

/**
 * Read `preview.logo` (ads-a2e-spec 5.3): one image URL under the thumbnails address rule. A wrong value is dropped and
 * reported like the other preview inputs; `undefined` and `null` mean no logo.
 */
function previewLogo(value, report) {
  if (value === undefined || value === null) return null;

  const url = pageUrl(value);

  if (!url)
    report(
      presetError('invalid_preview_logo', `미리보기 로고 주소가 올바르지 않아 로고 없이 재생합니다(${String(value)}).`)
    );

  return url;
}

/**
 * The raw schedule in a preview `schedule` object: a raw schedule, a `schedule-preview` response or its envelope.
 * Tracking values beside it are never read, so a preview has nothing to send.
 */
function rawSchedule(value) {
  if (!isGroup(value)) return null;

  if (Array.isArray(value.breaks)) return value;

  if (isGroup(value.schedule)) return rawSchedule(value.schedule);

  return value.ok === true && isGroup(value.data) ? rawSchedule(value.data) : null;
}

/**
 * Read `preview.schedule` (contract A2-D 5). A URL must answer a raw schedule: an envelope, such as the manager's own
 * schedule action, could carry tracking that `<media-ads src>` would send, so it is refused.
 */
async function loadPreviewSchedule(value, signal) {
  const invalid = (detail) => ({
    error: presetError('invalid_preview_schedule', `미리보기 편성이 올바르지 않아 광고 없이 재생합니다(${detail}).`),
  });

  if (typeof value !== 'string') {
    const schedule = rawSchedule(value);

    return schedule ? { schedule, url: null } : invalid('schedule');
  }

  const url = pageUrl(value);
  if (!url) return invalid(value);

  let response;

  try {
    response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', signal });
  } catch {
    return { error: presetError('preview_schedule_unavailable', '미리보기 편성을 받지 못해 광고 없이 재생합니다.') };
  }

  if (!response.ok)
    return {
      error: presetError(
        'preview_schedule_unavailable',
        `미리보기 편성을 받지 못해 광고 없이 재생합니다(HTTP ${response.status}).`
      ),
    };

  const payload = await response.json().catch(() => null);

  return isGroup(payload) && !Object.hasOwn(payload, 'ok') && Array.isArray(payload.breaks)
    ? { schedule: payload, url }
    : invalid(value);
}

/** Controller UI for a Video.js render: what `<media-ads>` builds from the same attributes. */
function attributeUi(attributes) {
  const labels = {};

  for (const [key, name] of [
    ['skip', 'skip-label'],
    ['skipCountdown', 'skip-countdown-label'],
    ['timer', 'timer-label'],
  ])
    if (Object.hasOwn(attributes, name)) labels[key] = attributes[name];

  // `<media-ads>` resolves its locale from its own `lang`, which the render sets.
  return { locale: attributes.lang ?? 'ko', labels };
}

/** A render without what `handle.restyle` applies in place: CSS, ad labels and the logo. */
function structure(render) {
  const { css, attributes, ui, labels, id, revision, logo, ...rest } = render;

  return JSON.stringify(rest);
}

function loadStyle(href) {
  if ([...document.querySelectorAll('link[rel="stylesheet"]')].some((link) => link.href === href)) return;

  const link = document.createElement('link');

  link.rel = 'stylesheet';
  link.href = href;
  document.head.append(link);
}

const assets = new URL('../assets/', here);
const asset = (path) => new URL(path, assets).href;
// A built-in logo's render `src` is a file name beside this loader; a preview logo is already a full address.
const skinLogo = (logo) => logo && { ...logo, src: new URL(logo.src, here).href };

function mediaId() {
  let id;

  do id = `solad-media-${++mediaCount}`;
  while (document.getElementById(id));

  return id;
}

function createMedia(tag, render, values) {
  const media = document.createElement(tag);
  const { autoplay, muted, loop, preload } = render.playback;

  media.id = mediaId();
  media.setAttribute('playsinline', '');
  media.setAttribute('preload', preload);

  // A preview mounted for a scene moves there before it plays, so its preroll cannot start first.
  if (autoplay && !values.scene) media.setAttribute('autoplay', '');

  // The attribute is the default; the property mutes the element that is already created. A fallback render has not
  // been through `settle`, so autoplay is muted here too.
  if (muted || autoplay) {
    media.setAttribute('muted', '');
    media.muted = true;
  }

  if (loop) media.setAttribute('loop', '');

  return media;
}

function scheduleUrl(videoId, breaks) {
  const url = new URL(api);

  url.searchParams.set('action', 'schedule');
  url.searchParams.set('videoId', videoId);

  if (breaks) url.searchParams.set('breaks', breaks);

  return url.href;
}

/**
 * The lecture layout around the player (ads-lms-design-handoff 2.1): the panel beside it from 960px, below it before.
 * The panel takes the preset CSS variables too.
 */
async function lectureLayout(render, preview) {
  if (preview) return null;

  const { ensureLayoutStyle } = await import(new URL('./lms-panel.js', here).href);
  const wrapper = document.createElement('div');
  const grid = document.createElement('div');
  const panel = document.createElement('solad-lms-panel');

  ensureLayoutStyle(document);
  wrapper.className = 'solad-lms';
  grid.className = 'solad-lms-grid';
  applyPresetCss(panel, render.css);
  wrapper.append(grid);
  return { wrapper, grid, panel };
}

async function buildVideojs(element, render, values, signal, onEvent, preview) {
  const hls = /\.m3u8$/i.test(new URL(pageUrl(values.src)).pathname);
  const tag = hls ? (values.engine === 'hlsjs' ? 'hlsjs-video' : 'hls-video') : 'video';

  loadStyle(asset(`videojs/${render.styles.css}`));
  await import(asset(`videojs/${render.styles.js}`));

  if (hls) await import(asset(`videojs/media/${tag}.js`));

  await import(asset('videojs/ui/seek-button.js'));
  await import(new URL('./solad-video-skin.js', here).href);

  const module = await import(asset('ads.js'));

  if (signal.aborted) return null;

  const i18n = document.createElement('media-i18n');
  const player = document.createElement('video-player');
  const skin = document.createElement(skinTags[render.skinTag] ?? render.skinTag);
  const media = createMedia(tag, render, values);
  const lms = render.lms ?? null;
  // A lecture without ads has no `<media-ads>`; with prerolls it asks the schedule for them alone (ads-lms-spec 2.1).
  const ads = lms?.ads === 'off' ? null : document.createElement('media-ads');
  const language = playerLanguage(render.language ?? pageLanguage(element));
  const lecture = lms ? await lectureLayout(render, preview) : null;

  if (signal.aborted) return null;

  i18n.setAttribute('lang', language);

  // `<solad-video-skin>` reads these once when it connects; a change remounts (see `structure`).
  if (render.controls.seekButtons) {
    skin.setAttribute('seek-buttons', String(render.controls.seekButtons));
    skin.setAttribute('seek-placement', render.controls.seekPlacement ?? 'bar');
  }

  if (render.controls.captions === false) skin.setAttribute('captions', 'off');

  // The ad skin draws the logo and takes a new one in place (`restyle`).
  if (render.logo) skin.logo = skinLogo(render.logo);

  if (lms) {
    skin.setAttribute('lms', '');
    skin.setAttribute('lms-max-rate', String(lms.maxRate));
    skin.setAttribute('lms-seek-limit', lms.seekLimit);

    // The bookmark lands in the notes tab, so both must be on, with a lecture to keep it (ads-lms-spec 10.2).
    if (lms.bookmarks && lms.tabs.notes && values.lecture && !preview) skin.setAttribute('lms-bookmarks', '');
  }

  // `<video-player>` reads `content-title` and `poster` (packages/core/src/dom/store/features/metadata.ts).
  if (render.display.title && values.title) player.setAttribute('content-title', values.title);

  if (render.display.poster && values.poster) player.setAttribute('poster', values.poster);

  applyPresetCss(skin, render.css);
  media.setAttribute('src', pageUrl(values.src));

  if (values.thumbnails) {
    const track = document.createElement('track');

    // The thumbnail slider reads the first metadata track labelled `thumbnails`.
    track.kind = 'metadata';
    track.label = 'thumbnails';
    track.src = values.thumbnails;
    track.default = true;
    media.append(track);
  }

  if (values.captions) {
    const track = document.createElement('track');

    // Off until the viewer turns captions on.
    track.kind = 'subtitles';
    track.srclang = language;
    track.label = languageNames[language];
    track.src = values.captions;
    media.append(track);
  }

  i18n.addEventListener('ads-event', (event) => onEvent(event.detail), { signal });

  const parts = { player, media, styled: skin, language, panel: lecture?.panel ?? null };
  const place = () => {
    if (!lecture) {
      element.append(i18n);
      return i18n;
    }

    lecture.grid.append(i18n, lecture.panel);
    element.append(lecture.wrapper);
    return lecture.wrapper;
  };

  // A lecture preview plays prerolls alone, or no ads.
  if (preview && lms?.ads === 'off') preview = { schedule: null, url: null };
  else if (preview?.schedule && lms?.ads === 'preroll')
    preview = {
      schedule: { ...preview.schedule, breaks: preview.schedule.breaks.filter((item) => item.position === 'pre') },
      url: null,
    };

  if (!ads && !preview) {
    skin.append(media);
    player.append(skin);
    i18n.append(player);
    return { ...parts, root: place(), ads: null, controller: null, schedule: null };
  }

  if (preview && !preview.url) {
    skin.append(media);
    player.append(skin);
    i18n.append(player);

    const root = place();

    // A preview whose schedule could not be read plays the content alone.
    if (!preview.schedule) return { ...parts, root, ads: null, controller: null, schedule: null };

    // `<media-ads src>` takes only a URL, so a schedule object goes to a preview controller on the skin's own
    // container, where `<media-ads>` would put the ad screen. It shows the same overlay but is not a player extension.
    const container = skin.shadowRoot?.querySelector('media-container') ?? skin;
    const controller = module.createAdsController({
      media,
      container,
      schedule: preview.schedule,
      preview: true,
      ui: attributeUi(render.attributes),
      onEvent(event) {
        skin.dispatchEvent(new CustomEvent('ads-event', { bubbles: true, composed: true, detail: event }));
      },
    });

    return { ...parts, root, ads: null, controller, schedule: preview.schedule };
  }

  applyMediaAdsAttributes(ads, render.attributes);
  ads.setAttribute('for', media.id);
  // A preview URL is a raw schedule (checked in `loadPreviewSchedule`), so `<media-ads>` has no tracking to send.
  ads.setAttribute(
    'src',
    preview ? preview.url : scheduleUrl(values.videoId, lms?.ads === 'preroll' ? 'preroll' : null)
  );
  ads.setAttribute('video-id', values.videoId);
  skin.append(media, ads);
  player.append(skin);
  i18n.append(player);
  return { ...parts, root: place(), ads, controller: null, schedule: preview?.schedule ?? null };
}

async function buildNative(element, render, values, signal, onEvent, report, preview) {
  const module = await import(asset('ads.js'));

  if (signal.aborted) return null;

  const container = document.createElement('div');
  const media = createMedia('video', render, values);

  container.style.position = 'relative';
  media.style.display = 'block';
  media.style.width = '100%';
  media.controls = true;

  if (render.display.poster && values.poster) media.setAttribute('poster', values.poster);

  applyPresetCss(container, render.css);
  container.append(media);
  element.append(container);
  media.src = pageUrl(values.src);

  const empty = {
    root: container,
    player: media,
    media,
    styled: container,
    ads: null,
    controller: null,
    schedule: null,
  };
  let data = preview?.schedule ? { schedule: preview.schedule } : null;

  if (!preview) {
    try {
      const response = await fetch(scheduleUrl(values.videoId), {
        signal,
        credentials: 'same-origin',
        cache: 'no-store',
      });
      const payload = await response.json();
      if (!response.ok || !payload?.ok) throw new Error(payload?.error?.message || '광고 편성을 불러오지 못했습니다.');

      data = payload.data;
    } catch (error) {
      if (signal.aborted) return empty;

      report(presetError('schedule_unavailable', error.message || '광고 편성을 불러오지 못했습니다.'));
    }
  }

  if (signal.aborted || !data) return empty;

  const { schedule, ...tracking } = data;
  // The native controller reports through a callback; re-dispatch it so both player types bubble `ads-event`.
  // A preview passes no tracking and `preview: true`, so the controller makes no event queue.
  const controller = module.createAdsController({
    media,
    container,
    schedule,
    ...(preview ? { preview: true } : { tracking }),
    ui: render.ui,
    timeouts: render.timeouts,
    onEvent(event) {
      container.dispatchEvent(new CustomEvent('ads-event', { bubbles: true, composed: true, detail: event }));
      onEvent(event);
    },
  });

  return { ...empty, controller, schedule };
}

/** Wait until the content knows its duration; a seek before that is lost. */
function metadata(media, signal) {
  if (media.readyState >= 1 && Number.isFinite(media.duration)) return Promise.resolve(true);

  return new Promise((resolve) => {
    media.addEventListener('loadedmetadata', () => resolve(true), { once: true, signal });
    signal.addEventListener('abort', () => resolve(false), { once: true });
  });
}

/** The content time for a scene shortcut, or `null` when the schedule or content has no such point. */
function seekTime(target, schedule, duration) {
  if (target === 'start') return 0;

  if (target === 'before-midroll') {
    const times = (schedule?.breaks ?? [])
      .filter((item) => item.position === 'mid' && Number.isFinite(item.atSeconds))
      .map((item) => item.atSeconds);

    return times.length ? Math.max(0, Math.min(...times) - SEEK_LEAD) : null;
  }

  return Number.isFinite(duration) ? Math.max(0, duration - SEEK_LEAD) : null;
}

/** The breaks a scene shortcut leads into: the prerolls, the midrolls at the first midroll time, or the postrolls. */
function sceneBreaks(target, schedule) {
  const breaks = schedule?.breaks ?? [];

  if (target === 'start') return breaks.filter((item) => item.position === 'pre');

  if (target === 'before-end') return breaks.filter((item) => item.position === 'post');

  const mids = breaks.filter((item) => item.position === 'mid' && Number.isFinite(item.atSeconds));
  const first = Math.min(...mids.map((item) => item.atSeconds));

  return mids.filter((item) => item.atSeconds === first);
}

/**
 * The schedule a player made for `scene` plays: the breaks before the scene are left out, so its ad shows at once. The
 * breaks kept are unchanged, so ad places count as in the full schedule.
 */
function sceneSchedule(scene, schedule) {
  if (!schedule || scene === undefined || scene === 'start') return schedule;

  const kept = scene === 'before-end' ? (item) => item.position === 'post' : (item) => item.position !== 'pre';

  return { ...schedule, breaks: schedule.breaks.filter(kept) };
}

/**
 * The break whose pod is on after `event`, or `null`. A finished ad that is not its break's last keeps the pod on,
 * since the next ad is loading; a cancel or a content-stage error ends it.
 */
function podAfter(event, schedule, current) {
  if (event?.type === 'click') return current;

  if (event?.type === 'start') return event.breakId;

  if (event?.type === 'cancel' || event?.stage === 'content') return null;

  const ads = schedule?.breaks?.find((item) => item.breakId === event?.breakId)?.ads ?? [];

  return ads.length > 0 && ads.at(-1)?.itemId !== event?.itemId ? event.breakId : null;
}

/** The validated `preview.preset` render, or the default render with an `invalid_preview_preset` error. */
function previewPreset(value, playerType) {
  const parsed = parsePlayerPreset(value);
  if (parsed.ok) return { render: presetRender(parsed.preset), preset: parsed.preset, error: null };

  const path = parsed.errors[0]?.path || 'preset';

  return {
    render: null,
    preset: null,
    error: presetError(
      'invalid_preview_preset',
      `미리보기 프리셋 값이 올바르지 않아 기본 설정으로 재생합니다(${path}).`
    ),
    playerType: playerType ?? (value?.playerType === 'native' ? 'native' : 'videojs'),
  };
}

/**
 * Create a player in `element`. Options win over the element's `data-*` values; `overrides` is a partial schema v2
 * preset. `playerType` is for the example pages only: a preset of the other type, the site preset included, falls back
 * to the default render of this type. `preview` is for the demo and admin previews only: it plays a raw schedule
 * without sending events, may take an unsaved preset, and adds `seek` and `restyle` to the handle; `preview.scene`
 * starts it at a `seek` target without the breaks before it, and `preview.logo` is a logo image URL for the preset's
 * `logo` values, in place of its built-in image. Mounting the same element again destroys the previous player first.
 */
export async function mount(element, options = {}) {
  mounts.get(element)?.destroy();

  const controller = new AbortController();
  const { signal } = controller;
  let built = null;
  const handle = {
    player: null,
    media: null,
    presetId: null,
    fallback: false,
    schedule: null,
    destroy() {
      if (signal.aborted) return;

      controller.abort();
      built?.lecture?.destroy();
      built?.controller?.destroy();
      built?.media.pause?.();
      built?.root.remove();

      if (mounts.get(element) === handle) mounts.delete(element);
    },
  };
  const report = (error) => {
    if (!signal.aborted) options.onError?.(error);
  };
  // The breaks this player has reached and the break whose pod is on, for the preview `seek`.
  const reached = new Set();
  let pod = null;
  const onEvent = (event) => {
    if (signal.aborted) return;

    reached.add(event?.breakId);
    pod = podAfter(event, built?.schedule, pod);
    options.onEvent?.(event);
  };

  mounts.set(element, handle);

  const values = readPlaceholder(element, options);
  const preview = isGroup(options.preview) ? options.preview : null;
  let scheduled = null;

  if (preview) {
    scheduled = await loadPreviewSchedule(preview.schedule, signal).catch(() => ({
      error: presetError('preview_schedule_unavailable', '미리보기 편성을 받지 못해 광고 없이 재생합니다.'),
    }));

    if (signal.aborted) throw new DOMException('같은 요소에 플레이어를 다시 만들었습니다.', 'AbortError');

    if (scheduled.error) report(scheduled.error);

    // `<media-ads>` drops a schedule for another video, so the preview plays the schedule's own video ID.
    values.videoId = scheduled.schedule?.videoId ?? values.videoId ?? 'preview';

    if (seekTargets.includes(preview.scene)) values.scene = preview.scene;

    values.logo = previewLogo(preview.logo, report);
  }

  const invalid = requiredError(values);

  if (invalid) {
    warn(invalid.message);
    element.dispatchEvent(new CustomEvent('solad-error', { bubbles: true, detail: invalid }));
    report(invalid);
    handle.destroy();
    throw Object.assign(new Error(invalid.message), { code: invalid.code });
  }

  const wanted = options.playerType;
  let source;

  if (preview && preview.preset !== undefined) source = previewPreset(preview.preset, wanted);
  else source = await loadPreset(values.preset);

  if (signal.aborted) throw new DOMException('같은 요소에 플레이어를 다시 만들었습니다.', 'AbortError');

  if (source?.error) report(source.error);

  if (source?.render && wanted && source.render.playerType !== wanted) {
    const label = values.preset ?? source.render.id ?? '사이트 적용 프리셋';

    warn(`프리셋이 다른 플레이어용이라 기본 설정으로 재생합니다(${label}: ${source.render.playerType} 플레이어용).`);
    report(
      presetError('player_type', `프리셋이 다른 플레이어용입니다(${label}: ${source.render.playerType} 플레이어용).`)
    );
    source = { render: null, preset: null, error: true };
  }

  const fallback = Boolean(source?.error);
  const base = source?.render ? source : { render: defaultRender(wanted ?? source?.playerType ?? 'videojs') };
  const preset = base.preset ?? readPresetRender(base.render).preset;
  let overrides = options.overrides;
  let render = settle(preset, base.render.revision, values.local, overrides, report, values.logo);
  // A failed preview schedule still plays the content, with no ads and no schedule request. A trimmed schedule is an
  // object, so a Video.js preview attaches the controller itself instead of `<media-ads src>`.
  const full = scheduled?.schedule ?? null;
  const played = sceneSchedule(values.scene, full);
  const plan = preview ? { schedule: played, url: played === full ? (scheduled.url ?? null) : null } : null;

  try {
    built =
      render.playerType === 'videojs'
        ? await buildVideojs(element, render, values, signal, onEvent, plan)
        : await buildNative(element, render, values, signal, onEvent, report, plan);
  } catch (error) {
    if (!signal.aborted) {
      warn('플레이어 파일을 불러오지 못했습니다.');
      report(presetError('load_failed', error?.message || '플레이어 파일을 불러오지 못했습니다.'));
      handle.destroy();
    }

    throw error;
  }

  if (signal.aborted || !built) {
    built?.controller?.destroy();
    built?.root.remove();
    throw new DOMException('같은 요소에 플레이어를 다시 만들었습니다.', 'AbortError');
  }

  Object.assign(handle, {
    player: built.player,
    media: built.media,
    presetId: render.id,
    fallback,
    schedule: built.schedule,
  });

  /** Move the content to a scene and play; `false` when the content has no such point. */
  async function move(target) {
    if (signal.aborted || !(await metadata(built.media, signal))) return false;

    const time = seekTime(target, built.schedule, built.media.duration);
    if (time === null) return false;

    built.media.currentTime = time;
    built.media.play()?.catch?.(() => {});
    return true;
  }

  if (preview)
    Object.assign(handle, {
      /**
       * Go to a scene shortcut; `false` when the schedule or content has no such point. `'remount'` moves nothing: the
       * caller mounts again with `preview.scene`. The midroll and end scenes always do, so their player leaves out the
       * breaks before them. The start moves this player unless its preroll already started or an ad is on, since a
       * break plays once per player and a pod ignores content seeks.
       */
      async seek(target) {
        if (!seekTargets.includes(target) || signal.aborted) return false;

        if (target === 'before-midroll') return sceneBreaks(target, full).length > 0 && 'remount';

        if (target === 'before-end') return 'remount';

        if (pod !== null || sceneBreaks(target, built.schedule).some((item) => reached.has(item.breakId)))
          return 'remount';

        return move(target);
      },
      /**
       * Apply a full preset in place when only its theme, ad labels or logo differ. `changes` may replace the mount's
       * `overrides` and `preview.logo`. `false` means the caller must mount again; an invalid preset is reported as
       * `invalid_preview_preset`.
       */
      restyle(value, changes = {}) {
        if (signal.aborted) return false;

        const parsed = parsePlayerPreset(value);

        if (!parsed.ok) {
          report(previewPreset(value, render.playerType).error);
          return false;
        }

        // A refused restyle mounts again with the same values, which reports a wrong logo once there.
        let logoError = null;
        const nextOverrides = Object.hasOwn(changes, 'overrides') ? changes.overrides : overrides;
        const logo = Object.hasOwn(changes, 'logo')
          ? previewLogo(changes.logo, (error) => (logoError = error))
          : values.logo;
        const next = settle(parsed.preset, 0, values.local, nextOverrides, () => {}, logo);
        if (structure(next) !== structure(render)) return false;

        applyPresetCss(built.styled, next.css);

        if (built.panel) applyPresetCss(built.panel, next.css);

        if (next.playerType === 'videojs') built.styled.logo = skinLogo(next.logo);

        if (built.ads) applyMediaAdsAttributes(built.ads, next.attributes);
        // `updateUI` replaces the options, so an emptied label returns to the package default.
        else built.controller?.updateUI(next.playerType === 'videojs' ? attributeUi(next.attributes) : next.ui);

        render = next;
        overrides = nextOverrides;
        values.logo = logo;
        handle.presetId = next.id;

        if (logoError) report(logoError);

        return true;
      },
    });

  if (render.lms && render.playerType === 'videojs') {
    try {
      const { attachLecture } = await import(new URL('./lms.js', here).href);

      if (signal.aborted) throw new DOMException('같은 요소에 플레이어를 다시 만들었습니다.', 'AbortError');

      built.lecture = attachLecture({
        element,
        skin: built.styled,
        media: built.media,
        panel: built.panel,
        rules: render.lms,
        videoId: values.videoId,
        presetId: render.id,
        lecture: values.lecture,
        learnerToken: values.learnerToken,
        captions: values.captions,
        language: built.language,
        preview: Boolean(preview),
      });
    } catch (error) {
      if (signal.aborted) throw error;

      // The player still plays without the lecture.
      warn('강의 기능 파일을 불러오지 못했습니다.');
      report(presetError('load_failed', error?.message || '강의 기능 파일을 불러오지 못했습니다.'));
    }
  }

  if (values.scene) void move(values.scene);

  element.dispatchEvent(
    new CustomEvent('solad-ready', { bubbles: true, detail: { player: built.player, presetId: render.id, fallback } })
  );
  return handle;
}

function mountAutomatically(element) {
  if (automatic.has(element) || element.hasAttribute('data-solad-manual')) return;

  automatic.add(element);
  // Failures are already warned and dispatched as `solad-error`.
  mount(element).catch(() => {});
}

function scan(node) {
  if (node.nodeType !== Node.ELEMENT_NODE) return;

  if (node.matches(SELECTOR)) mountAutomatically(node);

  for (const element of node.querySelectorAll(SELECTOR)) mountAutomatically(element);
}

if (typeof document !== 'undefined') {
  scan(document.documentElement);
  new MutationObserver((records) => {
    for (const record of records) for (const node of record.addedNodes) scan(node);
  }).observe(document.documentElement, { childList: true, subtree: true });
}
