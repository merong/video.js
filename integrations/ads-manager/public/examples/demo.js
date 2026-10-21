/**
 * The demo page (contract A2-D 3, design DemoBench): pick a preset, change options, watch the Grok sample through the
 * loader's preview mode and copy the install code for that state. Nothing is saved or recorded; the state lives in the
 * address.
 */
import { adProgress, pushProgress } from './ad-progress.js';
import {
  alignToPreset,
  changedCount,
  changeValue,
  demoLogoUrl,
  demoMountOptions,
  demoVideo,
  ignoredText,
  loadPresetList,
  loadPresetSource,
  logoChoice,
  mutedLock,
  presetLabel,
  presetValue,
  readDemoQuery,
  readDemoValue,
  resetToPreset,
  sampleCaptionsUrl,
  writeDemoQuery,
} from './demo-state.js';
import { apiExample, installOptions, loaderSnippet } from './install-code.js';
import { bindCopy, clearCopy, noteText, setStatus } from './page.js';
import { checkSample as checkGrokSample, MISSING_SAMPLE_MESSAGE } from './sample.js';
import { fitStage, setScenes, showLog, showNow, watchStage } from './stage.js';
import { mount as loaderMount } from '../player/loader.js';
import { defaultRender, readPresetRender } from '../player/preset.js';

const LOADER_URL = new URL('../player/loader.js', import.meta.url).pathname;
// The sample schedule names its ads by root paths (`/demo-media/…`), which only resolve when `public/` is the root.
const ADS_AT_ROOT = new URL('../', import.meta.url).pathname === '/';

const PREPARING = '플레이어를 준비하는 중이에요…';
const FAILED = '플레이어를 만들지 못했어요. 다시 불러오기를 눌러 주세요.';
const PRESET_FAILED = '프리셋을 불러오지 못해 기본 설정으로 보여요. 새로고침하면 다시 불러와요.';
const MUTED_TEXT = '소리 없이 시작해요.';
const MUTED_LOCKED = '자동재생을 켜면 음소거로 시작해요. 브라우저가 소리 나는 자동재생을 막기 때문이에요.';
const ADDRESS_ERROR = '/로 시작하는 경로나 http(s):// 주소로 입력해 주세요. 상대 경로는 받지 않아요.';
const SIGNED_IN_HELP = '관리자로 로그인해 있어서 저장 프리셋도 보여요.';
const SIGNED_OUT_HELP = '관리자로 로그인하면 저장 프리셋도 고를 수 있어요.';
const INVALID_SAMPLE_TITLE = '샘플 편성 형식이 달라요';
const LOGO_FAILED = '이미지를 불러오지 못해 플레이어에 로고를 숨겼어요. 주소와 파일을 확인해 주세요.';
const LINK_ERROR = 'http:// 또는 https://로 시작하는 주소로 입력해 주세요.';
const ALT_REQUIRED = '링크가 있으면 대체 텍스트를 입력해 주세요.';
const CORNERS = { 'top-left': '왼쪽 위', 'top-right': '오른쪽 위', 'bottom-left': '왼쪽 아래', 'bottom-right': '오른쪽 아래' };
// Logo number input → [state key, unit].
const LOGO_NUMBERS = { 'logo-w': ['logoWidth', 'px'], 'logo-op': ['logoOpacity', '%'], 'logo-m': ['logoMargin', 'px'] };

/** Whether an image address loads; the demo says why the player hid a logo it could not load. */
function loadImage(url) {
  return new Promise((resolve) => {
    const image = new Image();

    image.onload = () => resolve(true);
    image.onerror = () => resolve(false);
    image.src = url;
  });
}

/** The range message for a unit number input (Field "단위 붙은 숫자 칸"). */
function rangeError(input, unit) {
  const min = Number(input.min);
  const max = Number(input.max);
  const value = Number(input.value);
  const range = `${min}–${max} 사이의 정수로 입력해 주세요.`;

  if (input.value.trim() !== '' && Number.isFinite(value) && value > max) return `${max}${unit}보다 커요. ${range}`;

  if (input.value.trim() !== '' && Number.isFinite(value) && value < min) return `${min}${unit}보다 작아요. ${range}`;

  return range;
}

