/**
 * The help page (contract A2-D 4, design OptionTable and PhaseTag): the option tables come from `options.js`, rendered
 * into `[data-options]` and `[data-fields]` placeholders, so the admin's anchors and the page share one source.
 */
import { acceptsText, fieldAnchor, INSTALL_OPTIONS, optionAnchor, PRESET_FIELDS, stageText } from './options.js';
import { bindCopy, startToc } from './page.js';

const COLUMNS = ['이름', '받는 값', '기본값', '설명', '적용 단계'];
const LIVE = stageText('A2-1');

// Copy table titles (ads-demo-copy 3); groups the copy does not name keep their own title after the copy's.
const INSTALL_TITLES = {
  loaderData: '자리 요소 data-* 속성',
  element: '요소 속성 · <media-ads>',
  mount: 'JS API · mount',
  controller: 'JS API · createAdsController 옵션',
  controllerMethods: 'JS API · createAdsController 반환 메서드',
  events: '이벤트',
  skinCss: 'CSS 변수 · 스킨',
  adsCss: 'CSS 변수 · 광고 화면',
  exampleQuery: '데모·재생 테스트 페이지 쿼리',
};

export const FIELD_GROUPS = {
  meta: '이름과 플레이어 종류',
  theme: '테마',
  playback: '재생 동작',
  display: '표시',
  language: '언어',
  input: '입력',
  controls: '컨트롤',
  logo: '로고',
  ads: '광고 화면',
  lms: '강의(LMS)',
};

/** The table group of a preset field path. */
export function fieldGroup(path) {
  if (path === 'name' || path === 'playerType') return 'meta';

  return path.split('.')[0];
}

