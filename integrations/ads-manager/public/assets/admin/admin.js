import { AdminApi } from './api.js';
import { editorPayload, formatRate, makeItem, safeUrl, statsFilters } from './model.js';
import { PreviewSession } from './preview.js';

const byId = (id) => document.getElementById(`ads-${id}`);
const config = JSON.parse(byId('config').textContent);
const api = new AdminApi(config.apiUrl);
const preview = new PreviewSession();
const state = {
  bootstrap: null,
  creatives: [],
  draft: null,
  publishedVersion: null,
  resolvedFrom: null,
  dirty: false,
  choices: [],
  creativeDirty: false,
};
let previewRequest = 0;
let creativeObjectUrl = null;
let operationPending = false;
const targetNames = { site: '사이트', board: '게시판', category: '분류', video: '영상' };
const breakNames = { pre: '프리롤 · 시작 전', mid: '미드롤 · 재생 중', post: '포스트롤 · 종료 후' };

function node(tag, text = '', className = '') {
  const result = document.createElement(tag);

  result.textContent = text;

  if (className) result.className = className;

  return result;
}

function message(id, text, error = false) {
  const target = byId(id);

  target.textContent = text;
  target.dataset.error = String(error);
}

function values(form) {
  return Object.fromEntries(
    [...form.elements]
      .filter((field) => field.name && field.type !== 'file')
      .map((field) => [field.name, field.type === 'password' ? field.value : field.value.trim()])
  );
}

function actionButton(text, handler) {
  const button = node('button', text);

  button.type = 'button';
  button.addEventListener('click', handler);
  return button;
}

function report(id, error) {
  let text = error.message;

  if (error.status === 409) {
    text = '다른 곳에서 초안이 변경되었습니다. 현재 입력은 보존했습니다. 내용을 확인한 뒤 서버 초안을 다시 불러오세요.';
    byId('conflict-reload').hidden = false;
  } else if (error.status === 401) {
    text = '로그인이 만료되었습니다. 현재 입력은 보존했습니다. 다시 로그인한 뒤 작업을 이어가세요.';
    byId('reconnect').hidden = false;
  } else if (error.status === 403) {
    text = '권한 또는 보안 토큰을 확인하지 못했습니다. 연결을 다시 확인한 뒤 재시도하세요. 입력은 보존됩니다.';
    byId('reconnect').hidden = false;
  }

  // Error field values arrive from the host API; only render its string messages.
  // oxlint-disable-next-line anti-slop/no-runtime-typeof
  const fields = error.fields && Object.values(error.fields).filter((value) => typeof value === 'string');

  message(id, [text, ...(fields || [])].join(' '), true);
}

async function run(statusId, task) {
  if (operationPending) return;

  operationPending = true;
  const workspace = byId('workspace');
  const login = byId('login-form').querySelector('fieldset');

  workspace.inert = true;
  workspace.setAttribute('aria-busy', 'true');
  login.disabled = true;
  message(statusId, '처리 중입니다…');

  try {
    await task();
  } catch (error) {
    report(statusId, error);

    if (statusId === 'global-status') byId('reconnect').hidden = false;
  } finally {
    operationPending = false;
    workspace.inert = false;
    workspace.removeAttribute('aria-busy');
    login.disabled = false;
    updateEditorState();
  }
}

function isManual() {
  return state.bootstrap?.capabilities?.manualTargets === true;
}
function isStandalone() {
  return state.bootstrap?.capabilities?.host === 'standalone';
}

async function bootstrap() {
  const data = await api.request('bootstrap');

  state.bootstrap = data;
  api.csrfToken = data.csrfToken || '';
  byId('login').hidden = data.authenticated;
  byId('workspace').hidden = !data.authenticated;
  byId('logout').hidden = !data.authenticated || !isStandalone();
  byId('reconnect').hidden = true;
  byId('login-form').hidden = !isStandalone();

  const loginUrl = data.capabilities?.loginUrl;

  byId('host-login').hidden = isStandalone() || !safeUrl(loginUrl);

  if (safeUrl(loginUrl)) byId('host-login').href = loginUrl;

  if (!data.authenticated) {
    message(
      'global-status',
      isStandalone() ? '관리자 계정으로 로그인하세요.' : '사이트 관리자 권한으로 로그인한 뒤 다시 열어주세요.'
    );
    byId('site').textContent = '로그인 필요';
    return;
  }

  byId('site').textContent = `${data.site.siteId} · ${data.site.timeZone}`;
  byId('context-panel').hidden = !isStandalone() || !isManual();
  byId('upload-limit').textContent =
    `업로드 한도: ${new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 }).format(data.limits.uploadBytes / 1024 / 1024)} MiB. 실제 파일 형식은 서버에서 확인합니다.`;
  byId('creative-form').elements.source.querySelector('[value="upload"]').disabled = !data.capabilities.uploads;

  if (!data.capabilities.uploads) byId('creative-form').elements.source.value = 'url';

  toggleCreativeSource();
  targetControls();
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: data.site.timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const date = Object.fromEntries(today.map((part) => [part.type, part.value]));

  for (const key of ['from', 'to']) {
    if (!byId('stats-form').elements[key].value)
      byId('stats-form').elements[key].value = `${date.year}-${date.month}-${date.day}`;
  }

  message('global-status', '');
  await loadCreatives();
}

