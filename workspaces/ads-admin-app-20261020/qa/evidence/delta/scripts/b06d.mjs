// A1-QA-DELTA B06/B15: mid-roll position field releases focus (click, Tab, Shift+Tab), keeps its own value,
// re-sorting keeps focus on the control that received it, and invalid values block save with an alert.
// Works on the scratch target 영상 a1-qa-b06-scratch so the published B08 data is untouched.
import { BASE, launch, newContext, login, recordNetwork, consoleCollector, save, shot, apiCalls, sleep } from './lib.mjs';

const browser = await launch();
const context = await newContext(browser, { height: 1000 });
const net = recordNetwork(context);
const page = await context.newPage();
const logs = consoleCollector(page);
const result = {};
const mark = () => (net.length ? net[net.length - 1].t + 1 : 0);
const editor = page.getByRole('form', { name: '광고 편성 편집' });
const mids = () => editor.getByRole('article', { name: /미드롤/ });

const active = () => page.evaluate(() => {
  const el = document.activeElement;
  if (!el || el === document.body) return { tag: 'BODY' };
  const card = el.closest('article');
  return {
    tag: el.tagName,
    label: el.labels?.[0]?.textContent?.trim() ?? el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 30),
    value: 'value' in el ? String(el.value).slice(0, 40) : undefined,
    card: card?.querySelector('h3')?.textContent?.trim() ?? null,
    cardIndex: card ? [...document.querySelectorAll('article[data-break-id]')].indexOf(card) : null,
    breakId: card?.getAttribute('data-break-id') ?? null,
  };
});
const positions = () => mids().evaluateAll((els) => els.map((a) => ({ breakId: a.getAttribute('data-break-id'), at: a.querySelector('[data-at]')?.value })));

async function addMid(seconds, creative) {
  await editor.getByRole('group', { name: '광고 구간 추가' }).getByRole('button', { name: '미드롤' }).click();
  await sleep(200);
  const card = mids().last();
  await card.getByLabel('추가할 소재', { exact: true }).selectOption({ label: creative });
  await card.getByRole('button', { name: '광고 추가' }).click();
  await sleep(200);
  const pos = card.getByLabel('본편 재생 위치 (초)', { exact: true });
  await pos.click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type(String(seconds));
  return card;
}

try {
  await login(page);
  await page.goto(`${BASE}/#/schedule`);
  const target = page.getByRole('form', { name: '편집할 대상' });
  await target.waitFor();
  await target.getByLabel('적용 단위', { exact: true }).selectOption({ label: '개별 영상' });
  await target.getByLabel('고정 대상 ID', { exact: true }).fill('a1-qa-b06-scratch');
  await target.getByRole('button', { name: '편성 불러오기' }).click();
  await editor.waitFor();
  await sleep(800);
  await editor.getByLabel('이 대상의 광고', { exact: true }).selectOption({ label: '직접 편성 · 전체 대체' });

  // 1. One mid-roll: type position, click skip select and wait field, type into wait.
  const card = await addMid(5, 'QA 생수 미드롤 · v1 · 영상');
  const pos = card.getByLabel('본편 재생 위치 (초)', { exact: true });
  const r1 = { afterTypePos: await active() };
  await card.getByLabel('이 광고의 스킵', { exact: true }).selectOption({ label: 'N초 후 현재 광고만 스킵' });
  r1.afterSelect = await active();
  const wait = card.getByLabel('스킵 대기 (초)', { exact: true });
  await wait.click();
  await sleep(300);
  r1.afterWaitClick = await active();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('3');
  await sleep(300);
  r1.afterTypeWait = { active: await active(), position: await pos.inputValue(), wait: await wait.inputValue() };
  await card.getByRole('button', { name: '광고 추가' }).click();
  r1.afterAddClick = await active();
  r1.pass = r1.afterTypeWait.position === '5' && r1.afterTypeWait.wait === '3' && r1.afterWaitClick.label === '스킵 대기 (초)';
  result.click = r1;
  await shot(page, 'B06/click-out.png', { fullPage: true });

  // 2. Tab and Shift+Tab from the position field.
  await pos.focus();
  const tab = [];
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Tab');
    await sleep(150);
    tab.push(await active());
  }
  await pos.focus();
  const back = [];
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Shift+Tab');
    await sleep(150);
    back.push(await active());
  }
  result.keyboard = { tab, shiftTab: back, tabLeft: tab[0].label !== '본편 재생 위치 (초)', shiftTabLeft: back[0].label !== '본편 재생 위치 (초)', positionAfter: await pos.inputValue() };
  await shot(page, 'B06/tab-out.png', { fullPage: true });

  // 3. Two mid-rolls: give the second a smaller position, then click the first card's wait field.
  const second = await addMid(2, 'QA 생수 미드롤 · v1 · 영상');
  const beforeSort = await positions();
  const firstWait = mids().first().getByLabel('스킵 대기 (초)', { exact: true });
  const firstWaitBreak = await mids().first().getAttribute('data-break-id');
  await firstWait.click();
  await sleep(400);
  const afterSort = await positions();
  const focusAfterSort = await active();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('4');
  await sleep(300);
  result.resort = {
    beforeSort,
    afterSort,
    clickedBreakId: firstWaitBreak,
    focusAfterSort,
    focusStayedOnClickedControl: focusAfterSort.breakId === firstWaitBreak && focusAfterSort.label === '스킵 대기 (초)',
    afterTyping: await positions(),
    clickedWaitValue: await editor.locator(`article[data-break-id="${firstWaitBreak}"]`).getByLabel('스킵 대기 (초)', { exact: true }).inputValue(),
  };
  // Tab out of the second position too (sort on Tab).
  await second.getByLabel('본편 재생 위치 (초)', { exact: true }).focus().catch(() => {});
  await shot(page, 'B06/resort.png', { fullPage: true });

  // 4. Invalid positions: empty, 0, text. Try to save each; record alerts, focus, and requests.
  const invalid = [];
  for (const value of ['', '0', '-3', 'abc']) {
    const p = mids().first().getByLabel('본편 재생 위치 (초)', { exact: true });
    await p.click();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.press('Backspace');
    if (value) await page.keyboard.type(value);
    const typed = await p.inputValue();
    const t = mark();
    await editor.getByRole('button', { name: '초안 저장' }).click();
    await sleep(1200);
    invalid.push({
      value,
      typed,
      api: apiCalls(net, t).map((c) => `${c.method} ${c.action} ${c.status}${c.error ? ' ' + c.error.code : ''}`),
      alerts: (await page.getByRole('alert').allInnerTexts()).filter(Boolean),
      statuses: (await editor.getByRole('status').allInnerTexts()).filter(Boolean),
      ariaInvalid: await p.getAttribute('aria-invalid').catch(() => null),
      validationMessage: await p.evaluate((el) => el.validationMessage).catch(() => null),
      focus: await active(),
    });
    await shot(page, `B06/invalid-${value || 'empty'}.png`, { fullPage: true });
  }
  result.invalid = invalid;
} catch (error) {
  result.error = String(error).slice(0, 1500);
  await shot(page, 'B06/error.png', { fullPage: true }).catch(() => {});
}
result.console = logs;
save('B06/result.json', result);
await browser.close();
