/**
 * Solad lecture (LMS) player (`.agents/plans/ads-lms-spec.md` section 2, `ads-lms-design-handoff.md`). The loader
 * imports it only for a render with `lms`: progress from the parts actually played, resume, the "watched only" seek
 * limit, the rate cap, the lecture manifest and transcript, storage (server, this browser or none), reports, the six
 * `solad-lms-*` events and the bookmark key. The panel lives in `lms-panel.js`; the skin draws the slider layers and
 * the bookmark button (`solad-video-skin.js`).
 *
 * The pure helpers at the top are exported for tests.
 */

// Video.js `DEFAULT_RATES`; the settings menu shows these and the skin hides the ones above the cap.
export const RATES = [0.2, 0.5, 0.7, 1, 1.2, 1.5, 1.7, 2];
// Played parts closer than this are one part (spec 2.2).
const GAP = 0.5;
const REPORT_MS = 15000;
const BLOCK_NOTE_MS = 2000;
const NOTE_LIMIT = 200;
const NOTE_MAX = 1000;
const BOOKMARK_MAX = 80;
const STORE_PREFIX = 'solad-lms:v1:';
// oxlint-disable-next-line no-control-regex
const controlPattern = /[\u0000-\u001f\u007f-\u009f؜‎‏‪-‮⁦-⁩]+/gu;

const svg = (body, fill = 'currentColor') =>
  `<svg viewBox="0 0 18 18" fill="${fill}" aria-hidden="true" focusable="false">${body}</svg>`;
const stroke = (body) =>
  `<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
// Handoff 1.3: one icon per toast kind.
const TOAST_ICONS = {
  resumed: svg(
    '<path d="M9 1a7.98 7.98 0 0 1 6.132 2.867l1.441-1.44a.25.25 0 0 1 .427.177V6.75a.25.25 0 0 1-.25.25h-4.146a.25.25 0 0 1-.177-.427L13.71 5.29A5.99 5.99 0 0 0 9 3a6 6 0 0 0-4.242 10.242l-1.415 1.415A8 8 0 0 1 9 1"/>'
  ),
  blocked: stroke('<rect x="3.5" y="8" width="11" height="8" rx="1.5"/><path d="M6 8V5.5a3 3 0 0 1 6 0V8"/>'),
  bookmark: svg(
    '<path d="M5 1h8a2.5 2.5 0 0 1 2.5 2.5v12.6a.9.9 0 0 1-1.39.76L9 13.6l-5.11 3.26a.9.9 0 0 1-1.39-.76V3.5A2.5 2.5 0 0 1 5 1Z"/>'
  ),
  limit: stroke('<path d="M9 2.5 16.5 15.5h-15Z"/><path d="M9 7.5v3.5M9 13.5v.01"/>'),
  done: stroke('<circle cx="9" cy="9" r="7.5"/><path d="m5.75 9.25 2.25 2.25 4.25-4.5"/>'),
};

const round = (value) => Math.round(value * 1000) / 1000;
const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

/** Sorted parts with overlaps and gaps under 0.5 seconds joined. */
export function mergeSegments(segments) {
  const merged = [];
  const valid = segments.filter(
    (part) => Array.isArray(part) && Number.isFinite(part[0]) && Number.isFinite(part[1]) && part[1] > part[0]
  );

  for (const [start, end] of [...valid].sort((a, b) => a[0] - b[0])) {
    const previous = merged.at(-1);

    if (previous && start <= previous[1] + GAP) previous[1] = Math.max(previous[1], end);
    else merged.push([start, end]);
  }

  return merged;
}

export function addSegment(segments, start, end) {
  return mergeSegments([...segments, [start, end]]);
}

export function segmentsLength(segments) {
  return segments.reduce((total, [start, end]) => total + (end - start), 0);
}

/** The xAPI Video Profile `played-segments` text: `"0.000[.]12.000[,]14.000[.]21.000"`. */
export function playedSegments(segments) {
  return segments.map(([start, end]) => `${start.toFixed(3)}[.]${end.toFixed(3)}`).join('[,]');
}

/** Whole percent watched, rounded down (spec 2.2). */
export function percentOf(segments, duration) {
  if (!(duration > 0)) return 0;

  return Math.min(100, Math.floor((segmentsLength(segments) / duration) * 100 + 1e-9));
}

/** The menu rates up to the cap. */
export function rateSteps(maxRate) {
  return RATES.filter((rate) => rate <= maxRate + 1e-6);
}

/** One step up (`1`) or down (`-1`) inside the capped list, stopping at both ends instead of wrapping (spec 2.4). */
export function stepRate(current, direction, maxRate) {
  const rates = rateSteps(maxRate);
  let index = rates.findIndex((rate) => Math.abs(rate - current) < 1e-6);

  // A rate outside the list moves to its nearest neighbour in that direction.
  if (index < 0) {
    const above = rates.findIndex((rate) => rate > current);

    if (direction > 0) return above < 0 ? rates.at(-1) : rates[above];

    index = above < 0 ? rates.length : above;
  }

  return rates[Math.max(0, Math.min(rates.length - 1, index + direction))];
}

/** `m:ss`, or `h:mm:ss` from one hour, like the default skin's time display. */
export function formatTime(seconds) {
  const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = String(total % 60).padStart(2, '0');

  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`;
}

/** The resume position: only from 5 seconds and earlier than 10 seconds before the end (spec 2.3). */
export function resumeTime(position, duration) {
  if (!Number.isFinite(position) || position < 5) return null;

  return Number.isFinite(duration) && duration > 0 && position >= duration - 10 ? null : position;
}

function manifestUrl(value) {
  return typeof value === 'string' && value.length <= 2048 && /^(\/|https?:\/\/)/i.test(value.trim())
    ? value.trim()
    : null;
}

function manifestText(value, min, max) {
  if (typeof value !== 'string') return null;

  const text = value.replace(controlPattern, ' ').trim();

  return [...text].length >= min && [...text].length <= max ? text : null;
}

/**
 * Read a lecture manifest (spec 2.5). Wrong items are dropped and counted in `dropped`; a value that is not a manifest
 * gives `failed: true` and no items.
 */