/** The sample empty state for a schedule file in the wrong format. */
function showInvalidSample(empty) {
  const code = empty.ownerDocument.createElement('code');

  code.className = 'sa-code';
  code.textContent = 'demo-media/grok-20261018/schedule.json.js';
  empty.querySelector('b').textContent = INVALID_SAMPLE_TITLE;
  empty.querySelector('span').replaceChildren(code, '가 원본 raw 편성인지 확인해 주세요.');
}

/** The default render as a preview source, for when the preset API cannot be reached. */
function fallbackSource() {
  const render = defaultRender('videojs');

  return { render, preset: readPresetRender(render).preset };
}

/**
 * Start the demo on `root`. The dependencies are parameters so tests can run it without the API, the sample or player
 * bundles. Returns `{ ready, destroy, state }`: `ready` settles once the first preset is shown.
 */
export function startDemo({
  root = document,
  address = location,
  history = window.history,
  mount = loaderMount,
  loadPresets = loadPresetList,
  loadPreset = loadPresetSource,
  checkSample = checkGrokSample,
  checkImage = loadImage,
} = {}) {
  const $ = (id) => root.getElementById(id);
  const select = $('preset');
  const stage = $('stage');
  const status = $('stage-status');
  const player = $('player');
  const scenes = $('scenes');
  const restart = $('restart');
  const logBox = $('log');
  const now = $('now');
  const codeBlocks = { html: $('code-html'), js: $('code-js') };
  const request = new AbortController();
  const read = readDemoQuery(address.search);
  let state = read.state;
  let list = { items: [], siteId: 'default', signedIn: false, notice: '' };
  let source = null;
  let sample = null;
  let handle = null;
  let mountedKey = '';
  let generation = 0;
  // The count of scene clicks so only the last one acts, and the scene button to focus again after a new player.
  let asked = 0;
  let sceneButton = null;
  let presetRequest = null;
  let presetWarning = '';
  let log = [];
  // The last skip width and logo address, so turning the buttons on or choosing the address again brings them back.
  let lastSeek = 10;
  let lastLogoUrl = '';
  let checkedLogo = '';
  let logoFailed = false;

  function render() {
    return source.render;
  }

  // A `null` state value (an emptied language, hidden seek buttons, an emptied link) is a value, not the preset's.
  function effective(key) {
    return state[key] !== undefined ? state[key] : presetValue(key, render(), source.preset);
  }

  function showPresetList() {
    const { items, siteId, signedIn, notice } = list;
    const document = select.ownerDocument;
    const wanted = state.preset ?? siteId;
    const option = (item) => {
      const element = document.createElement('option');

      element.value = item.id;
      element.textContent = presetLabel(item, signedIn);
      return element;
    };
    const group = (label, members) => {
      const element = document.createElement('optgroup');

      element.label = label;
      element.append(...members.map(option));
      return element;
    };
    const builtIn = items.filter((item) => item.builtIn);
    const saved = items.filter((item) => !item.builtIn);
    // A preset shared by address that this visitor's list does not have keeps its id as its name.
    const extra = items.some((item) => item.id === wanted) ? [] : [{ id: wanted, name: wanted, site: false }];

    if (signedIn) {
      select.replaceChildren(group('내장', builtIn));

      if (saved.length || extra.length) select.append(group('저장 프리셋', [...saved, ...extra]));
    } else select.replaceChildren(...saved.map(option), group('내장', builtIn), ...extra.map(option));

    select.value = wanted;

    const field = $('preset-field');
    const help = $('preset-h');

    field.classList.toggle('is-warn', Boolean(notice));
    help.textContent = notice || (signedIn ? SIGNED_IN_HELP : SIGNED_OUT_HELP);
  }

  /** Load the preset `id` and show it; an unknown id from the address falls back to the site preset. */
  async function choose(id) {
    presetRequest?.abort();

    const ask = (presetRequest = new AbortController());
    let next;

    presetWarning = '';

    try {
      next = await loadPreset(id, { signal: ask.signal });
    } catch (error) {
      if (ask.signal.aborted) return;

      next = fallbackSource();
      presetWarning = PRESET_FAILED;
    }

    if (ask.signal.aborted) return;

    if (next.missing) {
      if (id !== list.siteId) {
        const note = $('preset-note');

        noteText(note, '주소의 프리셋을 찾지 못했어요.', `preset=${id} · 사이트 적용 프리셋으로 보여요.`);
        note.hidden = false;
        state = { ...state, preset: null };
        showPresetList();
        return choose(list.siteId);
      }

      next = fallbackSource();
      presetWarning = PRESET_FAILED;
    }

    source = next;
    state = alignToPreset(state, source.render, source.preset);
    update();
  }

  function setChecked(button, on) {
    button.setAttribute('aria-checked', String(Boolean(on)));
  }

  function setRadios(name, value) {
    for (const input of root.querySelectorAll(`input[name="${name}"]`)) input.checked = input.value === value;
  }

  /** Disable a blocked field and point it at the reason, then its own help. */
  function block(element, reason, help = '') {
    const describedBy = [reason, help].filter(Boolean).join(' ');

    element.disabled = Boolean(reason);

    if (describedBy) element.setAttribute('aria-describedby', describedBy);
    else element.removeAttribute('aria-describedby');
  }

  /** Show a field's help text, or an error or warning in its place. */
  function fieldHelp(input, help, text, tone = '') {
    const field = input.closest('.sa-field');

    field.classList.toggle('is-error', tone === 'is-error');
    field.classList.toggle('is-warn', tone === 'is-warn');
    help.textContent = text;

    if (tone === 'is-error') input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }

  // A native preset blocks the controls group but keeps its values (DemoBench "컨트롤").
  function showControlGroup(native) {
    const seek = effective('seekButtons');
    const reason = native ? 'off-c' : '';

    if (seek !== null) lastSeek = seek;

    setChecked($('seek'), seek !== null);
    $('seek-sub').hidden = seek === null;
    setRadios('seek-step', String(seek ?? lastSeek));
    $('off-c').hidden = !native;
    $('controls-body').classList.toggle('sa-off-body', native);

    for (const row of ['seek-row', 'captions-row']) $(row).classList.toggle('is-locked', native);

    for (const input of root.querySelectorAll('input[name="seek-step"]')) input.disabled = native;

    block($('seek'), reason, 'seek-d');
    block(root.querySelector('button.sa-toggle[data-key="captions"]'), reason, 'cc-d cc-k');
    block($('cc-url'), reason, 'cc-url-h');
    block($('cc-fill'), reason, 'cc-fill-h');
    showAddress($('cc-url'), state.captionsUrl);
  }

  // The image select stays usable without an image; a native preset blocks the whole group (DemoBench "로고 묶음").
  function showLogoGroup(native) {
    const choice = logoChoice(state);
    const reason = native ? 'logo-off-native' : choice === '' ? 'logo-off' : '';
    const href = effective('logoHref');
    const alt = $('logo-alt');

    if (choice === 'custom' && state.logo !== 'custom') lastLogoUrl = state.logo;

    // Before the image help below: a new address clears the last address's failure in this same drawing.
    checkLogo(native ? '' : demoLogoUrl(state, address.href));

    $('logo-off-native').hidden = !native;
    $('logo-off').hidden = native || choice !== '';
    $('logo-img').value = choice;
    block($('logo-img'), native ? reason : '', 'logo-img-h');
    fieldHelp($('logo-img'), $('logo-img-h'), logoFailed ? LOGO_FAILED : $('logo-img-h').dataset.help, logoFailed ? 'is-warn' : '');
    $('logo-url-field').hidden = choice !== 'custom';
    block($('logo-url'), native ? reason : '', 'logo-url-h');
    showAddress($('logo-url'), choice === 'custom' ? lastLogoUrl : '');
    $('logo-body').classList.toggle('sa-off-body', Boolean(reason));
    block($('logo-pos'), reason, 'logo-pos-h');
    setRadios('logo-position', effective('logoPosition'));
    $('logo-pos-now').textContent = CORNERS[effective('logoPosition')];

    for (const [id, [key]] of Object.entries(LOGO_NUMBERS)) {
      block($(id), reason, `${id}-h`);
      showAddress($(id), String(effective(key)));
    }

    block($('logo-href'), reason, 'logo-href-h');
    showAddress($('logo-href'), href ?? '');
    block(alt, reason, 'logo-alt-h');
    showAddress(alt, effective('logoAlt') ?? '');

    // A link needs a name; until it has one the player shows the image unlinked.
    if (href) alt.setAttribute('aria-required', 'true');
    else alt.removeAttribute('aria-required');

    if (!reason && href && !effective('logoAlt')) fieldHelp(alt, $('logo-alt-h'), ALT_REQUIRED, 'is-error');
    else if (alt.getAttribute('aria-invalid') === 'true' && !alt.value.trim())
      fieldHelp(alt, $('logo-alt-h'), $('logo-alt-h').dataset.help);

    for (const button of root.querySelectorAll('button.sa-toggle[data-key^="logo"]')) {
      button.closest('li').classList.toggle('is-locked', Boolean(reason));
      block(button, reason, button.getAttribute('aria-describedby').split(' ').at(-1));
    }
  }

  /** Try the logo image once per address; the player hides a logo it cannot load, so the demo says why. */
  function checkLogo(url) {
    if (url === checkedLogo) return;

    checkedLogo = url;
    logoFailed = false;

    if (!url) return;

    void checkImage(url).then((loaded) => {
      if (url !== checkedLogo || loaded) return;

      logoFailed = true;
      showControls();
    });
  }

  function showControls() {
    const native = render().playerType === 'native';
    const locked = Boolean(mutedLock(state, render()));

    for (const button of root.querySelectorAll('button.sa-toggle[data-key]')) setChecked(button, effective(button.dataset.key));

    const muted = root.querySelector('button.sa-toggle[data-key="muted"]');

    $('muted-row').classList.toggle('is-locked', locked);
    muted.disabled = locked;
    $('mu-d').textContent = locked ? MUTED_LOCKED : MUTED_TEXT;

    if (locked) setChecked(muted, true);

    setRadios('preload', effective('preload'));
    $('poster').checked = Boolean(effective('poster'));
    $('title').checked = Boolean(effective('title'));
    showAddress($('poster-url'), state.posterUrl);
    showAddress($('vtt'), state.thumbnails);

    if (root.activeElement !== $('title-text')) $('title-text').value = state.titleText;

    // A native preset blocks the Video.js-only fields but keeps their values.
    $('off-r').hidden = !native;
    $('off-body').classList.toggle('sa-off-body', native);

    for (const [id, help] of [
      ['title', ''],
      ['title-text', ''],
      ['vtt', 'vtt-h'],
    ]) {
      const input = $(id);
      const describedBy = [native ? 'off-r' : '', help].filter(Boolean).join(' ');

      input.disabled = native;

      if (describedBy) input.setAttribute('aria-describedby', describedBy);
      else input.removeAttribute('aria-describedby');
    }

    const language = effective('language');

    $('lang').value = language ?? '';
    $('page-lang-field').hidden = language !== null;
    $('page-lang').value = state.pageLang;

    const mediaGroup = $('media');

    setRadios('media', native ? 'mp4' : state.media);
    root.querySelector('input[name="media"][value="hls"]').disabled = native;
    $('md-h').hidden = !native;

    if (native) mediaGroup.setAttribute('aria-describedby', 'md-h');
    else mediaGroup.removeAttribute('aria-describedby');

    $('engine-field').hidden = native || state.media !== 'hls';
    setRadios('engine', state.engine);
    showControlGroup(native);
    showLogoGroup(native);

    const count = changedCount(state);

    $('reset-h').textContent = count ? `프리셋과 다른 값 ${count}개` : '프리셋 값 그대로예요';
    $('reset').disabled = count === 0;
  }

  /** An address input shows the state's value unless it holds a rejected entry. */
  function showAddress(input, value) {
    if (input.getAttribute('aria-invalid') !== 'true' && root.activeElement !== input) input.value = value;
  }

  function showCode() {
    const video = demoVideo(state, render());
    const options = installOptions(state, { render: render(), sitePresetId: list.siteId, video, loaderUrl: LOADER_URL });
    const code = { html: loaderSnippet(options.snippet), js: apiExample(options) };
    const why = $('code-why');
    const tag = why.ownerDocument.createElement('code');

    for (const [key, block] of Object.entries(codeBlocks)) {
      const element = block.querySelector('pre > code');

      if (element.textContent === code[key]) continue;

      element.textContent = code[key];
      clearCopy(block);
    }

    // The logo is a preset value with no upload yet, so only the demo shows it.
    $('cd-logo').hidden = render().playerType !== 'videojs' || logoChoice(state) === '';
    tag.className = 'sa-code';
    tag.textContent = 'data-preset';
    why.replaceChildren(
      options.snippet.presetId
        ? '지금 설정 그대로예요. 사이트 적용 프리셋이 아니라서 '
        : '지금 설정 그대로예요. 사이트 적용 프리셋이라 ',
      tag,
      options.snippet.presetId
        ? '을 넣었고, 프리셋과 같은 값은 쓰지 않았어요.'
        : '을 넣지 않았고, 프리셋과 같은 값은 쓰지 않았어요.'
    );
  }

  function showEmpty(empty) {
    const view = $('stage-view');

    view.classList.toggle('is-empty', empty);
    $('stage-frame').hidden = empty;
    $('stage-empty').hidden = !empty;
    $('stage-bar').hidden = empty;
    $('ads-root-note').hidden = empty || ADS_AT_ROOT;

    if (!empty) fitStage(stage);
  }

  function showPlayer({ force = false, scene = null } = {}) {
    if (!sample?.ok) {
      generation++;
      handle?.destroy();
      handle = null;
      mountedKey = '';
      showEmpty(true);
      // An invalid sample has its own title and line; a missing one keeps the markup's. The guide link stays.
      if (sample?.reason === 'invalid') showInvalidSample($('stage-empty'));
      setStatus(status, '');
      setScenes(scenes, { ready: false });
      return;
    }

    showEmpty(false);

    const options = demoMountOptions(state, source, undefined, address.href);
    const { preview, ...shown } = options;

    // The demo previews a lecture preset without its panel; the sample lecture shows it (ads-lms-spec 4).
    $('lms-note').hidden = preview.preset?.lms?.enabled !== true;
    // The logo layout and image change in place; any other value makes a new player.
    const { logo, ...kept } = shown.overrides ?? {};
    const key = JSON.stringify([{ ...shown, overrides: kept }, state.pageLang]);
    const changes = { overrides: options.overrides, logo: preview.logo ?? null };

    if (!force && handle && key === mountedKey && handle.restyle(preview.preset, changes)) {
      setStatus(status, presetWarning, presetWarning ? 'is-warn' : '');
      return;
    }

    void remount(scene ? { ...options, preview: { ...preview, scene } } : options, key);
  }

  async function remount(options, key) {
    const current = ++generation;
    let failure = '';

    handle?.destroy();
    handle = null;
    mountedKey = '';
    restart.hidden = true;
    // A new player has shown no ad yet; the log keeps earlier plays.
    showNow(now, null);
    setStatus(status, PREPARING);
    setScenes(scenes, { ready: false });
    player.setAttribute('lang', state.pageLang);

    try {
      const made = await mount(player, {
        ...options,
        onError(error) {
          failure ||= error.message;
        },
        onEvent(event) {
          if (current === generation) record(event);
        },
      });

      if (current !== generation) return;

      handle = made;
      mountedKey = key;
    } catch (error) {
      if (current !== generation || error?.name === 'AbortError') return;

      sceneButton = null;
      setStatus(status, FAILED, 'is-bad');
      restart.hidden = false;
      return;
    }

    const warning = failure || presetWarning;

    setStatus(status, warning, warning ? 'is-warn' : '');
    // A player made for a scene plays a trimmed schedule; the shortcuts follow the full sample.
    setScenes(scenes, { ready: true, schedule: sample.schedule });

    // The clicked scene button was disabled while the new player mounted, which drops its focus to the page.
    const active = root.activeElement;

    if (sceneButton && !sceneButton.disabled && (!active || active === root.body)) sceneButton.focus();

    sceneButton = null;
  }

  /**
   * Move to a scene. A scene whose ads this player already played, or one asked during an ad, plays on a new player
   * that starts there; the previous player's events are dropped by `generation`.
   */
  async function goTo(button, ask) {
    const seeking = handle;

    if (!seeking || (await seeking.seek(button.dataset.scene)) !== 'remount' || ask !== asked || handle !== seeking)
      return;

    sceneButton = button;
    showPlayer({ force: true, scene: button.dataset.scene });
  }

  function record(event) {
    const entry = adProgress(event, handle?.schedule ?? sample?.schedule);

    log = pushProgress(log, entry);
    showNow(now, entry);
    showLog(logBox, log);
  }

  function update({ user = false } = {}) {
    if (user) {
      $('query-note').hidden = true;
      $('preset-note').hidden = true;
    }

    const query = writeDemoQuery(state);

    history.replaceState(history.state, '', `${address.pathname}${query ? `?${query}` : ''}${address.hash}`);
    showControls();
    showCode();
    showPlayer();
  }

  function change(key, value) {
    if (!source) return;

    state = changeValue(state, key, value, render(), source.preset);
    update({ user: true });
  }

  function set(values) {
    if (!source) return;

    state = { ...state, ...values };
    update({ user: true });
  }

  /** Accept an emptied or valid address; mark anything else on its field without changing the state. */
  function bindAddress(input, key, help, helpText) {
    input.addEventListener('change', () => {
      const value = input.value.trim();
      const accepted = value === '' ? '' : readDemoValue(key, value);
      const field = input.closest('.sa-field');

      field.classList.toggle('is-error', accepted === undefined);
      help.hidden = accepted !== undefined && !helpText;
      help.textContent = accepted === undefined ? ADDRESS_ERROR : helpText;

      if (accepted === undefined) {
        input.setAttribute('aria-invalid', 'true');
        input.setAttribute('aria-describedby', help.id);
        return;
      }

      input.removeAttribute('aria-invalid');

      if (!helpText) input.removeAttribute('aria-describedby');

      set({ [key]: accepted });
    });
  }

  select.addEventListener('change', () => {
    const id = select.value;

    state = { ...state, preset: id === list.siteId ? null : id };
    $('query-note').hidden = true;
    $('preset-note').hidden = true;
    void choose(id);
  });

  for (const button of root.querySelectorAll('button.sa-toggle[data-key]'))
    button.addEventListener('click', () => {
      if (!button.disabled) change(button.dataset.key, button.getAttribute('aria-checked') !== 'true');
    });

  root.addEventListener('change', (event) => {
    const input = event.target;

    if (input.name === 'preload') change('preload', input.value);
    else if (input.name === 'seek-step') change('seekButtons', Number(input.value));
    else if (input.name === 'logo-position') change('logoPosition', input.value);
    else if (input.name === 'media' || input.name === 'engine') set({ [input.name]: input.value });
    else if (input.id === 'poster' || input.id === 'title') change(input.id, input.checked);
    else if (input.id === 'lang') change('language', input.value === '' ? null : input.value);
    else if (input.id === 'page-lang') set({ pageLang: readDemoValue('pageLang', input.value) ?? 'ko' });
    else if (input.id === 'title-text') {
      const value = input.value.trim();
      const accepted = value === '' ? '' : readDemoValue('titleText', value);

      if (accepted !== undefined) set({ titleText: accepted });
    }
  });

  bindAddress($('poster-url'), 'posterUrl', $('poster-url-h'), '');
  bindAddress($('vtt'), 'thumbnails', $('vtt-h'), $('vtt-h').textContent);
  bindAddress($('cc-url'), 'captionsUrl', $('cc-url-h'), $('cc-url-h').textContent);

  for (const help of $('logo-body').closest('fieldset').querySelectorAll('.sa-help[id]'))
    help.dataset.help = help.textContent;

  $('seek').addEventListener('click', () => {
    if (!$('seek').disabled) change('seekButtons', effective('seekButtons') === null ? lastSeek : null);
  });

  $('cc-fill').addEventListener('click', () => {
    const input = $('cc-url');

    // The field takes the path as if typed, which clears an earlier error; focus stays on the button.
    input.value = sampleCaptionsUrl(address.href);
    input.dispatchEvent(new Event('change'));
  });

  $('logo-img').addEventListener('change', () => {
    const value = $('logo-img').value;

    set({ logo: value === 'custom' ? lastLogoUrl || 'custom' : value });
  });

  $('logo-url').addEventListener('change', () => {
    const input = $('logo-url');
    const value = input.value.trim();
    const accepted = value === '' ? 'custom' : readDemoValue('logo', value);

    // The blur of a hidden field (another image choice hid it while it had focus) must not bring its address back.
    if ($('logo-url-field').hidden) return;

    // A sample id typed as an address is not an address.
    if (accepted === undefined || (value !== '' && !/^(\/|https?:\/\/)/i.test(value))) {
      fieldHelp(input, $('logo-url-h'), ADDRESS_ERROR, 'is-error');
      return;
    }

    fieldHelp(input, $('logo-url-h'), $('logo-url-h').dataset.help);
    lastLogoUrl = value;
    set({ logo: accepted });
  });

  for (const [id, [key, unit]] of Object.entries(LOGO_NUMBERS))
    $(id).addEventListener('change', () => {
      const input = $(id);
      const value = readDemoValue(key, input.value.trim());

      if (value === undefined) {
        fieldHelp(input, $(`${id}-h`), rangeError(input, unit), 'is-error');
        return;
      }

      fieldHelp(input, $(`${id}-h`), $(`${id}-h`).dataset.help);
      change(key, value);
    });

  $('logo-href').addEventListener('change', () => {
    const input = $('logo-href');
    const value = readDemoValue('logoHref', input.value.trim());

    if (value === undefined) {
      fieldHelp(input, $('logo-href-h'), LINK_ERROR, 'is-error');
      return;
    }

    fieldHelp(input, $('logo-href-h'), $('logo-href-h').dataset.help);
    change('logoHref', value);
  });

  $('logo-alt').addEventListener('change', () => {
    const input = $('logo-alt');
    const value = readDemoValue('logoAlt', input.value);

    if (value === undefined) return;

    fieldHelp(input, $('logo-alt-h'), $('logo-alt-h').dataset.help);
    change('logoAlt', value);
  });

  $('reset').addEventListener('click', () => {
    state = resetToPreset(state);
    update({ user: true });

    // The button is disabled once nothing differs, so focus moves to the preset it returned to.
    if ($('reset').disabled) select.focus();
  });

  for (const button of root.querySelectorAll('button[data-scene]'))
    button.addEventListener('click', () => void goTo(button, ++asked));

  restart.addEventListener('click', () => {
    asked++;
    showPlayer({ force: true });
  });

  $('clear-log').addEventListener('click', () => {
    log = [];
    showLog(logBox, log);
  });

  for (const block of Object.values(codeBlocks)) bindCopy(block);

  watchStage(stage);
  setScenes(scenes, { ready: false });

  if (read.ignored.length) {
    const note = $('query-note');

    noteText(
      note,
      `주소의 값 ${read.ignored.length}개를 무시했어요.`,
      `${ignoredText(address.search, read.ignored)} · 지금은 프리셋 값으로 보여요.`
    );
    note.hidden = false;
  }

  setStatus(status, PREPARING);

  const ready = Promise.all([
    loadPresets({ signal: request.signal }),
    checkSample({ signal: request.signal }).catch(() => ({ ok: false, reason: 'missing', message: MISSING_SAMPLE_MESSAGE })),
  ]).then(([presets, checked]) => {
    list = presets;
    sample = checked;
    showPresetList();
    return choose(state.preset ?? list.siteId);
  });

  ready.catch(() => {});

  return {
    ready,
    destroy() {
      request.abort();
      presetRequest?.abort();
      generation++;
      handle?.destroy();
      handle = null;
    },
    get state() {
      return state;
    },
  };
}