byId('login-form').addEventListener('submit', (event) => {
  event.preventDefault();
  run('login-status', async () => {
    const form = byId('login-form');
    const result = await api.request('login', {
      data: { username: form.elements.username.value.trim(), password: form.elements.password.value },
    });
    if (!result.authenticated) throw new Error('로그인되지 않았습니다. 계정을 확인하세요.');

    form.elements.password.value = '';
    await bootstrap();
    message('login-status', '');
    byId('creatives-title').focus();
  });
});

byId('logout').addEventListener('click', () => {
  if ((state.dirty || state.creativeDirty) && !confirm('저장하지 않은 변경이 있습니다. 로그아웃할까요?')) return;

  run('global-status', async () => {
    await api.request('logout', { data: {} });
    closePreview();
    clearCreativeMedia();
    state.draft = null;
    state.dirty = false;
    state.creatives = [];
    state.creativeDirty = false;
    byId('creative-form').reset();
    byId('creative-form').elements.creativeId.value = '';
    byId('creatives-list').replaceChildren();
    byId('breaks').replaceChildren();
    byId('editor').hidden = true;
    byId('stats-results').hidden = true;
    await bootstrap();
  });
});
byId('reconnect').addEventListener('click', () => run('global-status', bootstrap));

document.querySelectorAll('[data-page]').forEach((button) =>
  button.addEventListener('click', () => {
    for (const name of ['creatives', 'schedule', 'stats']) byId(`page-${name}`).hidden = name !== button.dataset.page;

    document.querySelectorAll('[data-page]').forEach((other) => other.removeAttribute('aria-current'));
    button.setAttribute('aria-current', 'page');
    byId(`${button.dataset.page}-title`).focus();
    clearCreativeMedia();
  })
);

async function loadCreatives() {
  const data = await api.request('creatives');

  state.creatives = data.items;
  renderCreatives();
  message(
    'creatives-status',
    data.items.length
      ? `${data.items.length}개 소재를 불러왔습니다.`
      : '아직 등록한 소재가 없습니다. URL 또는 파일로 첫 소재를 등록하세요.'
  );

  if (state.draft) renderBreaks();
}

function clearCreativeMedia() {
  const video = byId('creative-media').querySelector('video');

  if (video) {
    video.pause();
    video.removeAttribute('src');
    video.load();
  }

  byId('creative-media').replaceChildren();
  byId('creative-media').hidden = true;

  if (creativeObjectUrl) URL.revokeObjectURL(creativeObjectUrl);

  creativeObjectUrl = null;
}

function renderCreatives() {
  const list = byId('creatives-list');

  list.replaceChildren();

  for (const creative of state.creatives) {
    const card = node('article', '', 'ads-creative-card');

    card.append(
      node('h3', creative.name),
      node(
        'p',
        `${creative.creativeId} · v${creative.version} · ${creative.mime} · ${creative.archived ? '보관됨' : '사용 가능'}`,
        'ads-muted'
      )
    );
    const actions = node('div', '', 'ads-actions');
    const view = actionButton('소재 미리보기', () => {
      clearCreativeMedia();

      if (!safeUrl(creative.url)) return message('creative-status', '저장된 소재 주소를 확인하세요.', true);

      showCreativeMedia(creative.url, creative.mime, creative.alt);
      message(
        'creative-status',
        `저장된 “${creative.name}” v${creative.version} 미리보기입니다. 편집 중인 입력은 유지됩니다.`
      );
    });
    const edit = actionButton('새 버전으로 수정', () => editCreative(creative));
    const archive = actionButton('보관', () => {
      if (
        !confirm(
          `“${creative.name}” 소재를 보관할까요? 새로운 편성과 게시에는 사용할 수 없고 기존 게시본은 유지됩니다.`
        )
      )
        return;

      run('creatives-status', async () => {
        await api.request('creative-archive', { data: { creativeId: creative.creativeId } });
        await loadCreatives();
        message('creatives-status', '소재를 보관했습니다. 기존 게시본은 유지됩니다.');
        byId('creatives-reload').focus();
      });
    });

    edit.disabled = creative.archived;
    archive.disabled = creative.archived;
    actions.append(view, edit, archive);
    card.append(actions);
    list.append(card);
  }
}

