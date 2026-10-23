/**
 * Player preset schema v2 (`.agents/plans/ads-player-schema-v2.md`). PHP, this parser and `public/player/preset.js`
 * follow the same table: unknown keys and out-of-range values are rejected, never corrected. Empty values are `null`
 * and mean the built-in default.
 */

export type PlayerType = 'videojs' | 'native';
/** Player screen language. Ads always use Korean. */
export type PlayerLanguage = 'ko' | 'en' | 'ja' | 'zh-CN';
export type PlayerPreload = 'none' | 'metadata' | 'auto';
export type SeekButtonSeconds = 5 | 10 | 15 | 30;
/** Where the seek pair shows: the control bar, the middle of the video (around a play button), or both. */
export type SeekPlacement = 'bar' | 'center' | 'both';
export type LogoPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

/** Built-in logo images by `logo.assetId`: the render's `logo.src`, a file name relative to `public/player/`. */
export const LOGO_ASSETS = { sample: 'logo-sample.svg' } as const;

export type LogoAssetId = keyof typeof LOGO_ASSETS;

/** What each empty `logo.*` value renders as once an image is chosen (ads-a2e-spec 5.2). */
export const LOGO_DEFAULTS = {
  position: 'top-right',
  margin: 12,
  width: 80,
  opacity: 80,
  href: null,
  alt: null,
  hideDuringAds: true,
  hideWithControls: false,
} as const satisfies Omit<PresetLogoRender, 'src'>;
/** `DEFAULT_RATES` values a lecture may cap playback at. */
export type LmsMaxRate = 1 | 1.2 | 1.5 | 1.7 | 2;

export interface PlayerTheme {
  readonly accentColor: string | null;
  readonly accentTextColor: string | null;
  /** `#rrggbb`, or `#rrggbbaa` for a see-through line; `#00000000` draws none. */
  readonly borderColor: string | null;
  readonly borderRadius: number | null;
  readonly fontFamily: 'system' | null;
  readonly objectFit: 'contain' | 'cover' | null;
  readonly scaleUnit: 'root' | null;
}

export interface PlayerPlayback {
  readonly autoplay: boolean | null;
  /** `false` is rejected while `autoplay` is true. */
  readonly muted: boolean | null;
  readonly loop: boolean | null;
  readonly preload: PlayerPreload | null;
}

export interface PlayerDisplay {
  readonly poster: boolean | null;
  /** Video.js only. */
  readonly title: boolean | null;
}

/** Video.js only. */
export interface PlayerInput {
  readonly hotkeys: boolean | null;
  readonly gestures: boolean | null;
}

/** Video.js only. */
export interface PlayerControls {
  readonly captions: boolean | null;
  readonly quality: boolean | null;
  readonly audioTrack: boolean | null;
  readonly playbackRate: boolean | null;
  readonly pip: boolean | null;
  readonly fullscreen: boolean | null;
  readonly thumbnails: boolean | null;
  /** `null` hides the seek buttons. */
  readonly seekButtons: SeekButtonSeconds | null;
  /** `null` is the control bar. Kept while `seekButtons` is `null`. */
  readonly seekPlacement: SeekPlacement | null;
}

/** Video.js only. Logo uploads are not here yet, so `assetId` is a built-in image or `null`. */
export interface PlayerLogo {
  readonly assetId: LogoAssetId | null;
  readonly position: LogoPosition | null;
  readonly margin: number | null;
  readonly width: number | null;
  readonly opacity: number | null;
  readonly href: string | null;
  /** Required when `href` is set. */
  readonly alt: string | null;
  readonly hideDuringAds: boolean | null;
  readonly hideWithControls: boolean | null;
}

/** Ad label keys in contract 2.2 order: the ads package's `AdsLabels` without `mediaAlt`. */
export const AD_LABEL_KEYS = [
  'advertisement',
  'sequence',
  'playPause',
  'mute',
  'volume',
  'advertiser',
  'newWindow',
  'skip',
  'skipCountdown',
  'timer',
  'loading',
  'paused',
  'blocked',
  'enterFullscreen',
  'exitFullscreen',
  'fullscreenError',
] as const;

export type AdLabelKey = (typeof AD_LABEL_KEYS)[number];
export type PlayerAdsLabels = { readonly [Key in AdLabelKey]: string | null };

/**
 * Korean text the ads package shows for an empty label (`KO` in `packages/extensions/ads/src/dom/ui.ts`), for the
 * editor's placeholders. Ads always use Korean, whatever the preset language.
 */
export const AD_LABEL_DEFAULTS = {
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
  loading: '광고 불러오는 중…',
  paused: '광고 일시정지',
  blocked: '재생 버튼을 눌러 계속하세요',
  enterFullscreen: '전체화면 시작',
  exitFullscreen: '전체화면 종료',
  fullscreenError: '전체화면을 사용할 수 없습니다',
} as const satisfies { readonly [Key in AdLabelKey]: string };

