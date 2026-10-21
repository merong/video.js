// A2-D-QA-DELTA (copied from A2-D-QA) loader helpers (copied from A2-1-QA-DELTA): paste fixtures under qa/fixtures/paste/a2d-<case>.html, page probes for [data-solad-player],
// in-page admin API calls (the CSRF token stays inside the page) and server log status lines.
import fs from 'node:fs';
import { BASE, QA_DIR, consoleCollector, sleep } from './lib.mjs';

const REPO = '/Users/brian/works/tools/videojs/video.js';
export const PASTE = `${REPO}/workspaces/ads-admin-app-20261020/qa/fixtures/paste`;
export const CONTENT = '/demo-media/grok-20261018/content-scene-01.mp4';

/** Writes a full HTML page around `body` and returns its same-origin URL. */
export function writePaste(name, body, { lang = 'ko', title = `A2-1-QA ${name}`, head = '' } = {}) {
  const html = `<!doctype html>
<html${lang === null ? '' : ` lang="${lang}"`}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
${head}</head>
<body>
${body}
</body>
</html>
`;
  fs.writeFileSync(`${PASTE}/a2d-${name}.html`, html);
  return `${BASE}/__qa/paste/a2d-${name}.html`;
}

/** Placeholder markup as the loader expects it. */
export function placeholder(attrs) {
  return `<div${Object.entries(attrs).map(([k, v]) => (v === true ? ` ${k}` : ` ${k}="${v}"`)).join('')}></div>`;
}

export const LOADER_TAG = '<script type="module" src="/player/loader.js"></script>';

// Runs before any page script: records loader and ad events from the document.
function initRecorder() {
  const qa = { ready: [], errors: [], ads: [], t0: performance.now() };
  const who = (el) => el?.id || el?.dataset?.videoId || el?.tagName || null;
  window.__qa = qa;
  document.addEventListener('solad-ready', (e) => qa.ready.push({ at: Math.round(performance.now() - qa.t0), target: who(e.target), presetId: e.detail?.presetId, fallback: e.detail?.fallback, player: e.detail?.player?.tagName }), true);
  document.addEventListener('solad-error', (e) => qa.errors.push({ at: Math.round(performance.now() - qa.t0), target: who(e.target), code: e.detail?.code, message: e.detail?.message }), true);
  document.addEventListener('ads-event', (e) => {
    const d = e.detail ?? {};
    const pick = {};
    for (const [k, v] of Object.entries(d)) if (v === null || ['string', 'number', 'boolean'].includes(typeof v)) pick[k] = v;
    const tail = (v) => (typeof v === 'string' ? v.slice(-6) : v);
    qa.ads.push({ at: Math.round(performance.now() - qa.t0), target: who(e.target.closest?.('[data-solad-player]') ?? e.target), type: pick.type, contentTime: pick.contentTimeSeconds, ad: tail(pick.adId), break: tail(pick.breakId), sequence: pick.sequence, code: pick.code ?? pick.errorCode ?? null });
  }, true);
}

/** Opens a page with the recorder; `solad` holds the console lines that start with "[solad]". */
export async function openPage(context, url, { routes } = {}) {
  const page = await context.newPage();
  await page.addInitScript(initRecorder);
  if (routes) await routes(page);
  const logs = consoleCollector(page);
  const solad = [];
  const all = [];
  page.on('console', (msg) => {
    all.push({ type: msg.type(), text: msg.text().slice(0, 300) });
    if (msg.text().startsWith('[solad]')) solad.push({ type: msg.type(), text: msg.text().slice(0, 300) });
  });
  await page.goto(url);
  return { page, logs, solad, all };
}

export const qaState = (page) => page.evaluate(() => window.__qa);

/** Waits until `fn(state)` is true or the timeout passes; returns the last state. */
export async function waitQa(page, fn, timeout = 20000) {
  const end = Date.now() + timeout;
  let state = await qaState(page);
  while (Date.now() < end && !fn(state)) {
    await sleep(300);
    state = await qaState(page);
  }
  return state;
}

