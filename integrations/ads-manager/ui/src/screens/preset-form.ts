import { ApiError } from '../api/client';
import type { PresetEntry } from '../api/presets';
import { ALPHA_COLOR_FORMAT_ERROR } from '../components';
import {
  AD_LABEL_KEYS,
  DEFAULT_PLAYER_PRESET,
  parsePlayerPreset,
  type PlayerAdsLabels,
  type PlayerAdsProgress,
  type PlayerControls,
  type LogoAssetId,
  type LogoPosition,
  type PlayerInput,
  type PlayerPreset,
  type PresetError,
} from '../player';

/** A switch the editor shows: `''` is the built-in default, so turning a switch back to it saves `null`. */
export type FormFlag = '' | 'true' | 'false';

export type FormLanguage = '' | 'ko' | 'en' | 'ja' | 'zh-CN';

/** `''` is `metadata`, the built-in default. */
export type FormPreload = '' | 'none' | 'auto';

/** `''` hides the seek buttons (`null`). */
export type FormSeekButtons = '' | '5' | '10' | '15' | '30';

/** `''` is `bar`, the built-in default. */
export type FormSeekPlacement = '' | 'center' | 'both';

/** `''` is `2`, the built-in default. */
export type FormMaxRate = '' | '1' | '1.2' | '1.5' | '1.7';

/** `''` is `top-right`, the built-in default. */
export type FormLogoPosition = '' | Exclude<LogoPosition, 'top-right'>;

type LmsTab = keyof PlayerPreset['lms']['tabs'];

/** The label keys the A2-1 editor shows; the other 13 are kept as saved until their screen arrives (A2-3). */
type ShownLabel = 'skip' | 'skipCountdown' | 'timer';

/**
 * Saved values the editor has no controls for yet (A2-2, A2-3). They go back unchanged on save, so editing a preset
 * never clears them. `controls.seekButtons`, `controls.seekPlacement` and `controls.captions` are edited in the form
 * and replace their copies here.
 */
export interface KeptValues {
  input: PlayerInput;
  controls: PlayerControls;
  labels: Omit<PlayerAdsLabels, ShownLabel>;
  progress: PlayerAdsProgress;
}

/**
 * The preset editor as typed. Text and number inputs keep their raw text; `presetInput` turns it into the schema shape.
 * Values the selected player cannot apply stay in the form (switching back restores them) but are sent as `null`,
 * because the server rejects them (schema v2 2.1, decision 27).
 */
export interface PresetForm {
  id: string | null;
  name: string;
  playerType: 'videojs' | 'native';
  language: FormLanguage;
  theme: {
    accentColor: string;
    accentTextColor: string;
    borderColor: string;
    borderRadius: string;
    fontFamily: '' | 'system';
    objectFit: '' | 'contain' | 'cover';
    scaleUnit: '' | 'root';
  };
  playback: { autoplay: FormFlag; muted: FormFlag; loop: FormFlag; preload: FormPreload };
  display: { poster: FormFlag; title: FormFlag };
  controls: { seekButtons: FormSeekButtons; seekPlacement: FormSeekPlacement; captions: FormFlag };
  /** Number and text fields keep their raw text, like `theme`; `''` is the built-in default. */
  logo: {
    assetId: '' | LogoAssetId;
    position: FormLogoPosition;
    width: string;
    margin: string;
    opacity: string;
    href: string;
    alt: string;
    hideDuringAds: FormFlag;
    hideWithControls: FormFlag;
  };
  ads: {
    skip: string;
    skipCountdown: string;
    timer: string;
    accentColor: string;
    skipRadius: string;
    fontSize: string;
    loadSeconds: string;
    stallSeconds: string;
  };
  /** `lms.tabs.*` is flat here, like `ads.labels.*`. Choice values equal to the built-in default are `''`. */
  lms: {
    enabled: FormFlag;
    resume: '' | 'auto' | 'off';
    seekLimit: '' | 'watched';
    maxRate: FormMaxRate;
    completion: string;
    chapters: FormFlag;
    materials: FormFlag;
    transcript: FormFlag;
    notes: FormFlag;
    bookmarks: FormFlag;
    ads: '' | 'preroll';
  };
  kept: KeptValues;
}

