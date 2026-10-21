/**
 * The PlayerStage parts the demo and the playback test share (design PlayerStage, ActivityLog): width view, scene
 * shortcuts, the latest-progress line and the progress log.
 */
import { clockText, nowText, progressText } from './ad-progress.js';

export const SCENES = ['start', 'before-midroll', 'before-end'];
export const NOT_READY_REASON = '플레이어가 준비되면 쓸 수 있어요.';
export const NO_MIDROLL_REASON = '이 편성에는 미드롤이 없어서 "미드롤 앞"을 쓸 수 없어요.';

/** "보이는 폭 768px · 실제의 63%로 줄여 보여요" and the like. */
export function scaleText(choice, width, scale) {
  const label = choice === 'fill' ? '자리 폭' : '보이는 폭';

  return `${label} ${width}px · ${scale < 1 ? `실제의 ${Math.round(scale * 100)}%로 줄여 보여요` : '실제 크기예요'}`;
}

/** Draw the stage at the chosen width, scaled down when the room is narrower; the height stays 16:9. */
export function fitStage(stage) {
  const view = stage.querySelector('.sa-stage-view');
  const frame = stage.querySelector('.sa-stage-frame');
  const note = stage.querySelector('[data-scale-note]');
  const picked = stage.querySelector('.sa-stage-bar input:checked');

  if (!view || !frame || !picked || view.classList.contains('is-empty')) return;

  const room = view.clientWidth;
  const width = picked.value === 'fill' ? room : Number(picked.value);
  const scale = width > 0 ? Math.min(1, room / width) : 1;

  frame.style.setProperty('--_w', `${width}px`);
  frame.style.setProperty('--_s', String(scale));
  view.style.setProperty('--_h', `${Math.round((width * 9) / 16) * scale}px`);

  if (note) note.textContent = scaleText(picked.value, width, scale);
}

/** Fit now, on a width choice and whenever the stage changes size. */
export function watchStage(stage) {
  stage.addEventListener('change', () => fitStage(stage));

  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => fitStage(stage)).observe(stage);

  fitStage(stage);
}

/**
 * Enable the scene buttons (`button[data-scene]`) for a ready player, or block them all with `reason`. "미드롤 앞" is
 * blocked on its own when the schedule has no midroll.
 */
export function setScenes(tools, { ready, schedule, reason = NOT_READY_REASON }) {
  const group = tools.querySelector('[role="group"]');
  const why = tools.querySelector('[data-scene-why]');
  const midWhy = tools.querySelector('[data-midroll-why]');
  const midroll = (schedule?.breaks ?? []).some((item) => item.position === 'mid');

  for (const button of tools.querySelectorAll('button[data-scene]')) {
    const noMid = button.dataset.scene === 'before-midroll' && ready && !midroll;

    button.disabled = !ready || noMid;

    if (noMid) button.setAttribute('aria-describedby', midWhy.id);
    else button.removeAttribute('aria-describedby');
  }

  why.textContent = ready ? '' : reason;
  why.hidden = ready;
  midWhy.hidden = !ready || midroll;

  if (ready) group.removeAttribute('aria-describedby');
  else group.setAttribute('aria-describedby', why.id);
}

/** The latest-progress line (`p.sa-stage-now`): "최근 광고 진행" + text + time. Not a live region. */
export function showNow(line, entry) {
  const document = line.ownerDocument;
  const label = document.createElement('span');
  const text = document.createElement('span');

  label.textContent = '최근 광고 진행';
  text.textContent = entry ? nowText(entry) : '아직 광고가 나오지 않았어요';
  line.replaceChildren(label, text);

  if (!entry) return;

  const time = document.createElement('time');

  time.textContent = clockText(entry.at);
  time.dateTime = time.textContent;
  line.append(time);
}

/** The progress log (`div.sa-logbox`): newest first, or the empty state. */
export function showLog(box, log) {
  const document = box.ownerDocument;

  if (!log.length) {
    const empty = document.createElement('div');
    const lead = document.createElement('b');
    const rest = document.createElement('span');

    empty.className = 'sa-empty';
    lead.textContent = '아직 광고 진행이 없어요';
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
    time.textContent = clockText(entry.at);
    time.dateTime = time.textContent;
    text.textContent = progressText(entry);
    item.append(time, text);
    list.append(item);
  }

  box.replaceChildren(list);
}
