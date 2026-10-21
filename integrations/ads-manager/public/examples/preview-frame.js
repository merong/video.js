/**
 * The admin's player preview frame, `preview.html?type=videojs|native` (contract A2-D 6). It plays the Grok sample, or
 * the raw schedule and content the parent sends, through the loader's preview mode, so nothing is recorded. Messages
 * are same-origin only, and each one is checked for both its origin and its source; the content itself may be on
 * another origin, as the loader's `data-src` may.
 */
import { adProgress } from './ad-progress.js';
import { mount as loaderMount } from '../player/loader.js';
import { parsePlayerPreset, presetErrorText } from '../player/preset.js';
import {
  checkSample as checkGrokSample,
  SAMPLE_CONTENT_URL,
  SAMPLE_POSTER_URL,
  SAMPLE_SCHEDULE_URL,
  SAMPLE_TITLE,
} from './sample.js';

export const PREVIEW_MESSAGE = 'ads-player-preview';
export const PREVIEW_COMMAND_MESSAGE = 'ads-player-preview-command';
export const PREVIEW_STATUS_MESSAGE = 'ads-player-preview-status';
export const PREVIEW_EVENT_MESSAGE = 'ads-player-preview-event';
export const PREVIEW_COMMANDS = ['restart', 'start', 'before-midroll', 'before-end'];
export const STANDALONE_MESSAGE =
  '이 페이지는 관리자 화면의 플레이어 미리보기 칸 안에서 열려요. 플레이어를 직접 보려면 데모를 열어 주세요.';

// A language tag shape only; the loader maps it to a player language (anything unsupported is English).
const languageTag = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{1,8})*$/;
const isGroup = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

/** A title under the loader's `data-title` rule: trimmed, not empty, no control characters; otherwise `null`. */
function titleText(value) {
  // oxlint-disable-next-line no-control-regex
  if (typeof value !== 'string' || !value.trim() || /[\u0000-\u001f\u007f-\u009f]/u.test(value)) return null;

  return value.trim();
}

/**
 * The content address from the parent under the loader's `data-src` rule: a `/` path or an HTTP(S) URL, from any
 * origin. A `/` path resolves against the frame; anything else is `null`.
 */
function contentAddress(value, origin) {
  // oxlint-disable-next-line no-control-regex
  if (typeof value !== 'string' || !/^(\/(?!\/)|https?:\/\/)/i.test(value) || /[\u0000-\u001f\u007f]/.test(value))
    return null;

  try {
    const url = new URL(value, `${origin}/`);

    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;

    return url.origin === origin ? `${url.pathname}${url.search}` : url.href;
  } catch {
    return null;
  }
}

/**
 * Start the frame in `root`, reporting setup and preset failures in `notice`. The dependencies are parameters so tests
 * can run the protocol without a parent frame or player bundles. Returns `{ receive, destroy, ready }`: `receive`
 * handles one `message` event and `ready` settles after the sample check.
 */