/** Form paths, which are also the schema paths the API reports in `fields`. */
export type PresetPath =
  | 'name'
  | 'playerType'
  | 'language'
  | `theme.${keyof PresetForm['theme']}`
  | `playback.${keyof PresetForm['playback']}`
  | `display.${keyof PresetForm['display']}`
  | `controls.${keyof PresetForm['controls']}`
  | `logo.${keyof PresetForm['logo']}`
  | `ads.labels.${ShownLabel}`
  | 'ads.accentColor'
  | 'ads.skipRadius'
  | 'ads.fontSize'
  | `ads.timeouts.${'loadSeconds' | 'stallSeconds'}`
  | `lms.${'enabled' | 'resume' | 'seekLimit' | 'maxRate' | 'completion' | 'bookmarks' | 'ads'}`
  | `lms.tabs.${LmsTab}`;

/** Editor labels; the option reference shows the same names in its preset column. */
export const PRESET_FIELD_LABELS = {
  name: '이름',
  playerType: '플레이어 종류',
  language: '플레이어 화면 언어',
  'theme.accentColor': '강조색',
  'theme.accentTextColor': '강조 글자색',
  'theme.borderColor': '테두리 색',
  'theme.borderRadius': '모서리 둥글기 (px)',
  'theme.fontFamily': '글꼴',
  'theme.objectFit': '화면 채우기',
  'theme.scaleUnit': '크기 기준',
  'playback.autoplay': '자동 재생',
  'playback.muted': '음소거로 시작',
  'playback.loop': '반복 재생',
  'playback.preload': '미리 불러오기',
  'display.poster': '포스터 표시',
  'display.title': '제목 표시',
  'controls.seekButtons': '이전·이후 버튼',
  'controls.seekPlacement': '이전·이후 버튼 위치',
  'controls.captions': '자막',
  'logo.assetId': '로고 이미지',
  'logo.position': '로고 위치',
  'logo.width': '로고 폭 (px)',
  'logo.margin': '로고 여백 (px)',
  'logo.opacity': '로고 불투명도 (%)',
  'logo.href': '로고 링크 주소',
  'logo.alt': '로고 대체 텍스트',
  'logo.hideDuringAds': '광고 중 로고 숨기기',
  'logo.hideWithControls': '컨트롤과 함께 로고 숨기기',
  'ads.labels.skip': '건너뛰기 문구',
  'ads.labels.skipCountdown': '건너뛰기 대기 문구',
  'ads.labels.timer': '광고 시간 문구',
  'ads.accentColor': '광고 강조색',
  'ads.skipRadius': '건너뛰기 버튼 모서리 (px)',
  'ads.fontSize': '광고 글자 크기 (px)',
  'ads.timeouts.loadSeconds': '광고 로드 시간 제한 (초)',
  'ads.timeouts.stallSeconds': '광고 멈춤 시간 제한 (초)',
  'lms.enabled': '강의 기능 사용',
  'lms.resume': '이어보기',
  'lms.seekLimit': '앞으로 건너뛰기',
  'lms.maxRate': '최대 배속',
  'lms.completion': '완료 기준 (%)',
  'lms.tabs.chapters': '목차',
  'lms.tabs.materials': '자료',
  'lms.tabs.transcript': '스크립트',
  'lms.tabs.notes': '메모',
  'lms.bookmarks': '북마크 버튼',
  'lms.ads': '광고',
} satisfies Record<PresetPath, string>;

const COLOR_RULE = '#rrggbb 형식의 소문자 색으로 입력해 주세요. 예: #1a73e8';
const SWITCH_RULE = '켜기나 끄기를 다시 골라 주세요.';
const LABEL_RULE = '40자 이내로 입력해 주세요. 줄바꿈 같은 제어 문자는 쓸 수 없어요.';

