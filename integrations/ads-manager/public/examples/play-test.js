/**
 * Playback test (contract A2-D 2, design PlayTest): the published schedule for `?video`, with collected stats. It
 * replaces the old Video.js and native example pages; the switch links keep every other query value.
 */
import { mount } from '../player/loader.js';
import { adProgress, pushProgress } from './ad-progress.js';
import { loadPresetList, loadPresetSource } from './demo-state.js';
import { noteText, setStatus } from './page.js';
import { showLog, showNow } from './stage.js';

const here = import.meta.url;
const api = new URL('../api/index.php', here);
const presetIdPattern = /^(default|flat|rounded|accent|p-[a-z0-9]{10})$/;
// oxlint-disable-next-line no-control-regex
const controlPattern = /[\u0000-\u001f\u007f-\u009f]/u;
const choices = { type: ['videojs', 'native'], media: ['mp4', 'hls'], engine: ['spf', 'hlsjs'] };
const playerNames = { videojs: 'Video.js', native: '기본 video' };

const PREPARING = '플레이어를 준비하는 중이에요…';
const FAILED = '플레이어를 만들지 못했어요. 다시 불러오기를 눌러 주세요.';
// The page explains this itself (a preset note), so the loader's own line would repeat it.
const explained = ['player_type'];

/** `videoId` is `null` when the address has no usable `video`: the page then shows its empty state. */
export const PLAY_TEST_DEFAULTS = Object.freeze({
  videoId: null,
  type: 'videojs',
  media: 'mp4',
  engine: 'spf',
  content: null,
  preset: null,
});

/** The default content for a media type, beside the examples. */
export function defaultContent(media) {
  return new URL(media === 'hls' ? '../demo-media/content-master.m3u8' : '../demo-media/content.mp4', here).href;
}

/** `value` resolved against the page when it is a `/` path or an HTTP(S) URL, otherwise `null`. */
function contentUrl(value, address) {
  if (!/^(\/(?!\/)|https?:\/\/)/i.test(value) || controlPattern.test(value)) return null;

  try {
    const url = new URL(value, address);

    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * Read `?video=&type=&media=&engine=&content=&preset=` from the page `address`. Invalid values fall back to the
 * defaults and are listed in `ignored`; HLS with the native player is one, as a native video cannot play it.
 * `content` is a `/` path or an HTTP(S) URL, resolved against the page; `src` is what the player plays.
 */
export function readPlayTestQuery(address) {
  const query = new URL(address).searchParams;
  const ignored = [];
  const result = { ...PLAY_TEST_DEFAULTS };
  const video = query.get('video');

  if (video !== null) {
    if (video.trim() && !controlPattern.test(video) && [...video].length <= 128) result.videoId = video;
    else ignored.push('video');
  }

  for (const [key, allowed] of Object.entries(choices)) {
    const value = query.get(key);

    if (value === null) continue;

    if (allowed.includes(value)) result[key] = value;
    else ignored.push(key);
  }

  if (result.type === 'native' && result.media === 'hls') {
    result.media = 'mp4';
    ignored.push('media');
  }

  const content = query.get('content');

  if (content !== null) {
    result.content = contentUrl(content, address);
    if (!result.content) ignored.push('content');
  }

  const preset = query.get('preset');

  if (preset !== null) {
    if (presetIdPattern.test(preset)) result.preset = preset;
    else ignored.push('preset');
  }

  return { ...result, src: result.content ?? defaultContent(result.media), ignored };
}

/**
 * Point every `a[data-type]`, `a[data-media]` and `a[data-engine]` in `root` at `address` with that one value
 * changed, keeping the rest of the query, and mark the current ones with `aria-current="page"`. The native player link
 * also drops HLS, which it cannot play. With the native player HLS is shown as an unavailable chip, and the HLS engine
 * group is hidden while the media is MP4.
 */
export function configurePlayTestLinks(root, address) {
  const current = new URL(address);
  const values = readPlayTestQuery(current.href);

  for (const link of root.querySelectorAll('a[data-type], a[data-media], a[data-engine]')) {
    const key = ['type', 'media', 'engine'].find((name) => link.dataset[name] !== undefined);
    const value = link.dataset[key];
    const url = new URL(current);

    url.searchParams.set(key, value);
    if (key === 'type' && value === 'native' && url.searchParams.get('media') === 'hls') url.searchParams.set('media', 'mp4');
    url.hash = '';
    link.href = url.href;

    if (values[key] === value) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }

  const native = values.type === 'native';
  const hls = root.querySelector('a[data-media="hls"]');
  const off = root.querySelector('[data-media-off]');
  const why = root.querySelector('[data-media-why]');
  const engine = root.querySelector('[data-engine-field]');

  if (hls) hls.hidden = native;

  if (off) off.hidden = !native;

  if (why) {
    why.hidden = !native;
    if (native) hls?.parentElement.setAttribute('aria-describedby', why.id);
    else hls?.parentElement.removeAttribute('aria-describedby');
  }

  if (engine) engine.hidden = values.media !== 'hls';
}

/**
 * The preset the test plays, read ahead only for its name and player type: the address `preset`, or the site preset.
 * `{ id, name, site, playerType }`. `id` is the address id as given, even one that does not exist: the loader then
 * falls back to the built-in default as an installed page would. `id` is `null` when the site preset plays, so the
 * loader asks for it as a visitor's page would. `playerType` is `null` when the preset could not be read.
 */
export async function playTestPreset(query, { loadPresets = loadPresetList, loadPreset = loadPresetSource } = {}) {
  const list = await loadPresets().catch(() => ({ items: [], siteId: 'default', signedIn: false }));
  const id = query.preset === list.siteId ? null : query.preset;
  const source = await loadPreset(id ?? list.siteId).catch(() => null);
  const item = list.items.find((entry) => entry.id === (id ?? list.siteId));
  const name = id ? (item?.name ?? id) : (item?.name ?? '사이트 적용 프리셋');

  return { id, name, site: !id, playerType: source?.render?.playerType ?? null };
}

/** The preset row of the playback conditions: "<이름> (사이트 적용)" for the site preset. */
export function presetText(preset) {
  return preset.site && preset.name !== '사이트 적용 프리셋' ? `${preset.name} (사이트 적용)` : preset.name;
}

/** The note for a preset made for the other player type, or `null`. */
export function otherPlayerNote(preset, type) {
  if (!preset.playerType || preset.playerType === type) return null;

  return {
    lead: `‘${preset.name}’ 프리셋은 ${playerNames[preset.playerType]}용이에요.`,
    rest: `${playerNames[type]}에서는 이 프리셋 대신 기본값으로 재생해요. 로더도 같은 규칙이에요.`,
  };
}

/** The note for an address preset the loader did not find: it plays the built-in default, as an installed page. */
export function missingPresetNote(id) {
  return { lead: `프리셋을 찾지 못했어요(${id}).`, rest: '설치한 페이지와 같이 기본 설정으로 재생해요.' };
}

/** The note for ignored address values, or `null`. */
export function ignoredNote(query, address) {
  if (!query.ignored.length) return null;

  const search = new URL(address).searchParams;
  const values = query.ignored.map((key) => `${key}=${search.get(key) ?? ''}`).join(', ');

  return { lead: `주소의 값 ${query.ignored.length}개를 무시했어요.`, rest: `${values} · 기본값으로 재생해요.` };
}

/** Mount the test player in `element`; `onError` and `onEvent` are the loader's. A `null` preset plays the site's. */
export function startPlayTest(element, query, { preset = query.preset, onError, onEvent } = {}) {
  const options = { videoId: query.videoId, src: query.src, engine: query.engine, playerType: query.type, onError, onEvent };

  if (preset) options.preset = preset;

  return mount(element, options);
}

/**
 * The published schedule's breaks for the progress lines. The Video.js player keeps its schedule inside `<media-ads>`,
 * so this asks the public `schedule` action once more; it only reads, and its tracking token is never used.
 */
export async function scheduleForLabels(videoId, { signal } = {}) {
  const url = new URL(api);

  url.searchParams.set('action', 'schedule');
  url.searchParams.set('videoId', videoId);

  try {
    const response = await fetch(url, { credentials: 'same-origin', signal });
    const payload = await response.json();

    return payload?.ok && Array.isArray(payload.data?.schedule?.breaks) ? payload.data.schedule : null;
  } catch {
    return null;
  }
}

/** A page restored from the back-forward cache reloads, so its player and stats session start again. */
export function reloadOnRestore() {
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) location.reload();
  });
}

