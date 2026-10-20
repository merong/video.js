import { walkAncestors } from '@videojs/utils/dom';

/** Text templates only; values are rendered as text, never HTML. @internal */
export interface AdsLabels {
  advertisement: string;
  sequence: string;
  playPause: string;
  mute: string;
  volume: string;
  advertiser: string;
  newWindow: string;
  skip: string;
  skipCountdown: string;
  timer: string;
  mediaAlt: string;
  loading: string;
  paused: string;
  blocked: string;
  enterFullscreen: string;
  exitFullscreen: string;
  fullscreenError: string;
}

/** Presentation only. Omitted locale inherits the composed DOM language, then English. @internal */
export interface AdsUIOptions {
  readonly locale?: string | undefined;
  readonly labels?: Partial<AdsLabels> | undefined;
}

const EN: AdsLabels = {
  advertisement: 'Advertisement',
  sequence: 'Advertisement {index} of {count}',
  playPause: 'Play / pause ad',
  mute: 'Mute ad',
  volume: 'Ad volume',
  advertiser: 'Visit advertiser',
  newWindow: 'Opens in a new tab',
  skip: 'Skip ad',
  skipCountdown: 'Skip in {seconds}s',
  timer: '{elapsed} / {duration}',
  mediaAlt: 'Advertisement',
  loading: 'Loading advertisement…',
  paused: 'Advertisement paused',
  blocked: 'Press Play to continue',
  enterFullscreen: 'Enter fullscreen',
  exitFullscreen: 'Exit fullscreen',
  fullscreenError: 'Fullscreen unavailable',
};
const KO: AdsLabels = {
  advertisement: '광고',
  sequence: '광고 {index}/{count}',
  playPause: '광고 재생 / 일시정지',
  mute: '광고 음소거',
  volume: '광고 음량',
  advertiser: '광고주 사이트',
  newWindow: '새 탭에서 열림',
  skip: '광고 건너뛰기',
  skipCountdown: '{seconds}초 후 건너뛰기',
  timer: '{elapsed} / {duration}',
  mediaAlt: '광고',
  loading: '광고 불러오는 중…',
  paused: '광고 일시정지',
  blocked: '재생 버튼을 눌러 계속하세요',
  enterFullscreen: '전체화면 시작',
  exitFullscreen: '전체화면 종료',
  fullscreenError: '전체화면을 사용할 수 없습니다',
};

/** @internal */
export function resolveAdsLocale(target: Element, locale?: string): 'ko' | 'en' {
  const inherited = walkAncestors(target, (node) => node.getAttribute('lang')?.trim() || undefined, { composed: true });

  return (locale?.trim() || inherited || 'en').toLowerCase().split('-')[0] === 'ko' ? 'ko' : 'en';
}

/** Watch the ancestor chain, including shadow hosts, without observing ad timer DOM writes. @internal */
export function observeAdsLocale(target: Element, update: () => void): () => void {
  const observer = new MutationObserver(update);

  walkAncestors(
    target,
    (node) => {
      observer.observe(node, { attributes: true, attributeFilter: ['lang'] });
      return undefined;
    },
    { composed: true }
  );
  return () => observer.disconnect();
}

/** @internal */
export function resolveAdsLabels(locale: 'ko' | 'en', overrides?: Partial<AdsLabels>): AdsLabels {
  const labels = { ...(locale === 'ko' ? KO : EN) };

  // SAFETY: labels is a fresh copy of one complete, closed AdsLabels literal above.
  for (const key of Object.keys(labels) as (keyof AdsLabels)[]) {
    const value = overrides?.[key];

    if (value?.trim()) labels[key] = value;
  }

  return labels;
}

/** @internal */
export function formatAdLabel(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match));
}

/** @internal */
export function formatAdTime(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return '–:––';

  const whole = Math.max(0, Math.floor(seconds));

  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}