export function startPreviewFrame({
  root,
  notice,
  search = location.search,
  origin = location.origin,
  parent = window.parent,
  self = window,
  mount = loaderMount,
  checkSample = checkGrokSample,
} = {}) {
  const type = new URLSearchParams(search).get('type') === 'native' ? 'native' : 'videojs';
  const request = new AbortController();
  let sample = null;
  let latest = null;
  let handle = null;
  // The source of the mounted player; a new source or page language mounts again.
  let mounted = '';
  let generation = 0;
  // Whether a player is being mounted, and the count of scene commands so only the last one acts.
  let mounting = false;
  let asked = 0;
  let stopped = false;
  let ready = Promise.resolve();

  function report(status, message = '', reason) {
    notice.hidden = !['error', 'missing-sample'].includes(status);
    notice.textContent = notice.hidden ? '' : message;
    parent.postMessage({ type: PREVIEW_STATUS_MESSAGE, status, message, ...(reason ? { reason } : {}) }, origin);
  }

  function clear() {
    handle?.destroy();
    handle = null;
    mounted = '';
    root.replaceChildren();
  }

  /**
   * The schedule, content, title and poster to play, or a status when there is nothing playable. The poster is always
   * the placeholder, so the preset's "포스터 표시" shows on any content.
   */
  function source(message) {
    const poster = new URL(SAMPLE_POSTER_URL).pathname;

    if (message.schedule !== undefined || message.content !== undefined) {
      const content = contentAddress(message.content, origin);

      if (!isGroup(message.schedule) || !content)
        return { error: '미리보기 편성이나 본편 주소가 올바르지 않아요. /경로나 http(s):// 본편 주소와 raw 편성을 보내 주세요.' };

      const title = titleText(message.title) ?? titleText(message.schedule.videoId);

      return {
        schedule: message.schedule,
        content,
        title,
        poster,
        key: JSON.stringify([message.schedule, content, title]),
      };
    }

    if (!sample?.ok) return { missing: sample?.message ?? '', reason: sample?.reason ?? 'missing' };

    return {
      schedule: SAMPLE_SCHEDULE_URL,
      content: new URL(SAMPLE_CONTENT_URL).pathname,
      title: SAMPLE_TITLE,
      poster,
      key: 'sample',
    };
  }

  async function play(message, preset, language, scene = null) {
    const played = source(message);

    if (played.error) {
      clear();
      report('error', played.error);
      return;
    }

    if (played.missing !== undefined) {
      clear();
      report('missing-sample', played.missing, played.reason);
      return;
    }

    const pageLang =
      language === null && typeof message.pageLang === 'string' && languageTag.test(message.pageLang)
        ? message.pageLang
        : 'ko';
    const key = JSON.stringify([played.key, pageLang]);

    if (handle && mounted === key && handle.restyle(preset)) {
      report('ready');
      return;
    }

    const current = ++generation;
    let failure = '';

    mounting = true;

    clear();
    root.setAttribute('lang', pageLang);
    report('loading');

    try {
      handle = await mount(root, {
        src: played.content,
        ...(played.title ? { title: played.title } : {}),
        poster: played.poster,
        playerType: type,
        preview: { schedule: played.schedule, preset, ...(scene ? { scene } : {}) },
        onError(error) {
          failure ||= error.message;
        },
        onEvent(event) {
          if (current === generation)
            parent.postMessage({ type: PREVIEW_EVENT_MESSAGE, event: adProgress(event, handle?.schedule) }, origin);
        },
      });
    } catch (error) {
      if (current !== generation || error?.name === 'AbortError') return;

      mounting = false;
      report('error', error?.message || '미리보기 플레이어를 준비하지 못했어요.');
      return;
    }

    if (current !== generation) return;

    mounting = false;
    mounted = key;
    report(failure ? 'error' : 'ready', failure);
  }

  /**
   * Move to a scene. A scene whose ads this player already played, one asked during an ad, or one asked while a player
   * mounts plays on a new player that starts there; the previous player's events are dropped by `generation`.
   */
  async function goTo(command, ask) {
    const seeking = handle;

    if (seeking && (await seeking.seek(command)) !== 'remount') return;

    if (ask !== asked || stopped || handle !== seeking || (!seeking && !mounting)) return;

    clear();
    void play(latest.message, latest.preset, latest.language, command);
  }

  function receive(event) {
    const data = event.data;

    if (stopped || event.origin !== origin || event.source !== parent || !isGroup(data)) return;

    if (data.type === PREVIEW_COMMAND_MESSAGE) {
      if (!PREVIEW_COMMANDS.includes(data.command) || !latest) return;

      asked++;

      if (data.command === 'restart') {
        clear();
        void play(latest.message, latest.preset, latest.language);
      } else void goTo(data.command, asked);

      return;
    }

    if (data.type !== PREVIEW_MESSAGE) return;

    const parsed = parsePlayerPreset(data.preset);

    if (!parsed.ok) {
      report('error', presetErrorText(parsed.errors));
      return;
    }

    // A preset for the other player arrives just before the parent loads the other frame address.
    if (parsed.preset.playerType !== type) return;

    // An absent language is `null` after parsing, which follows `pageLang`.
    latest = { message: data, preset: data.preset, language: parsed.preset.language };
    void ready.then(() => {
      if (!stopped && latest?.message === data) return play(data, data.preset, parsed.preset.language);
    });
  }

  function destroy() {
    stopped = true;
    request.abort();
    self.removeEventListener('message', receive);
    clear();
  }

  if (parent === self) {
    // Guidance, not a failure: the frame's error tone and alert role do not apply.
    root.hidden = true;
    notice.classList.remove('is-warn');
    notice.setAttribute('role', 'note');
    notice.hidden = false;
    notice.textContent = STANDALONE_MESSAGE;
    return { receive, destroy, ready, type };
  }

  self.addEventListener('message', receive);
  self.addEventListener('pagehide', destroy, { once: true });
  report('loading');

  ready = checkSample({ signal: request.signal }).then(
    (result) => {
      sample = result;
    },
    () => {
      sample = { ok: false, message: '' };
    }
  );

  return { receive, destroy, ready, type };
}