export interface PlayerAdsProgress {
  readonly sequence: boolean | null;
  readonly timer: boolean | null;
  readonly bar: boolean | null;
}

export interface PlayerAdsSettings {
  readonly labels: PlayerAdsLabels;
  readonly accentColor: string | null;
  readonly skipRadius: number | null;
  readonly fontSize: number | null;
  readonly progress: PlayerAdsProgress;
  /** `native` only. */
  readonly timeouts: { readonly loadSeconds: number | null; readonly stallSeconds: number | null };
}

export interface PlayerLmsTabs {
  readonly chapters: boolean | null;
  readonly materials: boolean | null;
  readonly transcript: boolean | null;
  readonly notes: boolean | null;
}

/** Video.js only (ads-lms-spec 1.1). Values are stored while `enabled` is off but only an enabled group renders. */
export interface PlayerLms {
  readonly enabled: boolean | null;
  readonly resume: 'ask' | 'auto' | 'off' | null;
  readonly seekLimit: 'free' | 'watched' | null;
  readonly maxRate: LmsMaxRate | null;
  /** Percent watched that completes the lecture, 50–100. */
  readonly completion: number | null;
  readonly tabs: PlayerLmsTabs;
  readonly bookmarks: boolean | null;
  readonly ads: 'off' | 'preroll' | null;
}

export interface PlayerPreset {
  /** Server-made `p-xxxxxxxxxx` or a built-in id; absent on a preset that has not been saved yet. */
  readonly id: string | null;
  readonly name: string;
  readonly playerType: PlayerType;
  /** `null` follows the page language. */
  readonly language: PlayerLanguage | null;
  readonly theme: PlayerTheme;
  readonly playback: PlayerPlayback;
  readonly display: PlayerDisplay;
  readonly input: PlayerInput;
  readonly controls: PlayerControls;
  readonly logo: PlayerLogo;
  readonly ads: PlayerAdsSettings;
  readonly lms: PlayerLms;
}

export type PresetErrorCode =
  | 'required'
  | 'unknown_key'
  | 'type'
  | 'format'
  | 'enum'
  | 'range'
  | 'length'
  | 'control'
  | 'placeholder'
  /** A value the selected player cannot apply: a skin field for `native`, timeouts for `videojs`. */
  | 'player_type'
  /** `playback.muted: false` while `playback.autoplay` is true. */
  | 'conflict'
  /** A field accepted only by a later release: a `logo.assetId` that is not built in, until logo uploads exist. */
  | 'unavailable';

export interface PresetError {
  /** Dotted field path such as `theme.accentColor`. */
  readonly path: string;
  readonly code: PresetErrorCode;
}

export type PresetResult =
  | { readonly ok: true; readonly preset: PlayerPreset }
  | { readonly ok: false; readonly errors: readonly PresetError[] };

export type PresetCssProperty = (typeof PRESET_CSS_PROPERTIES)[number];
export type PresetCss = Readonly<Partial<Record<PresetCssProperty, string>>>;
type LabelAttribute = (typeof labelAttributes)[keyof typeof labelAttributes];
/** `PresetAttributes` while `presetRender` fills it. */
type AttributesDraft = { lang: 'ko' } & { -readonly [Name in LabelAttribute]?: string };
export type MediaAdsAttribute = 'lang' | LabelAttribute;
/** `<media-ads>` attributes. Ads are always Korean, so `lang` is always `ko`. */
export type PresetAttributes = { readonly lang: 'ko' } & Readonly<Partial<Record<LabelAttribute, string>>>;
export type PresetLabels = Readonly<Partial<Record<AdLabelKey, string>>>;

/** `createAdsController({ ui })` values a native preset sets. */
export interface PresetControllerUI {
  readonly locale: 'ko';
  readonly labels?: PresetLabels;
}

/** `createAdsController({ timeouts })` values a native preset sets. */
export interface PresetTimeouts {
  readonly loadSeconds?: number;
  readonly stallSeconds?: number;
}

/** Built-in defaults filled in, so the loader applies these values as they are. */
export interface PresetPlaybackRender {
  readonly autoplay: boolean;
  /** The preset's `muted`, false when empty. Autoplay does not change it; the loader mutes autoplay after merging. */
  readonly muted: boolean;
  readonly loop: boolean;
  readonly preload: PlayerPreload;
}

interface PresetRenderBase {
  readonly id: string | null;
  readonly revision: number;
  readonly language: PlayerLanguage | null;
  readonly playback: PresetPlaybackRender;
  readonly progress: { readonly sequence: boolean; readonly timer: boolean; readonly bar: boolean };
  /** Only the set labels, in contract 2.2 order. */
  readonly labels: PresetLabels;
  readonly css: PresetCss;
}