/**
 * Start the page in `root` for `address`: switch links, conditions, preset notes, then the player and its progress.
 * `deps` replaces the preset loaders, `mount` and the schedule request in tests.
 */
export async function startPlayTestPage(root, address, deps = {}) {
  const $ = (id) => root.getElementById(id);
  const query = readPlayTestQuery(address);
  const status = $('status');
  const restart = $('restart');
  let log = [];
  let schedule = null;
  let generation = 0;

  configurePlayTestLinks(root, address);

  const ignored = ignoredNote(query, address);

  if (ignored) noteText($('query-note'), ignored.lead, ignored.rest);

  $('query-note').hidden = !ignored;

  if (!query.videoId) {
    $('stage-view').classList.add('is-empty');
    $('stage-frame').hidden = true;
    $('stage-empty').hidden = false;
    $('now').hidden = true;
    $('conditions').hidden = true;
    return { query, preset: null };
  }

  $('cond-video').textContent = query.videoId;
  $('cond-src').textContent = query.src;
  showLog($('log'), log);

  const preset = await playTestPreset(query, deps);
  const other = otherPlayerNote(preset, query.type);

  $('cond-preset').textContent = presetText(preset);

  const showPresetNote = (note) => {
    if (note) noteText($('preset-note'), note.lead, note.rest);

    $('preset-note').hidden = !note;
  };

  showPresetNote(other);

  const record = (event) => {
    log = pushProgress(log, adProgress(event, schedule));
    showNow($('now'), log[0]);
    showLog($('log'), log);
  };

  async function play() {
    const current = ++generation;
    const start = deps.start ?? startPlayTest;
    let failure = '';
    let notFound = false;

    restart.hidden = true;
    setStatus(status, PREPARING);

    // Asked beside the mount so the first preroll line already has its place.
    if (query.type === 'videojs' && !schedule)
      void (deps.loadSchedule ?? scheduleForLabels)(query.videoId).then((value) => {
        schedule ??= value;
      });

    try {
      const handle = await start($('player'), query, {
        preset: preset.id,
        onError(error) {
          if (error.code === 'preset_not_found') notFound = true;
          else if (!explained.includes(error.code)) failure ||= error.message;
        },
        onEvent(event) {
          if (current === generation) record(event);
        },
      });

      if (current !== generation) return;

      schedule = handle.schedule ?? schedule;
      // The loader's own result decides the note, so the page shows what an installed page does.
      if (notFound && handle.fallback && preset.id) showPresetNote(missingPresetNote(preset.id));
      setStatus(status, failure, failure ? 'is-warn' : '');
    } catch (error) {
      if (current !== generation || error?.name === 'AbortError') return;

      setStatus(status, FAILED, 'is-bad');
      restart.hidden = false;
    }
  }

  restart.addEventListener('click', () => void play());
  await play();
  return { query, preset };
}