const token = /^[\w.'#{}()<>-]+$/;

/** Text with `a | b` choices of plain tokens shown as code, the copy's rule for literal values. */
function valueNodes(document, text) {
  const parts = text.split(' | ');

  if (parts.length < 2 || !parts.every((part) => token.test(part))) return [text];

  return parts.flatMap((part, index) => {
    const code = document.createElement('code');

    code.textContent = part;
    return index ? [' | ', code] : [code];
  });
}

function anchor(document, id, name) {
  const link = document.createElement('a');
  const mark = document.createElement('span');
  const label = document.createElement('span');

  link.className = 'sa-anchor';
  link.href = `#${id}`;
  mark.setAttribute('aria-hidden', 'true');
  mark.textContent = '#';
  label.className = 'sa-sr';
  label.textContent = `‘${name}’ 항목 주소`;
  link.append(mark, label);
  return link;
}

/** A PhaseTag: "적용" is the live one. */
export function phaseTag(document, text) {
  const tag = document.createElement('span');

  tag.className = text === LIVE ? 'sa-phase is-live' : 'sa-phase';
  tag.textContent = text;
  return tag;
}

function cell(document, label, content) {
  const td = document.createElement('td');
  const key = document.createElement('span');
  const value = document.createElement('span');

  td.setAttribute('role', 'cell');
  key.className = 'sa-optt-k';
  key.setAttribute('aria-hidden', 'true');
  key.textContent = label;
  value.append(...content);
  td.append(key, value);
  return td;
}

/** One OptionTable row: `{ id, name, accepts, defaultText, description, stage }`. */
function row(document, item) {
  const tr = document.createElement('tr');
  const th = document.createElement('th');
  const name = document.createElement('span');
  const code = document.createElement('code');

  tr.id = item.id;
  tr.setAttribute('role', 'row');
  th.scope = 'row';
  th.setAttribute('role', 'rowheader');
  name.className = 'sa-optt-name';
  code.textContent = item.name;
  name.append(code, anchor(document, item.id, item.name));
  th.append(name);
  tr.append(
    th,
    cell(document, COLUMNS[1], item.accepts ? valueNodes(document, item.accepts) : ['없음']),
    cell(document, COLUMNS[2], item.defaultText ? valueNodes(document, item.defaultText) : ['없음']),
    cell(document, COLUMNS[3], [item.description ?? '']),
    cell(document, COLUMNS[4], [phaseTag(document, item.stage)])
  );
  return tr;
}

/** An OptionTable labelled by `headingId`. */
function table(document, headingId, items) {
  const card = document.createElement('div');
  const scroll = document.createElement('div');
  const element = document.createElement('table');
  const head = document.createElement('thead');
  const headRow = document.createElement('tr');
  const body = document.createElement('tbody');

  card.className = 'sa-card is-flush sa-opts';
  scroll.className = 'sa-scroll';
  element.className = 'sa-table sa-optt';
  element.setAttribute('role', 'table');
  element.setAttribute('aria-labelledby', headingId);
  head.setAttribute('role', 'rowgroup');
  headRow.setAttribute('role', 'row');
  body.setAttribute('role', 'rowgroup');

  for (const label of COLUMNS) {
    const th = document.createElement('th');

    th.scope = 'col';
    th.setAttribute('role', 'columnheader');
    th.textContent = label;
    headRow.append(th);
  }

  head.append(headRow);
  body.append(...items.map((item) => row(document, item)));
  element.append(head, body);
  scroll.append(element);
  card.append(scroll);
  return card;
}

/** `div.sa-doc-hrow > h3` with an optional anchor and PhaseTag. */
function heading(document, id, text, { linked = false, phase = '' } = {}) {
  const wrap = document.createElement('div');
  const h3 = document.createElement('h3');

  wrap.className = 'sa-doc-hrow';
  h3.className = 'sa-doc-h3';
  h3.id = id;
  h3.textContent = text;
  wrap.append(h3);

  if (linked) wrap.append(anchor(document, id, text));

  if (phase) wrap.append(phaseTag(document, phase));

  return wrap;
}

function note(document, text) {
  const p = document.createElement('p');

  p.className = 'sa-small';
  p.textContent = text;
  return p;
}

/** The stage of an install row: its preset field's, otherwise applied. */
function installStage(item) {
  const field = item.presetField && PRESET_FIELDS.find((entry) => entry.path === item.presetField);

  return field ? stageText(field.stage) : LIVE;
}

/** The nodes for one install group: heading, note and table. */
export function installTable(document, id) {
  const group = INSTALL_OPTIONS.find((entry) => entry.id === id);
  const headingId = `table-${id}`;
  const items = group.rows.map((item) => ({
    id: optionAnchor(item.name, group.id),
    name: item.name,
    accepts: item.type,
    defaultText: item.defaultValue,
    description: item.description,
    stage: installStage(item),
  }));

  return [
    heading(document, headingId, INSTALL_TITLES[id] ?? group.title),
    ...(group.note ? [note(document, group.note)] : []),
    table(document, headingId, items),
  ];
}

/** The nodes for one preset field group; a group whose fields share a stage shows it once beside its heading. */
export function fieldTable(document, group) {
  const fields = PRESET_FIELDS.filter((field) => fieldGroup(field.path) === group);
  const stages = new Set(fields.map((field) => stageText(field.stage)));
  const [only] = stages;
  const headingId = `fields-${group}`;
  const items = fields.map((field) => ({
    id: fieldAnchor(field.path),
    name: field.path,
    accepts: acceptsText(field.accepts),
    defaultText: field.defaultText,
    description: field.description,
    stage: stageText(field.stage),
  }));

  return [
    heading(document, headingId, FIELD_GROUPS[group], {
      linked: true,
      phase: stages.size === 1 && only !== LIVE ? only : '',
    }),
    table(document, headingId, items),
  ];
}

/** Replace every table placeholder in `root` with its tables. */
export function renderHelpTables(root) {
  const document = root.ownerDocument ?? root;

  for (const slot of root.querySelectorAll('[data-options]')) slot.replaceWith(...installTable(document, slot.dataset.options));

  for (const slot of root.querySelectorAll('[data-fields]')) slot.replaceWith(...fieldTable(document, slot.dataset.fields));
}

/** Start the page: tables, copy buttons, the table of contents, then the address target again now that it exists. */
export function startHelp(root = document) {
  renderHelpTables(root);

  for (const block of root.querySelectorAll('.sa-codeblock')) bindCopy(block);

  startToc(root);

  // A fragment navigation to the same address scrolls to and marks (`:target`) a row that did not exist on load.
  if (location.hash && root.getElementById(decodeURIComponent(location.hash.slice(1)))) location.replace(location.href);
}