/** The logo a Video.js render carries once an image is chosen; every layout value is filled. */
export interface PresetLogoRender {
  /** A built-in image's file name relative to `public/player/`; the loader turns it into an address. */
  readonly src: string;
  readonly position: LogoPosition;
  readonly margin: number;
  readonly width: number;
  readonly opacity: number;
  readonly href: string | null;
  readonly alt: string | null;
  readonly hideDuringAds: boolean;
  readonly hideWithControls: boolean;
}

/** The lecture rules and panel a Video.js render carries while `lms.enabled` is on; every value is filled. */
export interface PresetLmsRender {
  readonly resume: 'ask' | 'auto' | 'off';
  readonly seekLimit: 'free' | 'watched';
  readonly maxRate: LmsMaxRate;
  readonly completion: number;
  readonly tabs: {
    readonly chapters: boolean;
    readonly materials: boolean;
    readonly transcript: boolean;
    readonly notes: boolean;
  };
  readonly bookmarks: boolean;
  readonly ads: 'off' | 'preroll';
}

/** Video.js render: skin files and `<media-ads>` attributes. It has no `ui` or `timeouts` key. */
export interface VideojsPresetRender extends PresetRenderBase {
  readonly playerType: 'videojs';
  readonly display: { readonly poster: boolean; readonly title: boolean };
  readonly input: { readonly hotkeys: boolean; readonly gestures: boolean };
  readonly controls: {
    readonly captions: boolean;
    readonly quality: boolean;
    readonly audioTrack: boolean;
    readonly playbackRate: boolean;
    readonly pip: boolean;
    readonly fullscreen: boolean;
    readonly thumbnails: boolean;
    readonly seekButtons: SeekButtonSeconds | null;
    readonly seekPlacement: SeekPlacement;
  };
  /** `null` without a logo image. */
  readonly logo: PresetLogoRender | null;
  readonly skinTag: 'video-skin';
  /** File names relative to `public/assets/videojs/`. */
  readonly styles: { readonly css: 'video.css'; readonly js: 'video.js' };
  readonly attributes: PresetAttributes;
  /** Present only while `lms.enabled` is on. */
  readonly lms?: PresetLmsRender;
}

/** Native `<video>` render: controller options. It has no `input`, `controls`, `logo` or `attributes` key. */
export interface NativePresetRender extends PresetRenderBase {
  readonly playerType: 'native';
  readonly display: { readonly poster: boolean };
  readonly skinTag: null;
  readonly styles: null;
  readonly ui: PresetControllerUI;
  /** Present only when a timeout is set. */
  readonly timeouts?: PresetTimeouts;
}

/** Same shape as the public `player-preset` action. */
export type PlayerPresetRender = VideojsPresetRender | NativePresetRender;

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

// SAFETY: the entries cover every AD_LABEL_KEYS key exactly once, each with null.
const emptyLabels = Object.fromEntries(AD_LABEL_KEYS.map((key) => [key, null])) as PlayerAdsLabels;

/** The built-in read-only `default` preset: every value empty, so package defaults apply. */
export const DEFAULT_PLAYER_PRESET: PlayerPreset = {
  id: 'default',
  name: '기본',
  playerType: 'videojs',
  language: null,
  theme: {
    accentColor: null,
    accentTextColor: null,
    borderColor: null,
    borderRadius: null,
    fontFamily: null,
    objectFit: null,
    scaleUnit: null,
  },
  playback: { autoplay: null, muted: null, loop: null, preload: null },
  display: { poster: null, title: null },
  input: { hotkeys: null, gestures: null },
  controls: {
    captions: null,
    quality: null,
    audioTrack: null,
    playbackRate: null,
    pip: null,
    fullscreen: null,
    thumbnails: null,
    seekButtons: null,
    seekPlacement: null,
  },
  logo: {
    assetId: null,
    position: null,
    margin: null,
    width: null,
    opacity: null,
    href: null,
    alt: null,
    hideDuringAds: null,
    hideWithControls: null,
  },
  ads: {
    labels: emptyLabels,
    accentColor: null,
    skipRadius: null,
    fontSize: null,
    progress: { sequence: null, timer: null, bar: null },
    timeouts: { loadSeconds: null, stallSeconds: null },
  },
  lms: {
    enabled: null,
    resume: null,
    seekLimit: null,
    maxRate: null,
    completion: null,
    tabs: { chapters: null, materials: null, transcript: null, notes: null },
    bookmarks: null,
    ads: null,
  },
};

// Contract 4.1 order. Shared by `presetRender` and the loader so a property outside this table is never set.
export const PRESET_CSS_PROPERTIES = [
  '--media-accent-color',
  '--media-accent-text-color',
  '--media-border-color',
  '--media-border-radius',
  '--media-font-family',
  '--media-object-fit',
  '--media-scale-unit',
  '--ads-accent-color',
  '--ads-skip-radius',
  '--ads-font-size',
] as const;