function editCreative(creative = null) {
  if (state.creativeDirty && !confirm('현재 소재의 저장하지 않은 입력을 버릴까요?')) return;

  const form = byId('creative-form');

  form.reset();
  form.elements.creativeId.value = creative?.creativeId || '';

  for (const name of ['name', 'url', 'mime', 'alt']) {
    if (creative) form.elements[name].value = creative[name];
  }

  form.elements.source.value = creative?.source === 'upload' && state.bootstrap.capabilities.uploads ? 'upload' : 'url';
  byId('creative-heading').textContent = creative ? '소재 새 버전 등록' : '새 소재 등록';
  byId('creative-version').textContent = creative
    ? `${creative.creativeId} · 현재 v${creative.version}. 저장하면 새 버전이 생성되며 게시된 편성은 그대로 유지됩니다.`
    : '영상과 이미지 · GIF를 지원합니다.';
  state.creativeDirty = false;
  message('creative-status', '');
  clearCreativeMedia();
  toggleCreativeSource();
  form.elements.name.focus();
}

function toggleCreativeSource() {
  const upload = byId('creative-form').elements.source.value === 'upload';

  byId('url-fields').hidden = upload;
  byId('upload-fields').hidden = !upload;
  byId('creative-form').elements.url.required = !upload;
  byId('creative-form').elements.file.required = upload;
}

byId('creative-new').addEventListener('click', () => editCreative());
byId('creatives-reload').addEventListener('click', () => run('creatives-status', loadCreatives));
byId('creative-form').addEventListener('input', () => {
  state.creativeDirty = true;
  clearCreativeMedia();
});
byId('creative-form').elements.source.addEventListener('change', toggleCreativeSource);
byId('creative-form').addEventListener('submit', (event) => {
  event.preventDefault();
  run('creative-status', async () => {
    const form = byId('creative-form');
    const input = values(form);
    let result;

    if (input.source === 'upload') {
      const file = form.elements.file.files[0];
      if (!file) throw new Error('업로드할 파일을 선택하세요.');

      if (file.size > state.bootstrap.limits.uploadBytes)
        throw new Error('파일이 업로드 한도를 초과합니다. 더 작은 파일을 선택하세요.');

      const data = new FormData();

      data.append('file', file);
      data.append('name', input.name);
      data.append('alt', input.alt);

      if (input.creativeId) data.append('creativeId', input.creativeId);

      result = await api.request('creative-upload', { data });
    } else {
      if (!safeUrl(input.url)) throw new Error('올바른 HTTP(S) URL 또는 /로 시작하는 소재 경로를 입력하세요.');

      const { name, url, mime, alt, creativeId } = input;

      const data = { name, url, mime, alt };

      if (creativeId) data.creativeId = creativeId;

      result = await api.request('creative-save', { data });
    }

    state.creativeDirty = false;
    editCreative(result.creative);
    message('creative-status', `소재 v${result.creative.version}을 저장했습니다. 편성에서 사용할 버전을 선택하세요.`);

    try {
      await loadCreatives();
    } catch (error) {
      report('creatives-status', error);
    }
  });
});

byId('creative-preview').addEventListener('click', () => {
  clearCreativeMedia();
  const form = byId('creative-form');
  let url = form.elements.url.value.trim();
  let mime = form.elements.mime.value;

  if (form.elements.source.value === 'upload') {
    const file = form.elements.file.files[0];
    if (!file) return message('creative-status', '미리 볼 파일을 선택하세요.', true);

    creativeObjectUrl = URL.createObjectURL(file);
    url = creativeObjectUrl;
    mime = file.type;
  } else if (!safeUrl(url)) {
    return message('creative-status', '올바른 소재 URL을 입력하세요.', true);
  }

  showCreativeMedia(url, mime, form.elements.alt.value);
  message('creative-status', '입력 소재 미리보기입니다. 서버 저장·게시 여부와는 별개입니다.');
});