export function readManifest(value) {
  const empty = { chapters: [], slides: [], files: [], transcript: null, dropped: 0, failed: true };

  if (!isRecord(value) || value.version !== 1) return empty;

  let dropped = 0;
  const list = (items, limit, read) => {
    if (items === undefined) return [];

    if (!Array.isArray(items)) {
      dropped++;
      return [];
    }

    const kept = [];

    for (const item of items) {
      const result = isRecord(item) ? read(item) : null;

      if (result && kept.length < limit) kept.push(result);
      else dropped++;
    }

    return kept;
  };
  const start = (item) => (Number.isFinite(item.start) && item.start >= 0 ? item.start : null);
  const chapters = list(value.chapters, 100, (item) => {
    const title = manifestText(item.title, 1, 80);

    return title !== null && start(item) !== null ? { start: item.start, title } : null;
  });
  // Chapters must rise; a chapter that does not is dropped.
  const rising = chapters.filter((chapter, index) => index === 0 || chapter.start > chapters[index - 1].start);
  const slides = list(value.slides, 300, (item) => {
    const image = manifestUrl(item.image);
    const alt = manifestText(item.alt, 1, 160);
    const title = item.title === undefined ? '' : manifestText(item.title, 0, 80);

    return image && alt !== null && title !== null && start(item) !== null
      ? { start: item.start, image, alt, title }
      : null;
  }).sort((a, b) => a.start - b.start);
  const files = list(value.files, 50, (item) => {
    const url = manifestUrl(item.url);
    const title = manifestText(item.title, 1, 80);
    const size = item.size === undefined || item.size === '' ? '' : manifestText(item.size, 1, 16);

    return url && title !== null && size !== null ? { title, url, size } : null;
  });
  let transcript = null;

  if (value.transcript !== undefined) {
    const src = isRecord(value.transcript) ? manifestUrl(value.transcript.src) : null;

    if (src) transcript = { src, lang: typeof value.transcript.lang === 'string' ? value.transcript.lang : '' };
    else dropped++;
  }

  dropped += chapters.length - rising.length;

  return { chapters: rising, slides, files, transcript, dropped, failed: false };
}

function vttSeconds(stamp) {
  const parts = stamp.trim().split(':').map(Number);
  if (parts.some((part) => !Number.isFinite(part))) return null;

  return parts.reduce((total, part) => total * 60 + part, 0);
}

