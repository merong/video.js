import { observePlayback } from '../assets/admin/preview.js';

const get = (id) => document.getElementById(id);
const native = new URLSearchParams(location.search).get('mode') === 'native';
const videoId = 'grok-demo-scene-01';
const contentUrl = new URL('../demo-media/grok-20261018/content-scene-01.mp4', import.meta.url);
const scheduleUrl = new URL('../demo-media/grok-20261018/schedule.json.js', import.meta.url);
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
const request = new AbortController();
let observation;
let controller;
let player;
let media;
let stopped = false;

function render(state) {
  get('phase').textContent = phaseNames[state.phase];
  if (get('status').textContent !== state.message) get('status').textContent = state.message;
  get('notice').hidden = !state.notice;
  if (get('notice').textContent !== state.notice) get('notice').textContent = state.notice;
  get('empty-history').hidden = state.history.length > 0;
  get('events').replaceChildren(
    ...state.history.map((line) => {
      const item = document.createElement('li');

      item.textContent = line;
      return item;
    })
  );
}

get(native ? 'mode-videojs' : 'mode-native').removeAttribute('aria-current');
get(native ? 'mode-native' : 'mode-videojs').setAttribute('aria-current', 'page');
get('reload').addEventListener('click', () => location.reload());
window.addEventListener('pageshow', (event) => {
  if (event.persisted) location.reload();
});
window.addEventListener(
  'pagehide',
  () => {
    stopped = true;
    request.abort();
    observation?.destroy();
    controller?.destroy();
    player?.remove();
    media?.pause();
  },
  { once: true }
);

async function start() {
  try {
    if (!native) await import('../assets/videojs/video.js');
    const module = await import('../assets/ads.js');

    if (stopped) return;

    media = document.createElement('video');
    media.id = 'grok-content';
    media.setAttribute('playsinline', '');
    media.setAttribute('preload', 'metadata');
    media.setAttribute('aria-label', 'Grok 해안 도시 장면, 본편 10초');
    if (native) {
      get('status').textContent = '광고 편성 파일을 불러오는 중입니다.';
      const response = await fetch(scheduleUrl, {
        signal: request.signal,
        cache: 'no-store',
        credentials: 'same-origin',
      });

      if (!response.ok)
        throw new Error('광고 편성 파일을 불러오지 못했습니다. 예제 파일 경로를 확인하고 다시 시도하세요.');

      const schedule = await response.json();

      if (stopped) return;

      if (!Array.isArray(schedule?.breaks) || schedule.videoId !== videoId)
        throw new Error('이 영상에 맞는 raw 편성 JSON인지 확인하세요.');

      observation = observePlayback({ media, container: get('mount'), schedule, onChange: render });
      media.controls = true;
      media.src = contentUrl.href;
      get('mount').append(media);
      controller = module.createAdsController({
        media,
        container: get('mount'),
        schedule,
        preview: true,
        onEvent: observation.onEvent,
      });
    } else {
      player = document.createElement('video-player');
      const skin = document.createElement('video-skin');
      const ads = document.createElement('media-ads');

      observation = observePlayback({ media, container: skin, onChange: render });
      media.src = contentUrl.href;
      ads.setAttribute('for', media.id);
      ads.setAttribute('src', scheduleUrl.href);
      ads.setAttribute('video-id', videoId);
      skin.append(media, ads);
      player.append(skin);
      get('mount').append(player);
    }
  } catch (error) {
    if (stopped) return;

    observation?.destroy();
    render({
      phase: 'error',
      message: 'Grok 예제를 준비하지 못했습니다.',
      notice: `${error.message} 본편·광고 파일과 플레이어 파일이 준비되었는지 확인하세요.`,
      history: [],
    });
  }
}

void start();
