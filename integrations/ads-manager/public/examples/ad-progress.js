/** Ad progress lines for the demo's event log and the admin preview (contract A2-D 3, 6). */

/** The demo keeps the latest 20 events. */
export const EVENT_LOG_LIMIT = 20;

const positionNames = { pre: '프리롤', mid: '미드롤', post: '포스트롤' };
const kindNames = {
  start: '시작',
  complete: '끝남',
  skip: '건너뜀',
  click: '클릭',
  error: '오류',
  cancel: '중단',
};

/**
 * `{ kind, position, at, index, count }` for an `ads-event` detail: the break position and the ad's place in its break
 * come from the schedule, `at` is the observation time. Unknown breaks keep an empty position.
 */
export function adProgress(event, schedule) {
  const item = schedule?.breaks?.find((entry) => entry.breakId === event?.breakId);
  const ads = Array.isArray(item?.ads) ? item.ads : [];
  const index = ads.findIndex((ad) => ad.itemId === event?.itemId);

  return {
    kind: typeof event?.type === 'string' ? event.type : '',
    position: typeof item?.position === 'string' ? item.position : '',
    at: typeof event?.occurredAt === 'string' ? event.occurredAt : new Date().toISOString(),
    index: index + 1,
    count: ads.length,
  };
}

function place({ position, index, count }) {
  return [positionNames[position] ?? position, index > 0 && count > 0 ? `${index}/${count}` : '']
    .filter(Boolean)
    .join(' ');
}

/** A log line: "프리롤 1/2 · 시작"; parts the event does not have are left out. */
export function progressText(entry) {
  return [place(entry), kindNames[entry.kind] ?? entry.kind].filter(Boolean).join(' · ');
}

/** The stage's latest-progress line: "프리롤 1/2 재생 중" while an ad plays, otherwise the log line. */
export function nowText(entry) {
  return entry.kind === 'start' ? [place(entry), '재생 중'].filter(Boolean).join(' ') : progressText(entry);
}

/** `HH:MM:SS` local time of an entry, for `time` text and `datetime`. */
export function clockText(at) {
  const date = new Date(at);

  return Number.isNaN(date.getTime())
    ? ''
    : [date.getHours(), date.getMinutes(), date.getSeconds()].map((part) => String(part).padStart(2, '0')).join(':');
}

/** A new log with `entry` first, at most `EVENT_LOG_LIMIT` long. */
export function pushProgress(log, entry) {
  return [entry, ...log].slice(0, EVENT_LOG_LIMIT);
}