function showCreativeMedia(url, mime, alt) {
  const media = document.createElement(mime.startsWith('video/') ? 'video' : 'img');

  media.addEventListener('error', () =>
    message('creative-status', '소재를 표시하지 못했습니다. URL, 접근 권한, 파일 형식을 확인하세요.', true)
  );

  if (media.tagName === 'VIDEO') {
    media.controls = true;
    media.preload = 'metadata';
    media.playsInline = true;
  } else media.alt = alt;

  media.src = url;
  byId('creative-media').append(media);
  byId('creative-media').hidden = false;
}

function targetControls() {
  const form = byId('target-form');
  const type = form.elements.targetType.value;
  const manual = isManual() || type === 'site';

  byId('target-board-label').hidden = type !== 'category';
  form.elements.boardId.required = type === 'category';
  byId('manual-target-label').hidden = !manual;
  form.elements.targetId.required = manual;
  form.elements.targetId.readOnly = type === 'site';

  if (type === 'site') form.elements.targetId.value = state.bootstrap.site.siteId;

  for (const name of ['target-query-label', 'target-search', 'target-choice-label']) byId(name).hidden = manual;

  form.elements.choice.required = !manual;
  byId('context-panel').hidden = !(isStandalone() && isManual() && type === 'video');
}

byId('target-form').elements.targetType.addEventListener('change', () => {
  byId('target-form').elements.targetId.value = '';
  resetTargetChoices();
  targetControls();
});
byId('target-form').elements.boardId.addEventListener('input', resetTargetChoices);

function resetTargetChoices() {
  state.choices = [];
  byId('target-form').elements.choice.replaceChildren(new Option('대상을 검색하세요', ''));
}

byId('target-search').addEventListener('click', () =>
  run('target-status', async () => {
    const form = values(byId('target-form'));
    if (form.targetType === 'category' && !form.boardId) throw new Error('분류를 검색할 게시판 ID를 입력하세요.');

    const query = { type: form.targetType, query: form.query };

    if (form.boardId) query.boardId = form.boardId;

    const data = await api.request('targets', { query });

    state.choices = data.items;
    byId('target-form').elements.choice.replaceChildren(
      new Option('대상을 선택하세요', ''),
      ...data.items.map((item, index) => new Option(item.label, String(index)))
    );
    message(
      'target-status',
      data.items.length
        ? `${data.items.length}개 대상이 있습니다. 선택 후 편성을 불러오세요.`
        : '검색 결과가 없습니다. 검색어나 게시판을 확인하세요.'
    );
  })
);

function selectedTarget() {
  const input = values(byId('target-form'));

  if (!isManual() && input.targetType !== 'site') {
    const choice = input.choice !== '' && state.choices[Number(input.choice)];
    if (!choice) throw new Error('호스트에서 확인된 대상을 검색해 선택하세요.');

    return structuredClone(choice.target);
  }

  if (!input.targetId || input.targetId.length > 128) throw new Error('128자 이내의 고정 대상 ID를 입력하세요.');

  if (input.targetType === 'category' && !input.boardId) throw new Error('분류 소속 게시판 ID를 입력하세요.');

  const target = { type: input.targetType, id: input.targetId };

  if (input.targetType === 'category') target.boardId = input.boardId;

  return target;
}

async function loadDraft(target) {
  const data = await api.request('schedule-draft', {
    query: { targetType: target.type, targetId: target.id, boardId: target.boardId },
  });

  acceptDraft(data);
  byId('editor').hidden = false;
  byId('conflict-reload').hidden = true;
  message('schedule-status', '');
  message('target-status', '편성을 불러왔습니다. 초안과 현재 게시본은 별도로 관리됩니다.');
}

function acceptDraft(data) {
  state.draft = structuredClone(data.draft);
  state.publishedVersion = data.publishedVersion;
  state.resolvedFrom = data.resolvedFrom;
  state.dirty = false;
  byId('mode').value = state.draft.mode;
  byId('mode').querySelector('[value="inherit"]').disabled = state.draft.target.type === 'site';
  byId('editor-target').textContent =
    `${targetNames[state.draft.target.type]} · ${state.draft.target.id}${state.draft.target.boardId ? ` / 게시판 ${state.draft.target.boardId}` : ''}`;
  byId('inheritance').textContent = state.resolvedFrom
    ? `현재 게시 설정 출처: ${targetNames[state.resolvedFrom.type]} ${state.resolvedFrom.id}`
    : '현재 적용되는 게시 편성 없음';
  renderBreaks();
  updateEditorState();
}

