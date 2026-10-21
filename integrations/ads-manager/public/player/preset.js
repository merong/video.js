/**
 * Player preset schema v2 (`.agents/plans/ads-player-schema-v2.md`) for the loader, the examples and the admin theme
 * preview. It follows `ui/src/player/preset.ts` and `src/PlayerPresets.php`: unknown keys and out-of-range values are
 * rejected, never corrected, and only the property and attribute names in the tables below are ever written.
 */

/** CSS custom properties a preset may set, in contract order. */
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
];

/** `<media-ads>` attributes a Video.js preset may set. */
export const MEDIA_ADS_ATTRIBUTES = ['lang', 'skip-label', 'skip-countdown-label', 'timer-label'];

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
];

/** Player screen languages; ads always use Korean. */
export const PLAYER_LANGUAGES = ['ko', 'en', 'ja', 'zh-CN'];

const builtInIds = ['default', 'flat', 'rounded', 'accent', 'lms'];
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
];
const themeKeys = [
  'accentColor',
  'accentTextColor',
  'borderColor',
  'borderRadius',
  'fontFamily',
  'objectFit',
  'scaleUnit',
];
const inputKeys = ['hotkeys', 'gestures'];
const controlKeys = [
  'captions',
  'quality',
  'audioTrack',
  'playbackRate',
  'pip',
  'fullscreen',
  'thumbnails',
  'seekButtons',
];
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
];
const lmsKeys = ['enabled', 'resume', 'seekLimit', 'maxRate', 'completion', 'tabs', 'bookmarks', 'ads'];
const lmsTabKeys = ['chapters', 'materials', 'transcript', 'notes'];
// `DEFAULT_RATES` values a lecture may cap playback at (ads-lms-spec 1.1).
const lmsRates = [1, 1.2, 1.5, 1.7, 2];
// The three labels v1 already carried as `<media-ads>` attributes.
const labelAttributes = { skip: 'skip-label', skipCountdown: 'skip-countdown-label', timer: 'timer-label' };
const labelPlaceholders = {
  sequence: ['{index}', '{count}'],
  skipCountdown: ['{seconds}'],
  timer: ['{elapsed}', '{duration}', '{remaining}'],
};
const readOnlyKeys = ['builtIn', 'createdAt', 'updatedAt'];
// C0/C1 controls plus bidirectional embeddings, overrides and isolates, which could reverse an ad button's text.
// oxlint-disable-next-line no-control-regex
const controlPattern = /[\u0000-\u001f\u007f-\u009f‪-‮⁦-⁩]/u;
const colorPattern = /^#[0-9a-f]{6}$/;
// Only the border color may carry alpha (schema v2 section 5).
const alphaColorPattern = /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/;
const idPattern = /^p-[a-z0-9]{10}$/;
const hrefPattern = /^https?:\/\/[^/?#]+/;

export const isGroup = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const has = (fields, key) => Object.hasOwn(fields, key) && fields[key] !== null && fields[key] !== undefined;
const lastKey = (path) => path.slice(path.lastIndexOf('.') + 1);

/** Mirrors `PresetReader` in `preset.ts`: `''` is empty for text fields, integers must be integers. */
function createReader() {
  const errors = [];
  const fail = (path, code) => {
    errors.push({ path, code });
    return null;
  };
  const failed = (path) => errors.some((error) => error.path === path);
  const known = (fields, prefix, keys) => {
    for (const key of Object.keys(fields)) if (!keys.includes(key)) fail(`${prefix}${key}`, 'unknown_key');
  };
  const text = (fields, path) => {
    const key = lastKey(path);
    if (!has(fields, key)) return null;

    if (typeof fields[key] !== 'string') return fail(path, 'type');

    return fields[key] || null;
  };
  const whole = (fields, path) => {
    const key = lastKey(path);
    if (!has(fields, key)) return undefined;

    return Number.isInteger(fields[key]) ? fields[key] : fail(path, 'type');
  };

  return {
    errors,
    fail,
    failed,
    known,
    text,
    group(fields, path, keys) {
      const key = lastKey(path);
      if (!has(fields, key)) return {};

      if (!isGroup(fields[key])) {
        fail(path, 'type');
        return {};
      }

      known(fields[key], `${path}.`, keys);
      return fields[key];
    },
    color(fields, path, pattern = colorPattern) {
      const value = text(fields, path);
      if (value === null) return null;

      return pattern.test(value) ? value : fail(path, 'format');
    },
    choice(fields, path, allowed) {
      const value = text(fields, path);
      if (value === null) return null;

      return allowed.includes(value) ? value : fail(path, 'enum');
    },
    integer(fields, path, min, max) {
      const value = whole(fields, path);
      if (value === undefined || value === null) return null;

      return value >= min && value <= max ? value : fail(path, 'range');
    },
    step(fields, path, allowed) {
      const value = whole(fields, path);
      if (value === undefined || value === null) return null;

      return allowed.includes(value) ? value : fail(path, 'enum');
    },
    /** A number from `allowed`, which may hold fractions; `''` is a type error like any integer field. */
    rate(fields, path, allowed) {
      const key = lastKey(path);
      if (!has(fields, key)) return null;

      if (typeof fields[key] !== 'number') return fail(path, 'type');

      return allowed.includes(fields[key]) ? fields[key] : fail(path, 'enum');
    },
    bool(fields, path) {
      const key = lastKey(path);
      if (!has(fields, key) || fields[key] === '') return null;

      return typeof fields[key] === 'boolean' ? fields[key] : fail(path, 'type');
    },
    label(fields, path, placeholders, max = 40) {
      const key = lastKey(path);
      if (!has(fields, key)) return null;

      if (typeof fields[key] !== 'string') return fail(path, 'type');

      if (controlPattern.test(fields[key])) return fail(path, 'control');

      const value = fields[key].trim();
      if ([...value].length > max) return fail(path, 'length');

      const rest = placeholders?.reduce((label, token) => label.replaceAll(token, ''), value);
      if (rest !== undefined && /[{}]/.test(rest)) return fail(path, 'placeholder');

      return value || null;
    },
    href(fields, path) {
      const value = text(fields, path);
      if (value === null) return null;

      if (controlPattern.test(value)) return fail(path, 'control');

      if ([...value].length > 2048) return fail(path, 'length');

      return hrefPattern.test(value) && !/\s/u.test(value) ? value : fail(path, 'format');
    },
  };
}

/** Validate untrusted preset input, returning `{ ok, preset }` or `{ ok: false, errors }` with every failing path. */
export function parsePlayerPreset(value) {
  if (!isGroup(value)) return { ok: false, errors: [{ path: '', code: 'type' }] };

  const read = createReader();

  read.known(value, '', [...topKeys, ...readOnlyKeys]);

  let id = null;

  // Unlike other text fields, `''` is not an empty id.
  if (typeof value.id === 'string' && (builtInIds.includes(value.id) || idPattern.test(value.id))) id = value.id;
  else if (has(value, 'id')) read.fail('id', typeof value.id === 'string' ? 'format' : 'type');

  const name = read.label(value, 'name', null);

  if (name === null && !read.failed('name')) read.fail('name', 'required');

  const playerType = read.choice(value, 'playerType', ['videojs', 'native']);

  if (playerType === null && !read.failed('playerType')) read.fail('playerType', 'required');

  const language = read.choice(value, 'language', PLAYER_LANGUAGES);
  const themeInput = read.group(value, 'theme', themeKeys);
  const theme = {
    accentColor: read.color(themeInput, 'theme.accentColor'),
    accentTextColor: read.color(themeInput, 'theme.accentTextColor'),
    borderColor: read.color(themeInput, 'theme.borderColor', alphaColorPattern),
    borderRadius: read.integer(themeInput, 'theme.borderRadius', 0, 32),
    fontFamily: read.choice(themeInput, 'theme.fontFamily', ['system']),
    objectFit: read.choice(themeInput, 'theme.objectFit', ['contain', 'cover']),
    scaleUnit: read.choice(themeInput, 'theme.scaleUnit', ['root']),
  };
  const playbackInput = read.group(value, 'playback', ['autoplay', 'muted', 'loop', 'preload']);
  const playback = {
    autoplay: read.bool(playbackInput, 'playback.autoplay'),
    muted: read.bool(playbackInput, 'playback.muted'),
    loop: read.bool(playbackInput, 'playback.loop'),
    preload: read.choice(playbackInput, 'playback.preload', ['none', 'metadata', 'auto']),
  };
  const displayInput = read.group(value, 'display', ['poster', 'title']);
  const display = {
    poster: read.bool(displayInput, 'display.poster'),
    title: read.bool(displayInput, 'display.title'),
  };
  const inputInput = read.group(value, 'input', inputKeys);
  const input = {
    hotkeys: read.bool(inputInput, 'input.hotkeys'),
    gestures: read.bool(inputInput, 'input.gestures'),
  };
  const controlsInput = read.group(value, 'controls', controlKeys);
  const controls = {
    captions: read.bool(controlsInput, 'controls.captions'),
    quality: read.bool(controlsInput, 'controls.quality'),
    audioTrack: read.bool(controlsInput, 'controls.audioTrack'),
    playbackRate: read.bool(controlsInput, 'controls.playbackRate'),
    pip: read.bool(controlsInput, 'controls.pip'),
    fullscreen: read.bool(controlsInput, 'controls.fullscreen'),
    thumbnails: read.bool(controlsInput, 'controls.thumbnails'),
    seekButtons: read.step(controlsInput, 'controls.seekButtons', [5, 10, 15, 30]),
  };
  const logoInput = read.group(value, 'logo', logoKeys);
  const assetId = read.text(logoInput, 'logo.assetId');

  // Logo uploads arrive in A2-3; until then any id is refused rather than kept for later.
  if (assetId !== null) read.fail('logo.assetId', 'unavailable');

  const logo = {
    assetId: null,
    position: read.choice(logoInput, 'logo.position', ['top-left', 'top-right', 'bottom-left', 'bottom-right']),
    margin: read.integer(logoInput, 'logo.margin', 0, 48),
    width: read.integer(logoInput, 'logo.width', 24, 240),
    opacity: read.integer(logoInput, 'logo.opacity', 10, 100),
    href: read.href(logoInput, 'logo.href'),
    alt: read.label(logoInput, 'logo.alt', null, 80),
    hideDuringAds: read.bool(logoInput, 'logo.hideDuringAds'),
    hideWithControls: read.bool(logoInput, 'logo.hideWithControls'),
  };
  const adsInput = read.group(value, 'ads', [
    'labels',
    'accentColor',
    'skipRadius',
    'fontSize',
    'progress',
    'timeouts',
  ]);
  const labelsInput = read.group(adsInput, 'ads.labels', AD_LABEL_KEYS);
  const labels = Object.fromEntries(
    AD_LABEL_KEYS.map((key) => [key, read.label(labelsInput, `ads.labels.${key}`, labelPlaceholders[key] ?? [])])
  );
  const accentColor = read.color(adsInput, 'ads.accentColor');
  const skipRadius = read.integer(adsInput, 'ads.skipRadius', 0, 24);
  const fontSize = read.integer(adsInput, 'ads.fontSize', 11, 18);
  const progressInput = read.group(adsInput, 'ads.progress', ['sequence', 'timer', 'bar']);
  const progress = {
    sequence: read.bool(progressInput, 'ads.progress.sequence'),
    timer: read.bool(progressInput, 'ads.progress.timer'),
    bar: read.bool(progressInput, 'ads.progress.bar'),
  };
  const timeoutsInput = read.group(adsInput, 'ads.timeouts', ['loadSeconds', 'stallSeconds']);
  const ads = {
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
  const lmsInput = read.group(value, 'lms', lmsKeys);
  const tabsInput = read.group(lmsInput, 'lms.tabs', lmsTabKeys);
  const lms = {
    enabled: read.bool(lmsInput, 'lms.enabled'),
    resume: read.choice(lmsInput, 'lms.resume', ['ask', 'auto', 'off']),
    seekLimit: read.choice(lmsInput, 'lms.seekLimit', ['free', 'watched']),
    maxRate: read.rate(lmsInput, 'lms.maxRate', lmsRates),
    completion: read.integer(lmsInput, 'lms.completion', 50, 100),
    tabs: Object.fromEntries(lmsTabKeys.map((key) => [key, read.bool(tabsInput, `lms.tabs.${key}`)])),
    bookmarks: read.bool(lmsInput, 'lms.bookmarks'),
    ads: read.choice(lmsInput, 'lms.ads', ['off', 'preroll']),
  };

  if (playback.autoplay === true && playback.muted === false) read.fail('playback.muted', 'conflict');

  if (logo.href !== null && logo.alt === null && !read.failed('logo.alt')) read.fail('logo.alt', 'required');

  if (playerType === 'native') {
    const unused = [
      ...themeKeys.map((key) => [`theme.${key}`, theme[key]]),
      ['display.title', display.title],
      ...inputKeys.map((key) => [`input.${key}`, input[key]]),
      ...controlKeys.map((key) => [`controls.${key}`, controls[key]]),
      ...logoKeys.map((key) => [`logo.${key}`, key === 'assetId' ? assetId : logo[key]]),
      ['lms.enabled', lms.enabled],
      ['lms.resume', lms.resume],
      ['lms.seekLimit', lms.seekLimit],
      ['lms.maxRate', lms.maxRate],
      ['lms.completion', lms.completion],
      ...lmsTabKeys.map((key) => [`lms.tabs.${key}`, lms.tabs[key]]),
      ['lms.bookmarks', lms.bookmarks],
      ['lms.ads', lms.ads],
    ];

    for (const [path, item] of unused) if (item !== null) read.fail(path, 'player_type');
  } else if (playerType === 'videojs') {
    if (ads.timeouts.loadSeconds !== null) read.fail('ads.timeouts.loadSeconds', 'player_type');

    if (ads.timeouts.stallSeconds !== null) read.fail('ads.timeouts.stallSeconds', 'player_type');
  }

  if (read.errors.length) return { ok: false, errors: read.errors };

  return {
    ok: true,
    preset: { id, name, playerType, language, theme, playback, display, input, controls, logo, ads, lms },
  };
}

function presetCss({ theme, ads }) {
  const values = [
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

  return Object.fromEntries(values.filter(([, value]) => value !== null));
}

/** The layout a logo takes for each empty preset `logo.*` value (ads-a2e-spec 5.2). */
export const LOGO_DEFAULTS = Object.freeze({
  position: 'top-right',
  margin: 12,
  width: 80,
  opacity: 80,
  href: null,
  alt: null,
  hideDuringAds: true,
  hideWithControls: false,
});

/**
 * The render `logo` (ads-a2e-spec 5.2): `null` without an image, otherwise every layout value filled with its default.
 * Only a preview passes `src` until logo uploads exist (A2-3), so the public render keeps `logo: null`.
 */
function logoRender(logo, src) {
  if (!src) return null;

  return {
    src,
    ...Object.fromEntries(Object.entries(LOGO_DEFAULTS).map(([key, fallback]) => [key, logo[key] ?? fallback])),
  };
}

/** The render `lms` (ads-lms-spec 1.1): only for an enabled group, every value filled with its default. */
function lmsRender(lms) {
  if (lms.enabled !== true) return null;

  return {
    resume: lms.resume ?? 'ask',
    seekLimit: lms.seekLimit ?? 'free',
    maxRate: lms.maxRate ?? 2,
    completion: lms.completion ?? 90,
    tabs: Object.fromEntries(lmsTabKeys.map((key) => [key, lms.tabs[key] ?? true])),
    bookmarks: lms.bookmarks ?? true,
    ads: lms.ads ?? 'off',
  };
}

/**
 * The public `player-preset` response for a validated preset, matching the PHP render (schema v2 section 3). `logoSrc`
 * is the preview logo image (`preview.logo`); the native render has no `logo` key.
 */
export function presetRender(preset, revision = 0, logoSrc = null) {
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
  const labels = Object.fromEntries(
    AD_LABEL_KEYS.filter((key) => ads.labels[key] !== null).map((key) => [key, ads.labels[key]])
  );
  const css = presetCss(preset);

  if (preset.playerType === 'videojs') {
    const attributes = { lang: 'ko' };

    for (const [key, name] of Object.entries(labelAttributes))
      if (Object.hasOwn(labels, key)) attributes[name] = labels[key];

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
      },
      logo: logoRender(preset.logo, logoSrc),
      progress,
      labels,
      skinTag: 'video-skin',
      styles: { css: 'video.css', js: 'video.js' },
      css,
      attributes,
    };

    return lms ? { ...render, lms } : render;
  }

  const ui = { locale: 'ko' };

  if (Object.keys(labels).length) ui.labels = labels;

  const timeouts = Object.fromEntries(Object.entries(ads.timeouts).filter(([, seconds]) => seconds !== null));
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
  };

  return Object.keys(timeouts).length ? { ...render, timeouts } : render;
}

