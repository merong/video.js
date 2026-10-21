// HL15: help-text facts on the real collection path (video a1-qa-help-1): skip label order, click-through tab behaviour, session counting.
import { BASE, EV, launch, newContext, login, recordNetwork, consoleCollector, save, sleep } from './lib.mjs';
import { queryStats } from './stats.mjs';
import { trackEvents } from './play.mjs';

const VID = 'a1-qa-help-1';
const URL_ = `${BASE}/examples/player.html?video=${VID}&content=${encodeURIComponent(`${BASE}/demo-media/grok-20261018/content-scene-01.mp4`)}`;
const browser = await launch();
const result = { url: URL_.replace(BASE, ''), runs: [] };

const admin = await newContext(browser, { height: 1000 });
const adminPage = await admin.newPage();
await login(adminPage);
result.statsBefore = await queryStats(adminPage, { '영상 ID': VID });

const snap = (page) => page.evaluate(() => {
  const all = (root) => [...root.querySelectorAll('video,img')].concat(...[...root.querySelectorAll('*')].filter((n) => n.shadowRoot).map((n) => all(n.shadowRoot)));
  const texts = (root) => {
    const out = [];
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const p = n.parentElement;
      if (p && !['STYLE', 'SCRIPT'].includes(p.tagName) && n.textContent.trim() && p.getClientRects().length) out.push(n.textContent.trim());
    }
    for (const h of root.querySelectorAll('*')) if (h.shadowRoot) out.push(...texts(h.shadowRoot));
    return out;
  };
  const player = document.getElementById('ads-player') ?? document.querySelector('[id$=mount]') ?? document.body;
  return {
    media: all(document).filter((m) => m.tagName === 'VIDEO' || m.offsetParent !== null).filter((m) => m.currentSrc || m.src).map((m) => ({ tag: m.tagName, src: (m.currentSrc || m.src).split('/').pop(), paused: m.paused ?? null, ended: m.ended ?? null, t: Math.round((m.currentTime ?? 0) * 10) / 10 })),
    overlay: texts(player).filter((s) => /광고|건너뛰기|초|:/.test(s)).join(' | '),
    visibility: document.visibilityState, focused: document.hasFocus(),
  };
});

async function run(page, context, label, { clicks = false } = {}) {
  const r = { label, skipLabels: [], order: [], clicks: {} };
  const box = await page.locator('video').first().boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const deadline = Date.now() + 150000;
  let lastAd = '';
  let lastSkip = '';
  while (Date.now() < deadline) {
    const s = await snap(page);
    const ad = s.media.find((m) => !m.src.includes('content-scene-01') && (m.tag === 'IMG' || !m.paused));
    const content = s.media.find((m) => m.src.includes('content-scene-01'));
    const key = ad ? ad.src : 'content';
    if (key !== lastAd) {
      r.order.push({ at: Date.now(), media: key, contentT: content?.t ?? null });
      lastAd = key;
    }
    const skip = (s.overlay.match(/\d+초 후 건너뛰기|광고 건너뛰기/) ?? [''])[0].replace(/\d+/, 'N');
    if (skip && skip !== lastSkip) {
      r.skipLabels.push({ media: key, label: skip, adT: ad?.t ?? null });
      lastSkip = skip;
    }
    if (clicks && ad && ad.tag === 'VIDEO' && !r.clicks.video && ad.t >= 1.5) {
      r.clicks.video = await clickThrough(page, context, 'video');
    }
    if (clicks && ad && ad.tag === 'IMG' && !r.clicks.image) {
      await sleep(800);
      r.clicks.image = await clickThrough(page, context, 'image');
    }
    if (content?.ended && !ad) break;
    await sleep(300);
  }
  r.ended = Boolean((await snap(page)).media.find((m) => m.src.includes('content-scene-01') && m.ended));
  return r;
}

async function clickThrough(page, context, kind) {
  const c = { kind };
  const before = await snap(page);
  c.before = { media: before.media.filter((m) => !m.src.includes('content-scene-01')), overlay: before.overlay };
  const link = page.getByRole('link', { name: '광고주 사이트' }).or(page.getByRole('button', { name: '광고주 사이트' })).first();
  c.linkFound = await link.count();
  if (!c.linkFound) return c;
  const popupPromise = context.waitForEvent('page', { timeout: 5000 }).catch(() => null);
  await link.click();
  const popup = await popupPromise;
  c.popup = popup ? popup.url() : null;
  await sleep(150);
  const at0 = await snap(page);
  await sleep(2000);
  const at2 = await snap(page);
  c.originalAfterClick = [at0, at2].map((s) => ({ visibility: s.visibility, focused: s.focused, media: s.media.filter((m) => !m.src.includes('content-scene-01')), overlay: s.overlay }));
  await page.screenshot({ path: `${EV}/HL15/click-${kind}-original.png` });
  if (popup) {
    c.popupVisibility = await popup.evaluate(() => document.visibilityState).catch(() => null);
    await popup.close();
  }
  await page.bringToFront();
  await sleep(1200);
  const back = await snap(page);
  c.afterReturn = { media: back.media.filter((m) => !m.src.includes('content-scene-01')), overlay: back.overlay };
  return c;
}

try {
  // Session 1 with click-through checks, then a same-session replay.
  {
    const context = await newContext(browser, { height: 900 });
    await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>QA advertiser stub</title>' }));
    const net = recordNetwork(context);
    const events = trackEvents(context);
    const page = await context.newPage();
    const logs = consoleCollector(page);
    await page.goto(URL_);
    await sleep(2500);
    const r1 = await run(page, context, 'session-1', { clicks: true });
    r1.events = events.splice(0).map((e) => `${e.status} ${e.items.map((i) => i.type).join('+')}`);
    result.runs.push(r1);
    result.statsAfterSession1 = await queryStats(adminPage, { '영상 ID': VID });
    const replay = page.getByRole('button', { name: '처음부터 다시 확인' });
    result.replayButton = await replay.count();
    if (result.replayButton) {
      await replay.click();
      await sleep(2000);
      const r2 = await run(page, context, 'session-1-replay');
      r2.events = events.splice(0).map((e) => `${e.status} ${e.items.map((i) => i.type).join('+')}`);
      result.runs.push(r2);
    }
    result.scheduleRequestsSession1 = net.filter((e) => e.action === 'schedule').map((e) => `${e.method} ${e.status}`);
    result.consoleSession1 = logs;
    await context.close();
  }
  result.statsAfterReplay = await queryStats(adminPage, { '영상 ID': VID });
  // Session 2: the same link opened again.
  {
    const context = await newContext(browser, { height: 900 });
    const events = trackEvents(context);
    const page = await context.newPage();
    await page.goto(URL_);
    await sleep(2500);
    const r3 = await run(page, context, 'session-2');
    r3.events = events.map((e) => `${e.status} ${e.items.map((i) => i.type).join('+')}`);
    result.runs.push(r3);
    await context.close();
  }
  result.statsAfterSession2 = await queryStats(adminPage, { '영상 ID': VID });
} catch (error) {
  result.error = String(error).slice(0, 1500);
}
save('HL15/result.json', result);
await browser.close();