/** What each field accepts, shown when a value is rejected locally or by the API. */
const FIELD_RULES = {
  name: '1–40자로 입력해 주세요. 줄바꿈 같은 제어 문자는 쓸 수 없어요.',
  playerType: '플레이어 종류를 골라 주세요.',
  language: '언어를 다시 골라 주세요.',
  'theme.accentColor': COLOR_RULE,
  'theme.accentTextColor': COLOR_RULE,
  'theme.borderColor': ALPHA_COLOR_FORMAT_ERROR,
  'theme.borderRadius': '0–32 사이의 정수로 입력해 주세요.',
  'theme.fontFamily': '글꼴을 다시 골라 주세요.',
  'theme.objectFit': '화면 채우기를 다시 골라 주세요.',
  'theme.scaleUnit': '크기 기준을 다시 골라 주세요.',
  'playback.autoplay': SWITCH_RULE,
  'playback.muted': '자동 재생을 켜면 음소거로 시작해야 해요.',
  'playback.loop': SWITCH_RULE,
  'playback.preload': '미리 불러오기를 다시 골라 주세요.',
  'display.poster': SWITCH_RULE,
  'display.title': SWITCH_RULE,
  'controls.seekButtons': '건너뛰는 폭을 다시 골라 주세요.',
  'controls.seekPlacement': '컨트롤 막대와 화면 가운데 중 한 곳 이상을 골라 주세요.',
  'controls.captions': SWITCH_RULE,
  'logo.assetId': '로고 이미지를 다시 골라 주세요. 지금은 샘플 로고만 쓸 수 있어요.',
  'logo.position': '로고 위치를 다시 골라 주세요.',
  'logo.width': '24–240 사이의 정수로 입력해 주세요.',
  'logo.margin': '0–48 사이의 정수로 입력해 주세요.',
  'logo.opacity': '10–100 사이의 정수로 입력해 주세요.',
  'logo.href': 'http:// 또는 https://로 시작하는 2048자 이내 주소로 입력해 주세요. 빈칸은 쓸 수 없어요.',
  'logo.alt': '80자 이내로 입력해 주세요. 링크 주소를 넣으면 꼭 써야 해요.',
  'logo.hideDuringAds': SWITCH_RULE,
  'logo.hideWithControls': SWITCH_RULE,
  'ads.labels.skip': `${LABEL_RULE} { } 문자도 쓸 수 없어요.`,
  'ads.labels.skipCountdown': `${LABEL_RULE} 자리표시자는 {seconds}만 쓸 수 있어요.`,
  'ads.labels.timer': `${LABEL_RULE} 자리표시자는 {elapsed} {duration} {remaining}만 쓸 수 있어요.`,
  'ads.accentColor': COLOR_RULE,
  'ads.skipRadius': '0–24 사이의 정수로 입력해 주세요.',
  'ads.fontSize': '11–18 사이의 정수로 입력해 주세요.',
  'ads.timeouts.loadSeconds': '1–60 사이의 정수로 입력해 주세요.',
  'ads.timeouts.stallSeconds': '1–120 사이의 정수로 입력해 주세요.',
  'lms.enabled': SWITCH_RULE,
  'lms.resume': '이어보기를 다시 골라 주세요.',
  'lms.seekLimit': '앞으로 건너뛰기를 다시 골라 주세요.',
  'lms.maxRate': '최대 배속을 다시 골라 주세요.',
  'lms.completion': '50에서 100 사이 정수로 넣어 주세요.',
  'lms.tabs.chapters': SWITCH_RULE,
  'lms.tabs.materials': SWITCH_RULE,
  'lms.tabs.transcript': SWITCH_RULE,
  'lms.tabs.notes': SWITCH_RULE,
  'lms.bookmarks': SWITCH_RULE,
  'lms.ads': '광고를 다시 골라 주세요.',
} satisfies Record<PresetPath, string>;

export type FieldErrors = Partial<Record<PresetPath, string>>;

export function isPresetPath(path: string): path is PresetPath {
  return Object.hasOwn(PRESET_FIELD_LABELS, path);
}

export interface FieldErrorSummary {
  fields: FieldErrors;
  /** Some error is on a path the form does not show. */
  other: boolean;
}

/** Field messages for local schema errors. Errors on paths the form does not show go to `other`. */
export function fieldErrors(errors: readonly PresetError[]): FieldErrorSummary {
  const fields: FieldErrors = {};
  let other = false;

  for (const error of errors) {
    if (!isPresetPath(error.path)) other = true;
    else if (!fields[error.path]) fields[error.path] = fieldMessage(error.path, error.code);
  }

  return { fields, other };
}

export function fieldMessage(path: PresetPath, code?: PresetError['code']): string {
  if (code === 'required') return path === 'name' ? '이름을 입력해 주세요.' : FIELD_RULES[path];

  if (code === 'player_type') return '선택한 플레이어 종류에서는 쓸 수 없는 값이에요.';

  return FIELD_RULES[path];
}

const text = (value: string | number | null) => (value === null ? '' : String(value));

const pick = <T extends string>(value: string, allowed: readonly T[], fallback: T): T =>
  allowed.find((item) => item === value) ?? fallback;

const SEEK_BUTTONS: readonly FormSeekButtons[] = ['', '5', '10', '15', '30'];
const SEEK_PLACEMENTS: readonly FormSeekPlacement[] = ['', 'center', 'both'];
const MAX_RATES: readonly FormMaxRate[] = ['', '1', '1.2', '1.5', '1.7'];
const LMS_TABS: readonly LmsTab[] = ['chapters', 'materials', 'transcript', 'notes'];
const LOGO_POSITIONS: readonly FormLogoPosition[] = ['', 'top-left', 'bottom-left', 'bottom-right'];

