// TASK L-1-SPIKE page. Query: media=mp4|hls, mode=manual|loader, ads=none|preroll, order=lms-first|ads-first,
// yield=1|0, chapters=none|blob|data, chapAt=before|after, maxRate=2, limit=watched|off, watched=<s>,
// indicator=on|off, rateKeys=on|off, layers=on|off, keys=on|off.
import { LmsSpike, chaptersTrack, chaptersVtt } from './lms-spike.js';

const query = new URLSearchParams(location.search);
const opt = (name, fallback) => query.get(name) ?? fallback;
const log = [];
const record = (type, detail = {}) => log.push({ t: Math.round(performance.now()), type, ...detail });

window.__lms = { log, ready: false, record };

// SPF <hls-video> loads only an absolute multivariant URL here (evidence/hls-probe.json); hls.js takes the media playlist.
const SOURCES = {
  mp4: '/demo-media/content.mp4',
  hls: new URL('/demo-media/content-master.m3u8', location.href).href,
  hlsjs: '/demo-media/content-fmp4.m3u8',
};
const TAGS = { mp4: 'video', hls: 'hls-video', hlsjs: 'hlsjs-video' };
const CHAPTERS = [
  { start: 0, title: '1장 소개' },
  { start: 9, title: '2장 본론' },
  { start: 20, title: '3장 실습' },
  { start: 30, title: '4장 정리' },
];
const kind = opt('media', 'mp4');
const src = query.get('src') ?? SOURCES[kind];
const host = document.getElementById('player');

function loadStyle(href) {
  const link = document.createElement('link');

  link.rel = 'stylesheet';
  link.href = href;
  document.head.append(link);
}

function addChapters(media) {
  const as = opt('chapters', 'none');
  if (as === 'none') return null;

  const track = chaptersTrack(chaptersVtt(CHAPTERS, 36), as);

  media.append(track);
  record('chapters-attached', { as, at: opt('chapAt', 'before') });
  return track;
}

async function buildManual() {
  loadStyle('/assets/videojs/video.css');
  await import('/assets/videojs/video.js');
  if (kind !== 'mp4') await import(`/assets/videojs/media/${TAGS[kind]}.js`);
  await import('/assets/videojs/ui/seek-button.js');
  await import('/player/solad-video-skin.js');
  await import('./lms-skin.js');
  if (opt('ads', 'none') !== 'none') await import('/assets/ads.js');

  const i18n = document.createElement('media-i18n');
  const player = document.createElement('video-player');
  const skin = document.createElement('spike-lms-skin');
  const media = document.createElement(TAGS[kind]);

  i18n.setAttribute('lang', 'ko');
  skin.setAttribute('seek-buttons', '10');
  if (opt('rateKeys', 'on') === 'off') skin.setAttribute('lms-rate-keys', 'off');
  if (opt('indicator', 'on') === 'off') skin.setAttribute('lms-indicator', 'off');
  if (opt('layers', 'on') === 'off') skin.setAttribute('lms-layers', 'off');
  if (query.has('maxRate')) skin.setAttribute('lms-max-rate', query.get('maxRate'));
  if (query.has('rateHide')) skin.setAttribute('lms-rate-hide', query.get('rateHide'));
  player.setAttribute('content-title', '강의 스파이크');
  media.id = 'lms-content';
  media.setAttribute('playsinline', '');
  media.setAttribute('preload', 'auto');
  media.muted = true;
  media.setAttribute('muted', '');
  media.setAttribute('src', src);
  if (opt('chapAt', 'before') === 'before') addChapters(media);

  skin.append(media);

  if (opt('ads', 'none') === 'preroll') {
    const ads = document.createElement('media-ads');

    ads.setAttribute('for', media.id);
    ads.setAttribute('src', '/spike/preroll.json');
    ads.setAttribute('video-id', 'grok-demo-scene-01');
    skin.append(ads);
  }

  player.append(skin);
  i18n.append(player);

  return { i18n, player, skin, media };
}

async function buildLoader() {
  const { mount } = await import('/player/loader.js');
  const placeholder = document.createElement('div');

  placeholder.setAttribute('data-solad-manual', '');
  host.append(placeholder);

  const options = { src, videoId: 'grok-demo-scene-01', onError: (error) => record('loader-error', { code: error?.code }) };

  if (opt('ads', 'none') === 'preroll') options.preview = { schedule: '/spike/preroll.json' };

  const handle = await mount(placeholder, options);
  const player = handle.player ?? placeholder.querySelector('video-player');
  const skin = player.querySelector('solad-video-skin');

  return { i18n: player.parentElement, player, skin, media: handle.media ?? skin.querySelector('video, hls-video') };
}

const built = opt('mode', 'manual') === 'loader' ? await buildLoader() : await buildManual();
const { player, skin, media } = built;
const root = skin.shadowRoot;
const container = root.querySelector('media-container');
const slider = root.querySelector('media-time-slider');
const lms = new LmsSpike({
  container,
  slider,
  maxRate: Number(opt('maxRate', 2)),
  seekLimit: opt('limit', 'watched'),
  yieldToAds: opt('yield', '1') === '1',
  log: record,
});
let registered = false;

function registerLms() {
  // From the media: it sits in <video-player>'s light tree, so the context request reaches the provider.
  registered = lms.register(media);
  record('lms-registered', { ok: registered });
}

// Manual mode appends here; the loader already appended.
const order = opt('order', 'lms-first');

if (opt('mode', 'manual') === 'manual') {
  if (order === 'lms-first' || opt('ads', 'none') === 'none') {
    // The provider (<video-player>) answers only once it is connected and upgraded, so register right after append.
    host.append(built.i18n);
    registerLms();
  } else {
    host.append(built.i18n);
    // <media-ads> registers on its first update (a microtask after connect); wait for it before LMS registers.
    await new Promise((resolve) => setTimeout(resolve, 0));
    registerLms();
  }
} else {
  registerLms();
}

if (opt('keys', 'on') === 'on') lms.bindKeys();
if (query.has('watched')) lms.setWatched(Number(query.get('watched')));
if (opt('chapAt', 'before') === 'after') {
  await new Promise((resolve) => setTimeout(resolve, 500));
  addChapters(media);
}

for (const type of ['seeking', 'seeked', 'ratechange', 'play', 'playing', 'pause', 'ended', 'loadedmetadata'])
  media.addEventListener(type, () => record(`media:${type}`, { time: Math.round(media.currentTime * 1000) / 1000 }));

player.addEventListener('ads-event', (event) => record('ads-event', { adType: event.detail?.type }));
player.addEventListener('solad-lms-seek-blocked', (event) => record('blocked-event', { allowed: event.detail.allowed }));

Object.assign(window.__lms, {
  lms,
  player,
  skin,
  media,
  root,
  container,
  slider,
  registered: () => registered,
  store: () => player.store,
  state: () => player.store?.state,
  ready: true,
});
record('ready', { mode: opt('mode', 'manual'), media: media.localName });
