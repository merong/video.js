// A1-QA-DELTA-2 B13/B14/390: page-level horizontal overflow on table screens (creatives, campaigns, schedule,
// reports with rows, players list, setup) at 1280×800, 768×1024 and 390×844. A control is "clipped" only when it leaves
// the viewport or a hidden/clip ancestor; controls inside an auto/scroll scroller are listed separately (reachable by scrolling).
import { BASE, launch, login, save, shot, sleep, overflow } from './lib.mjs';
import { queryStats } from './stats.mjs';

const browser = await launch();
const result = {};

const measure = (page) => page.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const clipped = [];
  const inScroller = [];
  for (const el of document.querySelectorAll('main button, main a, main input, main select, main textarea, header button, header a, nav a')) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || el.closest('[hidden]') || getComputedStyle(el).visibility === 'hidden') continue;
    let scroller = null;
    let clip = false;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX;
      const pr = p.getBoundingClientRect();
      const outside = r.right > pr.right + 1 || r.left < pr.left - 1;
      if (/(auto|scroll)/.test(ox)) { scroller = scroller ?? p; break; }
      if (/(hidden|clip)/.test(ox) && outside) { clip = true; break; }
    }
    const offViewport = r.right > vw + 0.5 || r.left < -0.5;
    const item = { tag: el.tagName, text: (el.getAttribute('aria-label') || el.textContent || el.value || '').trim().slice(0, 40), left: Math.round(r.left), right: Math.round(r.right) };
    if (clip || (offViewport && !scroller)) clipped.push(item);
    else if (offViewport && scroller) inScroller.push({ ...item, scroller: `${scroller.tagName}.${String(scroller.className).split(' ')[0]}` });
  }
  // Elements that extend past the viewport without a scrolling ancestor are what widen the page.
  const wideners = [...document.querySelectorAll('body *')].filter((e) => {
    const r = e.getBoundingClientRect();
    if (!r.width || r.right <= vw + 0.5) return false;
    for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(p).overflowX)) return false;
    return true;
  }).slice(0, 8).map((e) => ({ tag: e.tagName, cls: String(e.className).slice(0, 50), right: Math.round(e.getBoundingClientRect().right), pos: getComputedStyle(e).position }));
  const scrollers = [...document.querySelectorAll('main *')].filter((e) => e.scrollWidth > e.clientWidth + 1 && /(auto|scroll)/.test(getComputedStyle(e).overflowX)).map((e) => ({ cls: String(e.className).slice(0, 40), scrollWidth: e.scrollWidth, clientWidth: e.clientWidth, position: getComputedStyle(e).position }));
  return { clipped, clippedCount: clipped.length, inScroller: inScroller.slice(0, 10), inScrollerCount: inScroller.length, wideners, innerScrollers: scrollers.slice(0, 8) };
});

for (const [label, width, height] of [['B13', 1280, 800], ['B14', 768, 1024], ['B14-390', 390, 844]]) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  const r = { viewport: { width, height }, screens: {} };
  try {
    await login(page);
    const record = async (key) => {
      r.screens[key] = { ...(await overflow(page)), ...(await measure(page)) };
      await shot(page, `widths/${label}/${key}.png`, { fullPage: true });
    };
    for (const [key, hash] of [['creatives', '#/creatives'], ['campaigns', '#/campaigns'], ['dashboard', '#/dashboard'], ['players', '#/players'], ['players-setup', '#/players/setup'], ['players-options', '#/players/options']]) {
      await page.goto(`${BASE}/${hash}`);
      await sleep(1300);
      await record(key);
    }
    const stats = await queryStats(page, {});
    r.reportsRows = stats.tables.map((t) => t.length);
    await record('reports');
    await page.goto(`${BASE}/#/schedule`);
    await page.getByRole('button', { name: '편성 불러오기' }).click();
    await page.getByRole('form', { name: '광고 편성 편집' }).waitFor();
    await sleep(1000);
    await record('schedule');
  } catch (error) {
    r.error = String(error).slice(0, 1200);
    await shot(page, `widths/${label}/error.png`, { fullPage: true }).catch(() => {});
  }
  result[label] = r;
  await context.close();
}

save('widths/result.json', result);
await browser.close();