byId('target-form').addEventListener('submit', (event) => {
  event.preventDefault();

  if (state.dirty && !confirm('저장하지 않은 편집 내용을 버리고 편성을 불러올까요?')) return;

  run('target-status', () => loadDraft(selectedTarget()));
});
byId('conflict-reload').addEventListener('click', () => {
  if (!confirm('현재 편집 내용을 버리고 서버의 최신 초안을 불러올까요?')) return;

  run('schedule-status', async () => {
    await loadDraft(state.draft.target);
    message('schedule-status', '서버 초안을 다시 불러왔습니다.');
  });
});
byId('context-form').addEventListener('submit', (event) => {
  event.preventDefault();
  run('context-status', async () => {
    const input = values(byId('context-form'));
    if (input.categoryId && !input.boardId) throw new Error('분류를 지정하려면 게시판 ID도 입력하세요.');

    await api.request('video-context-save', {
      data: { ...input, boardId: input.boardId || null, categoryId: input.categoryId || null },
    });
    message('context-status', '영상 소속을 저장했습니다. 새 재생 세션부터 이 소속으로 편성을 찾습니다.');
  });
});

function markDirty() {
  state.dirty = true;
  updateEditorState();
}

function updateEditorState() {
  if (!state.draft) return;

  byId('draft-state').textContent = state.dirty
    ? '저장하지 않은 변경'
    : state.draft.revision
      ? `저장된 초안 r${state.draft.revision}`
      : '아직 저장하지 않은 초안';
  byId('live-state').textContent = state.publishedVersion ? `게시 v${state.publishedVersion}` : '게시본 없음';
  byId('unsaved-label').textContent = state.dirty
    ? '변경 내용을 저장한 뒤 게시하세요.'
    : '초안 저장만으로는 노출이 바뀌지 않습니다.';
  byId('publish').disabled = state.dirty || !state.draft.revision;
  byId('break-editor').hidden = state.draft.mode !== 'replace';
  byId('break-editor').disabled = state.draft.mode !== 'replace';
  byId('mode-help').textContent = {
    inherit: '이 대상의 직접 편성 대신 상위 게시 설정을 따릅니다.',
    replace: '상위 편성과 합치지 않고 아래 편성 전체로 대체합니다.',
    disabled: '이 대상의 광고를 끄고 상위 편성으로의 대체도 중단합니다. 게시해야 적용됩니다.',
  }[state.draft.mode];
  byId('preview-open').disabled = !state.bootstrap?.playerModuleUrl;
  byId('preview-open').title = state.bootstrap?.playerModuleUrl ? '' : '미리보기 플레이어가 아직 연결되지 않았습니다.';
}

byId('mode').addEventListener('change', () => {
  state.draft.mode = byId('mode').value;
  markDirty();
});

function id(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}
function sortBreaks() {
  const rank = (br) =>
    br.position === 'pre' ? -1 : br.position === 'post' ? Infinity : Number.isFinite(br.atSeconds) ? br.atSeconds : 0;

  state.draft.breaks.sort((a, b) => rank(a) - rank(b));
}

document.querySelectorAll('[data-add-break]').forEach((button) =>
  button.addEventListener('click', () => {
    const position = button.dataset.addBreak;

    if (state.draft.breaks.length >= 100) return message('schedule-status', '광고 구간은 최대 100개입니다.', true);

    if (position !== 'mid' && state.draft.breaks.some((br) => br.position === position))
      return message('schedule-status', '이미 있는 구간 안에 광고를 추가하세요.', true);

    const br = { breakId: id('break'), position, ads: [] };

    if (position === 'mid') br.atSeconds = 10;

    state.draft.breaks.push(br);
    sortBreaks();
    markDirty();
    renderBreaks();
    document.getElementById(`ads-break-${br.breakId}`)?.querySelector('button')?.focus();
  })
);

