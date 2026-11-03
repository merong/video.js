/**
 * 솔애드 라이트 플레이어(그누보드5).
 *
 * Extend/solad_lite.extend.php가 페이지 끝에 넣는 #solad-lite-config를 읽어
 *
 * 1. 글 보기 화면이면 첨부한 mp4·webm을 본문 위에 플레이어로 넣고, 본문 안의 <video>를 그 자리에서 플레이어로 바꾼다.
 * 2. 어느 페이지든 [data-solad-lite] 자리 표시를 플레이어로 바꾼다. 바꿀 것이 없으면 Video.js를 읽지 않는다. 광고 편성(schedule)이 있으면 각 플레이어에 프리롤 광고를 붙인다.
 *
 * 나중에 그려지는 내용에는 직접 부른다. SoladLite.mount(element, { src: '/data/file/free/movie.mp4', poster:
 * '/data/file/free/cover.jpg' }); SoladLite.scan(); // 새로 생긴 [data-solad-lite]를 찾아 바꾼다.
 */

const here = new URL(import.meta.url);
// solad-lite.js?v=1.0.0로 읽으면 Video.js와 ads.js도 같은 버전 주소로 읽어, 업데이트가 캐시에 막히지 않게 한다.
const version = here.search;
const asset = (path) => new URL(`./vendor/${path}${version}`, here).href;
const VIDEO = /\.(mp4|webm)$/i;
const config = readConfig();

let ready = null;
let count = 0;

function readConfig() {
  try {
    return JSON.parse(document.getElementById('solad-lite-config')?.textContent || '{}');
  } catch {
    return {};
  }
}

/** Video.js(기본 스킨)와 광고 요소(ads.js)를 한 번만 읽는다. */
function load() {
  ready ??= (async () => {
    const link = document.createElement('link');

    link.rel = 'stylesheet';
    link.href = asset('videojs/video.css');
    document.head.append(link);
    await Promise.all([import(asset('videojs/video.js')), import(asset('ads.js'))]);
  })();
  return ready;
}

function pageLanguage() {
  const lang = (document.documentElement.lang || 'ko').toLowerCase();

  return lang.startsWith('en') ? 'en' : lang.startsWith('ja') ? 'ja' : lang.startsWith('zh') ? 'zh-CN' : 'ko';
}

/** 같은 사이트의 /경로 또는 http(s) 주소면 그대로, 아니면 null. */
function mediaUrl(value) {
  if (!value) return null;

  try {
    const url = new URL(value, document.baseURI);

    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

/** `element` 안에 플레이어를 만든다. options: src(필수), poster, title, ads(false면 광고 없음). 이미 만든 자리는 다시 만들지 않는다. */
async function mount(element, options = {}) {
  const src = mediaUrl(options.src);

  if (!element || element.hasAttribute('data-solad-lite-ready')) return null;

  if (!src) {
    console.warn('[solad-lite] 재생할 동영상 주소가 없습니다.', element);
    return null;
  }

  element.setAttribute('data-solad-lite-ready', '');
  element.classList.add('solad-lite');
  await load();

  const lang = pageLanguage();
  const i18n = document.createElement('media-i18n');
  const player = document.createElement('video-player');
  const skin = document.createElement('video-skin');
  const media = document.createElement('video');
  const poster = mediaUrl(options.poster);

  i18n.setAttribute('lang', lang);
  media.id = `solad-lite-${++count}`;
  media.setAttribute('playsinline', '');
  media.setAttribute('preload', 'metadata');
  media.setAttribute('src', src);

  if (poster) player.setAttribute('poster', poster);

  if (options.title) player.setAttribute('content-title', options.title);

  skin.append(media);

  // 광고 편성은 사이트에 하나다. 모든 플레이어가 같은 영상 ID로 같은 편성을 읽는다.
  if (config.schedule && options.ads !== false) {
    const ads = document.createElement('media-ads');

    ads.setAttribute('for', media.id);
    ads.setAttribute('src', config.schedule);
    ads.setAttribute('video-id', config.videoId || 'solad-lite');
    ads.setAttribute('lang', lang);
    skin.append(ads);
  }

  player.append(skin);
  i18n.append(player);
  element.replaceChildren(i18n);
  return { element, player, media };
}

function placeholder(options) {
  const element = document.createElement('div');

  element.className = 'solad-lite';
  return { element, options };
}

/** 글 보기 화면: 본문의 <video>와 첨부 동영상. */
function boardJobs() {
  const jobs = [];
  const content = config.selector ? document.querySelector(config.selector) : null;

  if (!config.auto) return jobs;

  for (const video of content ? content.querySelectorAll('video') : []) {
    const src = video.getAttribute('src') || video.querySelector('source[src]')?.getAttribute('src');
    const url = mediaUrl(src);
    if (video.closest('.solad-lite') || !url || !VIDEO.test(new URL(url).pathname)) continue;

    const job = placeholder({ src: url, poster: video.getAttribute('poster') });

    video.replaceWith(job.element);
    jobs.push(job);
  }

  const files = Array.isArray(config.videos) ? config.videos : [];

  if (files.length && !content)
    console.warn(`[solad-lite] 본문 영역(${config.selector})을 찾지 못해 첨부 동영상을 넣지 못했습니다.`);

  if (files.length && content) {
    const box = document.createElement('div');

    box.className = 'solad-lite-files';

    for (const file of files) {
      const job = placeholder({ src: file.src, title: file.title });

      box.append(job.element);
      jobs.push(job);
    }

    content.prepend(box);
  }

  return jobs;
}

/** [data-solad-lite] 자리 표시. data-src, data-poster, data-title, data-ads="off". */
function scan(root = document) {
  const jobs = [];

  for (const element of root.querySelectorAll('[data-solad-lite]:not([data-solad-lite-ready])')) {
    jobs.push({
      element,
      options: {
        src: element.dataset.src,
        poster: element.dataset.poster,
        title: element.dataset.title,
        ads: element.dataset.ads !== 'off',
      },
    });
  }

  return Promise.all(jobs.map((job) => mount(job.element, job.options)));
}

function start() {
  const jobs = boardJobs();

  return Promise.all([...jobs.map((job) => mount(job.element, job.options)), scan()]);
}

globalThis.SoladLite = { mount, scan };

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