/** One record per placeholder: the built tree, media flags, metadata, skin styles, ad language and visible text. */
export function players(page, selector = '[data-solad-player]') {
  return page.evaluate((selector) => {
    const deepText = (root) => {
      const out = [];
      const walk = (node) => {
        if (node.shadowRoot) walk(node.shadowRoot);
        for (const child of node.childNodes) {
          if (child.nodeType === 3 && child.textContent.trim()) out.push(child.textContent.trim());
          else if (child.nodeType === 1) {
            const s = getComputedStyle(child);
            if (s.display !== 'none' && s.visibility !== 'hidden') walk(child);
          }
        }
      };
      walk(root);
      return out;
    };
    const deepAll = (root, selector) => {
      const out = [...root.querySelectorAll(selector)];
      for (const el of root.querySelectorAll('*')) if (el.shadowRoot) out.push(...deepAll(el.shadowRoot, selector));
      return out;
    };
    return [...document.querySelectorAll(selector)].map((el) => {
      const i18n = el.querySelector('media-i18n');
      const player = el.querySelector('video-player');
      const skin = el.querySelector('video-skin, solad-video-skin, [class*="media-skin"]');
      const media = el.querySelector('video, hls-video, hlsjs-video');
      const ads = el.querySelector('media-ads');
      // The skin renders into its shadow root; `.media-skin` carries the theme and the slider fill shows the accent.
      const skinTree = skin ? skin.shadowRoot ?? skin : null;
      const fill = skinTree ? deepAll(skinTree, '.media-slider-fill')[0] : null;
      const cs = skin ? getComputedStyle(skin) : null;
      const skinRoot = skinTree ? deepAll(skinTree, '.media-skin')[0] ?? skin : null;
      const rootCs = skinRoot ? getComputedStyle(skinRoot) : null;
      const labels = deepAll(el, 'button, [role="button"], [role="slider"], input[type="range"]')
        .map((b) => b.getAttribute('aria-label') || b.textContent.trim())
        .filter(Boolean);
      return {
        id: el.id || null,
        videoId: el.dataset.videoId ?? null,
        children: [...el.children].map((c) => c.tagName),
        tree: i18n ? `${i18n.tagName}[lang=${i18n.getAttribute('lang')}] > ${player?.tagName} > ${skin?.tagName} > ${[...(skin?.children ?? [])].map((c) => c.tagName).join('+')}` : el.firstElementChild ? `${el.firstElementChild.tagName} > ${[...el.firstElementChild.children].map((c) => c.tagName).join('+')}` : null,
        i18nLang: i18n?.getAttribute('lang') ?? null,
        playerAttrs: player ? { contentTitle: player.getAttribute('content-title'), poster: player.getAttribute('poster') } : null,
        media: media ? {
          tag: media.tagName,
          src: (media.getAttribute('src') || '').replace(location.origin, ''),
          autoplayAttr: media.hasAttribute('autoplay'),
          mutedAttr: media.hasAttribute('muted'),
          mutedProp: media.muted,
          loop: media.hasAttribute('loop'),
          preload: media.getAttribute('preload'),
          playsinline: media.hasAttribute('playsinline'),
          poster: media.getAttribute('poster'),
          paused: media.paused,
          currentTime: Math.round((media.currentTime || 0) * 10) / 10,
          controls: media.controls ?? null,
          tracks: [...media.querySelectorAll('track')].map((t) => ({ kind: t.kind, label: t.label, src: t.getAttribute('src') })),
        } : null,
        ads: ads ? { lang: ads.getAttribute('lang'), accentVar: getComputedStyle(ads).getPropertyValue('--ads-accent-color').trim(), attrs: Object.fromEntries([...ads.attributes].filter((a) => !['src'].includes(a.name)).map((a) => [a.name, a.value])) } : null,
        skin: cs ? {
          tag: skin.tagName,
          accentVar: cs.getPropertyValue('--media-accent-color').trim(),
          accentTextVar: cs.getPropertyValue('--media-accent-text-color').trim(),
          adsAccentVar: cs.getPropertyValue('--ads-accent-color').trim(),
          primary: rootCs.getPropertyValue('--media-primary').trim(),
          fillBefore: fill ? getComputedStyle(fill, '::before').backgroundColor : null,
          borderRadius: rootCs.borderRadius,
          borderRadiusVar: rootCs.getPropertyValue('--media-border-radius').trim(),
          borderColor: rootCs.borderTopColor,
          inline: skin.getAttribute('style'),
          skinRootClass: skinRoot?.className?.toString?.().slice(0, 80) ?? null,
          fillFound: Boolean(fill),
        } : null,
        buttonLabels: [...new Set(labels)].slice(0, 30),
        visibleText: deepText(el).slice(0, 40),
      };
    });
  }, selector);
}