function renderBreaks() {
  const holder = byId('breaks');

  holder.replaceChildren();

  if (!state.draft.breaks.length)
    holder.append(
      node(
        'p',
        '직접 편성이 비어 있습니다. 그대로 게시하면 상위 설정 대신 광고 없는 편성이 적용됩니다. 광고 구간을 추가하거나 광고 비활성화를 선택할 수 있습니다.',
        'ads-notice'
      )
    );

  for (const br of state.draft.breaks) {
    const section = byId('break-template').content.firstElementChild.cloneNode(true);

    section.id = `ads-break-${br.breakId}`;
    section.querySelector('[data-break-title]').textContent = breakNames[br.position];
    section.querySelector('[data-mid-label]').hidden = br.position !== 'mid';
    const at = section.querySelector('[data-at]');

    at.disabled = br.position !== 'mid';
    at.required = br.position === 'mid';
    at.value = br.atSeconds ?? '';
    at.addEventListener('input', () => {
      br.atSeconds = at.valueAsNumber;
      markDirty();
    });
    at.addEventListener('change', () => {
      sortBreaks();
      renderBreaks();
      document.getElementById(`ads-break-${br.breakId}`)?.querySelector('[data-at]')?.focus();
    });
    section.querySelector('[data-remove-break]').addEventListener('click', () => {
      if (
        br.ads.length &&
        !confirm('이 구간과 포함된 광고 항목을 제거할까요? 초안 저장 전에는 게시본이 바뀌지 않습니다.')
      )
        return;

      state.draft.breaks = state.draft.breaks.filter((candidate) => candidate !== br);
      markDirty();
      renderBreaks();
      document.querySelector('[data-add-break]')?.focus();
    });
    const choices = section.querySelector('[data-creative-select]');
    const available = state.creatives.filter((creative) => !creative.archived);

    choices.append(
      new Option(available.length ? '소재 버전을 선택하세요' : '먼저 사용 가능한 소재를 등록하세요', ''),
      ...available.map(
        (creative, index) =>
          new Option(
            `${creative.name} · v${creative.version} · ${creative.kind === 'image' ? '이미지' : '영상'}`,
            String(index)
          )
      )
    );
    section.querySelector('[data-add-item]').disabled = !available.length || br.ads.length >= 20;
    section.querySelector('[data-add-item]').addEventListener('click', () => {
      if (choices.value === '') return message('schedule-status', '추가할 소재 버전을 선택하세요.', true);

      const item = makeItem(available[Number(choices.value)], id('item'));

      br.ads.push(item);
      markDirty();
      renderBreaks();
      document.getElementById(`ads-item-${item.itemId}`)?.querySelector('[data-click]')?.focus();
    });

    if (!br.ads.length)
      section
        .querySelector('[data-items]')
        .append(node('p', '구간에 광고를 추가하세요. 빈 구간은 저장할 수 없습니다.', 'ads-hint'));

    br.ads.forEach((ad, index) => renderItem(section.querySelector('[data-items]'), br, ad, index));
    holder.append(section);
  }
}

function renderItem(holder, br, ad, index) {
  const item = byId('item-template').content.firstElementChild.cloneNode(true);
  const creative = state.creatives.find((value) => value.creativeId === ad.creativeId);

  item.id = `ads-item-${ad.itemId}`;
  item.querySelector('[data-item-title]').textContent = `${index + 1}. ${creative?.name || ad.creativeId}`;
  item.querySelector('[data-item-meta]').textContent =
    `v${ad.creativeVersion} · ${ad.mime}${creative?.archived ? ' · 보관된 소재: 게시 전 제거하거나 교체하세요.' : ''}`;
  const click = item.querySelector('[data-click]');

  click.value = ad.clickUrl ?? '';
  click.addEventListener('input', () => {
    ad.clickUrl = click.value.trim() || null;
    markDirty();
  });
  const skipMode = item.querySelector('[data-skip-mode]');
  const skip = item.querySelector('[data-skip]');
  const syncSkip = () => {
    item.querySelector('[data-skip-label]').hidden = skipMode.value !== 'after';
    skip.disabled = skipMode.value !== 'after';
    skip.required = skipMode.value === 'after';
  };

  skipMode.value = ad.skipAfterSeconds === null ? 'never' : 'after';
  skip.value = ad.skipAfterSeconds ?? 1;
  syncSkip();
  skipMode.addEventListener('change', () => {
    syncSkip();
    ad.skipAfterSeconds = skipMode.value === 'after' ? skip.valueAsNumber : null;
    markDirty();
  });
  skip.addEventListener('input', () => {
    ad.skipAfterSeconds = skip.valueAsNumber;
    markDirty();
  });
  const duration = item.querySelector('[data-duration]');

  item.querySelector('[data-duration-label]').hidden = ad.kind !== 'image';
  duration.disabled = ad.kind !== 'image';
  duration.required = ad.kind === 'image';
  duration.value = ad.displaySeconds ?? '';
  duration.addEventListener('input', () => {
    ad.displaySeconds = duration.valueAsNumber;
    markDirty();
  });

  for (const [selector, delta] of [
    ['data-up', -1],
    ['data-down', 1],
  ]) {
    const button = item.querySelector(`[${selector}]`);

    button.disabled = index + delta < 0 || index + delta >= br.ads.length;
    button.setAttribute('aria-label', `${index + 1}번 광고 ${delta < 0 ? '위로' : '아래로'} 이동`);
    button.addEventListener('click', () => {
      [br.ads[index], br.ads[index + delta]] = [br.ads[index + delta], br.ads[index]];
      markDirty();
      renderBreaks();
      document.getElementById(`ads-item-${ad.itemId}`)?.querySelector('[data-click]')?.focus();
      message('schedule-status', `${index + 1}번 광고를 ${index + delta + 1}번째로 이동했습니다. 저장 후 게시하세요.`);
    });
  }

  item.querySelector('[data-remove-item]').addEventListener('click', () => {
    br.ads.splice(index, 1);
    markDirty();
    renderBreaks();
    document.getElementById(`ads-break-${br.breakId}`)?.querySelector('[data-creative-select]')?.focus();
  });
  holder.append(item);
}

