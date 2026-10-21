// PL23 follow-up: search player screens' visible text for each contract 3.2 "준비 중" item and the --ads-* direct-use note.
import { BASE, launch, newContext, login, save, sleep } from './lib.mjs';
import { gotoList, presetForm } from './presets.mjs';
const KEYS = ['준비', '변경 이력', '되돌리기', '사용자 CSS', '로고', '워터마크', '오디오', '라이브', '상속', '게시판', '내려받기', '즉시', '직접', '자동 삽입'];
const browser = await launch();
const context = await newContext(browser, { height: 1000 });
const page = await context.newPage();
const out = {};
const scan = async () => {
  const text = await page.evaluate(() => {
    const m = [...document.querySelectorAll('main')].find((x) => x.getClientRects().length) ?? document.body;
    return m.innerText;
  });
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  return Object.fromEntries(KEYS.map((k) => [k, lines.filter((l) => l.includes(k)).map((l) => l.slice(0, 160))]).filter(([, v]) => v.length));
};
await login(page);
await gotoList(page);
out.list = await scan();
for (const [k, h] of [['setup', '#/players/setup'], ['options', '#/players/options']]) {
  await page.goto(`${BASE}/${h}`);
  await sleep(1200);
  out[k] = await scan();
}
await gotoList(page);
await page.getByRole('button', { name: 'QA Video.js 중립 v2 수정', exact: true }).click();
await presetForm(page).waitFor();
await sleep(800);
out.editVideojs = await scan();
await page.goto(`${BASE}/#/players/new`);
await sleep(1000);
out.newForm = await scan();
save('PL23/keyword-scan.json', out);
console.log(JSON.stringify(out, null, 1));
await browser.close();
