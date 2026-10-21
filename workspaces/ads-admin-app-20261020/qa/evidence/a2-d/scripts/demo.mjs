// A2-D-QA demo page helpers: the whole visible demo state in one read, the request log (events, presets) and small
// actions. Nothing here stores cookies or tokens.
import { BASE, sleep } from './lib.mjs';
import { players } from './a2.mjs';

export const DEMO = `${BASE}/examples/index.html`;

/** Records every request URL path+query (no headers) and counts `action=events`. */
export function requestLog(context) {
  const log = [];
  context.on('request', (r) => {
    const url = new URL(r.url());
    log.push({ method: r.method(), path: `${url.pathname}${url.search}`, frame: (() => { try { return new URL(r.frame().url()).pathname; } catch { return null; } })() });
  });
  return {
    all: () => log,
    events: () => log.filter((e) => /[?&]action=events(&|$)/.test(e.path)),
    actions: () => log.filter((e) => e.path.includes('/api/index.php')).map((e) => `${e.method} ${e.path.replace(/^.*action=/, '')}${e.frame && e.frame !== '/' ? ` @${e.frame}` : ''}`),
  };
}

export function demoState(page) {
  return page.evaluate(() => {
    const $ = (s) => document.querySelector(s);
    const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : null);
    const shown = (el) => Boolean(el && !el.hidden && el.getClientRects().length);
    const select = $('#preset');
    const options = select ? [...select.options].map((o) => ({ value: o.value, label: o.textContent.trim(), group: o.parentElement.tagName === 'OPTGROUP' ? o.parentElement.label : null, selected: o.selected })) : [];
    const toggle = (key) => {
      const el = document.querySelector(`[data-key="${key}"]`);
      if (!el) return null;
      return { checked: el.getAttribute('aria-checked'), disabled: el.disabled || el.getAttribute('aria-disabled') === 'true', describedBy: (el.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean).map((id) => text(document.getElementById(id))) };
    };
    const radio = (name) => document.querySelector(`input[name="${name}"]:checked`)?.value ?? null;
    const radioDisabled = (name) => [...document.querySelectorAll(`input[name="${name}"]`)].filter((r) => r.disabled).map((r) => r.value);
    return {
      query: location.search,
      docTitle: document.title,
      notes: { query: shown($('#query-note')) ? text($('#query-note')) : null, preset: shown($('#preset-note')) ? text($('#preset-note')) : null, adsRoot: shown($('#ads-root-note')) ? text($('#ads-root-note')) : null },
      preset: { value: select?.value, options, help: text($('#preset-h')) },
      reset: { text: text($('#reset-h')), disabled: $('#reset')?.disabled },
      toggles: { autoplay: toggle('autoplay'), muted: toggle('muted'), loop: toggle('loop') },
      preload: radio('preload'),
      poster: $('#poster')?.checked, posterUrl: $('#poster-url')?.value, posterHelp: shown($('#poster-url-h')) ? text($('#poster-url-h')) : null,
      offReason: shown($('#off-r')) ? text($('#off-r')) : null,
      title: $('#title')?.checked, titleDisabled: $('#title')?.disabled, titleText: $('#title-text')?.value, vtt: $('#vtt')?.value, vttHelp: text($('#vtt-h')),
      lang: $('#lang')?.value, pageLang: $('#page-lang')?.value, pageLangShown: shown($('#page-lang-field')),
      media: radio('media'), mediaDisabled: radioDisabled('media'), mediaHelp: shown($('#md-h')) ? text($('#md-h')) : null,
      engine: radio('engine'), engineShown: shown($('#engine-field')),
      codeWhy: text($('#code-why')),
      codeHtml: $('#code-html code')?.textContent ?? null,
      codeJs: $('#code-js code')?.textContent ?? null,
      stageStatus: text($('#stage-status')),
      now: text($('#now')),
      sceneWhy: shown($('[data-scene-why]')) ? text($('[data-scene-why]')) : null,
      scenes: [...document.querySelectorAll('[data-scene]')].map((b) => `${b.textContent.trim()}:${b.disabled ? 'off' : 'on'}`),
      log: [...document.querySelectorAll('#log li, #log .sa-log-row, #log p, #log div:not(.sa-empty)')].map(text).filter(Boolean).slice(0, 25),
      logEmpty: text($('#log .sa-empty')),
      empty: shown($('#stage-empty')) ? text($('#stage-empty')) : null,
      scaleNote: text($('[data-scale-note]')),
      frameWidth: Math.round($('#stage-frame')?.getBoundingClientRect().width ?? 0),
    };
  });
}

export async function player(page) {
  return (await players(page, '#player'))[0] ?? null;
}

/** Waits until the stage player has a media element and the status is not "준비하는 중". */
export async function waitPlayer(page, timeout = 15000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const ok = await page.evaluate(() => {
      const el = document.querySelector('#player');
      const media = el?.querySelector('video, hls-video, hlsjs-video');
      const status = document.querySelector('#stage-status')?.textContent ?? '';
      return Boolean(media) && !/준비하는 중/.test(status);
    });
    if (ok) return true;
    await sleep(250);
  }
  return false;
}

export async function openDemo(page, query = '') {
  await page.goto(`${DEMO}${query}`);
  await page.locator('#preset option').first().waitFor({ state: 'attached', timeout: 15000 });
  await waitPlayer(page);
  await sleep(800);
}