byId('schedule-form').addEventListener('submit', (event) => {
  event.preventDefault();
  run('schedule-status', async () => {
    const data = await api.request('schedule-save', { data: editorPayload(state.draft) });

    acceptDraft(data);
    byId('conflict-reload').hidden = true;
    message('schedule-status', `초안 r${data.draft.revision}을 저장했습니다. 현재 게시본은 바뀌지 않았습니다.`);
  });
});
byId('publish').addEventListener('click', () => {
  if (state.dirty || !state.draft.revision) return;

  if (!confirm(`저장한 초안 r${state.draft.revision}을 게시할까요? 새 재생 세션부터 적용됩니다.`)) return;

  run('schedule-status', async () => {
    const result = await api.request('schedule-publish', {
      data: { target: state.draft.target, revision: state.draft.revision },
    });

    state.publishedVersion = result.scheduleVersion;
    byId('conflict-reload').hidden = true;
    message(
      'schedule-status',
      `게시 v${result.scheduleVersion}이 적용되었습니다. 이미 재생 중인 세션은 기존 편성을 유지합니다.`
    );

    try {
      const data = await api.request('schedule-draft', {
        query: {
          targetType: state.draft.target.type,
          targetId: state.draft.target.id,
          boardId: state.draft.target.boardId,
        },
      });

      acceptDraft(data);
    } catch {
      message(
        'schedule-status',
        `게시 v${result.scheduleVersion}은 완료됐지만 최신 초안을 다시 읽지 못했습니다. 연결을 확인하고 다시 불러오세요.`
      );
    }
  });
});

function stopPreview() {
  previewRequest += 1;
  preview.destroy();
}
function closePreview() {
  stopPreview();

  if (byId('preview-dialog').open) byId('preview-dialog').close();
}
function resetPreviewView() {
  byId('preview-notice').hidden = true;
  byId('preview-notice').textContent = '';
  byId('preview-events').replaceChildren();
  byId('preview-history').hidden = true;
  byId('preview-context').textContent = '';
  byId('preview-status').dataset.phase = 'idle';
}
byId('preview-open').addEventListener('click', () => {
  if (!state.bootstrap.playerModuleUrl)
    return message('schedule-status', '미리보기 플레이어가 아직 연결되지 않았습니다.', true);

  const form = byId('preview-form');

  form.elements.videoId.readOnly = state.draft.target.type === 'video';

  if (state.draft.target.type === 'video') form.elements.videoId.value = state.draft.target.id;

  resetPreviewView();
  byId('preview-settings').open = true;
  message('preview-status', '실제 본편 URL과 고정 영상 ID를 입력하세요. 준비 후 재생 버튼을 눌러 확인합니다.');
  byId('preview-dialog').showModal();
});
byId('preview-close').addEventListener('click', closePreview);
byId('preview-dialog').addEventListener('close', stopPreview);
byId('preview-dialog').addEventListener('cancel', stopPreview);
byId('preview-stop').addEventListener('click', () => {
  stopPreview();
  byId('preview-status').dataset.phase = 'stopped';
  message('preview-status', '미리보기를 종료했습니다.');
});
byId('preview-form').addEventListener('input', () => {
  stopPreview();
  resetPreviewView();
  message('preview-status', '입력이 변경되었습니다. 미리보기를 다시 준비하세요.');
});
byId('preview-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  stopPreview();
  const request = previewRequest;
  const input = values(byId('preview-form'));

  resetPreviewView();
  byId('preview-status').dataset.phase = 'loading';
  message('preview-status', '편성을 검증하고 플레이어를 준비하고 있습니다…');

  try {
    if (!safeUrl(input.contentUrl)) throw new Error('올바른 본편 URL을 입력하세요.');

    const draft = editorPayload(state.draft);
    const target = draft.target;
    const data = await api.request('schedule-preview', {
      data: {
        ...draft,
        videoId: input.videoId,
        boardId: target.type === 'board' ? target.id : target.boardId || null,
        categoryId: target.type === 'category' ? target.id : null,
      },
    });

    if (request !== previewRequest || !byId('preview-dialog').open) return;

    const ready = await preview.start({
      playerModuleUrl: state.bootstrap.playerModuleUrl,
      media: byId('preview-video'),
      container: byId('preview-container'),
      contentUrl: input.contentUrl,
      schedule: data.schedule,
      onChange: (view) => {
        if (request !== previewRequest || !byId('preview-dialog').open) return;

        message('preview-status', view.message, view.phase === 'error');
        byId('preview-status').dataset.phase = view.phase;
        byId('preview-notice').hidden = !view.notice;
        byId('preview-notice').textContent = view.notice;
        byId('preview-history').hidden = !view.history.length;
        byId('preview-events').replaceChildren(...view.history.map((line) => node('li', line)));
      },
    });

    if (ready && request === previewRequest) {
      byId('preview-context').textContent =
        `영상 ${data.schedule.videoId} · ${data.schedule.breaks.length ? `광고 ${data.schedule.breaks.length}개 구간` : '적용할 광고 없음'} · 게시 전 미리보기`;
      byId('preview-settings').open = false;
      byId('preview-video').focus();
    }
  } catch (error) {
    if (request === previewRequest) {
      preview.destroy();
      byId('preview-status').dataset.phase = 'error';
      report('preview-status', error);
    }
  }
});

