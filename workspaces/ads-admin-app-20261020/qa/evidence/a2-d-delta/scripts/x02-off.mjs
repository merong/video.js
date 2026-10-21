// A2-D-QA-DELTA X02 display-off half: the fixture presets keep 포스터 표시·제목 표시 at their defaults (on), so two
// temporary presets are created in the isolated QA DB through 새 프리셋 (Video.js with poster and title off, 기본 video
// with poster off). The schedule's pre-publish preview is prepared with each for the named video and read; the two
// presets are then deleted through the list's 삭제 so the DB returns to its three QA presets.
import { BASE, launch, newContext, login, consoleCollector, save, shot, sleep, EV } from './lib.mjs';
import { requestLog } from './demo.mjs';

const NAMED = 'qa-x02-named';
const LABEL = 'QA 이름 붙인 영상';
const TEMP = [
  { name: 'QA X02 표시 끔 videojs', type: 'videojs', off: ['aa-preset-display-poster', 'aa-preset-display-title'] },
  { name: 'QA X02 표시 끔 native', type: 'native', off: ['aa-preset-display-poster'] },
];
const browser = await launch();
const context = await newContext(browser, { width: 1280, height: 1400 });
const req = requestLog(context);
const page = await context.newPage();
page.on('dialog', (d) => d.dismiss().catch(() => {}));
const logs = consoleCollector(page);
const result = { created: [], cases: [], deleted: [] };
const frame = () => page.frames().find((f) => f.url().includes('/examples/preview.html'));
const readFrame = () => frame()?.evaluate(() => {
  const vp = document.querySelector('#player video-player');
  const v = document.querySelector('#player video');
  return { url: location.search, built: Boolean(v), tree: vp ? 'VIDEO-PLAYER' : v ? `${v.parentElement.tagName} > VIDEO` : null, contentTitle: vp?.getAttribute('content-title') ?? null, poster: vp?.getAttribute('poster') ?? v?.getAttribute('poster') ?? null };
}).catch(() => null);

try {
  await login(page);
  for (const t of TEMP) {
    await page.goto(`${BASE}/#/players/new`);
    await page.locator('#aa-preset-name').waitFor({ timeout: 15000 });
    await page.locator('#aa-preset-name').fill(t.name);
    await page.locator('#aa-preset-playerType').selectOption(t.type);
    await sleep(500);
    for (const id of t.off) if (await page.locator(`#${id}`).isChecked()) await page.locator(`#${id}`).click();
    t.checked = {};
    for (const id of ['aa-preset-display-poster', 'aa-preset-display-title']) t.checked[id] = { checked: await page.locator(`#${id}`).isChecked(), disabled: await page.locator(`#${id}`).isDisabled() };
    await page.getByRole('button', { name: '프리셋 저장' }).click();
    await page.waitForURL(/#\/players\/edit\/p-/, { timeout: 15000 });
    t.id = page.url().split('/').pop();
    result.created.push({ name: t.name, type: t.type, id: t.id, checked: t.checked });
  }

  await page.goto(`${BASE}/#/schedule`);
  const target = page.getByRole('form', { name: '편집할 대상' });
  await target.getByLabel('적용 단위', { exact: true }).selectOption({ label: '개별 영상' });
  await sleep(600);
  await page.locator('summary', { hasText: '독립 설치 영상의 게시판·분류 연결' }).click();
  const ctx = page.getByRole('form', { name: '영상 소속 연결' });
  await ctx.getByRole('textbox', { name: '영상 ID' }).fill(NAMED);
  await ctx.getByRole('textbox', { name: '영상 이름' }).fill(LABEL);
  await ctx.getByRole('button', { name: '영상 소속 저장' }).click();
  await sleep(1200);
  await target.getByLabel('적용 단위', { exact: true }).selectOption({ label: '사이트 기본' });
  await target.getByRole('button', { name: '편성 불러오기' }).click();
  await page.getByRole('heading', { name: '게시 전 미리보기' }).waitFor({ timeout: 15000 });
  await sleep(800);

  for (const t of TEMP) {
    const box = page.getByRole('textbox', { name: '고정 영상 ID' });
    await box.fill('');
    await box.pressSequentially(NAMED);
    await page.getByRole('combobox', { name: '적용할 프리셋' }).selectOption({ label: t.name });
    await sleep(300);
    await page.getByRole('button', { name: '미리보기 준비' }).click();
    const end = Date.now() + 25000;
    let f = await readFrame();
    while (Date.now() < end && !(f?.built && f.url.includes(t.type))) { await sleep(400); f = await readFrame(); }
    await sleep(1500);
    f = await readFrame();
    const visible = await frame()?.evaluate(() => {
      const deep = (root, sel) => { const out = [...root.querySelectorAll(sel)]; for (const el of root.querySelectorAll('*')) if (el.shadowRoot) out.push(...deep(el.shadowRoot, sel)); return out; };
      const shown = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05; };
      const root = document.querySelector('#player');
      return { posters: deep(root, 'img, media-poster').filter(shown).map((el) => `${el.tagName}:${(el.currentSrc || el.getAttribute('src') || '').split('/').pop()}`), titles: deep(root, '*').filter((el) => el.children.length === 0 && shown(el) && /QA 이름 붙인 영상/.test(el.textContent)).map((el) => el.tagName) };
    }).catch(() => null);
    result.cases.push({ preset: t.name, frame: f, visible });
    await page.locator('.sa-stage-frame iframe').first().screenshot({ path: `${EV}/X02/off-${t.type}.png` }).catch(() => {});
  }

  // Clean-up: delete the two temporary presets.
  for (const t of TEMP) {
    await page.goto(`${BASE}/#/players`);
    await page.getByRole('table').first().waitFor();
    await sleep(800);
    await page.getByRole('button', { name: `${t.name} 삭제`, exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: '삭제', exact: true }).click();
    await sleep(1200);
    result.deleted.push({ name: t.name, stillListed: await page.getByRole('cell', { name: t.name }).count() });
  }
} catch (error) {
  result.error = String(error).slice(0, 1500);
  await shot(page, 'X02/off-error.png', { fullPage: true }).catch(() => {});
}
result.api = req.actions().filter((a) => !/bootstrap|creatives/.test(a));
result.events = req.events();
result.console = logs.map((l) => `${l.type}: ${(l.text ?? '').slice(0, 200)}`);
await context.close();
save('X02/off.json', result);
await browser.close();
