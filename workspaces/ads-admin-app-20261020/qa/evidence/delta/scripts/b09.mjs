// B09 (+B11 first/second stats query): admin preview plays real ads and sends no collection.
import { BASE, launch, newContext, login, recordNetwork, consoleCollector, save, shot, sleep } from './lib.mjs';
import { queryStats } from './stats.mjs';

const browser = await launch();
const context = await newContext(browser, { height: 1000 });
const net = recordNetwork(context);
const page = await context.newPage();
const logs = consoleCollector(page);
const result = {};

try {
  await login(page);
  result.statsBefore = await queryStats(page);

  await page.goto(`${BASE}/#/schedule`);
  const target = page.getByRole('form', { name: '편집할 대상' });
  await target.getByLabel('적용 단위', { exact: true }).selectOption({ label: '개별 영상' });
  await target.getByLabel('고정 대상 ID', { exact: true }).fill('a1-qa-video-1');
  await target.getByRole('button', { name: '편성 불러오기' }).click();
  await page.getByRole('form', { name: '광고 편성 편집' }).waitFor();
  await sleep(800);

  const start = net.length;
  const play = page.getByRole('form', { name: '재생 확인' });
  await play.getByRole('button', { name: '미리보기 준비' }).click();
  const region = page.getByRole('region', { name: '광고 편성 미리보기' });
  await region.waitFor();
  await sleep(1500);
  result.prepared = await region.innerText();

  const video = region.locator('video').first();
  // One real click only; playback start is judged from any media in the document (the ad may take over first).
  await video.click();
  await sleep(1500);
  result.anyMediaPlayingAfterClick = await page.evaluate(() => {
    const all = (root) => [...root.querySelectorAll('video')].concat(...[...root.querySelectorAll('*')].filter((n) => n.shadowRoot).map((n) => all(n.shadowRoot)));
    return all(document).map((v) => ({ src: v.currentSrc.replace(location.origin, ''), paused: v.paused, t: v.currentTime }));
  });
  const timeline = [];
  const shots = new Set();
  let last = '';
  const deadline = Date.now() + 150000;
  while (Date.now() < deadline) {
    const state = await region.evaluate((el) => {
      const all = (root) => [...root.querySelectorAll('video')].concat(...[...root.querySelectorAll('*')].filter((n) => n.shadowRoot).map((n) => all(n.shadowRoot)));
      const videos = all(document).map((v) => ({ src: v.currentSrc.replace(location.origin, ''), t: Math.round(v.currentTime * 10) / 10, paused: v.paused, ended: v.ended, hidden: v.offsetParent === null }));
      const images = [...el.querySelectorAll('img')].filter((i) => i.offsetParent !== null).map((i) => i.currentSrc.replace(location.origin, ''));
      const status = [...el.querySelectorAll('[role=status],[role=alert]')].map((s) => s.textContent.trim()).filter(Boolean);
      return { videos, images, status, log: el.querySelector('ol,ul')?.innerText ?? null };
    });
    const key = JSON.stringify([state.status, state.images, state.videos.map((v) => [v.src, v.paused, v.ended, v.hidden])]);
    if (key !== last) {
      timeline.push({ at: Date.now(), ...state });
      last = key;
      const phase = state.images.length ? 'image' : state.videos.find((v) => !v.paused && !v.hidden)?.src.split('/').pop();
      if (phase && !shots.has(phase)) {
        shots.add(phase);
        await shot(page, `B09/phase-${shots.size}-${phase.replace(/[^a-z0-9.-]/gi, '_')}.png`);
      }
    }
    const content = state.videos.find((v) => v.src.includes('content-scene-01'));
    if (content?.ended) break;
    await sleep(400);
  }
  result.timeline = timeline;
  await sleep(4000);
  const details = region.locator('details');
  if (await details.count()) await details.first().evaluate((d) => (d.open = true));
  result.final = await region.innerText();
  await shot(page, 'B09/ended.png', { fullPage: true });
  const end = net.length;
  result.requestsDuringPreview = net.slice(start, end).map((e) => ({ method: e.method, action: e.action, url: e.action ? null : e.url, status: e.status, type: e.type, sameOrigin: e.sameOrigin }));
  result.collectionCounts = {
    events: net.slice(start, end).filter((e) => e.action === 'events').length,
    publicSchedule: net.slice(start, end).filter((e) => e.action === 'schedule').length,
    schedulePreview: net.slice(start, end).filter((e) => e.action === 'schedule-preview').length,
  };

  // Leave the screen and check that media and requests stop.
  await page.getByRole('navigation', { name: '주 메뉴' }).getByRole('link', { name: '소재' }).click();
  const leave = net.length;
  await sleep(4000);
  result.afterLeave = {
    requests: net.slice(leave).map((e) => ({ method: e.method, action: e.action, url: e.action ? null : e.url, status: e.status })),
    mediaElements: await page.evaluate(() => [...document.querySelectorAll('video,audio')].map((m) => ({ src: m.currentSrc, paused: m.paused }))),
  };

  result.statsAfter = await queryStats(page);
} catch (error) {
  result.error = String(error).slice(0, 1500);
  await shot(page, 'B09/error.png', { fullPage: true }).catch(() => {});
}

result.console = logs;
save('B09/result.json', result);
save('B09/network.json', net);
await browser.close();
