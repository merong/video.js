import { observePlayback } from '../assets/admin/preview.js';
import { configureExampleLinks } from './context.js';

const get = (id) => document.getElementById(id);
const phaseNames = {
  loading: '불러오는 중',
  ready: '재생 대기',
  content: '본편',
  ad: '광고',
  transition: '전환 중',
  paused: '일시정지',
  ended: '종료',
  stopped: '중단',
  error: '확인 필요',
};
let observation;
let controller;
let media;
let stopped = false;
const request = new AbortController();

function render(state) {
  get('phase').textContent = phaseNames[state.phase];
  get('status').textContent = state.message;
  get('notice').hidden = !state.notice;
  get('notice').textContent = state.notice;
  get('empty-history').hidden = state.history.length > 0;
  get('events').replaceChildren(
    ...state.history.map((line) => {
      const item = document.createElement('li');

      item.textContent = line;
      return item;
    })
  );
}

get('reload').addEventListener('click', () => location.reload());
window.addEventListener('pageshow', (event) => {
  // A cached page retains the destroyed runtime and its old tracking session.
  if (event.persisted) location.reload();
});
window.addEventListener(
  'pagehide',
  () => {
    stopped = true;
    request.abort();
    observation?.destroy();
    controller?.destroy();
    media?.pause();
  },
  { once: true }
);

async function start() {
  try {
    const context = configureExampleLinks(document, location.href);
    const videojs = document.body.dataset.player === 'videojs';
    const tag = context.engine === 'hlsjs' ? 'hlsjs-video' : 'hls-video';

    get('context').textContent =
      `영상 ${context.videoId} · ${context.media.toUpperCase()}${videojs && context.media === 'hls' ? ` · ${context.engine === 'hlsjs' ? 'hls.js' : 'SPF'}` : ''}`;
    if (videojs) {
      await import('../assets/videojs/video.js');
      if (context.media === 'hls') await import(`../assets/videojs/media/${tag}.js`);
    }
    const module = await import('../assets/ads.js');

    if (stopped) return;

    media = document.createElement(videojs && context.media === 'hls' ? tag : 'video');
    media.id = 'content';
    media.setAttribute('playsinline', '');
    media.setAttribute('preload', 'metadata');
    media.setAttribute('aria-label', '본편 영상');
    const endpoint = new URL('../api/index.php', location.href);

    endpoint.searchParams.set('action', 'schedule');
    endpoint.searchParams.set('videoId', context.videoId);
    if (videojs) {
      const player = document.createElement('video-player');
      const skin = document.createElement('video-skin');
      const ads = document.createElement('media-ads');

      observation = observePlayback({ media, container: skin, onChange: render });
      media.setAttribute('src', context.content);
      ads.setAttribute('for', media.id);
      ads.setAttribute('src', endpoint.href);
      ads.setAttribute('video-id', context.videoId);
      skin.append(media, ads);
      player.append(skin);
      get('mount').append(player);
    } else {
      media.setAttribute('controls', '');
      let data;
      let scheduleError;

      get('status').textContent = '게시된 광고 편성을 불러오는 중입니다.';
      try {
        const response = await fetch(endpoint, {
          signal: request.signal,
          credentials: 'same-origin',
          cache: 'no-store',
        });
        const payload = await response.json();

        if (!response.ok || !payload.ok) throw new Error(payload.error?.message || '광고 편성을 불러오지 못했습니다.');

        data = payload.data;
      } catch (error) {
        if (stopped) return;

        scheduleError = error.message;
      }
      if (stopped) return;

      observation = observePlayback({ media, container: get('mount'), schedule: data?.schedule, onChange: render });
      get('mount').append(media);
      media.src = context.content;
      if (data) {
        const { schedule, ...tracking } = data;

        controller = module.createAdsController({
          media,
          container: get('mount'),
          schedule,
          tracking,
          onEvent: observation.onEvent,
        });
      } else observation.diagnostic('schedule_unavailable', `${scheduleError} 본편은 별도로 재생할 수 있습니다.`);
    }
  } catch (error) {
    if (!stopped)
      render({ phase: 'error', message: '플레이어를 준비하지 못했습니다.', notice: error.message, history: [] });
  }
}

void start();