/** The built-in `default` render the loader falls back to: every value empty, so package defaults apply. */
export function defaultRender(playerType = 'videojs') {
  const parsed = parsePlayerPreset({ id: 'default', name: '기본', playerType });

  return presetRender(parsed.preset);
}

const cssFields = {
  '--media-accent-color': ['theme', 'accentColor', (value) => value],
  '--media-accent-text-color': ['theme', 'accentTextColor', (value) => value],
  '--media-border-color': ['theme', 'borderColor', (value) => value],
  '--media-border-radius': ['theme', 'borderRadius', pixels],
  '--media-font-family': ['theme', 'fontFamily', (value) => (value === 'system-ui, sans-serif' ? 'system' : value)],
  '--media-object-fit': ['theme', 'objectFit', (value) => value],
  '--media-scale-unit': ['theme', 'scaleUnit', (value) => (value === '1rem' ? 'root' : value)],
  '--ads-accent-color': ['ads', 'accentColor', (value) => value],
  '--ads-skip-radius': ['ads', 'skipRadius', pixels],
  '--ads-font-size': ['ads', 'fontSize', pixels],
};

function pixels(value) {
  const match = typeof value === 'string' ? /^(\d+)px$/.exec(value) : null;

  return match ? Number(match[1]) : value;
}

