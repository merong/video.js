/**
 * `<solad-lms-panel>`: the lecture panel beside or below the player (`ads-lms-design-handoff.md` section 2). It draws
 * the progress head and the chapters, materials, transcript and notes tabs in its own shadow root, light by default
 * (`ads-lms-spec.md` 10.5); a page sets `solad-lms-panel { color-scheme: dark }` or `light dark` to change it.
 *
 * `lms.js` drives it: `configure()` before `connect()`, then `update(state)` when data changes and `setTime()` on time
 * updates. Messages go to the player's single live region through `actions.announce`.
 */
import { formatTime, itemAt } from './lms.js';

const TAG = 'solad-lms-panel';
const TABS = ['chapters', 'materials', 'transcript', 'notes'];
const TAB_STORE = 'solad-lms:tab';
const NOTE_LIMIT = 200;

const icon = (body, fill = false) =>
  fill
    ? `<svg viewBox="0 0 18 18" fill="currentColor" aria-hidden="true" focusable="false">${body}</svg>`
    : `<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
const ICONS = {
  check: icon('<path d="m4 9.5 3.25 3.25L14 6"/>'),
  lock: icon('<rect x="3.5" y="8" width="11" height="8" rx="1.5"/><path d="M6 8V5.5a3 3 0 0 1 6 0V8"/>'),
  server: icon(
    '<rect x="2.5" y="3" width="13" height="5" rx="1.25"/><rect x="2.5" y="10" width="13" height="5" rx="1.25"/>'
  ),
  monitor: icon('<rect x="2" y="3" width="14" height="9.5" rx="1.25"/><path d="M6.5 15.5h5M9 12.5v3"/>'),
  warn: icon('<path d="M9 2.5 16.5 15.5h-15Z"/><path d="M9 7.5v3.5M9 13.5v.01"/>'),
  prev: icon('<path d="m11 4-5 5 5 5"/>'),
  next: icon('<path d="m7 4 5 5-5 5"/>'),
  file: icon(
    '<path d="M10 2H5a1.5 1.5 0 0 0-1.5 1.5v11A1.5 1.5 0 0 0 5 16h8a1.5 1.5 0 0 0 1.5-1.5V6.5Z"/><path d="M10 2v4.5h4.5"/>'
  ),
  note: icon('<path d="M3 15h3.5L15 6.5 11.5 3 3 11.5Z"/>'),
  bookmark: icon(
    '<path d="M5 1h8a2.5 2.5 0 0 1 2.5 2.5v12.6a.9.9 0 0 1-1.39.76L9 13.6l-5.11 3.26a.9.9 0 0 1-1.39-.76V3.5A2.5 2.5 0 0 1 5 1Z"/>',
    true
  ),
  edit: icon('<path d="M3 15h3.5L15 6.5 11.5 3 3 11.5Z"/>'),
  delete: icon('<path d="M3 5h12M7 5V3h4v2M5 5l.75 10h6.5L13 5"/>'),
};

const STYLES = `
:host {
  color-scheme: light;
  display: block;
  min-width: 0;
  --solad-lms-surface: light-dark(#ffffff, #18181b);
  --solad-lms-surface-2: light-dark(#f4f4f5, #232327);
  --solad-lms-text: light-dark(#18181a, #f4f4f5);
  --solad-lms-sub: light-dark(#5f5f66, #a1a1aa);
  --solad-lms-line: light-dark(#e4e4e7, #34343a);
  --solad-lms-accent: var(--media-accent-color, var(--solad-lms-text));
  --solad-lms-warn: light-dark(#8a5300, #f5b14c);
  --solad-lms-bad: light-dark(#b42318, #ff8a80);
  --solad-lms-radius: 12px;
  --solad-lms-ring: var(--solad-lms-text);
}
:host([hidden]) { display: none; }
* { box-sizing: border-box; }
button, input, textarea { font: inherit; color: inherit; }
button { cursor: pointer; }
button:focus-visible, input:focus-visible, textarea:focus-visible, a:focus-visible, [tabindex]:focus-visible {
  outline: 2px solid var(--solad-lms-ring);
  outline-offset: 2px;
}
svg { width: 18px; height: 18px; flex: none; }
.panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: inherit;
  overflow: hidden;
  border: 1px solid var(--solad-lms-line);
  border-radius: var(--solad-lms-radius);
  background: var(--solad-lms-surface);
  color: var(--solad-lms-text);
  font: 14px/1.5 var(--media-font-family, "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif);
}
.head { display: grid; gap: 6px; padding: 12px 16px 10px; border-bottom: 1px solid var(--solad-lms-line); }
.head-row { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
.percent { font-size: 15px; font-weight: 700; }
.threshold { font-size: 12.5px; color: var(--solad-lms-sub); }
.chip {
  display: inline-flex; align-items: center; gap: 4px; margin-inline-start: auto; height: 22px; padding: 0 9px;
  border-radius: 999px; background: var(--solad-lms-surface-2); font-size: 12px; font-weight: 600; white-space: nowrap;
  align-self: center;
}
.chip svg { width: 14px; height: 14px; }
.chip[data-state="done"] { background: var(--solad-lms-text); color: var(--solad-lms-surface); }
.bar {
  position: relative; height: 8px; border-radius: 4px; background: var(--solad-lms-surface-2);
  box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--solad-lms-text) 35%, transparent);
}
.bar-fill { position: absolute; inset-block: 0; left: 0; border-radius: 4px; background: var(--solad-lms-accent);
  box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--solad-lms-text) 35%, transparent); }
.bar-mark { position: absolute; top: -3px; width: 2px; height: 14px; translate: -1px 0; border-radius: 1px; background: var(--solad-lms-text); }
.store { display: flex; align-items: center; gap: 6px; margin: 0; font-size: 12.5px; color: var(--solad-lms-sub); }
.store svg { width: 14px; height: 14px; }
.store[data-tone="warn"] { color: var(--solad-lms-warn); }
.tabs { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); border-bottom: 1px solid var(--solad-lms-line); }
.tab {
  position: relative; height: 44px; padding: 0 4px; border: 0; background: none; color: var(--solad-lms-sub);
  font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.tab:focus-visible { outline-offset: -4px; }
.tab[aria-selected="true"] { color: var(--solad-lms-text); font-weight: 700; }
.tab[aria-selected="true"]::after {
  content: ""; position: absolute; inset-inline: 8px; bottom: -1px; height: 2px; background: var(--solad-lms-accent);
}
.count { margin-inline-start: 4px; font-size: 12px; font-weight: 500; color: var(--solad-lms-sub); }
.body { position: relative; flex: 1; min-height: 0; overflow: auto; overscroll-behavior: contain; padding: 8px; }
.body[aria-busy="true"] .skeleton { display: grid; }
.skeleton { display: none; gap: 10px; padding: 8px; }
.skeleton i { height: 14px; border-radius: 4px; background: var(--solad-lms-surface-2); }
.skeleton i:nth-child(2n) { width: 70%; }
.list { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
.row {
  position: relative; display: grid; grid-template-columns: 44px minmax(0, 1fr) auto; align-items: center; gap: 8px;
  width: 100%; min-height: 44px; padding: 6px 8px; border: 0; border-radius: 8px; background: none; text-align: start;
}
.row:hover { background: var(--solad-lms-surface-2); }
.row[aria-current="true"] { background: var(--solad-lms-surface-2); font-weight: 600; }
.row[aria-current="true"]::before {
  content: ""; position: absolute; left: 0; inset-block: 8px; width: 3px; border-radius: 2px; background: var(--solad-lms-accent);
}
.row[aria-disabled="true"] { color: var(--solad-lms-sub); }
.time { font-size: 12.5px; color: var(--solad-lms-sub); font-variant-numeric: tabular-nums; }
.title { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; overflow-wrap: anywhere; }
.state { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--solad-lms-sub); font-weight: 400; }
.mini { width: 40px; height: 4px; border-radius: 2px; background: var(--solad-lms-surface-2); overflow: hidden;
  box-shadow: inset 0 0 0 1px var(--solad-lms-line); }
.mini i { display: block; height: 100%; background: var(--solad-lms-text); }
.state svg { width: 16px; height: 16px; }
.slide-title { margin: 0 0 6px; font-size: 13px; font-weight: 700; }
.figure { margin: 0; aspect-ratio: 16 / 9; display: grid; place-items: center; border-radius: 8px; background: var(--solad-lms-surface-2); overflow: hidden; }
.figure img { width: 100%; height: 100%; object-fit: contain; }
.figure p { margin: 0; color: var(--solad-lms-sub); font-size: 13px; }
.tools { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: 8px 0; }
.icon-button {
  display: inline-grid; place-items: center; width: 32px; height: 32px; border: 0; border-radius: 8px;
  background: var(--solad-lms-surface-2);
}
.icon-button:disabled, .icon-button[aria-disabled="true"] { opacity: 0.4; cursor: default; }
.slide-count { min-width: 48px; text-align: center; font-variant-numeric: tabular-nums; font-size: 13px; }
.chip-button {
  display: inline-flex; align-items: center; gap: 4px; height: 32px; padding: 0 10px; border: 0; border-radius: 999px;
  background: var(--solad-lms-surface-2); font-size: 13px; white-space: nowrap;
}
.chip-button[aria-pressed="true"] { box-shadow: inset 0 0 0 2px var(--solad-lms-text); font-weight: 600; }
.chip-button[aria-pressed="false"] svg { display: none; }
.chip-button[aria-disabled="true"] { opacity: 0.5; cursor: default; }
.spacer { flex: 1; }
.subhead { margin: 16px 0 4px; font-size: 13px; font-weight: 700; }
.file { display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 8px; border-radius: 8px; color: inherit; }
.file span:first-of-type { text-decoration: underline; flex: 1; min-width: 0; overflow-wrap: anywhere; }
.file:hover { background: var(--solad-lms-surface-2); }
.size { font-size: 12.5px; color: var(--solad-lms-sub); }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.search { flex: 1 1 140px; min-width: 0; height: 32px; padding: 0 10px; border: 1px solid var(--solad-lms-line); border-radius: 8px; background: var(--solad-lms-surface); }
.result { font-size: 12.5px; color: var(--solad-lms-sub); white-space: nowrap; }
mark { background: color-mix(in oklab, var(--solad-lms-accent) 35%, transparent); color: inherit; border-radius: 2px; }
.row.is-result { box-shadow: inset 0 0 0 2px var(--solad-lms-text); }
.empty { padding: 16px 8px; color: var(--solad-lms-sub); }
.empty p { margin: 0; }
.empty p:first-child { color: var(--solad-lms-text); font-weight: 600; }
.form { display: grid; gap: 6px; padding: 4px 4px 12px; border-bottom: 1px solid var(--solad-lms-line); margin-bottom: 8px; }
.form label { font-size: 12.5px; font-weight: 700; }
textarea { width: 100%; min-height: 3.6em; padding: 8px 10px; border: 1px solid var(--solad-lms-line); border-radius: 8px; background: var(--solad-lms-surface); resize: vertical; }
.form-row { display: flex; align-items: center; gap: 8px; }
.form-row .counter { font-size: 12px; color: var(--solad-lms-sub); margin-inline-end: auto; font-variant-numeric: tabular-nums; }
.primary { height: 32px; padding: 0 14px; border: 0; border-radius: 999px; background: var(--solad-lms-text); color: var(--solad-lms-surface); font-weight: 600; font-size: 13px; }
.primary:disabled { opacity: 0.4; cursor: default; }
.secondary { height: 32px; padding: 0 12px; border: 0; border-radius: 999px; background: var(--solad-lms-surface-2); font-size: 13px; }
.danger { background: var(--solad-lms-bad); color: var(--solad-lms-surface); }
.note { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 8px; align-items: start; padding: 8px 4px; border-radius: 8px; }
.note + .note { border-top: 1px solid var(--solad-lms-line); }
.pill { display: inline-flex; align-items: center; gap: 4px; height: 28px; padding: 0 8px; border: 0; border-radius: 999px; background: var(--solad-lms-surface-2); font-size: 12.5px; font-variant-numeric: tabular-nums; }
.pill svg { width: 14px; height: 14px; }
.note-text { padding-top: 3px; overflow-wrap: anywhere; white-space: pre-wrap; }
.note-text.is-sub { color: var(--solad-lms-sub); }
.note-actions { display: flex; gap: 2px; }
.note-actions .icon-button { width: 28px; height: 28px; background: none; }
.note-edit, .note-confirm, .note-error { grid-column: 1 / -1; display: grid; gap: 6px; }
.note-confirm, .note-error { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.note-error, .form-error { color: var(--solad-lms-bad); font-size: 13px; }
.limit { padding: 10px 12px; border-radius: 8px; background: var(--solad-lms-surface-2); font-size: 13px; }
.foot { margin: 0; padding: 8px 16px; border-top: 1px solid var(--solad-lms-line); color: var(--solad-lms-warn); font-size: 12.5px; display: flex; gap: 6px; align-items: center; }
.foot svg { width: 14px; height: 14px; }
@media (prefers-contrast: more) {
  :host { --solad-lms-sub: var(--solad-lms-text); --solad-lms-line: color-mix(in oklab, var(--solad-lms-text) 60%, transparent); }
}
@media (forced-colors: active) {
  .bar-fill, .row[aria-current="true"]::before, .tab[aria-selected="true"]::after { background: Highlight; forced-color-adjust: none; }
  mark { background: Mark; color: MarkText; }
}
@media (prefers-reduced-motion: no-preference) {
  .body { scroll-behavior: smooth; }
}
`;

// The grid around the player and the panel, in the page: the panel sits outside the player's clipped container.
const LAYOUT = `
.solad-lms { container: solad-lms / inline-size; }
.solad-lms-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; }
.solad-lms-grid > solad-lms-panel { max-height: 384px; }
.solad-lms-grid > solad-lms-panel[data-head-only] { max-height: none; }
@container solad-lms (width >= 960px) {
  .solad-lms-grid:not(:has(> solad-lms-panel[data-head-only])) { grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: 16px; }
  .solad-lms-grid:not(:has(> solad-lms-panel[data-head-only])) > solad-lms-panel { contain: size; max-height: none; }
}
`;

export function ensureLayoutStyle(document) {
  if (document.getElementById('solad-lms-layout')) return;

  const style = document.createElement('style');

  style.id = 'solad-lms-layout';
  style.textContent = LAYOUT;
  document.head.append(style);
}

function readTab() {
  try {
    return localStorage.getItem(TAB_STORE);
  } catch {
    return null;
  }
}

function writeTab(value) {
  try {
    localStorage.setItem(TAB_STORE, value);
  } catch {
    // Not remembered.
  }
}

function el(document, tag, attributes = {}, children = []) {
  const node = document.createElement(tag);

  for (const [name, value] of Object.entries(attributes)) {
    if (value === null || value === undefined || value === false) continue;

    if (name === 'text') node.textContent = value;
    else if (name === 'html') node.innerHTML = value;
    else node.setAttribute(name, value === true ? '' : String(value));
  }

  node.append(...children);
  return node;
}

/** Roving tabindex for the buttons of a list: one Tab stop, ↑/↓ and Home/End move (handoff 2.5). */
function rove(list, selector) {
  list.addEventListener('keydown', (event) => {
    const items = [...list.querySelectorAll(selector)];
    const index = items.indexOf(event.composedPath().find((node) => items.includes(node)));
    if (index < 0) return;

    const next = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: items.length - 1 }[event.key];
    if (next === undefined) return;

    event.preventDefault();
    focusItem(items, Math.max(0, Math.min(items.length - 1, next)));
  });
}

function focusItem(items, index) {
  items.forEach((item, at) => (item.tabIndex = at === index ? 0 : -1));
  items[index]?.focus();
}

function setTabStop(items, index) {
  if (items.some((item) => item.matches(':focus'))) return;

  items.forEach((item, at) => (item.tabIndex = at === Math.max(0, index) ? 0 : -1));
}

function escapeHtml(value) {
  return value.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]);
}

export class SoladLmsPanelElement extends HTMLElement {
  static tagName = TAG;

  #actions = null;
  #t = (key) => key;
  #tabs = { chapters: true, materials: true, transcript: true, notes: true };
  #headOnly = false;
  #state = null;
  #dom = null;
  #selected = null;
  #time = 0;
  #limit = null;
  #slide = 0;
  #follow = true;
  #autoScroll = true;
  #query = '';
  #matches = [];
  #match = -1;
  #noteTime = null;
  #signatures = {};
  #editing = null;
  #confirming = null;
  #failed = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  /** Which tabs the preset turns on, and `headOnly` for the progress line alone (preview, no lecture). */
  configure({ tabs, headOnly = false }) {
    this.#tabs = { ...this.#tabs, ...tabs };
    this.#headOnly = headOnly || !TABS.some((key) => this.#tabs[key]);
    this.toggleAttribute('data-head-only', this.#headOnly);
  }

  connect(actions) {
    this.#actions = actions;
    this.#t = actions.t;
    this.#build();
  }

  #build() {
    const t = this.#t;
    const doc = this.ownerDocument;
    const root = this.shadowRoot;
    const style = doc.createElement('style');

    style.textContent = STYLES;

    const dom = {};

    dom.percent = el(doc, 'strong', { class: 'percent' });
    dom.threshold = el(doc, 'span', { class: 'threshold' });
    dom.chip = el(doc, 'span', { class: 'chip' });
    dom.fill = el(doc, 'i', { class: 'bar-fill' });
    dom.mark = el(doc, 'i', { class: 'bar-mark' });
    dom.bar = el(doc, 'div', { class: 'bar', role: 'img' }, [dom.fill, dom.mark]);
    dom.store = el(doc, 'p', { class: 'store' });

    const head = el(doc, 'header', { class: 'head' }, [
      el(doc, 'div', { class: 'head-row' }, [dom.percent, dom.threshold, dom.chip]),
      dom.bar,
      dom.store,
    ]);

    dom.section = el(doc, 'section', { class: 'panel', 'aria-label': t('panel.label') }, [head]);

    if (!this.#headOnly) {
      dom.tablist = el(doc, 'div', { class: 'tabs', role: 'tablist', 'aria-label': t('tabs.label') });
      dom.body = el(doc, 'div', { class: 'body', 'aria-busy': 'true' }, [
        el(
          doc,
          'div',
          { class: 'skeleton', 'aria-hidden': 'true' },
          [1, 2, 3, 4].map(() => el(doc, 'i'))
        ),
      ]);
      dom.tab = {};
      dom.pane = {};

      for (const key of TABS) {
        const id = `solad-lms-${key}`;
        const tab = el(doc, 'button', {
          type: 'button',
          class: 'tab',
          role: 'tab',
          id: `${id}-tab`,
          'aria-controls': `${id}-pane`,
          'aria-selected': 'false',
          tabindex: -1,
          hidden: true,
        });
        const pane = el(doc, 'div', {
          class: 'pane',
          role: 'tabpanel',
          id: `${id}-pane`,
          'aria-labelledby': `${id}-tab`,
          hidden: true,
        });

        tab.addEventListener('click', () => this.#select(key, true));
        dom.tab[key] = tab;
        dom.pane[key] = pane;
        dom.tablist.append(tab);
        dom.body.append(pane);
      }

      dom.tablist.addEventListener('keydown', (event) => this.#tabKeys(event));
      dom.foot = el(doc, 'p', { class: 'foot', hidden: true });
      dom.section.append(dom.tablist, dom.body, dom.foot);

      // The user scrolling the body stops the transcript's auto-scroll (spec 2.6).
      for (const type of ['wheel', 'touchmove'])
        dom.body.addEventListener(type, () => this.#stopAutoScroll(), { passive: true });
    }

    this.#dom = dom;
    root.replaceChildren(style, dom.section);
  }

  #visibleTabs() {
    const state = this.#state;
    if (!state || this.#headOnly) return [];

    return TABS.filter((key) => {
      if (!this.#tabs[key]) return false;

      if (key === 'chapters') return state.chapters.length > 0;

      if (key === 'materials') return state.slides.length + state.files.length > 0;

      if (key === 'transcript') return state.cues.length > 0;

      return true;
    });
  }

  #select(key, focus = false) {
    const dom = this.#dom;

    this.#selected = key;
    writeTab(key);

    for (const name of TABS) {
      const on = name === key;

      dom.tab[name].setAttribute('aria-selected', String(on));
      dom.tab[name].tabIndex = on ? 0 : -1;
      dom.pane[name].hidden = !on;
    }

    if (focus) dom.tab[key].focus();

    if (key === 'transcript') this.#scrollToCue(true);
  }

  #tabKeys(event) {
    const visible = this.#visibleTabs();
    const index = visible.indexOf(this.#selected);
    const next = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: visible.length - 1 }[event.key];
    if (next === undefined || !visible.length) return;

    event.preventDefault();
    this.#select(visible[(next + visible.length) % visible.length], true);
  }

  /** Apply the controller's state (handoff 2.3–2.9). */
  update(state) {
    if (!this.#dom) return;

    this.#state = state;
    this.#limit = state.limit;
    this.#renderHead(state);

    if (this.#headOnly) return;

    const dom = this.#dom;
    const visible = this.#visibleTabs();
    const loading = state.storage === 'loading';

    dom.body.setAttribute('aria-busy', String(loading));

    for (const key of TABS) dom.tab[key].hidden = loading || !visible.includes(key);

    if (!loading) {
      if (!visible.includes(this.#selected)) {
        const saved = readTab();

        this.#select(visible.includes(saved) ? saved : visible[0]);
      }

      this.#renderChapters(state);
      this.#renderMaterials(state);
      this.#renderTranscript(state);
      this.#renderNotes(state);
    } else for (const key of TABS) dom.pane[key].hidden = true;

    const t = this.#t;
    const foot =
      state.lecture && state.manifestFailed
        ? t('manifest.failed')
        : state.dropped
          ? t('manifest.partial', { n: state.dropped })
          : '';

    dom.foot.hidden = !foot;
    dom.foot.innerHTML = foot ? `${ICONS.warn}<span>${escapeHtml(foot)}</span>` : '';
    this.#updateTime();
  }

  #renderHead(state) {
    const t = this.#t;
    const dom = this.#dom;
    const date = state.completedAt
      ? new Intl.DateTimeFormat(this.#actions.language, {
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hourCycle: 'h23',
        }).format(new Date(state.completedAt))
      : '';
    const chip = state.ad ? 'ad' : state.completedAt ? 'done' : 'learning';
    const tone = ['retrying', 'tokenInvalid', 'tokenExpired'].includes(state.storage) ? 'warn' : '';
    const storeIcon = tone ? ICONS.warn : state.storage === 'server' ? ICONS.server : ICONS.monitor;

    dom.percent.textContent = t('head.progress', { p: state.percent });
    dom.threshold.textContent = t('head.threshold', { t: state.completion });
    dom.chip.dataset.state = chip;
    dom.chip.innerHTML = `${chip === 'done' ? ICONS.check : ''}<span>${escapeHtml(
      chip === 'done' ? t('state.done', { date }) : t(`state.${chip}`)
    )}</span>`;
    dom.fill.style.width = `${state.percent}%`;
    dom.mark.style.left = `${state.completion}%`;
    dom.bar.setAttribute('aria-label', t('head.barLabel', { p: state.percent, t: state.completion }));
    dom.store.dataset.tone = tone;
    dom.store.innerHTML = `${storeIcon}<span>${escapeHtml(t(`store.${state.storage}`))}</span>`;
  }

  #changed(key, value) {
    const signature = JSON.stringify(value);
    if (this.#signatures[key] === signature) return false;

    this.#signatures[key] = signature;
    return true;
  }

  #renderChapters(state) {
    const pane = this.#dom.pane.chapters;
    const t = this.#t;
    const doc = this.ownerDocument;

    if (
      this.#changed(
        'chapterList',
        state.chapters.map(({ start, title }) => [start, title])
      )
    ) {
      const list = el(doc, 'ol', { class: 'list' });

      state.chapters.forEach((chapter, index) => {
        const button = el(doc, 'button', { type: 'button', class: 'row', tabindex: index ? -1 : 0 }, [
          el(doc, 'span', { class: 'time', text: formatTime(chapter.start) }),
          el(doc, 'span', { class: 'title', text: `${index + 1}. ${chapter.title}` }),
          el(doc, 'span', { class: 'state' }),
        ]);

        button.addEventListener('click', () => this.#goto(chapter.start, true));
        list.append(el(doc, 'li', {}, [button]));
      });

      rove(list, '.row');
      pane.replaceChildren(list);
    }

    const rows = [...pane.querySelectorAll('.row')];

    state.chapters.forEach((chapter, index) => {
      const row = rows[index];
      const locked = state.limit !== null && chapter.start > state.limit;
      const done = chapter.percent >= state.completion;
      const label = locked
        ? t('chapter.locked')
        : done
          ? t('chapter.done')
          : t('chapter.watched', { p: chapter.percent });
      const stateHtml = locked
        ? ICONS.lock
        : done
          ? ICONS.check
          : `<span class="mini"><i style="width:${chapter.percent}%"></i></span><span>${chapter.percent}%</span>`;
      const box = row.querySelector('.state');

      if (box.dataset.html !== stateHtml) {
        box.innerHTML = stateHtml;
        box.dataset.html = stateHtml;
      }

      row.toggleAttribute('aria-disabled', locked);

      if (locked) row.setAttribute('aria-disabled', 'true');

      row.setAttribute('aria-label', `${index + 1}. ${chapter.title}, ${formatTime(chapter.start)}, ${label}`);
    });
  }

  #renderMaterials(state) {
    const pane = this.#dom.pane.materials;
    const t = this.#t;
    const doc = this.ownerDocument;

    if (!this.#changed('materials', [state.slides, state.files])) return;

    const parts = [];

    if (state.slides.length) {
      const dom = {};

      dom.title = el(doc, 'p', { class: 'slide-title' });
      dom.figure = el(doc, 'figure', { class: 'figure' });
      dom.prev = el(doc, 'button', {
        type: 'button',
        class: 'icon-button',
        'aria-label': t('slide.prev'),
        html: ICONS.prev,
      });
      dom.count = el(doc, 'span', { class: 'slide-count', 'aria-live': 'off' });
      dom.next = el(doc, 'button', {
        type: 'button',
        class: 'icon-button',
        'aria-label': t('slide.next'),
        html: ICONS.next,
      });
      dom.follow = el(doc, 'button', {
        type: 'button',
        class: 'chip-button',
        'aria-pressed': 'true',
        html: `${ICONS.check}<span>${escapeHtml(t('slide.follow'))}</span>`,
      });
      dom.goto = el(doc, 'button', { type: 'button', class: 'chip-button', text: t('slide.goto'), hidden: true });
      dom.prev.addEventListener('click', () => this.#showSlide(this.#slide - 1, false));
      dom.next.addEventListener('click', () => this.#showSlide(this.#slide + 1, false));
      dom.follow.addEventListener('click', () => {
        this.#follow = true;
        this.#showSlide(itemAt(this.#state.slides, this.#time), true);
      });
      dom.goto.addEventListener('click', () => {
        if (dom.goto.getAttribute('aria-disabled') !== 'true') this.#goto(this.#state.slides[this.#slide].start);
      });
      this.#dom.slide = dom;
      parts.push(
        dom.title,
        dom.figure,
        el(doc, 'div', { class: 'tools' }, [
          dom.prev,
          dom.count,
          dom.next,
          el(doc, 'span', { class: 'spacer' }),
          dom.follow,
          dom.goto,
        ])
      );
    } else this.#dom.slide = null;

    if (state.files.length) {
      const list = el(doc, 'ul', { class: 'list' });

      for (const file of state.files)
        list.append(
          el(doc, 'li', {}, [
            el(doc, 'a', { class: 'file', href: file.url, target: '_blank', rel: 'noopener' }, [
              el(doc, 'span', { html: ICONS.file, class: 'file-icon', 'aria-hidden': 'true' }),
              el(doc, 'span', { text: file.title }),
              el(doc, 'span', { class: 'sr', text: t('files.newTab') }),
              ...(file.size ? [el(doc, 'span', { class: 'size', text: file.size })] : []),
            ]),
          ])
        );

      parts.push(el(doc, 'p', { class: 'subhead', text: t('files.title') }), list);
    }

    pane.replaceChildren(...parts);
    this.#slide = -1;

    if (state.slides.length) this.#showSlide(Math.max(0, itemAt(state.slides, this.#time)), this.#follow);
  }

  #showSlide(index, follow) {
    const dom = this.#dom.slide;
    const slides = this.#state?.slides ?? [];
    if (!dom || !slides.length) return;

    const next = Math.max(0, Math.min(slides.length - 1, index));
    const t = this.#t;

    this.#follow = follow;

    if (next !== this.#slide) {
      const slide = slides[next];
      const image = this.ownerDocument.createElement('img');

      this.#slide = next;
      dom.title.textContent = slide.title || `${next + 1}`;
      image.alt = slide.alt;
      image.decoding = 'async';
      image.addEventListener('error', () =>
        dom.figure.replaceChildren(el(this.ownerDocument, 'p', { text: t('slide.failed') }))
      );
      image.src = slide.image;
      dom.figure.replaceChildren(image);
      dom.count.textContent = t('slide.count', { n: next + 1, total: slides.length });
      dom.prev.disabled = next === 0;
      dom.next.disabled = next === slides.length - 1;
    }

    dom.follow.setAttribute('aria-pressed', String(this.#follow));
    dom.goto.hidden = this.#follow;
    dom.goto.toggleAttribute('aria-disabled', false);

    if (next === itemAt(slides, this.#time) || this.#locked(slides[next].start))
      dom.goto.setAttribute('aria-disabled', 'true');
  }

  #renderTranscript(state) {
    const pane = this.#dom.pane.transcript;
    const t = this.#t;
    const doc = this.ownerDocument;

    if (!this.#changed('cues', state.cues)) return;

    const dom = {};

    dom.search = el(doc, 'input', {
      type: 'search',
      class: 'search',
      placeholder: t('search.placeholder'),
      'aria-label': t('search.label'),
    });
    dom.result = el(doc, 'span', { class: 'result', 'aria-live': 'off' });
    dom.prev = el(doc, 'button', {
      type: 'button',
      class: 'icon-button',
      'aria-label': t('search.prev'),
      html: ICONS.prev,
      disabled: true,
    });
    dom.next = el(doc, 'button', {
      type: 'button',
      class: 'icon-button',
      'aria-label': t('search.next'),
      html: ICONS.next,
      disabled: true,
    });
    dom.auto = el(doc, 'button', {
      type: 'button',
      class: 'chip-button',
      'aria-pressed': String(this.#autoScroll),
      html: `${ICONS.check}<span>${escapeHtml(t('transcript.autoScroll'))}</span>`,
    });
    dom.list = el(doc, 'ol', { class: 'list' });
    dom.none = el(doc, 'div', { class: 'empty', hidden: true });

    state.cues.forEach((cue, index) => {
      const button = el(doc, 'button', { type: 'button', class: 'row', tabindex: index ? -1 : 0 }, [
        el(doc, 'span', { class: 'time', text: formatTime(cue.start) }),
        el(doc, 'span', { class: 'title', text: cue.text }),
        el(doc, 'span'),
      ]);

      button.addEventListener('click', () => this.#goto(cue.start, true));
      dom.list.append(el(doc, 'li', {}, [button]));
    });

    rove(dom.list, '.row');
    dom.search.addEventListener('input', () => this.#search(dom.search.value));
    dom.search.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        this.#moveMatch(event.shiftKey ? -1 : 1);
      } else if (event.key === 'Escape' && dom.search.value) {
        event.preventDefault();
        dom.search.value = '';
        this.#search('');
      }
    });
    dom.prev.addEventListener('click', () => this.#moveMatch(-1));
    dom.next.addEventListener('click', () => this.#moveMatch(1));
    dom.auto.addEventListener('click', () => {
      this.#autoScroll = dom.auto.getAttribute('aria-pressed') !== 'true';
      dom.auto.setAttribute('aria-pressed', String(this.#autoScroll));

      if (this.#autoScroll) this.#scrollToCue(true);
    });
    this.#dom.transcript = dom;
    pane.replaceChildren(
      el(doc, 'div', { class: 'tools' }, [dom.search, dom.result, dom.prev, dom.next, dom.auto]),
      dom.list,
      dom.none
    );
    this.#search(this.#query);
  }

  #search(value) {
    const dom = this.#dom.transcript;
    const cues = this.#state.cues;
    const query = value.trim().toLocaleLowerCase();
    const t = this.#t;

    this.#query = value;
    this.#matches = query
      ? cues.flatMap((cue, index) => (cue.text.toLocaleLowerCase().includes(query) ? [index] : []))
      : [];
    this.#match = -1;

    [...dom.list.querySelectorAll('.row')].forEach((row, index) => {
      const text = row.querySelector('.title');
      const cue = cues[index].text;

      row.classList.remove('is-result');

      if (!query) {
        text.textContent = cue;
        return;
      }

      const lower = cue.toLocaleLowerCase();
      let html = '';
      let at = 0;

      for (let found = lower.indexOf(query); found >= 0; found = lower.indexOf(query, found + query.length)) {
        html += `${escapeHtml(cue.slice(at, found))}<mark>${escapeHtml(cue.slice(found, found + query.length))}</mark>`;
        at = found + query.length;
      }

      text.innerHTML = html + escapeHtml(cue.slice(at));
    });

    const none = query && !this.#matches.length;

    dom.list.hidden = Boolean(none);
    dom.none.hidden = !none;
    dom.none.replaceChildren(
      ...(none
        ? [
            el(this.ownerDocument, 'p', { text: t('search.none', { q: value.trim() }) }),
            el(this.ownerDocument, 'p', { text: t('search.noneHint') }),
          ]
        : [])
    );
    dom.prev.disabled = dom.next.disabled = !this.#matches.length;
    dom.result.textContent = query && this.#matches.length ? t('search.found', { n: this.#matches.length }) : '';

    if (query) this.#announce(t('search.found', { n: this.#matches.length }));
  }

  #moveMatch(direction) {
    const dom = this.#dom.transcript;
    const total = this.#matches.length;
    if (!total) return;

    this.#match = (this.#match + direction + total) % total;

    const rows = [...dom.list.querySelectorAll('.row')];
    const row = rows[this.#matches[this.#match]];

    rows.forEach((item) => item.classList.toggle('is-result', item === row));
    dom.result.textContent = this.#t('search.count', { n: total, m: this.#match + 1 });
    this.#stopAutoScroll();
    this.#scrollInto(row);
  }

  #stopAutoScroll() {
    if (!this.#autoScroll) return;

    this.#autoScroll = false;
    this.#dom.transcript?.auto.setAttribute('aria-pressed', 'false');
  }

  #scrollInto(row) {
    const body = this.#dom.body;
    if (!row || !body) return;

    const top = row.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop;

    // Only the panel body scrolls, never the page.
    body.scrollTo({ top: top - body.clientHeight / 2 + row.offsetHeight / 2 });
  }

  #scrollToCue(force = false) {
    const dom = this.#dom.transcript;
    if (!dom || (!this.#autoScroll && !force) || this.#selected !== 'transcript' || this.#query.trim()) return;

    if (this.#autoScroll) this.#scrollInto(dom.list.querySelector('.row[aria-current="true"]'));
  }

  #renderNotes(state) {
    const pane = this.#dom.pane.notes;
    const t = this.#t;
    const doc = this.ownerDocument;
    const count = state.notes.length;

    this.#dom.tab.notes.innerHTML = `${escapeHtml(t('tab.notes'))}${
      count ? `<span class="count" aria-hidden="true">${count}</span>` : ''
    }`;
    this.#dom.tab.notes.setAttribute('aria-label', count ? t('tab.notesCount', { n: count }) : t('tab.notes'));

    for (const key of ['chapters', 'materials', 'transcript']) this.#dom.tab[key].textContent = t(`tab.${key}`);

    if (!this.#dom.noteForm) {
      const dom = {};

      dom.label = el(doc, 'label', { for: 'solad-lms-note-input' });
      dom.input = el(doc, 'textarea', {
        id: 'solad-lms-note-input',
        rows: 2,
        maxlength: 1000,
        placeholder: t('note.placeholder'),
      });
      dom.counter = el(doc, 'span', { class: 'counter', text: t('note.count', { n: 0 }) });
      dom.save = el(doc, 'button', { type: 'button', class: 'primary', text: t('note.save'), disabled: true });
      dom.error = el(doc, 'p', { class: 'form-error', hidden: true, text: t('note.failed') });
      dom.form = el(doc, 'div', { class: 'form' }, [
        dom.label,
        dom.input,
        el(doc, 'div', { class: 'form-row' }, [dom.counter, dom.save]),
        dom.error,
      ]);
      dom.limit = el(doc, 'p', { class: 'limit', hidden: true, text: t('note.limit') });
      dom.list = el(doc, 'div', { class: 'notes' });
      dom.input.addEventListener('focus', () => {
        this.#noteTime = this.#actions.time();
        this.#noteLabel();
      });
      dom.input.addEventListener('blur', () => {
        if (!dom.input.value.trim()) this.#noteTime = null;
      });
      dom.input.addEventListener('input', () => {
        dom.counter.textContent = t('note.count', { n: dom.input.value.length });
        dom.save.disabled = !dom.input.value.trim();
      });
      dom.input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          dom.save.click();
        }
      });
      dom.save.addEventListener('click', async () => {
        if (!dom.input.value.trim()) return;

        const time = this.#noteTime ?? this.#actions.time();
        const ok = await this.#actions.saveNote({ kind: 'note', time, text: dom.input.value });

        dom.error.hidden = ok;

        if (ok) {
          dom.input.value = '';
          dom.counter.textContent = t('note.count', { n: 0 });
          dom.save.disabled = true;
          this.#noteTime = null;
          this.#announce(t('note.saved'));
          dom.input.focus();
        } else this.#announce(t('note.failed'));
      });
      this.#dom.noteForm = dom;
      pane.replaceChildren(dom.form, dom.limit, dom.list);
    }

    const form = this.#dom.noteForm;
    const full = count >= NOTE_LIMIT;

    form.form.hidden = full;
    form.limit.hidden = !full;
    this.#noteLabel();

    if (!this.#changed('notes', [state.notes, this.#editing, this.#confirming, this.#failed, state.ad])) return;

    const focused = this.shadowRoot.activeElement;
    const focusKey = focused?.closest?.('.note')?.dataset.id
      ? `${focused.closest('.note').dataset.id}:${focused.dataset.role}`
      : null;

    form.list.replaceChildren(...this.#noteRows(state.notes));

    if (!count)
      form.list.append(
        el(doc, 'div', { class: 'empty' }, [
          el(doc, 'p', { text: t('note.empty') }),
          el(doc, 'p', { text: t('note.emptyHint') }),
        ])
      );

    if (focusKey) {
      const [id, role] = focusKey.split(':');

      form.list.querySelector(`.note[data-id="${id}"] [data-role="${role}"]`)?.focus();
    }
  }

  #noteLabel() {
    const form = this.#dom.noteForm;
    if (!form) return;

    form.label.textContent = this.#t('note.label', { time: formatTime(this.#noteTime ?? this.#time) });
  }

  #noteRows(notes) {
    const t = this.#t;
    const doc = this.ownerDocument;

    return notes.map((note) => {
      const kind = t(note.kind === 'bookmark' ? 'note.bookmark' : 'note.note');
      const time = formatTime(note.time);
      const row = el(doc, 'div', { class: 'note', 'data-id': note.id });
      const goto = el(doc, 'button', {
        type: 'button',
        class: 'pill',
        'data-role': 'goto',
        'aria-label': t('note.goto', { time, kind }),
        'aria-disabled': this.#state.ad ? 'true' : null,
        html: `${note.kind === 'bookmark' ? ICONS.bookmark : ICONS.note}<span>${time}</span>`,
      });
      const edit = el(doc, 'button', {
        type: 'button',
        class: 'icon-button',
        'data-role': 'edit',
        'aria-label': t('note.edit', { time, kind }),
        html: ICONS.edit,
      });
      const remove = el(doc, 'button', {
        type: 'button',
        class: 'icon-button',
        'data-role': 'delete',
        'aria-label': t('note.delete', { time, kind }),
        html: ICONS.delete,
      });

      goto.addEventListener('click', () => this.#goto(note.time));
      edit.addEventListener('click', () => {
        this.#editing = note.id;
        this.#confirming = null;
        this.update(this.#state);
        this.shadowRoot.querySelector(`.note[data-id="${note.id}"] textarea`)?.focus();
      });
      remove.addEventListener('click', () => {
        this.#confirming = note.id;
        this.#editing = null;
        this.update(this.#state);
        this.shadowRoot.querySelector(`.note[data-id="${note.id}"] [data-role="confirm-delete"]`)?.focus();
      });

      if (this.#editing === note.id) {
        const area = el(doc, 'textarea', {
          rows: 2,
          maxlength: note.kind === 'bookmark' ? 80 : 1000,
          'aria-label': t('note.edit', { time, kind }),
        });
        const save = el(doc, 'button', { type: 'button', class: 'primary', text: t('note.save') });
        const cancel = el(doc, 'button', { type: 'button', class: 'secondary', text: t('note.cancel') });

        area.value = note.text;
        save.addEventListener('click', async () => {
          const ok = await this.#actions.saveNote({ ...note, text: area.value });

          this.#failed = ok ? null : note.id;

          if (ok) {
            this.#editing = null;
            this.#announce(t('note.saved'));
          } else this.#announce(t('note.failed'));

          this.update(this.#state);

          if (ok) this.shadowRoot.querySelector(`.note[data-id="${note.id}"] [data-role="edit"]`)?.focus();
        });
        cancel.addEventListener('click', () => {
          this.#editing = null;
          this.#failed = null;
          this.update(this.#state);
          this.shadowRoot.querySelector(`.note[data-id="${note.id}"] [data-role="edit"]`)?.focus();
        });
        row.append(
          goto,
          el(doc, 'span'),
          el(doc, 'span'),
          el(doc, 'div', { class: 'note-edit' }, [
            area,
            el(doc, 'div', { class: 'form-row' }, [el(doc, 'span', { class: 'spacer' }), cancel, save]),
          ])
        );
      } else
        row.append(
          goto,
          el(doc, 'span', {
            class: `note-text${note.text ? '' : ' is-sub'}`,
            text: note.text || t('note.bookmark'),
          }),
          el(doc, 'span', { class: 'note-actions' }, [edit, remove])
        );

      if (this.#confirming === note.id) {
        const cancel = el(doc, 'button', { type: 'button', class: 'secondary', text: t('note.cancel') });
        const confirm = el(doc, 'button', {
          type: 'button',
          class: 'secondary danger',
          'data-role': 'confirm-delete',
          'aria-label': t('note.delete', { time, kind }),
          text: t('note.confirmDelete'),
        });

        cancel.addEventListener('click', () => {
          this.#confirming = null;
          this.update(this.#state);
          this.shadowRoot.querySelector(`.note[data-id="${note.id}"] [data-role="delete"]`)?.focus();
        });
        confirm.addEventListener('click', async () => {
          const rows = [...this.shadowRoot.querySelectorAll('.note')];
          const nextId = rows[rows.indexOf(row) + 1]?.dataset.id;
          const ok = await this.#actions.deleteNote(note.id);

          this.#confirming = null;
          this.#failed = ok ? null : note.id;
          this.#announce(ok ? t('note.deleted') : t('note.failed'));
          this.update(this.#state);

          if (ok)
            (
              this.shadowRoot.querySelector(`.note[data-id="${nextId}"] [data-role="goto"]`) ?? this.#dom.noteForm.input
            ).focus();
        });
        row.append(
          el(doc, 'div', { class: 'note-confirm' }, [
            el(doc, 'span', {
              text: t(note.kind === 'bookmark' ? 'note.confirmBookmark' : 'note.confirm'),
            }),
            el(doc, 'span', { class: 'spacer' }),
            cancel,
            confirm,
          ])
        );
      }

      if (this.#failed === note.id) row.append(el(doc, 'p', { class: 'note-error', text: t('note.failed') }));

      return row;
    });
  }

  #locked(time) {
    return this.#limit !== null && time > this.#limit;
  }

  /** Move under the rules; a locked chapter moves to the limit and shows the blocked toast (handoff 6.9). */
  #goto(time) {
    if (!this.#actions || this.#state?.ad) return;

    if (this.#locked(time)) this.#actions.blocked(time);
    else this.#actions.seek(time);
  }

  #announce(text) {
    this.#actions?.announce(text);
  }

  /** The playback time from `lms.js`; marks the chapter, slide and line now playing. */
  setTime(time, limit) {
    this.#time = time;

    if (limit !== undefined && this.#state) this.#limit = this.#state.limit === null ? null : limit;

    this.#updateTime();
  }

  #updateTime() {
    const state = this.#state;
    const dom = this.#dom;
    if (!state || !dom || this.#headOnly || state.storage === 'loading') return;

    const mark = (pane, items) => {
      const rows = [...pane.querySelectorAll('.list > li > .row')];
      const index = itemAt(items, this.#time);

      rows.forEach((row, at) => {
        if (at === index) row.setAttribute('aria-current', 'true');
        else row.removeAttribute('aria-current');
      });
      setTabStop(rows, index);
      return index;
    };

    mark(dom.pane.chapters, state.chapters);

    const cue = state.cues.length ? mark(dom.pane.transcript, state.cues) : -1;

    if (cue !== this.#lastCue) {
      this.#lastCue = cue;
      this.#scrollToCue();
    }

    if (this.#follow) this.#showSlide(itemAt(state.slides, this.#time), true);
    else if (dom.slide) this.#showSlide(this.#slide, false);

    if (this.#noteTime === null) this.#noteLabel();
  }

  #lastCue = -1;
}

if (!customElements.get(TAG)) customElements.define(TAG, SoladLmsPanelElement);