const builtInIds = ['default', 'flat', 'rounded', 'accent', 'lms'];
const seekSteps = [5, 10, 15, 30] as const satisfies readonly SeekButtonSeconds[];
const topKeys = [
  'id',
  'name',
  'playerType',
  'language',
  'theme',
  'playback',
  'display',
  'input',
  'controls',
  'logo',
  'ads',
  'lms',
] as const;
const themeKeys = [
  'accentColor',
  'accentTextColor',
  'borderColor',
  'borderRadius',
  'fontFamily',
  'objectFit',
  'scaleUnit',
] as const satisfies readonly (keyof PlayerTheme)[];
const inputKeys = ['hotkeys', 'gestures'] as const satisfies readonly (keyof PlayerInput)[];
const controlKeys = [
  'captions',
  'quality',
  'audioTrack',
  'playbackRate',
  'pip',
  'fullscreen',
  'thumbnails',
  'seekButtons',
  'seekPlacement',
] as const satisfies readonly (keyof PlayerControls)[];
const logoKeys = [
  'assetId',
  'position',
  'margin',
  'width',
  'opacity',
  'href',
  'alt',
  'hideDuringAds',
  'hideWithControls',
] as const satisfies readonly (keyof PlayerLogo)[];
const lmsKeys = [
  'enabled',
  'resume',
  'seekLimit',
  'maxRate',
  'completion',
  'tabs',
  'bookmarks',
  'ads',
] as const satisfies readonly (keyof PlayerLms)[];
const lmsTabKeys = ['chapters', 'materials', 'transcript', 'notes'] as const satisfies readonly (keyof PlayerLmsTabs)[];
const lmsRates = [1, 1.2, 1.5, 1.7, 2] as const satisfies readonly LmsMaxRate[];
// The three labels v1 already carried as `<media-ads>` attributes.
const labelAttributes = {
  skip: 'skip-label',
  skipCountdown: 'skip-countdown-label',
  timer: 'timer-label',
} as const;
const labelAttributeKeys = [
  'skip',
  'skipCountdown',
  'timer',
] as const satisfies readonly (keyof typeof labelAttributes)[];
const labelPlaceholders = new Map<AdLabelKey, readonly string[]>([
  ['sequence', ['{index}', '{count}']],
  ['skipCountdown', ['{seconds}']],
  ['timer', ['{elapsed}', '{duration}', '{remaining}']],
]);
// Stored metadata the admin list adds; accepted and dropped like the API does.
const readOnlyKeys = ['builtIn', 'createdAt', 'updatedAt'];