/** A saved switch value; one equal to the built-in default reads as `''`, like the API's `null`. */
const flag = (value: boolean | null, fallback: boolean): FormFlag =>
  value === null || value === fallback ? '' : value ? 'true' : 'false';

/** Built-in switch defaults (schema v2 2.1, the `null` column). */
export const FLAG_DEFAULTS = {
  'playback.autoplay': false,
  'playback.muted': false,
  'playback.loop': false,
  'display.poster': true,
  'display.title': true,
  'controls.captions': true,
  'logo.hideDuringAds': true,
  'logo.hideWithControls': false,
  'lms.enabled': false,
  'lms.tabs.chapters': true,
  'lms.tabs.materials': true,
  'lms.tabs.transcript': true,
  'lms.tabs.notes': true,
  'lms.bookmarks': true,
} as const;

export type FlagPath = keyof typeof FLAG_DEFAULTS;

/** Whether the switch at `path` is on, with `''` meaning its built-in default. */
export function flagOn(form: PresetForm, path: FlagPath): boolean {
  const value = formValue(form, path);

  return value === '' ? FLAG_DEFAULTS[path] : value === 'true';
}

export const BLANK_FORM: PresetForm = formFromPreset({ ...DEFAULT_PLAYER_PRESET, id: null, name: '' });

export function formFromPreset(preset: PlayerPreset): PresetForm {
  const { theme, playback, display, logo, ads, lms } = preset;
  const { skip, skipCountdown, timer, ...labels } = ads.labels;

  return {
    id: preset.id,
    name: preset.name,
    playerType: preset.playerType,
    language: preset.language ?? '',
    theme: {
      accentColor: text(theme.accentColor),
      accentTextColor: text(theme.accentTextColor),
      borderColor: text(theme.borderColor),
      borderRadius: text(theme.borderRadius),
      fontFamily: theme.fontFamily ?? '',
      objectFit: theme.objectFit ?? '',
      scaleUnit: theme.scaleUnit ?? '',
    },
    playback: {
      autoplay: flag(playback.autoplay, false),
      muted: flag(playback.muted, false),
      loop: flag(playback.loop, false),
      preload: playback.preload === 'none' || playback.preload === 'auto' ? playback.preload : '',
    },
    display: { poster: flag(display.poster, true), title: flag(display.title, true) },
    controls: {
      seekButtons: pick(text(preset.controls.seekButtons), SEEK_BUTTONS, ''),
      // `bar` is the built-in default, so it reads as `''` like the API's `null`.
      seekPlacement: pick(preset.controls.seekPlacement ?? '', SEEK_PLACEMENTS, ''),
      captions: flag(preset.controls.captions, true),
    },
    logo: {
      assetId: logo.assetId ?? '',
      position: pick(logo.position ?? '', LOGO_POSITIONS, ''),
      width: text(logo.width),
      margin: text(logo.margin),
      opacity: text(logo.opacity),
      href: logo.href ?? '',
      alt: logo.alt ?? '',
      hideDuringAds: flag(logo.hideDuringAds, true),
      hideWithControls: flag(logo.hideWithControls, false),
    },
    ads: {
      skip: text(skip),
      skipCountdown: text(skipCountdown),
      timer: text(timer),
      accentColor: text(ads.accentColor),
      skipRadius: text(ads.skipRadius),
      fontSize: text(ads.fontSize),
      loadSeconds: text(ads.timeouts.loadSeconds),
      stallSeconds: text(ads.timeouts.stallSeconds),
    },
    lms: {
      enabled: flag(lms.enabled, false),
      resume: lms.resume === 'auto' || lms.resume === 'off' ? lms.resume : '',
      seekLimit: lms.seekLimit === 'watched' ? 'watched' : '',
      maxRate: pick(text(lms.maxRate), MAX_RATES, ''),
      completion: text(lms.completion),
      chapters: flag(lms.tabs.chapters, true),
      materials: flag(lms.tabs.materials, true),
      transcript: flag(lms.tabs.transcript, true),
      notes: flag(lms.tabs.notes, true),
      bookmarks: flag(lms.bookmarks, true),
      ads: lms.ads === 'preroll' ? 'preroll' : '',
    },
    kept: { input: preset.input, controls: preset.controls, labels, progress: ads.progress },
  };
}

const COPY_SUFFIX = ' 복사본';
/** The schema's name limit, in code points. */
const NAME_MAX = 40;

