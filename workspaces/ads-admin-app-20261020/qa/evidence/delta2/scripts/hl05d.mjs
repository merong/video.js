// A1-QA-DELTA HL05: a link to the term already open (#/help/<id>) clears a filter that hides it and focuses its
// heading again (HelpLink reopen event, HelpScreen.tsx). Read-only.
import { BASE, launch, newContext, login, recordNetwork, save, shot, sleep, apiCalls } from './lib.mjs';

const browser = await launch();
const context = await newContext(browser, { height: 900 });
const net = recordNetwork(context);
const page = await context.newPage();
const result = { cases: [] };
const chips = () => page.getByRole('group', { name: '용어 분류' }).getByRole('button');
const state = (termId) => page.evaluate((id) => {
  const heading = document.getElementById(`sa-help-${id}`);
  const r = heading?.getBoundingClientRect();
  return {
    hash: location.hash,
    focus: document.activeElement?.id || document.activeElement?.tagName,
    headingFocused: document.activeElement === heading,
    headingInView: Boolean(r && r.top >= 0 && r.top < innerHeight),
    pressed: [...document.querySelectorAll('[role=group][aria-label="용어 분류"] button[aria-pressed="true"]')].map((b) => b.textContent.trim()),
    visibleTerms: [...document.querySelectorAll('article.sa-term')].filter((a) => a.getClientRects().length).length,
    targetVisible: Boolean(heading && heading.getClientRects().length),
  };
}, termId);

try {
  await login(page);
  await page.goto(`${BASE}/#/help`);
  await sleep(1200);
  const flow = page.getByRole('list', { name: '기본 작업 순서' }).getByRole('link');
  const href = await flow.first().getAttribute('href');
  const termId = href.replace('#/help/', '');
  result.termId = termId;
  await flow.first().click();
  await sleep(800);
  result.opened = await state(termId);

  // 1. Filter to another category (target hidden), then the same link again.
  const labels = await chips().allInnerTexts();
  result.chips = labels;
  let hiding = null;
  for (let i = 1; i < labels.length && !hiding; i++) {
    await chips().nth(i).click();
    await sleep(250);
    if (!(await state(termId)).targetVisible) hiding = labels[i];
  }
  const before = await state(termId);
  await flow.first().click();
  await sleep(800);
  result.cases.push({ case: 'filter hides target → same link', filter: hiding, before, after: await state(termId) });
  await shot(page, 'HL05/reopen-filter-cleared.png');

  // 2. A filter that shows the target stays; focus returns to the heading.
  let showing = null;
  for (let i = 1; i < labels.length && !showing; i++) {
    await chips().nth(i).click();
    await sleep(250);
    if ((await state(termId)).targetVisible) showing = labels[i];
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await flow.first().focus();
  const before2 = await state(termId);
  await flow.first().click();
  await sleep(800);
  result.cases.push({ case: 'filter shows target → same link', filter: showing, before: before2, after: await state(termId) });

  // 3. No filter, scrolled away, focus elsewhere → same link.
  await chips().first().click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await flow.first().focus();
  const before3 = await state(termId);
  await flow.first().click();
  await sleep(800);
  result.cases.push({ case: 'no filter → same link', before: before3, after: await state(termId) });

  result.pass = result.cases.every((c) => c.after.headingFocused && c.after.targetVisible && c.after.headingInView) &&
    result.cases[0].after.pressed.join() === labels[0] && result.cases[1].after.pressed.join() === showing;
  result.api = apiCalls(net).map((c) => `${c.method} ${c.action} ${c.status}`);
} catch (error) {
  result.error = String(error).slice(0, 1500);
}
save('HL05/result-reopen.json', result);
await browser.close();
