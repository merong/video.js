/**
 * The sample lecture page (`ads-lms-design-handoff.md` section 4): the built-in lecture preset on the sample lecture,
 * with its rules, tabs, ads and learner token as page options. Nothing is saved but the lecture's own progress.
 */
import { mount } from '../player/loader.js';
import { clearLocalProgress, formatTime } from '../player/lms.js';
import { loaderSnippet } from './install-code.js';
import { bindCopy, clearCopy, setStatus } from './page.js';

const VIDEO = {
  videoId: 'sample-lecture',
  src: '/demo-media/lecture/lecture.mp4',
  title: '솔애드 강의 프리셋 둘러보기',
  poster: '/examples/lecture/slide-01.svg',
  lecture: '/examples/lecture/manifest.json',
};
const LOG_SIZE = 20;
// The built-in lecture preset's rules, which the server keeps while a learner token is in use.
const PRESET_RULES = { seekLimit: 'free', maxRate: 2, completion: 90 };
const TABS = ['chapters', 'materials', 'transcript', 'notes'];
const TOKEN_TEXT = {
  shape: '토큰 모양이 맞지 않아요. 점(.)으로 나뉜 두 부분이어야 해요.',
  server: (sub) => `학습자 ${sub}로 서버에 저장해요.`,
  expired: '토큰이 만료됐어요. ‘LMS 연동’에서 새 시험 토큰을 만들어 주세요.',
  invalid: '토큰을 확인하지 못했어요. 연동 키가 바뀌었는지 확인해 주세요.',
  local: '이 설치에는 LMS 표가 없어서 이 브라우저에만 저장해요.',
};

/** The `sub` claim of a learner token's payload, for the status line only; the server checks the signature. */
function tokenSubject(token) {
  try {
    const part = token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/');
    const json = new TextDecoder().decode(Uint8Array.from(atob(part), (char) => char.charCodeAt(0)));

    return String(JSON.parse(json).sub ?? '');
  } catch {
    return '';
  }
}

