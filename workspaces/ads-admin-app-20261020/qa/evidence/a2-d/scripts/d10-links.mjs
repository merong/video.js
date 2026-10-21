// A2-D-QA D10 admin "재생 테스트 링크": the first run filled 고정 영상 ID before the panel settled (the field was empty in
// D10/admin-links.png). This run waits, fills, checks the value, reads both links and opens each in a new window.
import { BASE, launch, newContext, login, consoleCollector, save, shot, sleep } from './lib.mjs';
import { players } from './a2.mjs';
import { requestLog } from './demo.mjs';

const browser = await launch();
const context = await newContext(browser, { width: 1280, height: 1400 });
const req = requestLog(context);
const page = await context.newPage();
const logs = consoleCollector(page);
const result = { runs: [] };
try {
  await login(page);
  await page.goto(`${BASE}/#/schedule`);
  const target = page.getByRole('form', { name: '편집할 대상' });
  await target.getByLabel('적용 단위', { exact: true }).selectOption({ label: '사이트 기본' });
  await target.getByRole('button', { name: '편성 불러오기' }).click();
  await page.getByRole('heading', { name: '게시본 재생 테스트' }).waitFor({ timeout: 15000 });
  await sleep(2500);
  const id = page.getByRole('textbox', { name: '고정 영상 ID' });
  await id.click();
  await id.pressSequentially('grok-demo-scene-01');
  await page.keyboard.press('Tab');
  for (const preset of ['rounded', 'p-pchm59hhyv']) {
    await page.getByRole('combobox', { name: '적용할 프리셋' }).selectOption(preset);
    await sleep(1000);
    const group = page.getByRole('group', { name: '게시본 재생 테스트' });
    const run = { preset, idValue: await id.inputValue(), links: await group.locator('a').evaluateAll((as) => as.map((a) => ({ text: a.textContent.replace(/\s+/g, ' ').trim(), href: a.getAttribute('href')?.replace(/^https?:\/\/[^/]+/, ''), target: a.getAttribute('target'), rel: a.getAttribute('rel') }))), notes: (await group.innerText()).split('\n').filter((l) => /기본값|다른 플레이어/.test(l)) };
    await group.scrollIntoViewIfNeeded();
    await shot(page, `D10/admin-links-${preset}.png`);
    run.opened = [];
    for (const link of run.links.filter((l) => l.href?.includes('play-test.html'))) {
      const [popup] = await Promise.all([context.waitForEvent('page'), group.getByRole('link', { name: link.text }).click()]);
      await popup.waitForLoadState();
      await sleep(3500);
      const p = (await players(popup, '#player'))[0];
      run.opened.push({ text: link.text, url: popup.url().replace(BASE, ''), presetNote: await popup.locator('#preset-note:visible').innerText().catch(() => null), cond: await popup.locator('#conditions tr').evaluateAll((trs) => trs.map((tr) => tr.textContent.replace(/\s+/g, ' ').trim())), tree: p?.tree, fill: p?.skin?.fillBefore, radius: p?.skin?.borderRadius });
      await shot(popup, `D10/admin-open-${preset}-${link.text.includes('기본') ? 'native' : 'videojs'}.png`);
      await popup.close();
    }
    result.runs.push(run);
  }
} catch (error) {
  result.error = String(error).slice(0, 1500);
  await shot(page, 'D10/links-error.png', { fullPage: true }).catch(() => {});
}
result.events = req.events().length;
result.console = logs;
await context.close();
save('D10/admin-links.json', result);
await browser.close();