/** The cues of a WebVTT text as `{start, end, text}`; notes, styles, regions and cue tags are left out. */
export function parseVtt(text) {
  if (typeof text !== 'string' || !/^﻿?WEBVTT/.test(text)) return [];

  const cues = [];

  for (const block of text.replace(/\r\n?/g, '\n').split(/\n{2,}/)) {
    const lines = block.split('\n');
    const index = lines.findIndex((line) => line.includes('-->'));
    if (index < 0 || /^(NOTE|STYLE|REGION)\b/.test(lines[0])) continue;

    const [from, rest] = lines[index].split('-->');
    const start = vttSeconds(from);
    const end = vttSeconds(rest.trim().split(/\s+/)[0]);
    const body = lines
      .slice(index + 1)
      .join(' ')
      .replace(/<[^>]*>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .trim();

    if (start !== null && end !== null && end > start && body) cues.push({ start, end, text: body });
  }

  return cues.sort((a, b) => a.start - b.start);
}

/** WebVTT chapters for `[{start, title}]`, the last ending at `duration` (spec 2.5). */
export function chaptersVtt(chapters, duration) {
  const stamp = (seconds) => new Date(Math.max(0, seconds) * 1000).toISOString().slice(11, 23);
  const cues = chapters.map(({ start, title }, index) => {
    const end = chapters[index + 1]?.start ?? Math.max(duration, start + 1);

    return `${index + 1}\n${stamp(start)} --> ${stamp(end)}\n${title.replace(/-->/g, '→')}`;
  });

  return `WEBVTT\n\n${cues.join('\n\n')}\n`;
}

/** The index of the item whose `start` is the last at or before `time`, or `-1`. */
export function itemAt(items, time) {
  let found = -1;

  for (let index = 0; index < items.length && items[index].start <= time + 1e-3; index++) found = index;

  return found;
}

/** The share of `[start, end)` covered by `segments`, 0–100 rounded down. */
export function partPercent(segments, start, end) {
  if (!(end > start)) return 0;

  let covered = 0;

  for (const [from, to] of segments) covered += Math.max(0, Math.min(to, end) - Math.max(from, start));

  return Math.min(100, Math.floor((covered / (end - start)) * 100 + 1e-9));
}

/** The `solad-lms-progress` detail (spec 2.8). */
export function progressDetail(state) {
  const segments = state.segments.map(([start, end]) => [round(start), round(end)]);
  const ratio = state.duration > 0 ? Math.min(1, segmentsLength(state.segments) / state.duration) : 0;

  return {
    videoId: state.videoId,
    sessionId: state.sessionId,
    seq: state.seq,
    reason: state.reason,
    position: round(state.position),
    duration: round(state.duration || 0),
    rate: state.rate,
    segments,
    playedSegments: playedSegments(segments),
    progress: Math.round(ratio * 10000) / 10000,
    percent: state.percent,
    threshold: state.completion / 100,
    maxWatched: round(state.maxWatched),
    activeSeconds: round(state.activeSeconds),
    completed: Boolean(state.completedAt),
  };
}

/** Note text the server accepts: no control or bidirectional control characters, so line breaks become spaces. */
export function cleanNoteText(value) {
  return String(value ?? '')
    .replace(controlPattern, ' ')
    .replace(/ {2,}/g, ' ')
    .trim();
}

// Handoff 5.1 (ko and en); ja and zh-CN translated for L-2.
const TEXT = {
  ko: {
    'resume.title': '지난번 {time}까지 봤어요',
    'resume.meta': '진도 {p}% · 완료 기준 {t}%',
    'resume.continue': '이어서 보기',
    'resume.restart': '처음부터',
    'toast.resumed': '{time}부터 이어서 재생해요',
    'toast.seekBlocked': '아직 보지 않은 구간이에요. {time}까지만 이동할 수 있어요.',
    'toast.bookmarked': '북마크를 추가했어요 · {time}',
    'toast.noteLimit': '메모와 북마크는 200개까지예요. 지운 뒤에 더해 주세요.',
    'toast.completed': '강의를 완료했어요',
    'panel.label': '강의 진도와 자료',
    'head.progress': '진도 {p}%',
    'head.threshold': '완료 기준 {t}%',
    'head.barLabel': '진도 {p}%, 완료 기준 {t}%',
    'state.learning': '학습 중',
    'state.done': '완료 · {date}',
    'state.ad': '광고 중',
    'store.server': '학습 기록이 저장돼요',
    'store.local': '로그인하지 않아 이 브라우저에만 저장돼요',
    'store.preview': '미리보기는 진도를 저장하지 않아요',
    'store.loading': '진도를 불러오는 중이에요',
    'store.retrying': '서버에 저장하지 못해 이 브라우저에 임시로 저장하고 있어요. 연결되면 다시 보내요.',
    'store.tokenInvalid': '학습자 정보를 확인하지 못해 이 브라우저에만 저장돼요',
    'store.tokenExpired': '학습자 토큰이 만료돼 이 브라우저에만 저장돼요',
    'tabs.label': '강의 자료',
    'tab.chapters': '목차',
    'tab.materials': '자료',
    'tab.transcript': '스크립트',
    'tab.notes': '메모',
    'tab.notesCount': '메모 {n}개',
    'chapter.watched': '{p}% 봄',
    'chapter.done': '완료',
    'chapter.locked': '잠김',
    'slide.prev': '이전 슬라이드',
    'slide.next': '다음 슬라이드',
    'slide.count': '{n} / {total}',
    'slide.follow': '영상 따라가기',
    'slide.goto': '이 장면으로 이동',
    'slide.failed': '슬라이드를 불러오지 못했어요',
    'files.title': '내려받기 자료',
    'files.newTab': '(새 탭에서 열림)',
    'search.placeholder': '스크립트에서 찾기',
    'search.label': '스크립트 검색',
    'search.count': '{n}개 중 {m}번째',
    'search.found': '{n}개 찾았어요',
    'search.prev': '이전 결과',
    'search.next': '다음 결과',
    'search.none': '‘{q}’와 맞는 문장이 없어요.',
    'search.noneHint': '다른 낱말로 찾아보세요.',
    'transcript.autoScroll': '자동 스크롤',
    'note.label': '{time}에 메모',
    'note.placeholder': '이 장면에 남길 메모',
    'note.save': '저장',
    'note.cancel': '취소',
    'note.note': '메모',
    'note.bookmark': '북마크',
    'note.goto': '{time}로 이동, {kind}',
    'note.edit': '{time} {kind} 고치기',
    'note.delete': '{time} {kind} 지우기',
    'note.confirm': '이 메모를 지울까요?',
    'note.confirmBookmark': '이 북마크를 지울까요?',
    'note.confirmDelete': '지우기',
    'note.saved': '메모를 저장했어요',
    'note.deleted': '메모를 지웠어요',
    'note.failed': '저장하지 못했어요.',
    'note.retry': '다시 시도',
    'note.empty': '아직 메모가 없어요.',
    'note.emptyHint': '지금 장면에 떠오른 생각을 남겨 보세요. 북마크 버튼이나 B 키로 장면만 표시할 수도 있어요.',
    'note.limit': '메모와 북마크는 200개까지예요. 지운 뒤에 더할 수 있어요.',
    'note.tooLong': '1000자까지 쓸 수 있어요',
    'note.count': '{n} / 1000',
    loading: '강의 자료를 불러오는 중이에요',
    'manifest.partial': '강의 자료 중 {n}개를 읽지 못했어요',
    'manifest.failed': '강의 자료를 읽지 못했어요',
  },
  en: {
    'resume.title': 'You stopped at {time} last time',
    'resume.meta': '{p}% watched · {t}% to complete',
    'resume.continue': 'Resume',
    'resume.restart': 'Start over',
    'toast.resumed': 'Resuming from {time}',
    'toast.seekBlocked': 'You haven’t watched this part yet. You can skip ahead up to {time}.',
    'toast.bookmarked': 'Bookmark added · {time}',
    'toast.noteLimit': 'You can keep up to 200 notes and bookmarks. Delete some to add more.',
    'toast.completed': 'Lecture completed',
    'panel.label': 'Lecture progress and materials',
    'head.progress': '{p}% watched',
    'head.threshold': '{t}% to complete',
    'head.barLabel': '{p}% watched, {t}% to complete',
    'state.learning': 'In progress',
    'state.done': 'Completed · {date}',
    'state.ad': 'Ad playing',
    'store.server': 'Your progress is saved',
    'store.local': 'You’re not signed in, so progress is saved only in this browser',
    'store.preview': 'Preview doesn’t save progress',
    'store.loading': 'Loading your progress',
    'store.retrying': 'Couldn’t save to the server. Saving in this browser for now and will retry.',
    'store.tokenInvalid': 'We couldn’t verify the learner, so progress is saved only in this browser',
    'store.tokenExpired': 'The learner token expired, so progress is saved only in this browser',
    'tabs.label': 'Lecture materials',
    'tab.chapters': 'Chapters',
    'tab.materials': 'Materials',
    'tab.transcript': 'Transcript',
    'tab.notes': 'Notes',
    'tab.notesCount': 'Notes, {n}',
    'chapter.watched': '{p}% watched',
    'chapter.done': 'Completed',
    'chapter.locked': 'Locked',
    'slide.prev': 'Previous slide',
    'slide.next': 'Next slide',
    'slide.count': '{n} / {total}',
    'slide.follow': 'Follow video',
    'slide.goto': 'Go to this scene',
    'slide.failed': 'Couldn’t load the slide',
    'files.title': 'Downloads',
    'files.newTab': '(opens in a new tab)',
    'search.placeholder': 'Search transcript',
    'search.label': 'Search transcript',
    'search.count': '{m} of {n}',
    'search.found': '{n} results',
    'search.prev': 'Previous result',
    'search.next': 'Next result',
    'search.none': 'No lines match “{q}”.',
    'search.noneHint': 'Try another word.',
    'transcript.autoScroll': 'Auto-scroll',
    'note.label': 'Note at {time}',
    'note.placeholder': 'Write a note for this moment',
    'note.save': 'Save',
    'note.cancel': 'Cancel',
    'note.note': 'note',
    'note.bookmark': 'bookmark',
    'note.goto': 'Go to {time}, {kind}',
    'note.edit': 'Edit {kind} at {time}',
    'note.delete': 'Delete {kind} at {time}',
    'note.confirm': 'Delete this note?',
    'note.confirmBookmark': 'Delete this bookmark?',
    'note.confirmDelete': 'Delete',
    'note.saved': 'Note saved',
    'note.deleted': 'Note deleted',
    'note.failed': 'Couldn’t save.',
    'note.retry': 'Try again',
    'note.empty': 'No notes yet.',
    'note.emptyHint': 'Write down a thought about this moment, or press the bookmark button or B to mark it.',
    'note.limit': 'You can keep up to 200 notes and bookmarks. Delete some to add more.',
    'note.tooLong': 'Up to 1,000 characters',
    'note.count': '{n} / 1000',
    loading: 'Loading lecture materials',
    'manifest.partial': 'Couldn’t read {n} lecture items',
    'manifest.failed': 'Couldn’t read the lecture materials',
  },
  ja: {
    'resume.title': '前回は {time} まで視聴しました',
    'resume.meta': '進捗 {p}% · 完了基準 {t}%',
    'resume.continue': '続きから見る',
    'resume.restart': '最初から',
    'toast.resumed': '{time} から再生します',
    'toast.seekBlocked': 'まだ視聴していない部分です。{time} まで移動できます。',
    'toast.bookmarked': 'ブックマークを追加しました · {time}',
    'toast.noteLimit': 'メモとブックマークは 200 件までです。削除してから追加してください。',
    'toast.completed': '講義を完了しました',
    'panel.label': '講義の進捗と資料',
    'head.progress': '進捗 {p}%',
    'head.threshold': '完了基準 {t}%',
    'head.barLabel': '進捗 {p}%、完了基準 {t}%',
    'state.learning': '学習中',
    'state.done': '完了 · {date}',
    'state.ad': '広告再生中',
    'store.server': '学習記録が保存されます',
    'store.local': 'ログインしていないため、このブラウザーにのみ保存されます',
    'store.preview': 'プレビューでは進捗を保存しません',
    'store.loading': '進捗を読み込んでいます',
    'store.retrying': 'サーバーに保存できないため、このブラウザーに一時保存しています。接続したら再送します。',
    'store.tokenInvalid': '受講者を確認できないため、このブラウザーにのみ保存されます',
    'store.tokenExpired': '受講者トークンの期限が切れたため、このブラウザーにのみ保存されます',
    'tabs.label': '講義資料',
    'tab.chapters': '目次',
    'tab.materials': '資料',
    'tab.transcript': 'スクリプト',
    'tab.notes': 'メモ',
    'tab.notesCount': 'メモ {n} 件',
    'chapter.watched': '{p}% 視聴',
    'chapter.done': '完了',
    'chapter.locked': 'ロック中',
    'slide.prev': '前のスライド',
    'slide.next': '次のスライド',
    'slide.count': '{n} / {total}',
    'slide.follow': '動画に合わせる',
    'slide.goto': 'この場面へ移動',
    'slide.failed': 'スライドを読み込めませんでした',
    'files.title': 'ダウンロード資料',
    'files.newTab': '（新しいタブで開きます）',
    'search.placeholder': 'スクリプトを検索',
    'search.label': 'スクリプト検索',
    'search.count': '{n} 件中 {m} 件目',
    'search.found': '{n} 件見つかりました',
    'search.prev': '前の結果',
    'search.next': '次の結果',
    'search.none': '「{q}」に一致する文はありません。',
    'search.noneHint': '別の語句で検索してください。',
    'transcript.autoScroll': '自動スクロール',
    'note.label': '{time} のメモ',
    'note.placeholder': 'この場面のメモ',
    'note.save': '保存',
    'note.cancel': 'キャンセル',
    'note.note': 'メモ',
    'note.bookmark': 'ブックマーク',
    'note.goto': '{time} へ移動、{kind}',
    'note.edit': '{time} の{kind}を編集',
    'note.delete': '{time} の{kind}を削除',
    'note.confirm': 'このメモを削除しますか？',
    'note.confirmBookmark': 'このブックマークを削除しますか？',
    'note.confirmDelete': '削除',
    'note.saved': 'メモを保存しました',
    'note.deleted': 'メモを削除しました',
    'note.failed': '保存できませんでした。',
    'note.retry': '再試行',
    'note.empty': 'まだメモはありません。',
    'note.emptyHint':
      '今の場面で思ったことを残してみましょう。ブックマークボタンか B キーで場面だけ記録することもできます。',
    'note.limit': 'メモとブックマークは 200 件までです。削除すると追加できます。',
    'note.tooLong': '1000 文字まで入力できます',
    'note.count': '{n} / 1000',
    loading: '講義資料を読み込んでいます',
    'manifest.partial': '講義資料のうち {n} 件を読み込めませんでした',
    'manifest.failed': '講義資料を読み込めませんでした',
  },
  'zh-CN': {
    'resume.title': '上次看到 {time}',
    'resume.meta': '进度 {p}% · 完成标准 {t}%',
    'resume.continue': '继续观看',
    'resume.restart': '从头开始',
    'toast.resumed': '从 {time} 继续播放',
    'toast.seekBlocked': '这部分还没看过。最多只能跳到 {time}。',
    'toast.bookmarked': '已添加书签 · {time}',
    'toast.noteLimit': '笔记和书签最多 200 条。请删除后再添加。',
    'toast.completed': '课程已完成',
    'panel.label': '课程进度和资料',
    'head.progress': '进度 {p}%',
    'head.threshold': '完成标准 {t}%',
    'head.barLabel': '进度 {p}%，完成标准 {t}%',
    'state.learning': '学习中',
    'state.done': '已完成 · {date}',
    'state.ad': '广告播放中',
    'store.server': '学习记录会被保存',
    'store.local': '未登录，进度只保存在此浏览器中',
    'store.preview': '预览不保存进度',
    'store.loading': '正在加载进度',
    'store.retrying': '无法保存到服务器，暂时保存在此浏览器中，连接后会重新发送。',
    'store.tokenInvalid': '无法确认学员信息，进度只保存在此浏览器中',
    'store.tokenExpired': '学员令牌已过期，进度只保存在此浏览器中',
    'tabs.label': '课程资料',
    'tab.chapters': '目录',
    'tab.materials': '资料',
    'tab.transcript': '文稿',
    'tab.notes': '笔记',
    'tab.notesCount': '笔记 {n} 条',
    'chapter.watched': '已看 {p}%',
    'chapter.done': '已完成',
    'chapter.locked': '已锁定',
    'slide.prev': '上一张幻灯片',
    'slide.next': '下一张幻灯片',
    'slide.count': '{n} / {total}',
    'slide.follow': '跟随视频',
    'slide.goto': '跳到此场景',
    'slide.failed': '无法加载幻灯片',
    'files.title': '下载资料',
    'files.newTab': '（在新标签页中打开）',
    'search.placeholder': '在文稿中查找',
    'search.label': '搜索文稿',
    'search.count': '第 {m} 个，共 {n} 个',
    'search.found': '找到 {n} 个',
    'search.prev': '上一个结果',
    'search.next': '下一个结果',
    'search.none': '没有与“{q}”匹配的句子。',
    'search.noneHint': '请换个词试试。',
    'transcript.autoScroll': '自动滚动',
    'note.label': '{time} 的笔记',
    'note.placeholder': '为这个场景写笔记',
    'note.save': '保存',
    'note.cancel': '取消',
    'note.note': '笔记',
    'note.bookmark': '书签',
    'note.goto': '跳到 {time}，{kind}',
    'note.edit': '编辑 {time} 的{kind}',
    'note.delete': '删除 {time} 的{kind}',
    'note.confirm': '要删除这条笔记吗？',
    'note.confirmBookmark': '要删除这个书签吗？',
    'note.confirmDelete': '删除',
    'note.saved': '笔记已保存',
    'note.deleted': '笔记已删除',
    'note.failed': '保存失败。',
    'note.retry': '重试',
    'note.empty': '还没有笔记。',
    'note.emptyHint': '记下此刻的想法吧。也可以用书签按钮或 B 键只标记场景。',
    'note.limit': '笔记和书签最多 200 条。删除后可以再添加。',
    'note.tooLong': '最多 1000 个字符',
    'note.count': '{n} / 1000',
    loading: '正在加载课程资料',
    'manifest.partial': '有 {n} 项课程资料无法读取',
    'manifest.failed': '无法读取课程资料',
  },
};

/** A translator for a player locale; `{name}` slots take `values`. */
export function lmsText(locale) {
  const table = TEXT[locale] ?? TEXT.en;

  return (key, values = {}) =>
    (table[key] ?? TEXT.en[key] ?? key).replace(/\{(\w+)\}/g, (slot, name) => String(values[name] ?? slot));
}

export const LMS_LOCALES = Object.keys(TEXT);

// ---------------------------------------------------------------------------------------------------------------------
// @internal Video.js API: everything that touches unreleased player internals is in this block. The extension context
// `Symbol.for('@videojs/extension')` (packages/html/src/player/context.ts) and `PlayerExtension.mediaOverride`
// (packages/core/src/dom/extensions/extension.ts, media.ts) are internal and may change upstream; the L-1 spike
// (`.agents/plans/ads-lms-spike.md`) checked them against the bundled build.
// ---------------------------------------------------------------------------------------------------------------------

const EXTENSION_CONTEXT = Symbol.for('@videojs/extension');

/**
 * Ask the `<video-player>` around `from` for its extension registrar with the @lit/context request protocol
 * (`context-request`, bubbling and composed) that `<media-ads>` also uses; the provider answers synchronously.
 */
function requestRegistrar(from) {
  let value = null;
  const event = new Event('context-request', { bubbles: true, composed: true });

  Object.assign(event, {
    context: EXTENSION_CONTEXT,
    contextTarget: from,
    subscribe: false,
    callback: (provided) => {
      value = provided;
    },
  });
  from.dispatchEvent(event);
  return value;
}

/** One instance per player; the coordinator keeps one extension per class. */
class LectureExtension {
  #lecture;

  constructor(lecture) {
    this.#lecture = lecture;
  }

  attach(target) {
    this.#lecture.attachMedia(target?.media ?? null);
  }

  detach() {
    this.#lecture.attachMedia(null);
  }

  // Read on every media access, so `null` hands `currentTime` back to the next source.
  get mediaOverride() {
    return this.#lecture.override();
  }
}

/** Register `lecture` as a player extension; returns the release function, or `null` without a player. */
function registerExtension(from, lecture) {
  return requestRegistrar(from)?.registerExtension(new LectureExtension(lecture)) ?? null;
}

// --- end of the internal API block -----------------------------------------------------------------------------------

const api = new URL('../api/index.php', import.meta.url);

/** POST a public LMS action; resolves `{ok, status, data, error}` and never throws. */
async function post(action, body, { keepalive = false } = {}) {
  const url = new URL(api);

  url.searchParams.set('action', action);

  try {
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive,
    });
    const payload = await response.json().catch(() => null);

    return payload?.ok
      ? { ok: true, status: response.status, data: payload.data }
      : { ok: false, status: response.status, error: payload?.error ?? null };
  } catch {
    return { ok: false, status: 0, error: null };
  }
}