/** A copy for "복제": a new, unsaved preset. A long name is cut so the copy's name still fits the limit. */
export function duplicateForm(entry: PresetEntry): PresetForm {
  const room = NAME_MAX - [...COPY_SUFFIX].length;
  const base = [...entry.preset.name].slice(0, room).join('').trimEnd();

  return { ...formFromPreset(entry.preset), id: null, name: `${base}${COPY_SUFFIX}` };
}

/** A copy of `form` with the control at `path` set to the typed or selected `value`. */
export function updateForm(form: PresetForm, path: PresetPath, value: string): PresetForm {
  const next = structuredClone(form);
  const [group, key, sub] = path.split('.');

  switch (path) {
    case 'name':
      next.name = value;
      break;
    case 'playerType':
      next.playerType = pick(value, ['videojs', 'native'], 'videojs');
      break;
    case 'language':
      next.language = pick(value, ['', 'ko', 'en', 'ja', 'zh-CN'], '');
      break;
    case 'playback.preload':
      next.playback.preload = pick(value, ['', 'none', 'auto'], '');
      break;
    case 'playback.autoplay':
    case 'playback.muted':
    case 'playback.loop':
      next.playback[pick(key ?? '', ['autoplay', 'muted', 'loop'], 'autoplay')] = switchValue(path, value);
      break;
    case 'display.poster':
    case 'display.title':
      next.display[pick(key ?? '', ['poster', 'title'], 'poster')] = switchValue(path, value);
      break;
    case 'controls.seekButtons':
      next.controls.seekButtons = pick(value, SEEK_BUTTONS, '');
      break;
    case 'controls.seekPlacement':
      next.controls.seekPlacement = pick(value, SEEK_PLACEMENTS, '');
      break;
    case 'controls.captions':
      next.controls.captions = switchValue(path, value);
      break;
    case 'theme.fontFamily':
      next.theme.fontFamily = pick(value, ['', 'system'], '');
      break;
    case 'theme.objectFit':
      next.theme.objectFit = pick(value, ['', 'contain', 'cover'], '');
      break;
    case 'theme.scaleUnit':
      next.theme.scaleUnit = pick(value, ['', 'root'], '');
      break;
    case 'logo.assetId':
      next.logo.assetId = pick(value, ['', 'sample'], '');
      break;
    case 'logo.position':
      // `top-right` is the built-in default, so it is stored as `''` like the other choices.
      next.logo.position = pick(value, LOGO_POSITIONS, '');
      break;
    case 'logo.hideDuringAds':
    case 'logo.hideWithControls':
      next.logo[pick(key ?? '', ['hideDuringAds', 'hideWithControls'], 'hideDuringAds')] = switchValue(path, value);
      break;
    case 'logo.width':
    case 'logo.margin':
    case 'logo.opacity':
    case 'logo.href':
    case 'logo.alt':
      next.logo[pick(key ?? '', ['width', 'margin', 'opacity', 'href', 'alt'], 'width')] = value;
      break;
    case 'lms.enabled':
    case 'lms.bookmarks':
      next.lms[pick(key ?? '', ['enabled', 'bookmarks'], 'enabled')] = switchValue(path, value);
      break;
    case 'lms.tabs.chapters':
    case 'lms.tabs.materials':
    case 'lms.tabs.transcript':
    case 'lms.tabs.notes':
      next.lms[pick(sub ?? '', LMS_TABS, 'chapters')] = switchValue(path, value);
      break;
    case 'lms.resume':
      next.lms.resume = pick(value, ['', 'auto', 'off'], '');
      break;
    case 'lms.seekLimit':
      next.lms.seekLimit = pick(value, ['', 'watched'], '');
      break;
    case 'lms.maxRate':
      next.lms.maxRate = pick(value, MAX_RATES, '');
      break;
    case 'lms.completion':
      next.lms.completion = value;
      break;
    case 'lms.ads':
      next.lms.ads = pick(value, ['', 'preroll'], '');
      break;
    case 'theme.accentColor':
    case 'theme.accentTextColor':
    case 'theme.borderColor':
    case 'theme.borderRadius':
      next.theme[pick(key ?? '', ['accentColor', 'accentTextColor', 'borderColor', 'borderRadius'], 'accentColor')] =
        value;
      break;
    default:
      // `ads.labels.*` and `ads.timeouts.*` are flat in the form; the last segment names the control.
      next.ads[
        pick(
          group === 'ads' && sub ? sub : (key ?? ''),
          ['skip', 'skipCountdown', 'timer', 'accentColor', 'skipRadius', 'fontSize', 'loadSeconds', 'stallSeconds'],
          'skip'
        )
      ] = value;
  }

  return next;
}

