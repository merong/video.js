// HL11 keyboard-only help flow; HL12 help layout at 1280×800 and 768×1024.
import { BASE, EV, launch, newContext, login, recordNetwork, apiCalls, consoleCollector, save, sleep, overflow } from './lib.mjs';

const browser = await launch();
const result = { HL11: { steps: [] }, HL12: {} };

{
  const context = await newContext(browser, { height: 900 });
  const net = recordNetwork(context);
  const page = await context.newPage();
  const logs = consoleCollector(page);
  const active = () => page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return { tag: 'BODY' };
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      tag: el.tagName, id: el.id || undefined, href: el.getAttribute('href') || undefined, pressed: el.getAttribute('aria-pressed') ?? undefined,
      name: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40), group: el.closest('[role=group]')?.getAttribute('aria-label') ?? undefined,
      visible: r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && !el.closest('[hidden],[inert]'),
      focusRing: (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || (cs.boxShadow && cs.boxShadow !== 'none'),
    };
  });
  async function tabTo(label, match, { max = 120, back = false } = {}) {
    const trail = [];
    for (let i = 0; i < max; i++) {
      await page.keyboard.press(back ? 'Shift+Tab' : 'Tab');
      const a = await active();
      trail.push(a);
      if (match(a)) {
        result.HL11.steps.push({ label, presses: i + 1, reached: a, hiddenFocus: trail.filter((t) => t.tag !== 'BODY' && !t.visible).map((t) => t.name), noRing: trail.filter((t) => t.tag !== 'BODY' && t.visible && !t.focusRing).map((t) => `${t.tag}:${t.name}`) });
        return a;
      }
    }
    result.HL11.steps.push({ label, presses: max, reached: null, trailTail: trail.slice(-8) });
    throw new Error(`keyboard: ${label} not reached`);
  }
  try {
    await login(page);
    await page.goto(`${BASE}/#/dashboard`);
    await sleep(1000);
    await page.evaluate(() => document.activeElement?.blur());
    const mark = net.length ? net[net.length - 1].t + 1 : 0;
    await tabTo('상단 도움말', (a) => a.tag === 'A' && a.href === '#/help');
    await page.keyboard.press('Enter');
    await sleep(800);
    result.HL11.afterHelp = await active();
    await tabTo('필터 스킵', (a) => a.tag === 'BUTTON' && a.name.startsWith('스킵'));
    await page.keyboard.press('Enter');
    await sleep(400);
    result.HL11.filterAfterEnter = await active();
    await tabTo('스킵 대기 일시정지', (a) => a.tag === 'BUTTON' && a.name === '일시정지' && a.group === '스킵 대기 그림 조작');
    await page.keyboard.press('Space');
    await sleep(300);
    result.HL11.pauseAfterSpace = await active();
    result.HL11.pausedClass = await page.locator('article[aria-labelledby="sa-help-skip-offset"] figure').getAttribute('class');
    await tabTo('스킵 대기 다시 보기', (a) => a.tag === 'BUTTON' && a.name === '다시 보기' && a.group === '스킵 대기 그림 조작');
    await page.keyboard.press('Enter');
    await sleep(80);
    result.HL11.replay = await page.evaluate(() => document.querySelector('article[aria-labelledby="sa-help-skip-offset"] figure').getAnimations({ subtree: true }).map((a) => Math.round(a.currentTime)).slice(0, 3));
    await page.screenshot({ path: `${EV}/HL11/help-keyboard.png` });
    // Back to 소재 by keyboard: Shift+Tab to the menu link, then into the first HelpLink.
    await tabTo('메뉴 소재', (a) => a.tag === 'A' && a.href === '#/creatives', { back: true, max: 200 });
    await page.keyboard.press('Enter');
    await sleep(1200);
    result.HL11.afterCreatives = await active();
    await tabTo('소재 HelpLink', (a) => a.tag === 'A' && (a.href ?? '').startsWith('#/help/'));
    const link = await active();
    await page.screenshot({ path: `${EV}/HL11/creatives-helplink-focus.png` });
    await page.keyboard.press('Enter');
    await sleep(800);
    result.HL11.afterHelpLink = { link: link.href, ...(await active()), hash: new URL(page.url()).hash };
    result.HL11.api = apiCalls(net, mark).map((c) => `${c.method} ${c.action} ${c.status}`);
  } catch (error) {
    result.HL11.error = String(error).slice(0, 1200);
    await page.screenshot({ path: `${EV}/HL11/error.png` }).catch(() => {});
  }
  result.HL11.console = logs;
  await context.close();
}

for (const [label, width, height] of [['1280', 1280, 800], ['768', 768, 1024]]) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  const r = {};
  try {
    await login(page);
    await page.goto(`${BASE}/#/help`);
    await sleep(1500);
    r.top = await overflow(page);
    await page.screenshot({ path: `${EV}/HL12/${label}-help-top.png` });
    const flow = page.getByRole('list', { name: '기본 작업 순서' });
    await flow.screenshot({ path: `${EV}/HL12/${label}-flow.png` });
    r.flow = await flow.evaluate((ul) => {
      const items = [...ul.querySelectorAll('li')].map((li) => li.getBoundingClientRect());
      return { rows: new Set(items.map((b) => Math.round(b.top))).size, overflowX: ul.scrollWidth > ul.clientWidth + 1, overlapping: items.some((a, i) => items.some((b, j) => i < j && a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1)) };
    });
    r.figures = {};
    for (const id of ['ad-break', 'creative-source', 'player-skin']) {
      const article = page.locator(`article[aria-labelledby="sa-help-${id}"]`);
      await article.scrollIntoViewIfNeeded();
      await sleep(500);
      await article.screenshot({ path: `${EV}/HL12/${label}-${id}.png` });
      r.figures[id] = await article.evaluate((a) => {
        const vw = document.documentElement.clientWidth;
        const fig = a.querySelector('figure').getBoundingClientRect();
        const clipped = [...a.querySelectorAll('figure *')].filter((e) => {
          const b = e.getBoundingClientRect();
          return b.width && (b.right > fig.right + 1 || b.left < fig.left - 1 || b.right > vw + 0.5);
        }).map((e) => e.className?.toString() || e.tagName);
        const btns = [...a.querySelectorAll('figure button')].map((b) => b.getBoundingClientRect());
        const overlap = btns.some((x, i) => btns.some((y, j) => i < j && x.left < y.right && y.left < x.right && x.top < y.bottom && y.top < x.bottom));
        return { figWidth: Math.round(fig.width), clipped: clipped.slice(0, 8), buttonsOverlap: overlap };
      });
    }
    r.end = await overflow(page);
  } catch (error) {
    r.error = String(error).slice(0, 1000);
  }
  result.HL12[label] = r;
  await context.close();
}

save('HL11-12/result.json', result);
await browser.close();