function readStore(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? 'null');

    return isRecord(value) ? value : null;
  } catch {
    return null;
  }
}

function writeStore(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private windows and full storage keep the progress in memory only.
  }
}

/** Remove this browser's copy for `videoId` (the demo's "clear" button). */
export function clearLocalProgress(videoId) {
  try {
    localStorage.removeItem(STORE_PREFIX + videoId);
  } catch {
    // Nothing stored.
  }
}

function noteId() {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.getRandomValues(new Uint8Array(10));

  return `n-${[...bytes].map((byte) => alphabet[byte % alphabet.length]).join('')}`;
}

function sessionUuid() {
  return crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function readNotes(value) {
  if (!Array.isArray(value)) return [];

  return value
    .filter((note) => isRecord(note) && typeof note.id === 'string' && Number.isFinite(note.time))
    .map(({ id, kind, time, text }) => ({
      id,
      kind: kind === 'bookmark' ? 'bookmark' : 'note',
      time,
      text: String(text ?? ''),
    }))
    .sort((a, b) => a.time - b.time);
}

async function loadManifest(lecture) {
  if (isRecord(lecture)) return readManifest(lecture);

  if (typeof lecture !== 'string') return null;

  try {
    const response = await fetch(lecture, { credentials: 'same-origin' });

    return readManifest(response.ok ? await response.json() : null);
  } catch {
    return readManifest(null);
  }
}

async function loadCues(src) {
  if (!src) return [];

  try {
    const response = await fetch(src, { credentials: 'same-origin' });

    return response.ok ? parseVtt(await response.text()) : [];
  } catch {
    return [];
  }
}

function isEditable(event) {
  const element = event.composedPath()[0];

  return (
    element instanceof HTMLElement &&
    (element.isContentEditable || /^(input|textarea|select)$/i.test(element.localName))
  );
}

/**
 * Attach the lecture to a mounted Video.js player.
 *
 * - `element`: the loader placeholder, where the events are dispatched
 * - `skin`, `media`: the built player
 * - `panel`: the `<solad-lms-panel>` or `null`
 * - `rules`: the render `lms`; `lecture`: manifest URL or object; `captions`: the `data-captions` URL
 * - `preview`: no storage, events or reports
 *
 * Returns `{destroy, state}`.
 */
export function attachLecture({
  element,
  skin,
  media,
  panel,
  rules,
  videoId,
  presetId,
  lecture,
  learnerToken,
  captions,
  language,
  preview = false,
}) {
  const t = lmsText(language);
  const root = skin.shadowRoot;
  const container = root?.querySelector('media-container') ?? skin;
  const slider = root?.querySelector('media-time-slider') ?? null;
  const listeners = new AbortController();
  const { signal } = listeners;
  const storeKey = STORE_PREFIX + videoId;
  const state = {
    videoId,
    sessionId: sessionUuid(),
    seq: 0,
    storage: preview ? 'none' : 'local',
    learner: null,
    lmsToken: null,
    completion: rules.completion,
    seekLimit: rules.seekLimit,
    maxRate: rules.maxRate,
    segments: [],
    maxWatched: 0,
    position: 0,
    duration: NaN,
    percent: 0,
    completedAt: null,
    activeSeconds: 0,
    notes: [],
    manifest: null,
    cues: [],
    chapter: -1,
    ad: false,
    ready: false,
  };
  let override = null;
  let release = null;
  let realMedia = media;
  let last = 0;
  let lastWall = 0;
  let reverting = false;
  let lastBlocked = 0;
  let unsentActive = 0;
  let failures = 0;
  let storeNote = preview ? 'preview' : 'loading';
  let dirty = false;
  let timer = 0;
  let paintFrame = 0;
  let resumeOpen = false;
  let destroyed = false;

  const limiting = () => state.seekLimit === 'watched' && !state.completedAt;
  const allowed = () => state.maxWatched + 1;
  const adsActive = () => Boolean(container.querySelector(':scope > [data-ads-overlay]'));
  const dispatch = (type, detail) => {
    if (!preview) element.dispatchEvent(new CustomEvent(type, { bubbles: true, detail }));
  };

  // --- player UI built by the skin -----------------------------------------------------------------------------------

  const live = root?.querySelector('.solad-lms-live');
  let announced = '';

  function announce(text) {
    if (!live || !text) return;

    // The same text again is cleared first so it is read again.
    if (text === announced) {
      live.textContent = '';
      setTimeout(() => (live.textContent = text), 100);
    } else live.textContent = text;

    announced = text;
  }

  let toastTimer = 0;
  let toastKind = '';

  function toast(kind, text, ms) {
    const box = root?.querySelector('.solad-lms-toast');
    if (!box || adsActive()) return;

    clearTimeout(toastTimer);
    box.dataset.kind = kind;
    box.querySelector('.solad-lms-toast-icon').innerHTML = TOAST_ICONS[kind] ?? '';
    // Only this file's text and times go in here.
    box.querySelector('.solad-lms-toast-text').innerHTML = text;
    box.hidden = false;
    container.toggleAttribute('data-solad-lms-toast', true);
    requestAnimationFrame(() => box.setAttribute('data-open', ''));
    toastKind = kind;
    toastTimer = setTimeout(() => {
      box.removeAttribute('data-open');
      container.removeAttribute('data-solad-lms-toast');
      toastTimer = setTimeout(() => {
        if (toastKind === kind) box.hidden = true;
      }, 160);
    }, ms);
    announce(box.textContent.trim());
  }

  const timeHtml = (seconds) => `<b>${formatTime(seconds)}</b>`;

  function blocked(requested) {
    const now = performance.now();

    // Every blocked seek is an event, so a site can count attempts; only the notice waits 2 seconds (spec 2.4).
    dispatch('solad-lms-seek-blocked', { requested: round(requested), allowed: round(allowed()) });

    if (now - lastBlocked < BLOCK_NOTE_MS) return;

    lastBlocked = now;
    toast('blocked', t('toast.seekBlocked', { time: timeHtml(allowed()) }), 4000);
  }

  function clamp(value) {
    if (!limiting() || !(value > allowed())) return value;

    blocked(value);
    return allowed();
  }

  function paint() {
    paintFrame = 0;

    const duration = realMedia?.duration;

    if (slider && duration > 0) {
      const at = (seconds) => `${Math.min(100, (seconds / duration) * 100).toFixed(3)}%`;
      const stops = state.segments.map(
        ([start, end]) =>
          `transparent ${at(start)}, var(--solad-lms-watched-color) ${at(start)} ${at(end)}, transparent ${at(end)}`
      );

      slider.style.setProperty(
        '--solad-lms-watched',
        stops.length ? `linear-gradient(to right, ${stops.join(', ')})` : 'none'
      );

      const limit = limiting() && allowed() < duration;

      slider.style.setProperty('--solad-lms-limit', at(Math.min(allowed(), duration)));
      slider.toggleAttribute('data-solad-lms-limit', limit);
    }

    panel?.update(panelState());
  }

  function schedulePaint() {
    if (!paintFrame) paintFrame = requestAnimationFrame(paint);
  }

  // --- rules ---------------------------------------------------------------------------------------------------------

  function makeOverride() {
    return {
      get currentTime() {
        return realMedia.currentTime;
      },
      set currentTime(value) {
        // Clamp and still write: a no-op leaves `time.seek()` waiting for a `seeked` that never comes.
        realMedia.currentTime = clamp(value);
      },
    };
  }

  const lecture$ = {
    attachMedia(next) {
      if (next) realMedia = next;
    },
    override() {
      if (!realMedia || !limiting() || adsActive()) return null;

      override ??= makeOverride();
      return override;
    },
  };

  /** Move to `time` under the rules, from the panel or a key; `false` while an ad plays. */
  function seek(time) {
    if (adsActive() || resumeOpen) return false;

    realMedia.currentTime = clamp(Math.max(0, time));
    return true;
  }

  function onTime() {
    const time = realMedia.currentTime;
    const now = performance.now();

    if (adsActive()) {
      last = time;
      lastWall = now;
      return;
    }

    const step = time - last;

    if (!realMedia.seeking && !realMedia.paused && step > 0 && step <= 1.5 * realMedia.playbackRate + 0.1) {
      const wall = Math.min((now - lastWall) / 1000, 1.5);

      state.segments = addSegment(state.segments, last, time);

      if (time > state.maxWatched) state.maxWatched = time;

      state.activeSeconds += wall;
      unsentActive += wall;
      dirty = true;
      updatePercent(Math.floor(time) !== Math.floor(last));
    }

    last = time;
    lastWall = now;
    state.position = time;
    chapterChange(time);
    panel?.setTime(time, allowed());
  }

  function updatePercent(repaint) {
    const percent = percentOf(state.segments, realMedia.duration);

    state.percent = Math.max(state.percent, percent);

    if (!state.completedAt && state.percent >= state.completion) complete(new Date().toISOString());
    else if (repaint) schedulePaint();
  }

  function complete(at) {
    state.completedAt = at;
    toast('done', t('toast.completed'), 5000);
    schedulePaint();
    dispatch('solad-lms-complete', { ...detail('interval'), completedAt: at });
  }

  function chapterChange(time) {
    const chapters = state.manifest?.chapters ?? [];
    const index = itemAt(chapters, time);
    if (index === state.chapter) return;

    state.chapter = index;

    if (index >= 0)
      dispatch('solad-lms-chapter', { index, title: chapters[index].title, start: chapters[index].start });
  }

  // Safety net for seeks that skip the facade (OS media keys, the PiP window, direct writes to the real media).
  function onSeeking() {
    if (!limiting() || adsActive() || reverting) return;

    if (!(realMedia.currentTime > allowed() + 0.5)) return;

    reverting = true;
    blocked(realMedia.currentTime);
    realMedia.currentTime = allowed();
  }

  function onRate() {
    if (adsActive()) return;

    if (realMedia.playbackRate > state.maxRate + 1e-6) realMedia.playbackRate = state.maxRate;
    else report('ratechange');
  }

  // --- storage and reports -------------------------------------------------------------------------------------------

  function detail(reason) {
    return progressDetail({
      ...state,
      reason,
      position: realMedia?.currentTime ?? state.position,
      duration: realMedia?.duration || state.duration,
      rate: realMedia?.playbackRate ?? 1,
    });
  }

  function saveCopy() {
    if (preview) return;

    writeStore(storeKey, {
      segments: state.segments,
      position: state.position,
      duration: Number.isFinite(state.duration) ? state.duration : null,
      maxWatched: state.maxWatched,
      percent: state.percent,
      completedAt: state.completedAt,
      activeSeconds: state.activeSeconds,
      // Server notes stay on the server; the copy keeps this browser's own notes.
      notes: state.storage === 'server' ? (readStore(storeKey)?.notes ?? []) : state.notes,
    });
  }

  function report(reason, { keepalive = false } = {}) {
    if (destroyed || preview || !state.ready || adsActive()) return;

    const duration = realMedia.duration;
    if (!(duration > 0)) return;

    state.duration = duration;
    state.position = realMedia.currentTime;
    state.seq++;
    dirty = false;

    const event = detail(reason);

    dispatch('solad-lms-progress', event);
    saveCopy();

    if (state.storage !== 'server') return;

    const delta = unsentActive;

    unsentActive = 0;
    post(
      'lms-progress',
      {
        lmsToken: state.lmsToken,
        videoId,
        seq: state.seq,
        reason,
        segments: event.segments,
        position: event.position,
        duration: event.duration,
        rate: event.rate,
        activeSecondsDelta: round(Math.min(delta, 86400)),
      },
      { keepalive }
    ).then((result) => {
      if (destroyed || keepalive) return;

      if (result.ok) {
        failures = 0;
        setStoreNote('server');
        applyServer(result.data);
        return;
      }

      // The unsent seconds join the next report; the segments always go whole.
      unsentActive += delta;

      if (result.status === 403) {
        state.storage = 'local';
        setStoreNote('tokenExpired');
        return;
      }

      if (++failures >= 2) setStoreNote('retrying');
    });
  }

  function applyServer(data) {
    if (!isRecord(data)) return;

    if (Array.isArray(data.segments)) state.segments = mergeSegments(data.segments);

    if (Number.isFinite(data.maxWatched)) state.maxWatched = Math.max(state.maxWatched, data.maxWatched);

    // The server's percent and completion win over the screen's.
    if (Number.isInteger(data.percent)) state.percent = data.percent;

    if (data.completedAt && !state.completedAt) complete(data.completedAt);

    saveCopy();
    schedulePaint();
  }

  function setStoreNote(kind) {
    if (storeNote === kind) return;

    const changed = storeNote !== 'loading';

    storeNote = kind;
    schedulePaint();

    if (changed && ['retrying', 'tokenExpired'].includes(kind)) announce(t(`store.${kind}`));
  }

  function restore(saved) {
    if (!isRecord(saved)) return;

    state.segments = mergeSegments(Array.isArray(saved.segments) ? saved.segments : []);
    state.maxWatched = Number.isFinite(saved.maxWatched) ? saved.maxWatched : 0;
    state.position = Number.isFinite(saved.position) ? saved.position : 0;
    state.duration = Number.isFinite(saved.duration) ? saved.duration : NaN;
    state.percent = Number.isInteger(saved.percent) ? saved.percent : 0;
    state.completedAt = typeof saved.completedAt === 'string' ? saved.completedAt : null;
    state.activeSeconds = Number.isFinite(saved.activeSeconds) ? saved.activeSeconds : 0;
  }

  async function openSession() {
    if (preview) return;

    const local = readStore(storeKey);
    const body = { videoId };

    if (typeof presetId === 'string') body.presetId = presetId;

    if (learnerToken) body.learnerToken = learnerToken;

    const result = await post('lms-session', body);

    if (result.ok && result.data.storage === 'server') {
      state.storage = 'server';
      state.learner = result.data.learner ?? null;
      state.lmsToken = result.data.lmsToken;
      Object.assign(state, pickRules(result.data.rules));
      restore(result.data.progress ?? local);
      // A server session keeps its own notes; the local copy holds only progress.
      state.notes = readNotes(result.data.notes);
      storeNote = 'server';
      return;
    }

    restore(local);
    state.notes = readNotes(local?.notes);
    state.learnerError = result.ok && typeof result.data.learnerError === 'string' ? result.data.learnerError : null;

    if (result.ok && result.data.learnerError === 'expired') storeNote = 'tokenExpired';
    else if (result.ok && result.data.learnerError) storeNote = 'tokenInvalid';
    else storeNote = 'local';
  }

  function pickRules(value) {
    if (!isRecord(value)) return {};

    const picked = {};

    if (Number.isInteger(value.completion)) picked.completion = value.completion;

    if (['free', 'watched'].includes(value.seekLimit)) picked.seekLimit = value.seekLimit;

    if (Number.isFinite(value.maxRate)) picked.maxRate = value.maxRate;

    return picked;
  }

  // --- notes ---------------------------------------------------------------------------------------------------------

  /** Save a new or changed note; resolves `true` when it is stored. */
  async function saveNote(input) {
    const kind = input.kind === 'bookmark' ? 'bookmark' : 'note';
    const text = cleanNoteText(input.text).slice(0, kind === 'note' ? NOTE_MAX : BOOKMARK_MAX);
    if (kind === 'note' && !text) return false;

    if (!input.id && state.notes.length >= NOTE_LIMIT) {
      toast('limit', t('toast.noteLimit'), 4000);
      return false;
    }

    const note = { id: input.id ?? null, kind, time: round(Math.max(0, input.time)), text };

    if (state.storage === 'server') {
      const result = await post('lms-notes', { lmsToken: state.lmsToken, videoId, op: 'save', note });

      if (!result.ok) {
        if (result.error?.code === 'note_limit') toast('limit', t('toast.noteLimit'), 4000);

        return false;
      }

      const before = new Set(state.notes.map((item) => item.id));

      state.notes = readNotes(result.data.notes);
      note.id ??= state.notes.find((item) => !before.has(item.id))?.id ?? null;
    } else {
      note.id ??= noteId();

      state.notes = readNotes([...state.notes.filter((item) => item.id !== note.id), note]);
      saveCopy();
    }

    dispatch('solad-lms-note', { op: 'save', note });
    schedulePaint();
    return true;
  }

  async function deleteNote(id) {
    const note = state.notes.find((item) => item.id === id);
    if (!note) return false;

    if (state.storage === 'server') {
      const result = await post('lms-notes', { lmsToken: state.lmsToken, videoId, op: 'delete', note: { id } });
      if (!result.ok) return false;

      state.notes = readNotes(result.data.notes);
    } else {
      state.notes = state.notes.filter((item) => item.id !== id);
      saveCopy();
    }

    dispatch('solad-lms-note', { op: 'delete', note });
    schedulePaint();
    return true;
  }

  const bookmarkButton = root?.querySelector('.solad-lms-bookmark');
  let bookmarkTimer = 0;

  async function bookmark() {
    if (!bookmarkButton || adsActive() || resumeOpen) return;

    const time = realMedia.currentTime;

    if (state.notes.length >= NOTE_LIMIT) {
      toast('limit', t('toast.noteLimit'), 4000);
      return;
    }

    clearTimeout(bookmarkTimer);
    bookmarkButton.setAttribute('data-added', '');
    bookmarkTimer = setTimeout(() => bookmarkButton.removeAttribute('data-added'), 1200);

    if (await saveNote({ kind: 'bookmark', time, text: '' }))
      toast('bookmark', t('toast.bookmarked', { time: timeHtml(time) }), 3000);
  }

  // --- resume --------------------------------------------------------------------------------------------------------

  function resumeOverlay(position) {
    const controls = root.querySelector('media-controls');
    const overlay = document.createElement('div');
    const titleId = `solad-lms-resume-${state.sessionId.slice(0, 8)}`;

    overlay.className = 'solad-lms-resume';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', titleId);
    overlay.innerHTML = `<div class="solad-lms-resume-card">
<p class="solad-lms-resume-title" id="${titleId}"></p>
<p class="solad-lms-resume-meta"></p>
<div class="solad-lms-resume-actions"><button type="button" data-action="restart"></button><button type="button" data-action="resume" class="is-primary"></button></div>
</div>`;
    overlay.querySelector('.solad-lms-resume-title').textContent = t('resume.title', { time: formatTime(position) });
    overlay.querySelector('.solad-lms-resume-meta').textContent = t('resume.meta', {
      p: state.percent,
      t: state.completion,
    });

    const restart = overlay.querySelector('[data-action="restart"]');
    const resume = overlay.querySelector('[data-action="resume"]');

    restart.textContent = t('resume.restart');
    resume.textContent = t('resume.continue');

    return new Promise((resolve) => {
      const close = (choice) => {
        overlay.remove();
        resumeOpen = false;
        controls?.removeAttribute('inert');
        bookmarkButton?.removeAttribute('inert');
        resolve(choice);
      };

      // Player keys stay out while the card is open (handoff 1.4).
      overlay.addEventListener('keydown', (event) => {
        event.stopPropagation();

        if (event.key === 'Escape') {
          event.preventDefault();
          close('restart');
        } else if (event.key === 'Tab') {
          event.preventDefault();
          (event.shiftKey === (event.composedPath()[0] === restart) ? resume : restart).focus();
        }
      });
      overlay.addEventListener('pointerdown', (event) => event.stopPropagation());
      overlay.addEventListener('click', (event) => event.stopPropagation());
      restart.addEventListener('click', () => close('restart'));
      resume.addEventListener('click', () => close('resume'));
      resumeOpen = true;
      controls?.setAttribute('inert', '');
      container.append(overlay);
      resume.focus({ preventScroll: true });
    });
  }

  async function startResume() {
    if (rules.resume === 'off') return;

    const saved = state.position;
    const known = Number.isFinite(state.duration) ? state.duration : realMedia.duration;
    if (resumeTime(saved, known) === null && Number.isFinite(known)) return;

    if (!(await metadata())) return;

    const position = resumeTime(saved, realMedia.duration);
    if (position === null) return;

    if (rules.resume === 'auto') {
      realMedia.currentTime = position;
      last = position;
      toast('resumed', t('toast.resumed', { time: timeHtml(position) }), 3000);
      return;
    }

    if (!realMedia.paused) realMedia.pause();

    const choice = await resumeOverlay(position);

    if (destroyed) return;

    realMedia.currentTime = choice === 'resume' ? position : 0;
    last = realMedia.currentTime;
    realMedia.play()?.catch?.(() => {});
    root.querySelector('media-play-button')?.focus({ preventScroll: true });
  }

  function metadata() {
    if (realMedia.readyState >= 1 && realMedia.duration > 0) return Promise.resolve(true);

    return new Promise((resolve) => {
      realMedia.addEventListener('loadedmetadata', () => resolve(true), { once: true, signal });
      signal.addEventListener('abort', () => resolve(false), { once: true });
    });
  }

  // --- panel ---------------------------------------------------------------------------------------------------------

  function panelState() {
    const manifest = state.manifest;
    const duration = realMedia?.duration > 0 ? realMedia.duration : state.duration;
    const chapters = (manifest?.chapters ?? []).map((chapter, index, list) => {
      const end = list[index + 1]?.start ?? duration;

      return { ...chapter, end, percent: partPercent(state.segments, chapter.start, end) };
    });

    return {
      percent: state.percent,
      completion: state.completion,
      completedAt: state.completedAt,
      storage: storeNote,
      ad: state.ad,
      limit: limiting() ? allowed() : null,
      chapters,
      slides: manifest?.slides ?? [],
      files: manifest?.files ?? [],
      cues: state.cues,
      notes: state.notes,
      manifestFailed: Boolean(manifest?.failed),
      dropped: manifest?.dropped ?? 0,
      lecture: Boolean(lecture),
    };
  }

  function addChapters() {
    const chapters = state.manifest?.chapters ?? [];
    if (!chapters.length || media.querySelector('track[data-solad-lms]')) return;

    const track = document.createElement('track');

    track.kind = 'chapters';
    track.label = 'chapters';
    track.default = true;
    track.dataset.soladLms = '';
    // A data URL works with every Video.js media and the plain `<video>` (L-1 spike).
    track.src = `data:text/vtt;charset=utf-8,${encodeURIComponent(chaptersVtt(chapters, realMedia.duration))}`;
    media.append(track);
  }

  // --- wiring --------------------------------------------------------------------------------------------------------

  const on = (target, type, handler) => target.addEventListener(type, handler, { signal });

  release = registerExtension(media, lecture$);

  on(media, 'timeupdate', onTime);
  on(media, 'seeking', onSeeking);
  on(media, 'seeked', () => {
    last = realMedia.currentTime;
    lastWall = performance.now();
    state.position = last;
    chapterChange(last);
    panel?.setTime(last, allowed());

    if (reverting) reverting = false;
    else if (!adsActive()) report('seeked');
  });
  on(media, 'play', () => {
    last = realMedia.currentTime;
    lastWall = performance.now();
  });
  on(media, 'pause', () => {
    if (!adsActive() && !realMedia.ended) report('pause');
  });
  on(media, 'ended', () => report('ended'));
  on(media, 'ratechange', onRate);
  on(media, 'durationchange', () => {
    if (realMedia.duration > 0) {
      state.duration = realMedia.duration;
      addChapters();
      schedulePaint();
    }
  });
  on(document, 'visibilitychange', () => {
    if (document.visibilityState === 'hidden' && dirty) report('hidden');
  });
  on(window, 'pagehide', () => {
    if (dirty) report('pagehide', { keepalive: true });
  });

  // `>`/`<` without the upstream wrap and under the cap, and `b` for a bookmark, on the element the hotkey
  // coordinator listens on. The skin removed the upstream speed bindings.
  on(container, 'keydown', (event) => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || isEditable(event)) return;

    if (event.key === '>' || event.key === '<') {
      event.preventDefault();

      if (!adsActive())
        realMedia.playbackRate = stepRate(realMedia.playbackRate, event.key === '>' ? 1 : -1, state.maxRate);
    } else if ((event.key === 'b' || event.key === 'B') && bookmarkButton) {
      event.preventDefault();
      void bookmark();
    }
  });

  if (bookmarkButton) on(bookmarkButton, 'click', () => void bookmark());

  // The ad screen comes and goes as a direct child of the container.
  const adWatch = new MutationObserver(() => {
    const ad = adsActive();
    if (ad === state.ad) return;

    state.ad = ad;
    bookmarkButton?.toggleAttribute('inert', ad);
    last = realMedia.currentTime;
    lastWall = performance.now();
    schedulePaint();
  });

  adWatch.observe(container, { childList: true });

  timer = setInterval(() => {
    if (dirty && !realMedia.paused && !adsActive()) report('interval');
  }, REPORT_MS);

  panel?.configure({ tabs: rules.tabs, headOnly: !lecture });

  if (panel)
    panel.connect({
      t,
      language,
      seek,
      saveNote,
      deleteNote,
      announce,
      time: () => realMedia.currentTime,
      blocked: (time) => {
        if (limiting() && time > allowed()) seek(time);
      },
    });

  panel?.update(panelState());

  const ready = (async () => {
    const [, manifest] = await Promise.all([openSession(), loadManifest(lecture)]);

    if (destroyed) return;

    state.manifest = manifest;

    // The transcript is the manifest's, else the page's captions (spec 2.5).
    state.cues = await loadCues(manifest?.transcript?.src ?? captions);

    if (destroyed) return;

    state.ready = true;

    if (realMedia.duration > 0) addChapters();

    if (manifest?.failed && lecture) announce(t('manifest.failed'));
    else if (manifest?.dropped) announce(t('manifest.partial', { n: manifest.dropped }));

    schedulePaint();
    const readyDetail = {
      videoId,
      storage: state.storage === 'server' ? 'server' : preview ? 'none' : 'local',
      learner: state.learner,
      progress: { ...detail('interval'), completedAt: state.completedAt },
    };

    // Why a given learner token fell back to this browser: `expired` or `invalid` (contract 4.2).
    if (state.learnerError) readyDetail.learnerError = state.learnerError;

    dispatch('solad-lms-ready', readyDetail);

    await startResume();
  })();

  return {
    state,
    ready,
    seek,
    bookmark,
    destroy() {
      if (destroyed) return;

      if (dirty) report('pagehide', { keepalive: true });

      destroyed = true;
      listeners.abort();
      adWatch.disconnect();
      clearInterval(timer);
      clearTimeout(toastTimer);
      clearTimeout(bookmarkTimer);
      cancelAnimationFrame(paintFrame);
      release?.();
      release = null;
    },
  };
}