export function startLecture(document = globalThis.document) {
  const $ = (id) => document.getElementById(id);
  const element = $('player');
  const state = {
    resume: 'ask',
    seekLimit: 'free',
    maxRate: 2,
    completion: 90,
    tabs: { chapters: true, materials: true, transcript: true, notes: true },
    bookmarks: true,
    ads: 'off',
    token: '',
  };
  const progress = { storage: '', percent: 0, position: 0, active: 0, completed: false };
  let handle = null;
  let log = [];
  let building = Promise.resolve();

  const radios = (name) => [...document.querySelectorAll(`input[name="${name}"]`)];
  const server = () => Boolean(state.token);

  function showOptions() {
    const shown = server() ? { ...state, ...PRESET_RULES } : state;

    for (const name of ['resume', 'seekLimit', 'maxRate', 'ads'])
      for (const input of radios(name)) input.checked = input.value === String(shown[name]);

    $('completion').value = String(shown.completion);

    for (const button of document.querySelectorAll('[data-tab]'))
      button.setAttribute('aria-checked', String(state.tabs[button.dataset.tab]));

    $('bookmarks').setAttribute('aria-checked', String(state.bookmarks));

    // With a learner token the server keeps the preset's rules, so the page cannot change them.
    $('rules-off').hidden = !server();

    for (const input of [...radios('seekLimit'), ...radios('maxRate'), $('completion')]) input.disabled = server();
  }

  function showCode() {
    const block = $('code-html');

    block.querySelector('code').textContent = loaderSnippet({
      host: 'standalone',
      videoId: VIDEO.videoId,
      contentUrl: VIDEO.src,
      posterUrl: VIDEO.poster,
      title: VIDEO.title,
      loaderUrl: new URL('../player/loader.js', import.meta.url).pathname,
      presetId: 'lms',
      lms: { lectureUrl: VIDEO.lecture, learnerToken: state.token || undefined },
    });
    clearCopy(block);
  }

  function showStatus() {
    const where = { server: '서버', local: '이 브라우저', none: '저장 안 함' }[progress.storage] ?? '불러오는 중';

    setStatus(
      $('stage-status'),
      `저장: ${where} · 진도 ${progress.percent}% · 본 곳 ${formatTime(progress.position)} · 학습 시간 ${formatTime(
        progress.active
      )} · ${progress.completed ? '완료' : '완료 전'}`
    );
  }

  function showLog() {
    const box = $('log');

    if (!log.length) {
      const empty = document.createElement('div');
      const lead = document.createElement('b');
      const rest = document.createElement('span');

      empty.className = 'sa-empty';
      lead.textContent = '아직 강의 이벤트가 없어요';
      rest.textContent = '재생하면 여기에 쌓여요.';
      empty.append(lead, rest);
      box.replaceChildren(empty);
      return;
    }

    const list = document.createElement('ol');

    list.className = 'sa-log';

    for (const entry of log) {
      const item = document.createElement('li');
      const time = document.createElement('time');
      const text = document.createElement('span');

      time.className = 'sa-num';
      time.textContent = entry.at;
      time.dateTime = entry.at;
      text.textContent = entry.text;
      item.append(time, text);
      list.append(item);
    }

    box.replaceChildren(list);
  }

  function eventText(type, detail) {
    const name = type.replace('solad-lms-', '');

    if (type === 'solad-lms-progress') return `${type} · ${detail.reason} · ${detail.percent}%`;

    if (type === 'solad-lms-ready') return `${type} · ${detail.storage}${detail.learnerError ? ` · ${detail.learnerError}` : ''}`;

    if (type === 'solad-lms-chapter') return `${type} · ${detail.index + 1}. ${detail.title}`;

    if (type === 'solad-lms-seek-blocked')
      return `${type} · ${formatTime(detail.requested)} → ${formatTime(detail.allowed)}`;

    if (type === 'solad-lms-note') return `${type} · ${detail.op} · ${detail.note.kind} ${formatTime(detail.note.time)}`;

    return `${type}${name === 'complete' ? ` · ${detail.percent}%` : ''}`;
  }

  function onLecture(event) {
    const { type, detail } = event;
    const at = new Date().toTimeString().slice(0, 8);
    const update = type === 'solad-lms-ready' ? detail.progress : detail;

    log = [{ at, text: eventText(type, detail) }, ...log].slice(0, LOG_SIZE);
    showLog();

    if (type === 'solad-lms-ready') {
      progress.storage = detail.storage;
      showToken(detail);
    }

    if (update && 'percent' in update) {
      progress.percent = update.percent;
      progress.position = update.position;
      progress.active = update.activeSeconds;
      progress.completed = update.completed;
    }

    showStatus();
  }

  function showToken(detail) {
    const status = $('token-status');

    if (!state.token) setStatus(status, '');
    else if (detail.storage === 'server') setStatus(status, TOKEN_TEXT.server(tokenSubject(state.token) || '?'));
    else if (detail.learnerError === 'expired') setStatus(status, TOKEN_TEXT.expired, 'is-warn');
    else if (detail.learnerError) setStatus(status, TOKEN_TEXT.invalid, 'is-warn');
    else setStatus(status, TOKEN_TEXT.local, 'is-warn');
  }

  function overrides() {
    const lms = { enabled: true, resume: state.resume, tabs: state.tabs, bookmarks: state.bookmarks, ads: state.ads };

    // With a learner token the server's rules apply (handoff 4.1), so the page sends none.
    if (!server()) Object.assign(lms, { seekLimit: state.seekLimit, maxRate: state.maxRate, completion: state.completion });

    return { lms };
  }

  function build() {
    building = building.then(async () => {
      handle?.destroy();
      handle = null;
      Object.assign(progress, { storage: '', percent: 0, position: 0, active: 0, completed: false });
      showStatus();

      try {
        handle = await mount(element, {
          videoId: VIDEO.videoId,
          src: VIDEO.src,
          poster: VIDEO.poster,
          title: VIDEO.title,
          lecture: VIDEO.lecture,
          learnerToken: state.token || undefined,
          preset: 'lms',
          overrides: overrides(),
        });
      } catch (error) {
        if (error?.name !== 'AbortError') setStatus($('stage-status'), '플레이어를 만들지 못했어요.', 'is-bad');
      }
    });
    return building;
  }

  function rebuild() {
    showOptions();
    showCode();
    void build();
  }

  for (const type of ['ready', 'progress', 'complete', 'chapter', 'seek-blocked', 'note'])
    element.addEventListener(`solad-lms-${type}`, onLecture);

  for (const name of ['resume', 'seekLimit', 'maxRate', 'ads'])
    for (const input of radios(name))
      input.addEventListener('change', () => {
        state[name] = name === 'maxRate' ? Number(input.value) : input.value;
        rebuild();
      });

  $('completion').addEventListener('change', () => {
    const value = Math.round(Number($('completion').value));

    if (value >= 50 && value <= 100 && value !== state.completion) {
      state.completion = value;
      rebuild();
    } else $('completion').value = String(state.completion);
  });

  for (const button of document.querySelectorAll('[data-tab]'))
    button.addEventListener('click', () => {
      state.tabs = { ...state.tabs, [button.dataset.tab]: !state.tabs[button.dataset.tab] };
      rebuild();
    });

  $('bookmarks').addEventListener('click', () => {
    state.bookmarks = !state.bookmarks;
    rebuild();
  });

  $('token-apply').addEventListener('click', () => {
    const token = $('token').value.trim();

    if (token && !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) {
      setStatus($('token-status'), TOKEN_TEXT.shape, 'is-bad');
      $('token').focus();
      return;
    }

    state.token = token;
    rebuild();
  });

  $('token-clear').addEventListener('click', () => {
    $('token').value = '';
    state.token = '';
    setStatus($('token-status'), '');
    rebuild();
  });

  for (const input of radios('st-w'))
    input.addEventListener('change', () => ($('root').dataset.width = input.value));

  for (const button of document.querySelectorAll('[data-time]'))
    button.addEventListener('click', () => {
      const media = handle?.media;
      if (!media) return;

      // Through the media, so the lecture's rules apply as they do to any seek.
      media.currentTime = Number(button.dataset.time);
      media.play()?.catch?.(() => {});
    });

  $('reload').addEventListener('click', () => void build());

  $('clear').addEventListener('click', () => $('clear-dialog').showModal());
  $('clear-dialog').addEventListener('close', async () => {
    if ($('clear-dialog').returnValue !== 'clear') return;

    handle?.destroy();
    handle = null;
    clearLocalProgress(VIDEO.videoId);
    await build();
    setStatus($('stage-status'), '이 브라우저의 학습 기록을 지웠어요.');
  });

  $('clear-log').addEventListener('click', () => {
    log = [];
    showLog();
  });

  bindCopy($('code-html'));

  fetch(VIDEO.src, { method: 'HEAD' })
    .then((response) => ($('no-video').hidden = response.ok))
    .catch(() => ($('no-video').hidden = false));

  showLog();
  rebuild();
}