function sameValue(left, right) {
  if (!isGroup(left) || !isGroup(right)) return left === right;

  const keys = Object.keys(left);

  return keys.length === Object.keys(right).length && keys.every((key) => sameValue(left[key], right[key]));
}

/** A group's own keys as a plain object; spreading never runs the `__proto__` setter. */
const own = (value) => (isGroup(value) ? { ...value } : {});

/**
 * Render playback as preset input. A preset cannot store unmuted autoplay, so an autoplay render's `muted: false` comes
 * from an empty `muted` and is read back as empty.
 */
const playbackInput = (playback) =>
  playback.autoplay === true && playback.muted === false ? { ...playback, muted: null } : playback;

/**
 * Validate a public `player-preset` render (API JSON). The render is read back into preset input, checked with
 * `parsePlayerPreset`, and accepted only when rendering that preset gives the same render. `preset` is that input, so
 * the loader can merge page values over it.
 */
export function readPresetRender(value) {
  if (!isGroup(value)) return { ok: false, errors: [{ path: '', code: 'type' }] };

  if (!Number.isInteger(value.revision) || value.revision < 0)
    return { ok: false, errors: [{ path: 'revision', code: 'type' }] };

  const errors = [];
  const theme = {};
  const ads = { labels: {} };

  for (const [name, item] of Object.entries(own(value.css))) {
    // Own keys only, so `constructor` or `__proto__` is an unknown name rather than an inherited method.
    const target = Object.hasOwn(cssFields, name) ? cssFields[name] : null;

    if (!target) errors.push({ path: `css.${name}`, code: 'unknown_key' });
    else (target[0] === 'theme' ? theme : ads)[target[1]] = target[2](item);
  }

  for (const [name, item] of Object.entries(own(value.attributes))) {
    const key = Object.keys(labelAttributes).find((label) => labelAttributes[label] === name);

    // `lang` is always `ko`; the comparison below rejects any other value.
    if (key) ads.labels[key] = item;
    else if (name !== 'lang') errors.push({ path: `attributes.${name}`, code: 'unknown_key' });
  }

  if (errors.length) return { ok: false, errors };

  // Spreading defines own keys, where `Object.assign` would run the `__proto__` setter.
  ads.labels = { ...ads.labels, ...own(value.labels), ...own(own(value.ui).labels) };
  ads.progress = own(value.progress);
  ads.timeouts = own(value.timeouts);

  const parsed = parsePlayerPreset({
    id: value.id ?? null,
    name: '프리셋',
    playerType: value.playerType,
    language: value.language,
    theme,
    playback: playbackInput(own(value.playback)),
    display: own(value.display),
    input: own(value.input),
    controls: own(value.controls),
    ads,
    // Only an enabled group renders, so a render `lms` reads back as enabled.
    ...(Object.hasOwn(value, 'lms') ? { lms: { ...own(value.lms), enabled: true } } : {}),
  });
  if (!parsed.ok) return parsed;

  const render = presetRender(parsed.preset, value.revision);

  return sameValue(render, value)
    ? { ok: true, render, preset: parsed.preset }
    : { ok: false, errors: [{ path: '', code: 'format' }] };
}

/** Set a validated render's CSS on `element`, clearing every other preset property first. */
export function applyPresetCss(element, css) {
  for (const name of PRESET_CSS_PROPERTIES) element.style.removeProperty(name);

  for (const [name, value] of Object.entries(css))
    if (PRESET_CSS_PROPERTIES.includes(name)) element.style.setProperty(name, value);
}

/** Set a validated Video.js render's attributes on `<media-ads>`, clearing every other preset attribute first. */
export function applyMediaAdsAttributes(element, attributes) {
  for (const name of MEDIA_ADS_ATTRIBUTES)
    if (Object.hasOwn(attributes, name)) element.setAttribute(name, attributes[name]);
    else element.removeAttribute(name);
}

/** The first error as a noun phrase, so it fits both the example notice and the admin preview tone. */
export function presetErrorText(errors) {
  const [first] = errors;

  return first ? `프리셋 값 오류: ${first.path || '전체'}(${first.code}).` : '프리셋 값 오류.';
}