/** `'true'`, `'false'` or `''`, with the built-in default stored as `''` so it saves as `null`. */
function switchValue(path: FlagPath, value: string): FormFlag {
  const on = pick(value, ['', 'true', 'false'], '');

  return on === '' || (on === 'true') === FLAG_DEFAULTS[path] ? '' : on;
}

const PRESET_PATHS = Object.keys(PRESET_FIELD_LABELS).filter(isPresetPath);

/** A field this draft and a save elsewhere both changed, to different values. */
export interface FormConflict {
  path: PresetPath;
  mine: string;
  theirs: string;
}

export interface RebasedForm {
  form: PresetForm;
  /** Fields only the other save changed; the form now holds their values. */
  adopted: PresetPath[];
  /** The form keeps `mine` for these until the operator picks a side. */
  conflicts: FormConflict[];
}

/**
 * Moves a draft started from `base` onto the server's current form, so a save never quietly reverts a change made
 * elsewhere: fields only the server changed take its value, and fields both sides changed differently are conflicts.
 */
export function rebaseForm(mine: PresetForm, base: PresetForm, server: PresetForm): RebasedForm {
  // The editor has no controls for these yet, so the saved values always win.
  let form: PresetForm = { ...mine, kept: server.kept };
  const adopted: PresetPath[] = [];
  const conflicts: FormConflict[] = [];

  for (const path of PRESET_PATHS) {
    const ours = formValue(mine, path);
    const before = formValue(base, path);
    const theirs = formValue(server, path);
    if (theirs === before || theirs === ours) continue;

    if (ours === before) {
      form = updateForm(form, path, theirs);
      adopted.push(path);
    } else {
      conflicts.push({ path, mine: ours, theirs });
    }
  }

  return { form, adopted, conflicts };
}

/** The text a control shows for `path`. */
export function formValue(form: PresetForm, path: PresetPath): string {
  const [group, key, sub] = path.split('.');

  if (path === 'name') return form.name;

  if (path === 'playerType') return form.playerType;

  if (path === 'language') return form.language;

  const name = sub ?? key ?? '';
  const find = (values: Readonly<Record<string, string>>) =>
    Object.entries(values).find(([field]) => field === name)?.[1] ?? '';

  if (group === 'theme') return find(form.theme);

  if (group === 'playback') return find(form.playback);

  if (group === 'display') return find(form.display);

  if (group === 'controls') return find(form.controls);

  if (group === 'logo') return find(form.logo);

  if (group === 'lms') return find(form.lms);

  return find(form.ads);
}

/** Empty text is `null`; anything else is a number, `NaN` included, so the schema reports it. */
function integer(value: string): number | null {
  return value.trim() === '' ? null : Number(value);
}

/** Text that has only spaces is empty, like the API's `''`. */
function optional(value: string): string | null {
  return value.trim() === '' ? null : value.trim();
}

/** Switch text as the schema bool; `''` is `null`, the built-in default. */
function bool(value: FormFlag): boolean | null {
  return value === '' ? null : value === 'true';
}

