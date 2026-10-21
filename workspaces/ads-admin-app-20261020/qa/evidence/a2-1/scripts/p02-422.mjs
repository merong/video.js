// A2-1-QA P02 follow-up: a 422 on theme.accentColor from a routed player-preset-save response. The earlier run kept the
// empty-name draft (drafts survive leaving the editor), so the name is filled back first. The route answers every save
// in this context, so nothing is written.
import { BASE, launch, newContext, login, save, shot, sleep } from './lib.mjs';

const SITE = 'p-qrgzuc8ste';
const browser = await launch();
const context = await newContext(browser, { width: 1280, height: 900 });
const page = await context.newPage();
const r = {};
const describe = (sel) => page.locator(sel).evaluate((el) => ({ invalid: el.getAttribute('aria-invalid'), described: (el.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean).map((id) => document.getElementById(id)?.textContent?.trim()) }));
let routed = 0;
await page.route((url) => new URL(url).searchParams.get('action') === 'player-preset-save', (route) => {
  routed += 1;
  return route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ ok: false, error: { code: 'validation', message: '입력값을 확인해 주세요.', fields: { 'theme.accentColor': '입력값을 확인해 주세요.' } } }) });
});
await login(page);
await page.goto(`${BASE}/#/players/edit/${SITE}`);
await page.getByRole('form', { name: '프리셋 수정' }).waitFor();
await sleep(900);
r.draftName = await page.locator('#aa-preset-name').inputValue();
await page.locator('#aa-preset-name').fill('QA Video.js 중립 v2');
await page.getByRole('button', { name: '프리셋 저장' }).click();
await sleep(1200);
r.routed = routed;
r.focus = await page.evaluate(() => ({ id: document.activeElement?.id, tag: document.activeElement?.tagName }));
r.accent = await describe('#aa-preset-theme-accentColor');
r.status = (await page.getByRole('status').allInnerTexts()).concat(await page.getByRole('alert').allInnerTexts()).filter(Boolean);
r.savebar = (await page.locator('.aa-savebar').innerText()).replace(/\s+/g, ' ').trim();
r.nav = (await page.locator('.aa-editor-nav').innerText()).replace(/\s+/g, ' ');
await shot(page, 'P02/server-422.png');
// Changing the field clears its server error.
await page.locator('#aa-preset-theme-accentColor').fill('#0f5133');
await page.keyboard.press('Tab');
await sleep(400);
r.afterEdit = { accent: await describe('#aa-preset-theme-accentColor'), savebar: (await page.locator('.aa-savebar').innerText()).replace(/\s+/g, ' ').trim() };
// Drop the draft so the stored preset stays as it is.
await page.goto(`${BASE}/#/players`);
await sleep(800);
r.dropDraftButtons = await page.getByRole('button', { name: '입력 버리기' }).count();
save('P02/server-422.json', r);
console.log(JSON.stringify(r, null, 1));
await browser.close();