function currentStatsFilters() {
  return statsFilters(values(byId('stats-form')));
}
byId('stats-form').addEventListener('input', () => {
  byId('stats-results').hidden = true;
  message('stats-status', '조회 조건이 변경되었습니다. 통계 조회를 눌러 결과를 갱신하세요.');
});
byId('stats-form').addEventListener('submit', (event) => {
  event.preventDefault();
  run('stats-status', async () => {
    byId('stats-results').hidden = true;
    const filters = currentStatsFilters();
    const data = await api.request('stats', { query: filters });

    renderStats(data);
    byId('stats-meta').textContent = `${filters.from} ~ ${filters.to} · ${data.timeZone} · 집계 시각 ${data.asOf}`;
    message(
      'stats-status',
      data.rows.length
        ? `${data.rows.length}개 조합의 결과입니다.`
        : '이 조건에 수집된 기록이 없습니다. 기간과 광고·영상·게시판 ID를 확인하세요.'
    );
    byId('stats-results').hidden = false;
  });
});

function renderStats(data) {
  const metrics = [
    ['starts', '시작'],
    ['completes', '완료'],
    ['skips', '스킵'],
    ['clicks', '클릭'],
    ['errors', '오류'],
    ['completionRate', '완료율'],
    ['clickRate', '클릭률'],
  ];
  const format = (key, value) =>
    key.endsWith('Rate') ? formatRate(value) : new Intl.NumberFormat('ko-KR').format(value ?? 0);

  byId('metrics').replaceChildren(
    ...metrics.map(([key, label]) => {
      const group = node('div');

      group.append(node('dt', label), node('dd', format(key, data.totals[key])));
      return group;
    })
  );
  byId('stats-rows').replaceChildren(
    ...data.rows.map((row) => {
      const tr = node('tr');

      for (const key of ['adId', 'videoId', 'boardId']) tr.append(node('td', row[key] ?? '—'));

      for (const [key] of metrics) tr.append(node('td', format(key, row[key])));

      return tr;
    })
  );
}

byId('csv').addEventListener('click', () =>
  run('stats-status', async () => {
    const filters = currentStatsFilters();
    const blob = await api.request('stats-csv', { query: filters, csv: true });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = `ads-${filters.from}-${filters.to}.csv`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    message('stats-status', '현재 조회 조건의 CSV 다운로드를 요청했습니다. 브라우저 다운로드 목록을 확인하세요.');
  })
);

window.addEventListener('beforeunload', (event) => {
  if (!state.dirty && !state.creativeDirty) return;

  event.preventDefault();
  event.returnValue = '';
});
window.addEventListener('pagehide', () => {
  stopPreview();
  clearCreativeMedia();
});
run('global-status', bootstrap);
