import { safeUrl } from './model.js';

const positions = { pre: '프리롤', mid: '미드롤', post: '포스트롤' };
const eventNames = {
  start: '시작',
  complete: '완료',
  skip: '건너뜀',
  click: '광고주 방문',
  error: '오류',
  cancel: '중단',
};
const errors = {
  schedule_unavailable: '광고 편성을 불러오지 못했습니다.',
  invalid_schedule: '광고 편성을 적용할 수 없습니다.',
  invalid_duration: '본편 길이를 확인할 수 없어 광고 편성을 적용하지 못했습니다.',
  content_play_rejected: '본편 재생이 차단되었습니다. 재생 버튼을 다시 눌러 주세요.',
  unsupported_picture_in_picture: '화면 속 화면에서는 광고 재생을 지원하지 않습니다.',
  unsupported_remote_playback: '원격 재생에서는 광고 재생을 지원하지 않습니다.',
  creative_load_failed: '광고 소재를 불러오지 못했습니다.',
  creative_load_timeout: '광고 소재를 불러오는 시간이 초과되었습니다.',
  creative_play_failed: '광고를 재생하지 못했습니다.',
  creative_play_timeout: '광고 재생이 시작되지 않았습니다.',
  creative_stall_timeout: '광고 재생이 멈춰 다음 순서로 진행합니다.',
};

/** Page-level observations only; playback and tracking remain owned by the ads controller. */
export function observePlayback({ media, container, schedule, onChange }) {
  const listeners = new AbortController();
  const history = [];
  let phase = 'loading';
  let text = '본편을 불러오는 중입니다.';
  let notice = '';
  let activeAd = false;
  let returning = false;
  let stopped = false;

  const publish = (nextPhase, message) => {
    if (stopped) return;

    phase = nextPhase;
    text = message;
    onChange({ phase, message: text, notice, history: [...history] });
  };
  const record = (line) => {
    history.push(line);

    if (history.length > 20) history.shift();
  };
  const diagnostic = (code, message) => {
    if (stopped) return;

    notice = message || errors[code] || `광고 처리 중 오류가 발생했습니다${code ? ` (${code})` : ''}.`;
    publish('error', notice);
  };
  const onEvent = (event) => {
    if (stopped || !eventNames[event?.type]) return;

    const br = schedule?.breaks.find((entry) => entry.breakId === event.breakId);
    const index = br?.ads.findIndex((entry) => entry.itemId === event.itemId) ?? -1;
    const label = index >= 0 ? `${positions[br.position]} · 광고 ${index + 1}/${br.ads.length}` : `광고 ${event.adId}`;

    record(`${label} · ${eventNames[event.type]}`);

    if (event.type === 'start') {
      activeAd = true;
      returning = true;
      publish('ad', `${label} 진행 중`);
    } else if (event.type === 'click') {
      publish(phase, text);
    } else {
      activeAd = false;

      if (event.type === 'error') {
        diagnostic(event.code);
      } else if (event.type === 'cancel') {
        publish('stopped', '광고 재생이 중단되었습니다.');
      } else if (br?.position === 'post' && index === br.ads.length - 1) {
        publish('ended', `${label} ${eventNames[event.type]} · 재생이 끝났습니다.`);
      } else if (!schedule && media.ended) {
        // HTML observations carry no pod length. A later start can still begin another postroll ad.
        publish('ended', `${label} ${eventNames[event.type]} · 본편은 종료되었습니다.`);
      } else {
        publish('transition', `${label} ${eventNames[event.type]} · 다음 재생을 기다립니다.`);
      }
    }
  };
  const listen = (target, name, handler) => target.addEventListener(name, handler, { signal: listeners.signal });

  listen(container, 'ads-event', (event) => onEvent(event.detail));
  listen(container, 'ads-error', (event) => diagnostic(event.detail?.code));
  listen(media, 'loadstart', () => {
    if (!activeAd && phase !== 'error') publish('loading', '본편을 불러오는 중입니다.');
  });
  listen(media, 'canplay', () => {
    if (phase === 'loading') publish('ready', '재생 버튼을 눌러 본편과 광고를 확인하세요.');
  });
  listen(media, 'playing', () => {
    if (activeAd) return;

    if (returning) record('본편 복귀');

    publish('content', returning ? '광고 후 본편을 재생하고 있습니다.' : '본편 재생 중');
    returning = false;
  });
  listen(media, 'waiting', () => {
    if (!activeAd && phase === 'content') publish('loading', '본편을 불러오는 중입니다.');
  });
  listen(media, 'pause', () => {
    if (!activeAd && phase === 'content' && !media.ended) publish('paused', '본편이 일시정지되었습니다.');
  });
  listen(media, 'ended', () => {
    if (activeAd) return;

    const post = schedule?.breaks.some((entry) => entry.position === 'post');

    publish(
      'ended',
      post || !schedule ? '본편이 끝났습니다. 후속 광고가 있으면 이어집니다.' : '본편 재생이 끝났습니다.'
    );
  });
  listen(media, 'error', () =>
    diagnostic('content', '본편을 불러오지 못했습니다. 주소와 브라우저 지원 형식을 확인하세요.')
  );
  publish('loading', text);

  if (media.error) diagnostic('content', '본편을 불러오지 못했습니다. 주소와 브라우저 지원 형식을 확인하세요.');
  else if (media.readyState >= 3) publish('ready', '재생 버튼을 눌러 본편과 광고를 확인하세요.');

  return {
    onEvent,
    diagnostic,
    destroy() {
      stopped = true;
      listeners.abort();
    },
  };
}

/** Owns one preview session and rejects late module loads after close/replacement. */
export class PreviewSession {
  #controller = null;
  #media = null;
  #generation = 0;
  #observation = null;

  destroy() {
    this.#generation += 1;
    this.#observation?.destroy();
    this.#observation = null;
    this.#controller?.destroy();
    this.#controller = null;
    this.#media?.pause();
    this.#media?.removeAttribute('src');
    this.#media?.load();
    this.#media = null;
  }

  async start({ playerModuleUrl, media, container, contentUrl, schedule, onChange = () => {} }) {
    this.destroy();

    if (!playerModuleUrl || !safeUrl(playerModuleUrl)) throw new Error('미리보기 플레이어가 아직 연결되지 않았습니다.');

    if (!safeUrl(contentUrl)) throw new Error('실제 본편 영상의 HTTP(S) 주소 또는 / 경로를 입력하세요.');

    const generation = this.#generation;
    const module = await import(playerModuleUrl);

    if (generation !== this.#generation) return false;

    // The externally deployed module must implement the C0 callable entry point.
    // oxlint-disable-next-line anti-slop/no-runtime-typeof
    if (typeof module.createAdsController !== 'function')
      throw new Error('연결된 플레이어가 광고 미리보기를 지원하지 않습니다.');

    this.#media = media;
    this.#observation = observePlayback({ media, container, schedule, onChange });
    media.src = contentUrl;
    media.load();
    this.#controller = module.createAdsController({
      media,
      container,
      schedule,
      preview: true,
      onEvent: this.#observation.onEvent,
    });
    return true;
  }
}
