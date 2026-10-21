// B10: published play-test links (player.html, videojs.html) in new tabs; real collection path.
import { BASE, launch, newContext, login, recordNetwork, consoleCollector, save, shot, sleep, redactUrl } from './lib.mjs';

const browser = await launch();
const context = await newContext(browser, { height: 1000 });
const net = recordNetwork(context);
const events = [];
context.on('request', (request) => {
  const url = new URL(request.url());
  if (url.searchParams.get('action') !== 'events' || request.method() !== 'POST') return;
  let body = null;
  try {
    body = JSON.parse(request.postData() ?? 'null');
  } catch {
    body = null;
  }
  const list = Array.isArray(body?.events) ? body.events : Array.isArray(body) ? body : body ? [body] : [];
  // Keep only non-secret fields: event type, ad and video ids.
  events.push({ page: request.frame()?.url() ? redactUrl(request.frame().url()) : null, items: list.map((e) => ({ type: e.type ?? e.event, adId: e.adId ?? null, videoId: e.videoId ?? null, attemptId: e.attemptId ? 'present' : null })), keys: body ? Object.keys(body) : [] });
});
const page = await context.newPage();
const logs = consoleCollector(page);
const result = { tabs: [] };

async function playTab(name) {
  const link = page.getByRole('link', { name });
  const href = await link.getAttribute('href');
  const [tab] = await Promise.all([context.waitForEvent('page'), link.click()]);
  const tabLogs = consoleCollector(tab);
  await tab.waitForLoadState('load');
  await sleep(2500);
  const r = { name, href, hrefAbsolute: /^https?:\/\//.test(href ?? ''), url: redactUrl(tab.url()), start: net.length };
  await shot(tab, `B10/${name.startsWith('기본') ? 'player' : 'videojs'}-ready.png`);
  const box = await tab.locator('video').first().boundingBox();
  await tab.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const media = () => tab.evaluate(() => {
    const all = (root) => [...root.querySelectorAll('video,img')].concat(...[...root.querySelectorAll('*')].filter((n) => n.shadowRoot).map((n) => all(n.shadowRoot)));
    return all(document).filter((m) => m.tagName === 'VIDEO' || m.offsetParent !== null).map((m) => ({ tag: m.tagName, src: (m.currentSrc || m.src || '').replace(location.origin, ''), paused: m.paused ?? null, ended: m.ended ?? null, t: m.currentTime ?? null }));
  });
  const timeline = [];
  let last = '';
  const deadline = Date.now() + 150000;
  let n = 0;
  while (Date.now() < deadline) {
    const m = await media();
    const key = JSON.stringify(m.map((x) => [x.src, x.paused, x.ended]));
    if (key !== last) {
      timeline.push({ at: Date.now(), media: m });
      last = key;
      await shot(tab, `B10/${name.startsWith('기본') ? 'player' : 'videojs'}-${++n}.png`);
    }
    if (m.find((x) => x.src.includes('content-scene-01') && x.ended)) break;
    await sleep(400);
  }
  await sleep(3000);
  r.timeline = timeline;
  r.contentEnded = Boolean(timeline.at(-1)?.media.find((x) => x.src.includes('content-scene-01') && x.ended));
  r.requests = net.slice(r.start).filter((e) => e.frame === r.url || e.sameOrigin).map((e) => ({ method: e.method, action: e.action, url: e.action ? null : e.url, status: e.status, ok: e.ok, failed: e.failed ?? null }));
  r.console = tabLogs;
  await tab.close();
  return r;
}

try {
  await login(page);
  await page.goto(`${BASE}/#/schedule`);
  const target = page.getByRole('form', { name: '편집할 대상' });
  await target.getByLabel('적용 단위', { exact: true }).selectOption({ label: '개별 영상' });
  await target.getByLabel('고정 대상 ID', { exact: true }).fill('a1-qa-video-1');
  await target.getByRole('button', { name: '편성 불러오기' }).click();
  await page.getByRole('form', { name: '광고 편성 편집' }).waitFor();
  await sleep(800);
  result.linkGroup = await page.getByRole('group', { name: '게시본 재생 테스트' }).innerText();
  for (const name of ['기본 video로 재생 (새 탭)', 'Video.js로 재생 (새 탭)']) result.tabs.push(await playTab(name));
} catch (error) {
  result.error = String(error).slice(0, 1500);
  await shot(page, 'B10/error.png', { fullPage: true }).catch(() => {});
}

result.events = events;
result.console = logs;
save('B10/result.json', result);
save('B10/network.json', net);
await browser.close();
