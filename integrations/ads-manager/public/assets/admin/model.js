/** Shared form rules; the server remains authoritative for assets and publication. */
export function safeUrl(value) {
  // These URLs cross the JSON/form boundary; reject nonstrings and controls before URL normalization.
  // oxlint-disable-next-line anti-slop/no-runtime-typeof, no-control-regex
  if (typeof value !== 'string' || !value || /[\u0000-\u0020\u007f\\]/u.test(value)) return false;

  if (value.startsWith('/')) return !value.startsWith('//');

  try {
    const url = new URL(value);

    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function makeItem(creative, itemId) {
  const item = {
    itemId,
    adId: creative.creativeId,
    creativeId: creative.creativeId,
    creativeVersion: creative.version,
    kind: creative.kind,
    url: creative.url,
    mime: creative.mime,
    alt: creative.alt,
    clickUrl: null,
    skipAfterSeconds: null,
  };

  if (creative.kind === 'image') item.displaySeconds = 5;

  return item;
}

export function editorPayload(record) {
  const copy = structuredClone(record);
  // Validate server-supplied IDs before building an editor request.
  // oxlint-disable-next-line anti-slop/no-runtime-typeof
  const validId = (value) => typeof value === 'string' && value.trim().length > 0 && value.length <= 128;
  const fail = (message) => {
    throw new Error(message);
  };

  if (!['site', 'board', 'category', 'video'].includes(copy.target.type) || !validId(copy.target.id)) {
    fail('적용 대상과 128자 이내의 고정 ID를 지정하세요.');
  }

  if (copy.target.type === 'category' && !validId(copy.target.boardId)) fail('분류의 게시판 ID를 지정하세요.');

  if (!['inherit', 'replace', 'disabled'].includes(copy.mode)) fail('편성 적용 방식을 선택하세요.');

  if (copy.target.type === 'site' && copy.mode === 'inherit') fail('사이트 기본 편성은 상속할 수 없습니다.');

  if (!Number.isInteger(copy.revision) || copy.revision < 0) fail('편성을 다시 불러온 뒤 저장하세요.');

  if (copy.mode !== 'replace') return { ...copy, breaks: [] };

  if (copy.breaks.length > 100) fail('광고 구간은 최대 100개입니다.');

  const breakIds = new Set();
  const itemIds = new Set();
  const positions = new Set();

  for (const br of copy.breaks) {
    if (!validId(br.breakId) || breakIds.has(br.breakId)) fail('광고 구간 ID가 중복되거나 잘못되었습니다.');

    breakIds.add(br.breakId);

    if (!['pre', 'mid', 'post'].includes(br.position)) fail('광고 구간 위치를 선택하세요.');

    if (br.position === 'mid' && (!Number.isFinite(br.atSeconds) || br.atSeconds <= 0)) {
      fail('미드롤 위치는 0보다 큰 본편 재생 초로 입력하세요.');
    }

    const position = br.position === 'mid' ? `mid:${br.atSeconds}` : br.position;

    if (positions.has(position)) fail('같은 시점의 광고는 한 구간 안에 순서대로 추가하세요.');

    positions.add(position);

    if (br.position !== 'mid') delete br.atSeconds;

    if (!br.ads.length || br.ads.length > 20) fail('각 광고 구간에는 광고를 1~20개 넣으세요.');

    for (const ad of br.ads) {
      if (!validId(ad.itemId) || itemIds.has(ad.itemId)) fail('광고 항목 ID가 중복되거나 잘못되었습니다.');

      itemIds.add(ad.itemId);

      if (!validId(ad.creativeId) || !Number.isInteger(ad.creativeVersion) || ad.creativeVersion < 1) {
        fail('저장된 소재 버전을 선택하세요.');
      }

      ad.adId = ad.creativeId;

      if (!safeUrl(ad.url) || (ad.clickUrl !== null && !safeUrl(ad.clickUrl)))
        fail('광고 주소는 HTTP(S) 또는 /로 시작하는 경로여야 합니다.');

      if (
        ad.skipAfterSeconds !== null &&
        (!Number.isInteger(ad.skipAfterSeconds) || ad.skipAfterSeconds < 1 || ad.skipAfterSeconds > 3600)
      ) {
        fail('스킵 대기 시간은 1~3600초의 정수로 입력하세요.');
      }

      if (ad.kind === 'image') {
        if (!Number.isFinite(ad.displaySeconds) || ad.displaySeconds <= 0 || ad.displaySeconds > 3600)
          fail('이미지 표시 시간은 0초 초과, 3600초 이하여야 합니다.');

        if (ad.skipAfterSeconds !== null && ad.skipAfterSeconds >= ad.displaySeconds)
          fail('스킵 대기 시간은 이미지 표시 시간보다 짧아야 합니다.');
      } else if (ad.kind === 'video') {
        delete ad.displaySeconds;
      } else {
        fail('지원하지 않는 소재 종류입니다.');
      }
    }
  }

  const order = (br) => (br.position === 'pre' ? -1 : br.position === 'post' ? Infinity : br.atSeconds);

  copy.breaks.sort((a, b) => order(a) - order(b));
  return copy;
}

export function statsFilters(values) {
  const date = (value) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value;

  if (!date(values.from) || !date(values.to) || values.from > values.to)
    throw new Error('시작일과 종료일을 올바르게 지정하세요.');

  return Object.fromEntries(
    ['from', 'to', 'adId', 'videoId', 'boardId']
      .filter((key) => values[key]?.trim())
      .map((key) => [key, values[key].trim()])
  );
}

export function formatRate(value) {
  return Number.isFinite(value) && value >= 0 && value <= 1
    ? `${new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 }).format(value * 100)}%`
    : '—';
}
