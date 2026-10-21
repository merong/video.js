// B15 supplement: keyboard save/publish reached backwards to avoid the mid position trap; keyboard only (Tab, Shift+Tab, Enter, Space, typing) from menu to schedule edit, save and publish.
import { BASE, launch, newContext, login, recordNetwork, consoleCollector, save, shot, sleep, apiCalls } from './lib.mjs';

const browser = await launch();
const context = await newContext(browser, { height: 900 });
const net = recordNetwork(context);
const page = await context.newPage();
const logs = consoleCollector(page);
const result = { steps: [] };
const mark = () => (net.length ? net[net.length - 1].t + 1 : 0);

const active = () => page.evaluate(() => {
  let el = document.activeElement;
  while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
  if (!el || el === document.body) return { tag: 'BODY' };
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  return {
    tag: el.tagName,
    name: (el.getAttribute('aria-label') || el.labels?.[0]?.textContent || el.textContent || '').trim().slice(0, 50),
    value: el.tagName === 'INPUT' ? el.value.slice(0, 60) : undefined,
    visible: r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && !el.closest('[hidden],[inert]'),
    focusRing: (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || (cs.boxShadow && cs.boxShadow !== 'none'),
  };
});

/** Presses Tab (or Shift+Tab) until `match` accepts the active element. */
async function tabTo(label, match, { max = 80, back = false } = {}) {
  const trail = [];
  for (let i = 0; i < max; i++) {
    await page.keyboard.press(back ? 'Shift+Tab' : 'Tab');
    const a = await active();
    trail.push(a);
    if (match(a)) {
      result.steps.push({ label, presses: i + 1, reached: a, hiddenFocus: trail.filter((t) => !t.visible).map((t) => t.name), noRing: trail.filter((t) => t.visible && !t.focusRing).map((t) => `${t.tag}:${t.name}`) });
      return a;
    }
  }
  result.steps.push({ label, presses: max, reached: null, trailTail: trail.slice(-10) });
  throw new Error(`keyboard: ${label} not reached`);
}

try {
  await login(page);
  await page.goto(`${BASE}/#/schedule`);
  await sleep(1000);
  await page.evaluate(() => document.activeElement?.blur());
  await tabTo('편성 불러오기', (a) => a.tag === 'BUTTON' && a.name === '편성 불러오기');
  await page.keyboard.press('Enter');
  await sleep(1500);
  await tabTo('커피 클릭 목적지 URL', (a) => a.tag === 'INPUT' && a.name === '클릭 목적지 URL' && /qa-coffee/.test(a.value ?? ''));
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('https://example.com/qa-coffee-kbd');
  // Avoid the mid position trap: restart from the document end (focus reset only, no pointer on controls).
  await page.evaluate(() => document.activeElement?.blur());
  const t = mark();
  await tabTo('초안 저장 (역방향)', (a) => a.tag === 'BUTTON' && a.name === '초안 저장', { back: true, max: 80 });
  await page.keyboard.press('Enter');
  await sleep(1500);
  result.save = { api: apiCalls(net, t), status: await page.getByRole('form', { name: '광고 편성 편집' }).getByRole('status').last().innerText() };
  await tabTo('저장한 초안 게시', (a) => a.tag === 'BUTTON' && a.name === '저장한 초안 게시');
  await page.keyboard.press('Space');
  await sleep(500);
  result.dialogFocus = await active();
  await shot(page, 'B15/workaround-publish-dialog.png');
  if (result.dialogFocus.name !== '게시') await tabTo('대화상자 게시', (a) => a.tag === 'BUTTON' && a.name === '게시', { max: 6 });
  const t2 = mark();
  await page.keyboard.press('Enter');
  await sleep(1500);
  result.publish = { api: apiCalls(net, t2), status: await page.getByRole('form', { name: '광고 편성 편집' }).getByRole('status').last().innerText(), focusAfter: await active() };
  await shot(page, 'B15/workaround-published.png');
} catch (error) {
  result.error = String(error).slice(0, 1500);
  await shot(page, 'B15/workaround-error.png', { fullPage: true }).catch(() => {});
}

result.console = logs;
save('B15/result-workaround.json', result);
await browser.close();