/** The schema input for `parsePlayerPreset` and the save request: the full v2 shape in contract 2.1 order. */
export function presetInput(form: PresetForm) {
  const native = form.playerType === 'native';
  const { theme, playback, display, logo, ads, lms, kept } = form;
  const labels: PlayerAdsLabels = {
    ...kept.labels,
    skip: optional(ads.skip),
    skipCountdown: optional(ads.skipCountdown),
    timer: optional(ads.timer),
  };
  // Native video saves the Video.js-only groups as all `null` (decision 27); the form still keeps them.
  const empty = DEFAULT_PLAYER_PRESET;

  return {
    id: form.id,
    name: form.name,
    playerType: form.playerType,
    language: form.language || null,
    theme: {
      accentColor: native ? null : optional(theme.accentColor),
      accentTextColor: native ? null : optional(theme.accentTextColor),
      borderColor: native ? null : optional(theme.borderColor),
      borderRadius: native ? null : integer(theme.borderRadius),
      fontFamily: native ? null : theme.fontFamily || null,
      objectFit: native ? null : theme.objectFit || null,
      scaleUnit: native ? null : theme.scaleUnit || null,
    },
    playback: {
      autoplay: bool(playback.autoplay),
      muted: bool(playback.muted),
      loop: bool(playback.loop),
      preload: playback.preload || null,
    },
    display: { poster: bool(display.poster), title: native ? null : bool(display.title) },
    input: native ? empty.input : kept.input,
    controls: native
      ? empty.controls
      : {
          ...kept.controls,
          captions: bool(form.controls.captions),
          seekButtons: form.controls.seekButtons ? Number(form.controls.seekButtons) : null,
          seekPlacement: form.controls.seekPlacement || null,
        },
    logo: native
      ? empty.logo
      : {
          assetId: logo.assetId || null,
          position: logo.position || null,
          margin: integer(logo.margin),
          width: integer(logo.width),
          opacity: integer(logo.opacity),
          href: optional(logo.href),
          alt: optional(logo.alt),
          hideDuringAds: bool(logo.hideDuringAds),
          hideWithControls: bool(logo.hideWithControls),
        },
    ads: {
      labels: Object.fromEntries(AD_LABEL_KEYS.map((key) => [key, labels[key]])),
      accentColor: optional(ads.accentColor),
      skipRadius: integer(ads.skipRadius),
      fontSize: integer(ads.fontSize),
      progress: kept.progress,
      timeouts: {
        loadSeconds: native ? integer(ads.loadSeconds) : null,
        stallSeconds: native ? integer(ads.stallSeconds) : null,
      },
    },
    lms: native
      ? empty.lms
      : {
          enabled: bool(lms.enabled),
          resume: lms.resume || null,
          seekLimit: lms.seekLimit || null,
          maxRate: lms.maxRate ? Number(lms.maxRate) : null,
          completion: integer(lms.completion),
          tabs: {
            chapters: bool(lms.chapters),
            materials: bool(lms.materials),
            transcript: bool(lms.transcript),
            notes: bool(lms.notes),
          },
          bookmarks: bool(lms.bookmarks),
          ads: lms.ads || null,
        },
  };
}

/**
 * The preset the live preview may show: the form when it passes the schema. A blank name does not block the preview,
 * since it never reaches the player.
 */
export function previewPreset(form: PresetForm): PlayerPreset | null {
  const result = parsePlayerPreset({ ...presetInput(form), name: form.name.trim() || '미리보기' });

  return result.ok ? result.preset : null;
}

/** The "테두리 없음" border color: see-through, so no line is drawn (spec A2-E 1.3). */
export const NO_BORDER_COLOR = '#00000000';

/** A border color whose alpha is `00` draws no line; the editor opens it with "테두리 없음" on. */
export function drawsNoBorder(value: string): boolean {
  return /^#[0-9a-f]{6}00$/u.test(value.trim().toLowerCase());
}

type ThemeLook = Pick<PresetForm['theme'], 'accentColor' | 'accentTextColor' | 'borderColor' | 'borderRadius'>;

export interface ThemeChoice extends ThemeLook {
  id: string;
  label: string;
  /** What sets it apart, under the name on its card. */
  note: string;
}

/**
 * The editor's theme cards: the four built-in looks (fixture `builtIn`) and two more. A card fills these four theme
 * values; the font, fit and scale stay as they are.
 */
export const THEME_CHOICES: readonly ThemeChoice[] = [
  {
    id: 'default',
    label: '기본',
    note: '스킨 기본값',
    accentColor: '',
    accentTextColor: '',
    borderColor: '',
    borderRadius: '',
  },
  {
    id: 'flat',
    label: '플랫',
    note: '테두리·모서리 없음',
    accentColor: '',
    accentTextColor: '',
    borderColor: NO_BORDER_COLOR,
    borderRadius: '0',
  },
  {
    id: 'rounded',
    label: '둥근 테두리',
    note: '모서리 12px',
    accentColor: '',
    accentTextColor: '',
    borderColor: '',
    borderRadius: '12',
  },
  {
    id: 'accent',
    label: '강조색',
    note: '파란 강조',
    accentColor: '#2563eb',
    accentTextColor: '#ffffff',
    borderColor: '',
    borderRadius: '',
  },
  {
    id: 'dark',
    label: '다크',
    note: '회색 강조·진한 테두리',
    accentColor: '#d4d4d8',
    accentTextColor: '#18181a',
    borderColor: '#18181a',
    borderRadius: '8',
  },
  {
    id: 'warm',
    label: '따뜻한 색',
    note: '주황 강조·둥근 모서리',
    accentColor: '#f97316',
    accentTextColor: '#18181a',
    borderColor: '',
    borderRadius: '16',
  },
];

export const THEME_FIELDS = ['accentColor', 'accentTextColor', 'borderColor', 'borderRadius'] as const;