// C0/C1 controls plus bidirectional embeddings, overrides and isolates, which could reverse an ad button's text.
// oxlint-disable-next-line no-control-regex
const controlPattern = /[\u0000-\u001f\u007f-\u009f‪-‮⁦-⁩]/u;
const colorPattern = /^#[0-9a-f]{6}$/;
// Only the border color may carry alpha (schema v2 section 5).
const alphaColorPattern = /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/;
const idPattern = /^p-[a-z0-9]{10}$/;
const hrefPattern = /^https?:\/\/[^/?#]+/;

/** Untrusted JSON, read once at the boundary so the rules below work on known shapes. */
type Field =
  | { readonly kind: 'absent' }
  | { readonly kind: 'string'; readonly value: string }
  | { readonly kind: 'number'; readonly value: number }
  | { readonly kind: 'boolean'; readonly value: boolean }
  | { readonly kind: 'group'; readonly fields: Fields }
  | { readonly kind: 'other' };
type Fields = ReadonlyMap<string, Field>;

const absent: Field = { kind: 'absent' };

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- the single boundary that reads untrusted preset JSON.
function toField(value: unknown): Field {
  if (value === undefined || value === null) return absent;

  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- untrusted JSON (API, form state, iframe messages).
  if (typeof value === 'string') return { kind: 'string', value };

  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- untrusted JSON (API, form state, iframe messages).
  if (typeof value === 'number') return { kind: 'number', value };

  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- untrusted JSON (API, form state, iframe messages).
  if (typeof value === 'boolean') return { kind: 'boolean', value };

  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- untrusted JSON (API, form state, iframe messages).
  if (typeof value !== 'object' || Array.isArray(value)) return { kind: 'other' };

  return { kind: 'group', fields: new Map(Object.entries(value).map(([key, item]) => [key, toField(item)])) };
}

/** The last path segment is the key inside `fields`. */
function field(fields: Fields, path: string): Field {
  return fields.get(path.slice(path.lastIndexOf('.') + 1)) ?? absent;
}

/** Mirrors `PlayerPresets::normalize` in PHP: `''` is empty for text fields, integers must be integers. */
class PresetReader {
  readonly errors: PresetError[] = [];

  fail(path: string, code: PresetErrorCode): null {
    this.errors.push({ path, code });
    return null;
  }

  failed(path: string): boolean {
    return this.errors.some((error) => error.path === path);
  }

  known(fields: Fields, prefix: string, keys: readonly string[]): void {
    for (const key of fields.keys()) if (!keys.includes(key)) this.fail(`${prefix}${key}`, 'unknown_key');
  }

  /** A nested group; absent means every field is empty. */
  group(fields: Fields, path: string, keys: readonly string[]): Fields {
    const value = field(fields, path);
    if (value.kind === 'absent') return new Map();

    if (value.kind !== 'group') {
      this.fail(path, 'type');
      return new Map();
    }

    this.known(value.fields, `${path}.`, keys);
    return value.fields;
  }

  text(fields: Fields, path: string): string | null {
    const value = field(fields, path);
    if (value.kind === 'absent') return null;

    if (value.kind !== 'string') return this.fail(path, 'type');

    return value.value || null;
  }

  color(fields: Fields, path: string, pattern = colorPattern): string | null {
    const value = this.text(fields, path);
    if (value === null) return null;

    return pattern.test(value) ? value : this.fail(path, 'format');
  }

  choice<T extends string>(fields: Fields, path: string, allowed: readonly T[]): T | null {
    const value = this.text(fields, path);
    if (value === null) return null;

    return allowed.find((item) => item === value) ?? this.fail(path, 'enum');
  }

  integer(fields: Fields, path: string, min: number, max: number): number | null {
    const value = field(fields, path);
    if (value.kind === 'absent') return null;

    if (value.kind !== 'number' || !Number.isInteger(value.value)) return this.fail(path, 'type');

    return value.value >= min && value.value <= max ? value.value : this.fail(path, 'range');
  }

  /** An integer from `allowed`; other integers are `enum` errors. */
  step<T extends number>(fields: Fields, path: string, allowed: readonly T[]): T | null {
    const value = field(fields, path);
    if (value.kind === 'absent') return null;

    if (value.kind !== 'number' || !Number.isInteger(value.value)) return this.fail(path, 'type');

    return allowed.find((item) => item === value.value) ?? this.fail(path, 'enum');
  }

  /** A number from `allowed`, which may hold fractions; `''` is a type error like any integer field. */
  rate<T extends number>(fields: Fields, path: string, allowed: readonly T[]): T | null {
    const value = field(fields, path);
    if (value.kind === 'absent') return null;

    if (value.kind !== 'number') return this.fail(path, 'type');

    return allowed.find((item) => item === value.value) ?? this.fail(path, 'enum');
  }

  /** `true`/`false` only; `0`, `1` and `"true"` are type errors. */
  bool(fields: Fields, path: string): boolean | null {
    const value = field(fields, path);
    if (value.kind === 'absent' || (value.kind === 'string' && value.value === '')) return null;

    return value.kind === 'boolean' ? value.value : this.fail(path, 'type');
  }

  /**
   * Trimmed with `String.prototype.trim` (Unicode spaces, line ends and U+FEFF), at most `max` characters, no control
   * or bidirectional control characters; braces only as `placeholders` when given.
   */
  label(fields: Fields, path: string, placeholders: readonly string[] | null, max = 40): string | null {
    const raw = field(fields, path);
    if (raw.kind === 'absent') return null;

    if (raw.kind !== 'string') return this.fail(path, 'type');

    if (controlPattern.test(raw.value)) return this.fail(path, 'control');

    const value = raw.value.trim();
    if ([...value].length > max) return this.fail(path, 'length');

    const rest = placeholders?.reduce((text, token) => text.replaceAll(token, ''), value);
    if (rest !== undefined && /[{}]/.test(rest)) return this.fail(path, 'placeholder');

    return value || null;
  }

  /** An absolute `http(s)://` URL of at most 2048 characters with no spaces or control characters. */
  href(fields: Fields, path: string): string | null {
    const value = this.text(fields, path);
    if (value === null) return null;

    if (controlPattern.test(value)) return this.fail(path, 'control');

    if ([...value].length > 2048) return this.fail(path, 'length');

    return hrefPattern.test(value) && !/\s/u.test(value) ? value : this.fail(path, 'format');
  }
}

/** Validate untrusted preset input against schema v2 2.1, returning every failing field path. */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- public parser for API JSON, form state and iframe messages.
export function parsePlayerPreset(value: unknown): PresetResult {
  const root = toField(value);
  if (root.kind !== 'group') return { ok: false, errors: [{ path: '', code: 'type' }] };

  const input = root.fields;
  const read = new PresetReader();

  read.known(input, '', [...topKeys, ...readOnlyKeys]);

  const idField = field(input, 'id');
  let id: string | null = null;

  // Unlike other text fields, `''` is not an empty id.
  if (idField.kind === 'string' && (builtInIds.includes(idField.value) || idPattern.test(idField.value)))
    id = idField.value;
  else if (idField.kind !== 'absent') read.fail('id', idField.kind === 'string' ? 'format' : 'type');

  const name = read.label(input, 'name', null);

  if (name === null && !read.failed('name')) read.fail('name', 'required');

  const playerType = read.choice(input, 'playerType', ['videojs', 'native'] as const);

  if (playerType === null && !read.failed('playerType')) read.fail('playerType', 'required');

  const language = read.choice(input, 'language', ['ko', 'en', 'ja', 'zh-CN'] as const);
  const themeInput = read.group(input, 'theme', themeKeys);
  const theme: PlayerTheme = {
    accentColor: read.color(themeInput, 'theme.accentColor'),
    accentTextColor: read.color(themeInput, 'theme.accentTextColor'),
    borderColor: read.color(themeInput, 'theme.borderColor', alphaColorPattern),
    borderRadius: read.integer(themeInput, 'theme.borderRadius', 0, 32),
    fontFamily: read.choice(themeInput, 'theme.fontFamily', ['system'] as const),
    objectFit: read.choice(themeInput, 'theme.objectFit', ['contain', 'cover'] as const),
    scaleUnit: read.choice(themeInput, 'theme.scaleUnit', ['root'] as const),
  };
  const playbackInput = read.group(input, 'playback', ['autoplay', 'muted', 'loop', 'preload']);
  const playback: PlayerPlayback = {
    autoplay: read.bool(playbackInput, 'playback.autoplay'),
    muted: read.bool(playbackInput, 'playback.muted'),
    loop: read.bool(playbackInput, 'playback.loop'),
    preload: read.choice(playbackInput, 'playback.preload', ['none', 'metadata', 'auto'] as const),
  };
  const displayInput = read.group(input, 'display', ['poster', 'title']);
  const display: PlayerDisplay = {
    poster: read.bool(displayInput, 'display.poster'),
    title: read.bool(displayInput, 'display.title'),
  };
  const inputInput = read.group(input, 'input', inputKeys);
  const inputs: PlayerInput = {
    hotkeys: read.bool(inputInput, 'input.hotkeys'),
    gestures: read.bool(inputInput, 'input.gestures'),
  };
  const controlsInput = read.group(input, 'controls', controlKeys);
  const controls: PlayerControls = {
    captions: read.bool(controlsInput, 'controls.captions'),
    quality: read.bool(controlsInput, 'controls.quality'),
    audioTrack: read.bool(controlsInput, 'controls.audioTrack'),
    playbackRate: read.bool(controlsInput, 'controls.playbackRate'),
    pip: read.bool(controlsInput, 'controls.pip'),
    fullscreen: read.bool(controlsInput, 'controls.fullscreen'),
    thumbnails: read.bool(controlsInput, 'controls.thumbnails'),
    seekButtons: read.step(controlsInput, 'controls.seekButtons', seekSteps),
    seekPlacement: read.choice(controlsInput, 'controls.seekPlacement', ['bar', 'center', 'both'] as const),
  };
  const logoInput = read.group(input, 'logo', logoKeys);
  const assetId = read.text(logoInput, 'logo.assetId');
  const builtInLogo = assetId !== null && isLogoAsset(assetId) ? assetId : null;

  // Logo uploads are not here yet, so only a built-in image id is accepted.
  if (assetId !== null && builtInLogo === null) read.fail('logo.assetId', 'unavailable');

  const logo: PlayerLogo = {
    assetId: builtInLogo,
    position: read.choice(logoInput, 'logo.position', [
      'top-left',
      'top-right',
      'bottom-left',
      'bottom-right',
    ] as const),
    margin: read.integer(logoInput, 'logo.margin', 0, 48),
    width: read.integer(logoInput, 'logo.width', 24, 240),
    opacity: read.integer(logoInput, 'logo.opacity', 10, 100),
    href: read.href(logoInput, 'logo.href'),
    alt: read.label(logoInput, 'logo.alt', null, 80),
    hideDuringAds: read.bool(logoInput, 'logo.hideDuringAds'),
    hideWithControls: read.bool(logoInput, 'logo.hideWithControls'),
  };
  const adsInput = read.group(input, 'ads', [
    'labels',
    'accentColor',
    'skipRadius',
    'fontSize',
    'progress',
    'timeouts',
  ]);
  const labelsInput = read.group(adsInput, 'ads.labels', AD_LABEL_KEYS);
  // SAFETY: the entries cover every AD_LABEL_KEYS key exactly once, each with a label or null.
  const labels = Object.fromEntries(
    AD_LABEL_KEYS.map((key) => [key, read.label(labelsInput, `ads.labels.${key}`, labelPlaceholders.get(key) ?? [])])
  ) as PlayerAdsLabels;
  const accentColor = read.color(adsInput, 'ads.accentColor');
  const skipRadius = read.integer(adsInput, 'ads.skipRadius', 0, 24);
  const fontSize = read.integer(adsInput, 'ads.fontSize', 11, 18);
  const progressInput = read.group(adsInput, 'ads.progress', ['sequence', 'timer', 'bar']);
  const progress: PlayerAdsProgress = {
    sequence: read.bool(progressInput, 'ads.progress.sequence'),
    timer: read.bool(progressInput, 'ads.progress.timer'),
    bar: read.bool(progressInput, 'ads.progress.bar'),
  };
  const timeoutsInput = read.group(adsInput, 'ads.timeouts', ['loadSeconds', 'stallSeconds']);
  const ads: PlayerAdsSettings = {
    labels,
    accentColor,
    skipRadius,
    fontSize,
    progress,
    timeouts: {
      loadSeconds: read.integer(timeoutsInput, 'ads.timeouts.loadSeconds', 1, 60),
      stallSeconds: read.integer(timeoutsInput, 'ads.timeouts.stallSeconds', 1, 120),
    },
  };
  const lmsInput = read.group(input, 'lms', lmsKeys);
  const tabsInput = read.group(lmsInput, 'lms.tabs', lmsTabKeys);
  const lms: PlayerLms = {
    enabled: read.bool(lmsInput, 'lms.enabled'),
    resume: read.choice(lmsInput, 'lms.resume', ['ask', 'auto', 'off'] as const),
    seekLimit: read.choice(lmsInput, 'lms.seekLimit', ['free', 'watched'] as const),
    maxRate: read.rate(lmsInput, 'lms.maxRate', lmsRates),
    completion: read.integer(lmsInput, 'lms.completion', 50, 100),
    tabs: {
      chapters: read.bool(tabsInput, 'lms.tabs.chapters'),
      materials: read.bool(tabsInput, 'lms.tabs.materials'),
      transcript: read.bool(tabsInput, 'lms.tabs.transcript'),
      notes: read.bool(tabsInput, 'lms.tabs.notes'),
    },
    bookmarks: read.bool(lmsInput, 'lms.bookmarks'),
    ads: read.choice(lmsInput, 'lms.ads', ['off', 'preroll'] as const),
  };

  // Autoplay starts muted (decision 17), so an explicit unmuted start contradicts it.
  if (playback.autoplay === true && playback.muted === false) read.fail('playback.muted', 'conflict');

  if (logo.href !== null && logo.alt === null && !read.failed('logo.alt')) read.fail('logo.alt', 'required');

  // Values the selected player cannot apply are rejected rather than kept silently.
  if (playerType === 'native') {
    const unused: readonly (readonly [string, unknown])[] = [
      ...themeKeys.map((key) => [`theme.${key}`, theme[key]] as const),
      ['display.title', display.title],
      ...inputKeys.map((key) => [`input.${key}`, inputs[key]] as const),
      ...controlKeys.map((key) => [`controls.${key}`, controls[key]] as const),
      ...logoKeys.map((key) => [`logo.${key}`, key === 'assetId' ? assetId : logo[key]] as const),
      ['lms.enabled', lms.enabled],
      ['lms.resume', lms.resume],
      ['lms.seekLimit', lms.seekLimit],
      ['lms.maxRate', lms.maxRate],
      ['lms.completion', lms.completion],
      ...lmsTabKeys.map((key) => [`lms.tabs.${key}`, lms.tabs[key]] as const),
      ['lms.bookmarks', lms.bookmarks],
      ['lms.ads', lms.ads],
    ];

    for (const [path, item] of unused) if (item !== null) read.fail(path, 'player_type');
  } else if (playerType === 'videojs') {
    if (ads.timeouts.loadSeconds !== null) read.fail('ads.timeouts.loadSeconds', 'player_type');

    if (ads.timeouts.stallSeconds !== null) read.fail('ads.timeouts.stallSeconds', 'player_type');
  }

  if (read.errors.length || playerType === null || name === null) return { ok: false, errors: read.errors };

  return {
    ok: true,
    preset: { id, name, playerType, language, theme, playback, display, input: inputs, controls, logo, ads, lms },
  };
}

/** CSS custom properties in contract order; empty fields emit nothing. */
function presetCss(preset: PlayerPreset) {
  const { theme, ads } = preset;
  const values: readonly (readonly [PresetCssProperty, string | null])[] = [
    ['--media-accent-color', theme.accentColor],
    ['--media-accent-text-color', theme.accentTextColor],
    ['--media-border-color', theme.borderColor],
    ['--media-border-radius', theme.borderRadius === null ? null : `${theme.borderRadius}px`],
    ['--media-font-family', theme.fontFamily === 'system' ? 'system-ui, sans-serif' : null],
    ['--media-object-fit', theme.objectFit],
    ['--media-scale-unit', theme.scaleUnit === 'root' ? '1rem' : null],
    ['--ads-accent-color', ads.accentColor],
    ['--ads-skip-radius', ads.skipRadius === null ? null : `${ads.skipRadius}px`],
    ['--ads-font-size', ads.fontSize === null ? null : `${ads.fontSize}px`],
  ];
  const css: Mutable<PresetCss> = {};

  for (const [name, value] of values) if (value !== null) css[name] = value;

  return css;
}

function isLogoAsset(id: string): id is LogoAssetId {
  return Object.hasOwn(LOGO_ASSETS, id);
}

/** The render `logo`: `null` without an image, otherwise every layout value filled with its default. */
function logoRender(logo: PlayerLogo): PresetLogoRender | null {
  if (logo.assetId === null) return null;

  return {
    src: LOGO_ASSETS[logo.assetId],
    position: logo.position ?? LOGO_DEFAULTS.position,
    margin: logo.margin ?? LOGO_DEFAULTS.margin,
    width: logo.width ?? LOGO_DEFAULTS.width,
    opacity: logo.opacity ?? LOGO_DEFAULTS.opacity,
    href: logo.href,
    alt: logo.alt,
    hideDuringAds: logo.hideDuringAds ?? LOGO_DEFAULTS.hideDuringAds,
    hideWithControls: logo.hideWithControls ?? LOGO_DEFAULTS.hideWithControls,
  };
}

/** The render `lms`: only for an enabled group, every value filled with its default. */
function lmsRender(lms: PlayerLms): PresetLmsRender | null {
  if (lms.enabled !== true) return null;

  return {
    resume: lms.resume ?? 'ask',
    seekLimit: lms.seekLimit ?? 'free',
    maxRate: lms.maxRate ?? 2,
    completion: lms.completion ?? 90,
    tabs: {
      chapters: lms.tabs.chapters ?? true,
      materials: lms.tabs.materials ?? true,
      transcript: lms.tabs.transcript ?? true,
      notes: lms.tabs.notes ?? true,
    },
    bookmarks: lms.bookmarks ?? true,
    ads: lms.ads ?? 'off',
  };
}

/**
 * Build the public `player-preset` response (schema v2 section 3) for a validated preset, matching the PHP render.
 * Empty values are filled with the built-in defaults; `language` stays `null` because the page decides it.
 */
export function presetRender(preset: PlayerPreset, revision = 0): PlayerPresetRender {
  const { playback, display, input, controls, ads } = preset;
  const base = {
    id: preset.id,
    revision,
    playerType: preset.playerType,
    language: preset.language,
    playback: {
      autoplay: playback.autoplay ?? false,
      muted: playback.muted ?? false,
      loop: playback.loop ?? false,
      preload: playback.preload ?? 'metadata',
    },
  };
  const progress = {
    sequence: ads.progress.sequence ?? true,
    timer: ads.progress.timer ?? true,
    bar: ads.progress.bar ?? false,
  };
  const labels: Mutable<PresetLabels> = {};

  for (const key of AD_LABEL_KEYS) {
    const label = ads.labels[key];

    if (label !== null) labels[key] = label;
  }

  const css = presetCss(preset);

  if (preset.playerType === 'videojs') {
    const attributes: AttributesDraft = { lang: 'ko' };

    for (const key of labelAttributeKeys) {
      const label = labels[key];

      if (label !== undefined) attributes[labelAttributes[key]] = label;
    }

    const lms = lmsRender(preset.lms);
    const render = {
      ...base,
      playerType: 'videojs',
      display: { poster: display.poster ?? true, title: display.title ?? true },
      input: { hotkeys: input.hotkeys ?? true, gestures: input.gestures ?? true },
      controls: {
        captions: controls.captions ?? true,
        quality: controls.quality ?? true,
        audioTrack: controls.audioTrack ?? true,
        playbackRate: controls.playbackRate ?? true,
        pip: controls.pip ?? true,
        fullscreen: controls.fullscreen ?? true,
        thumbnails: controls.thumbnails ?? true,
        seekButtons: controls.seekButtons,
        seekPlacement: controls.seekPlacement ?? 'bar',
      },
      logo: logoRender(preset.logo),
      progress,
      labels,
      skinTag: 'video-skin',
      styles: { css: 'video.css', js: 'video.js' },
      css,
      attributes,
    } satisfies VideojsPresetRender;

    return lms ? { ...render, lms } : render;
  }

  const ui: PresetControllerUI = Object.keys(labels).length ? { locale: 'ko', labels } : { locale: 'ko' };

  const timeouts: Mutable<PresetTimeouts> = {};

  if (ads.timeouts.loadSeconds !== null) timeouts.loadSeconds = ads.timeouts.loadSeconds;

  if (ads.timeouts.stallSeconds !== null) timeouts.stallSeconds = ads.timeouts.stallSeconds;

  const render = {
    ...base,
    playerType: 'native',
    display: { poster: display.poster ?? true },
    progress,
    labels,
    skinTag: null,
    styles: null,
    css,
    ui,
  } satisfies NativePresetRender;

  return Object.keys(timeouts).length ? { ...render, timeouts } : render;
}
