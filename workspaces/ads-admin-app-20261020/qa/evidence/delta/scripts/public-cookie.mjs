// A1-QA-DELTA public actions: schedule, events and player-preset never answer with Set-Cookie (src/Http.php
// PUBLIC_ACTIONS, src/bootstrap.php). Logged-in admin requests still work with the session cookie and CSRF header.
// Only presence/absence of headers is recorded; cookie, token and body values are never written.
import { BASE, launch, newContext, login, save, sleep } from './lib.mjs';

const browser = await launch();
const result = {};

function watch(context, sink) {
  context.on('response', async (response) => {
    const url = new URL(response.url());
    if (!url.pathname.endsWith('/api/index.php')) return;
    const req = response.request();
    const headers = await response.allHeaders();
    sink.push({
      action: url.searchParams.get('action'),
      method: req.method(),
      status: response.status(),
      setCookie: 'set-cookie' in headers,
      reqCookie: Boolean((await req.allHeaders()).cookie),
      reqCsrf: Boolean((await req.allHeaders())['x-csrf-token']),
      respCsrf: 'x-csrf-token' in headers,
      cacheControl: headers['cache-control'] ?? null,
    });
  });
}
async function play(page, query, seconds) {
  await page.goto(`${BASE}/examples/videojs.html?${query}`);
  await sleep(2500);
  const box = await page.locator('video').first().boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await sleep(seconds * 1000);
}
const summary = (rows) => Object.values(rows.reduce((acc, r) => {
  const k = `${r.method} ${r.action} ${r.status}`;
  acc[k] ??= { call: k, n: 0, setCookie: 0, reqCookie: 0, reqCsrf: 0, respCsrf: 0 };
  acc[k].n++;
  for (const f of ['setCookie', 'reqCookie', 'reqCsrf', 'respCsrf']) if (r[f]) acc[k][f]++;
  return acc;
}, {}));

const Q = `video=a1-qa-video-1&content=${encodeURIComponent(`${BASE}/demo-media/grok-20261018/content-scene-01.mp4`)}`;
// 1. Anonymous viewer.
{
  const context = await newContext(browser, { height: 900 });
  const rows = [];
  watch(context, rows);
  const page = await context.newPage();
  await play(page, `${Q}&preset=p-vym1rjw052`, 14);
  result.anonymous = { calls: summary(rows), cookiesAfter: (await context.cookies()).map((c) => c.name.replace(/./g, '*').slice(0, 3) + `(${c.name.length})`) };
  await context.close();
}
// 2. Logged-in admin: login, a CSRF write, then the public player in the same browser.
{
  const context = await newContext(browser, { height: 900 });
  const rows = [];
  watch(context, rows);
  const page = await context.newPage();
  await login(page);
  await page.goto(`${BASE}/#/players`);
  await sleep(1500);
  const before = rows.length;
  // Write with cookie + CSRF: set P-A (already default) as default again; also the same write without the header.
  result.adminWrite = await page.evaluate(async () => {
    const list = await fetch('api/index.php?action=player-presets', { credentials: 'same-origin' });
    const token = list.headers.get('X-CSRF-Token');
    const revision = (await list.json())?.data?.revision ?? null;
    const body = JSON.stringify({ id: 'p-vym1rjw052', revision });
    const r = await fetch('api/index.php?action=player-preset-default', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token ?? '' }, body });
    const okCode = (await r.json())?.ok ?? null;
    const noCsrf = await fetch('api/index.php?action=player-preset-default', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body });
    return { revisionFound: revision !== null, tokenFound: Boolean(token), withCsrf: r.status, withCsrfOk: okCode, withoutCsrf: noCsrf.status, withoutCsrfCode: (await noCsrf.json())?.error?.code ?? null };
  });
  await sleep(800);
  result.adminCalls = summary(rows.slice(0, before));
  result.adminWriteCalls = summary(rows.slice(before));
  const mark = rows.length;
  const viewer = await context.newPage();
  await play(viewer, `${Q}&preset=p-vym1rjw052`, 14);
  result.publicWhileLoggedIn = summary(rows.slice(mark));
  await page.reload();
  await sleep(1500);
  result.stillLoggedIn = await page.getByRole('button', { name: '로그아웃' }).isVisible();
  await context.close();
}
save('PUBLIC-COOKIE/result.json', result);
await browser.close();