/** The card whose four values the form holds, or `undefined` for values set by hand ("직접 조정"). */
export function themeChoiceOf(form: PresetForm): ThemeChoice | undefined {
  return THEME_CHOICES.find((choice) =>
    THEME_FIELDS.every((key) => choice[key] === form.theme[key].trim().toLowerCase())
  );
}

/** WCAG 2 contrast ratio of two `#rrggbb` colors. */
export function contrastRatio(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];

  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

function luminance(color: string): number {
  const channel = (offset: number) => {
    const value = Number.parseInt(color.slice(offset, offset + 2), 16) / 255;

    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

const COLOR = /^#[0-9a-f]{6}$/;
const SKIN_ACCENT = '#ffffff';
// `contrast-color()` fallback in browsers without it (Chrome 147, Firefox 146, Safari 26 and older).
const FALLBACK_TEXT = '#000000';

/**
 * Contract 4.1: warn (never block) when accent and accent text colors are below 4.5:1. An empty accent text color is
 * compared with black, the fallback where `contrast-color()` is missing; an empty accent color is the skin's white.
 */
export function contrastWarning(form: PresetForm): string | undefined {
  if (form.playerType === 'native') return undefined;

  const accent = form.theme.accentColor.trim();
  const accentText = form.theme.accentTextColor.trim();

  if ((accent && !COLOR.test(accent)) || (accentText && !COLOR.test(accentText)) || (!accent && !accentText)) {
    return undefined;
  }

  const ratio = contrastRatio(accent || SKIN_ACCENT, accentText || FALLBACK_TEXT);
  if (ratio >= 4.5) return undefined;

  const shown = `${Math.floor(ratio * 10) / 10}:1`;

  return accentText
    ? `강조색과 강조 글자색의 대비가 ${shown}이라 글자가 잘 안 보일 수 있어요. 4.5:1 이상을 권해요. 저장은 할 수 있어요.`
    : `강조 글자색이 비어 있으면 일부 브라우저는 검정 글자를 써요. 검정과의 대비가 ${shown}이에요. 강조 글자색도 지정해 주세요.`;
}

export const PRESET_CONFLICT_TEXT =
  '다른 곳에서 먼저 바뀌었어요. 입력은 그대로 두었어요. 다시 불러온 뒤 저장해 주세요.';

/** The list page has no input to keep, so its 409 text says only what to do next. */
export const PRESET_LIST_CONFLICT_TEXT =
  '다른 곳에서 프리셋 목록이 먼저 바뀌었어요. 목록을 다시 불러온 뒤 다시 해 주세요.';

/** A 404 or 400 for a preset id: the list on screen is out of date, so the screen offers to reload it. */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- receives whatever a failed request threw.
export function needsListReload(error: unknown): boolean {
  return error instanceof ApiError && (error.code === 'preset_not_found' || error.code === 'invalid_preset_id');
}

export interface PresetErrorResult {
  /** What to throw so the status line shows it. */
  error: unknown;
  fields: FieldErrors;
}

/**
 * Rewrites preset API errors as 해요체 screen text. A 422 keeps its field paths so the editor can mark the field; the
 * field messages themselves come from `FIELD_RULES`, not the server.
 */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- receives whatever a failed request threw.
export function presetError(error: unknown): PresetErrorResult {
  if (!(error instanceof ApiError)) return { error, fields: {} };

  const rewrite = (message: string) => new ApiError(message, error.status, error.code);

  switch (error.code) {
    case 'validation': {
      const fields: FieldErrors = {};

      for (const path of Object.keys(error.fields)) if (isPresetPath(path)) fields[path] = fieldMessage(path);

      return { error: rewrite('저장하지 못했어요. 표시한 항목을 확인해 주세요.'), fields };
    }
    case 'preset_limit':
      return {
        error: rewrite('저장 프리셋은 20개까지예요. 쓰지 않는 프리셋을 지운 뒤 다시 저장해 주세요.'),
        fields: {},
      };
    case 'preset_builtin':
      return { error: rewrite('내장 프리셋은 바꿀 수 없어요. 복제해서 쓰세요.'), fields: {} };
    case 'preset_not_found':
      return {
        error: rewrite('프리셋을 찾지 못했어요. 다른 곳에서 지웠을 수 있어요. 목록을 다시 불러와 주세요.'),
        fields: {},
      };
    case 'invalid_preset_id':
      return { error: rewrite('프리셋 ID가 올바르지 않아요. 목록을 다시 불러와 주세요.'), fields: {} };
    default:
      return { error, fields: {} };
  }
}
