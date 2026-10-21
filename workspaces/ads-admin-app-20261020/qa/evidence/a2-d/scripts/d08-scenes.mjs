// A2-D-QA D03/D08 scene shortcuts without autoplay: 미드롤 앞 must reach a midroll ad and 끝 직전 a postroll ad, read from
// the latest-progress line, on the demo and in the editor preview. Then the editor's "데모에서 열기" is clicked and the
// new window's preset is read. Nothing is saved.
import { BASE, launch, newContext, login, consoleCollector, save, shot, sleep } from './lib.mjs';
import { players } from './a2.mjs';
import { openDemo, requestLog } from './demo.mjs';

const browser = await launch();
const result = { demo: [], editor: [] };
const context = await newContext(browser, { width: 1280, height: 1400 });
const req = requestLog(context);
const page = await context.newPage();
const logs = consoleCollector(page);

async function until(read, re, timeout = 25000) {
  const end = Date.now() + timeout;
  let last = await read();
  while (Date.now() < end && !re.test(last ?? '')) {
    await sleep(400);
    last = await read();
  }
  return last;
}

async function scenes(list, nowSel, buttons, target) {
  const read = () => page.locator(nowSel).innerText().then((t) => t.replace(/\s+/g, ' ').trim()).catch(() => null);
  for (const [button, re, label] of [['미드롤 앞', /미드롤 1\/1 재생 중/, 'midroll'], ['끝 직전', /포스트롤 \d\/\d 재생 중/, 'postroll'], ['처음부터', /프리롤 1\/2 재생 중/, 'start']]) {
    const t0 = Date.now();
    await page.locator(buttons, { hasText: button }).first().click();
    const now = await until(read, re);
    const p = (await players(target(), '#player'))[0];
    list.push({ button, reached: re.test(now ?? ''), ms: Date.now() - t0, now, adText: p?.visibleText?.filter((t) => !t.startsWith('@')).slice(-5), controls: p?.buttonLabels?.slice(0, 4) });
    await shot(page, `D08/scene-${list === result.demo ? 'demo' : 'editor'}-${label}.png`);
  }
}

try {
  await openDemo(page);
  await scenes(result.demo, '#now', '[data-scene]', () => page);

  await login(page);
  await page.goto(`${BASE}/#/players/edit/p-i0aecb28w3`);
  await page.getByRole('heading', { name: '플레이어 미리보기' }).waitFor({ timeout: 15000 });
  await sleep(4000);
  await page.locator('.sa-stage').scrollIntoViewIfNeeded();
  await scenes(result.editor, '.sa-stage-now', '.sa-stage-tools button', () => page.frames().find((f) => f.url().includes('/examples/preview.html')));

  const [popup] = await Promise.all([context.waitForEvent('page'), page.getByRole('link', { name: '데모에서 열기 (새 창)' }).click()]);
  await popup.waitForLoadState();
  await popup.locator('#preset option').first().waitFor({ state: 'attached' });
  await sleep(2500);
  result.demoLink = { url: popup.url().replace(BASE, ''), preset: await popup.locator('#preset').inputValue(), selected: await popup.locator('#preset option:checked').innerText(), opener: await popup.evaluate(() => window.opener === null) };
  await shot(popup, 'D08/demo-link-popup.png');
  await popup.close();
} catch (error) {
  result.error = String(error).slice(0, 1500);
  await shot(page, 'D08/scene-error.png', { fullPage: true }).catch(() => {});
}
result.events = req.events();
result.console = logs;
await context.close();
save('D08/scenes.json', result);
await browser.close();
