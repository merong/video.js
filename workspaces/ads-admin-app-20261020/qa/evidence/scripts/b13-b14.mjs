// B13 (1280×800) and B14 (768×1024): no page-level horizontal scroll, no clipped controls, schedule actions reachable.
import { BASE, launch, newContext, login, consoleCollector, save, shot, sleep, overflow } from './lib.mjs';

const browser = await launch();
const result = {};

async function clipped(page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const out = [];
    for (const el of document.querySelectorAll('main button, main a, main input, main select, main textarea, header button, header a, nav a')) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || el.closest('[hidden]') || getComputedStyle(el).visibility === 'hidden') continue;
      // A control is clipped when it leaves the viewport or an ancestor that hides overflow without scrolling.
      let clip = r.right > vw + 0.5 || r.left < -0.5;
      for (let p = el.parentElement; p && !clip; p = p.parentElement) {
        const cs = getComputedStyle(p);
        if (/(hidden|clip)/.test(cs.overflowX)) {
          const pr = p.getBoundingClientRect();
          if (r.right > pr.right + 1 || r.left < pr.left - 1) clip = true;
        }
      }
      if (clip) out.push({ tag: el.tagName, text: (el.getAttribute('aria-label') || el.textContent || el.value || '').trim().slice(0, 40), left: Math.round(r.left), right: Math.round(r.right) });
    }
    const scrollers = [...document.querySelectorAll('main *')].filter((e) => e.scrollWidth > e.clientWidth + 1 && /(auto|scroll)/.test(getComputedStyle(e).overflowX)).map((e) => ({ tag: e.tagName, cls: e.className?.toString().slice(0, 40), scrollWidth: e.scrollWidth, clientWidth: e.clientWidth }));
    return { clipped: out.slice(0, 20), clippedCount: out.length, innerScrollers: scrollers.slice(0, 10) };
  });
}

async function hitTest(locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) return { visible: false };
  const hit = await locator.page().evaluate(({ x, y }) => {
    const el = document.elementFromPoint(x, y);
    return el ? (el.closest('button,a')?.textContent ?? el.tagName).trim().slice(0, 40) : null;
  }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
  return { visible: true, box: { x: Math.round(box.x), w: Math.round(box.width) }, hit, enabled: await locator.isEnabled() };
}

for (const [label, width, height] of [['B13', 1280, 800], ['B14', 768, 1024]]) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  const logs = consoleCollector(page);
  const r = { viewport: { width, height }, screens: {} };
  try {
    await page.goto(`${BASE}/`);
    await page.getByRole('button', { name: '로그인' }).waitFor();
    r.screens.login = { ...(await overflow(page)), ...(await clipped(page)) };
    await shot(page, `${label}/login.png`, { fullPage: true });
    await login(page);
    const navLinks = page.getByRole('navigation', { name: '주 메뉴' }).getByRole('link');
    r.menu = { count: await navLinks.count(), visible: await navLinks.filter({ visible: true }).count(), menuButton: await page.getByRole('button', { name: /메뉴/ }).count() };
    for (const [key, hash] of [['creatives', '#/creatives'], ['reports', '#/reports'], ['dashboard', '#/dashboard'], ['campaigns', '#/campaigns']]) {
      await page.goto(`${BASE}/${hash}`);
      await sleep(1200);
      r.screens[key] = { ...(await overflow(page)), ...(await clipped(page)) };
      await shot(page, `${label}/${key}.png`, { fullPage: true });
    }
    await page.goto(`${BASE}/#/schedule`);
    await page.getByRole('button', { name: '편성 불러오기' }).click();
    await page.getByRole('form', { name: '광고 편성 편집' }).waitFor();
    await sleep(1000);
    r.scheduleItems = await page.getByRole('form', { name: '광고 편성 편집' }).getByRole('group', { name: /^\d+\. / }).count();
    r.screens.schedule = { ...(await overflow(page)), ...(await clipped(page)) };
    r.scheduleActions = {
      save: await hitTest(page.getByRole('button', { name: '초안 저장' })),
      publish: await hitTest(page.getByRole('button', { name: '저장한 초안 게시' })),
    };
    await shot(page, `${label}/schedule.png`, { fullPage: true });
    const fixed = page.getByRole('form', { name: '재생 확인' }).getByLabel('고정 영상 ID', { exact: true });
    if (await fixed.isEditable()) await fixed.fill('a1-qa-video-1');
    await page.getByRole('button', { name: '미리보기 준비' }).click();
    await page.getByRole('region', { name: '광고 편성 미리보기' }).waitFor();
    await sleep(1500);
    r.screens.preview = { ...(await overflow(page)), ...(await clipped(page)) };
    await page.getByRole('region', { name: '광고 편성 미리보기' }).screenshot({ path: `${(await import('./lib.mjs')).EV}/${label}/preview.png` });
    // Close the preview without playback (no collection either way).
    await page.getByRole('button', { name: '미리보기 닫기' }).click();
  } catch (error) {
    r.error = String(error).slice(0, 1200);
    await shot(page, `${label}/error.png`, { fullPage: true }).catch(() => {});
  }
  r.console = logs;
  result[label] = r;
  await context.close();
}

save('B13-B14/result.json', result);
await browser.close();
