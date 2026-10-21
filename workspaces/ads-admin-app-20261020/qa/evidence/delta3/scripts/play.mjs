// Shared stage-5 helper: play a public player page to the end and keep media timeline, overlay text, requests and events.
import { BASE, EV, consoleCollector, redact, redactUrl, sleep } from './lib.mjs';

export function trackEvents(context, sink = []) {
  context.on('response', async (response) => {
    const url = new URL(response.url());
    if (url.searchParams.get('action') !== 'events' || response.request().method() !== 'POST') return;
    let body = null;
    let sent = null;
    try {
      sent = JSON.parse(response.request().postData() ?? 'null');
    } catch {
      /* keep null */
    }
    try {
      body = redact(JSON.parse(await response.text()));
    } catch {
      /* keep nulls */
    }
    const list = Array.isArray(sent?.events) ? sent.events : sent ? [sent] : [];
    sink.push({ at: Date.now(), resourceType: response.request().resourceType(), page: redactUrl(response.frame()?.url() ?? ''), status: response.status(), body, items: list.map((e) => ({ type: e.type ?? e.event, adId: e.adId ?? null, videoId: e.videoId ?? null })) });
  });
  return sink;
}

const snapshot = (page) => page.evaluate(() => {
  const all = (root) => [...root.querySelectorAll('video,img')].concat(...[...root.querySelectorAll('*')].filter((n) => n.shadowRoot).map((n) => all(n.shadowRoot)));
  const visibleText = (root) => {
    const out = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const p = n.parentElement;
      if (!p || ['STYLE', 'SCRIPT'].includes(p.tagName) || !n.textContent.trim() || !p.getClientRects().length || p.closest('[hidden]')) continue;
      out.push(n.textContent.trim());
    }
    for (const host of root.querySelectorAll('*')) if (host.shadowRoot) out.push(visibleText(host.shadowRoot));
    return out.filter(Boolean).join(' | ');
  };
  const media = all(document).filter((m) => m.tagName === 'VIDEO' || m.offsetParent !== null).map((m) => ({ tag: m.tagName, src: (m.currentSrc || m.src || '').replace(location.origin, ''), paused: m.paused ?? null, ended: m.ended ?? null, t: Math.round((m.currentTime ?? 0) * 10) / 10 }));
  const overlay = visibleText(document.body).replace(/\s+/g, ' ').trim().slice(0, 400);
  return { media, overlay };
});

/** Opens `url` in `page`, clicks the video once and follows playback until the content video ends. */
export async function playToEnd(page, { label, shotDir, contentMatch = 'content-scene-01', maxMs = 150000, net } = {}) {
  const logs = consoleCollector(page);
  const r = { label, start: net ? net.length : 0 };
  await page.waitForLoadState('load');
  await sleep(2500);
  r.url = redactUrl(page.url());
  if (shotDir) await page.screenshot({ path: `${EV}/${shotDir}/${label}-ready.png` });
  const box = await page.locator('video').first().boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const timeline = [];
  const overlays = new Set();
  let last = '';
  let n = 0;
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const s = await snapshot(page);
    if (s.overlay) overlays.add(s.overlay.replace(/\d+/g, '#'));
    const key = JSON.stringify(s.media.map((x) => [x.src, x.paused, x.ended]));
    if (key !== last) {
      timeline.push({ at: Date.now(), media: s.media, overlay: s.overlay });
      last = key;
      if (shotDir) await page.screenshot({ path: `${EV}/${shotDir}/${label}-${++n}.png` });
    }
    if (s.media.find((x) => x.src.includes(contentMatch) && x.ended)) {
      // Let a post-roll finish: stop once no ad media is shown next to the ended content.
      r.contentEndedAt ??= Date.now();
      const adShown = s.media.some((x) => !x.src.includes(contentMatch) && x.src);
      if (!adShown || Date.now() - r.contentEndedAt > 25000) break;
    }
    await sleep(400);
  }
  await sleep(3000);
  r.timeline = timeline;
  r.overlayTexts = [...overlays];
  r.contentEnded = Boolean(timeline.at(-1)?.media.find((x) => x.src.includes(contentMatch) && x.ended));
  if (net) r.requests = net.slice(r.start).map((e) => ({ method: e.method, action: e.action ?? null, url: e.action ? null : e.url.replace(BASE, ''), status: e.status, failed: e.failed ?? null }));
  r.console = logs;
  return r;
}