/** Clicks the centre of each placeholder's media to start playback (a user gesture). */
export async function clickPlay(page, index = 0) {
  const box = await page.locator('[data-solad-player]').nth(index).boundingBox();
  if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

/** In-page admin API call; the token is read and used only inside the page. */
export function adminCall(page, action, data, { method } = {}) {
  return page.evaluate(async ({ action, data, method }) => {
    const boot = await fetch('/api/index.php?action=bootstrap', { credentials: 'same-origin' });
    const token = boot.headers.get('x-csrf-token');
    const init = data !== undefined || method
      ? { method: method ?? 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token }, body: data === undefined ? undefined : JSON.stringify(data) }
      : { credentials: 'same-origin' };
    const res = await fetch(`/api/index.php?action=${action}`, init);
    const text = await res.text();
    let body = null;
    try { body = JSON.parse(text); } catch { /* text */ }
    return { status: res.status, ok: body?.ok ?? null, code: body?.error?.code ?? null, message: body?.error?.message ?? null, fields: body?.error?.fields ?? null, data: body?.data ?? null };
  }, { action, data, method });
}

/** player-preset lines from the PHP built-in server log since `fromLine` (status and path only). */
export function serverLog(fromLine = 0) {
  const lines = fs.readFileSync(`${QA_DIR}/server.log`, 'utf8').split('\n');
  return { lines: lines.slice(fromLine).filter((l) => /\[\d{3}\]: (GET|POST|PUT|DELETE)/.test(l)).map((l) => l.replace(/^\[[^\]]+\] /, '').replace(/^127\.0\.0\.1:\d+ /, '')), next: lines.length - 1 };
}

export const serverLines = () => fs.readFileSync(`${QA_DIR}/server.log`, 'utf8').split('\n').length - 1;

/**
 * Chrome's own network view through CDP: the wire status (304 on revalidation), whether the request carried
 * If-None-Match, and the ETag. Only these headers are kept, never cookies.
 */
export async function cdpNetwork(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  const byId = new Map();
  const get = (id) => byId.get(id) ?? byId.set(id, { id }).get(id);
  cdp.on('Network.requestWillBeSent', (e) => Object.assign(get(e.requestId), { url: e.request.url.replace(/^https?:\/\/[^/]+/, ''), method: e.request.method, at: Date.now() }));
  cdp.on('Network.requestWillBeSentExtraInfo', (e) => {
    const h = Object.fromEntries(Object.entries(e.headers).map(([k, v]) => [k.toLowerCase(), v]));
    Object.assign(get(e.requestId), { ifNoneMatch: h['if-none-match'] ?? null, cacheControlSent: h['cache-control'] ?? null });
  });
  cdp.on('Network.responseReceivedExtraInfo', (e) => {
    const h = Object.fromEntries(Object.entries(e.headers).map(([k, v]) => [k.toLowerCase(), v]));
    Object.assign(get(e.requestId), { wireStatus: e.statusCode, etag: h.etag ?? null, cacheControl: h['cache-control'] ?? null });
  });
  cdp.on('Network.responseReceived', (e) => Object.assign(get(e.requestId), { status: e.response.status, fromDiskCache: e.response.fromDiskCache, fromServiceWorker: e.response.fromServiceWorker }));
  cdp.on('Network.loadingFailed', (e) => Object.assign(get(e.requestId), { failed: e.errorText }));
  return {
    all: () => [...byId.values()],
    presets: () => [...byId.values()].filter((r) => /action=player-preset(&|$)/.test(r.url ?? '')).map(({ id, ...r }) => r),
    errors: () => [...byId.values()].filter((r) => (r.status ?? 0) >= 400 || (r.wireStatus ?? 0) >= 400).map(({ id, ...r }) => r),
  };
}
