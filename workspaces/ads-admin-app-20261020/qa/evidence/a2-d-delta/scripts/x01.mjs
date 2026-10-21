// A2-D-QA-DELTA X01 (A2D-02 editor): on the saved Video.js preset p-i0aecb28w3 the 포스터 표시·제목 표시 checkboxes
// are set to the four combinations without saving; each time the preview frame's player content-title and poster and
// a shot of the frame are read. The native preset p-pchm59hhyv is read for the <video poster>. Nothing is saved.
import { BASE, launch, newContext, login, consoleCollector, save, shot, sleep } from './lib.mjs';
import { requestLog } from './demo.mjs';

const browser = await launch();
const context = await newContext(browser, { width: 1280, height: 1100 });
const req = requestLog(context);
const page = await context.newPage();
page.on('dialog', (d) => d.dismiss().catch(() => {}));
const logs = consoleCollector(page);
const result = { videojs: [], native: [] };
const frame = () => page.frames().find((f) => f.url().includes('/examples/preview.html'));

async function readFrame() {
  const f = frame();
  if (!f) return null;
  const p = await f.evaluate(() => {
    const vp = document.querySelector('#player video-player');
    const v = document.querySelector('#player video');
    const i18n = document.querySelector('#player media-i18n');
    return { tree: vp ? `${i18n?.tagName}[lang=${i18n?.getAttribute('lang')}] > VIDEO-PLAYER` : v ? `${v.parentElement.tagName} > VIDEO` : null, playerAttrs: vp ? { contentTitle: vp.getAttribute('content-title'), poster: vp.getAttribute('poster') } : null, media: v ? { poster: v.getAttribute('poster') } : null, mediaId: v?.id ?? null };
  });
  const visible = await f.evaluate(() => {
    const deep = (root, sel) => { const out = [...root.querySelectorAll(sel)]; for (const el of root.querySelectorAll('*')) if (el.shadowRoot) out.push(...deep(el.shadowRoot, sel)); return out; };
    const shown = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05; };
    const root = document.querySelector('#player');
    const posters = deep(root, 'img, media-poster, [class*="poster"]').filter(shown).map((el) => `${el.tagName}:${(el.currentSrc || el.getAttribute('src') || '').split('/').pop()}`);
    const titles = deep(root, '*').filter((el) => el.children.length === 0 && shown(el) && /Grok 해안 도시 장면/.test(el.textContent)).map((el) => `${el.tagName}.${String(el.className).slice(0, 30)}`);
    return { posters, titles };
  });
  return { mediaId: p?.mediaId, tree: p?.tree, contentTitle: p?.playerAttrs?.contentTitle ?? null, poster: p?.playerAttrs?.poster ?? p?.media?.poster ?? null, videoPoster: p?.media?.poster ?? null, ...visible };
}

async function set(id, on) {
  const box = page.locator(`#${id}`);
  if ((await box.isChecked()) !== on) await box.click();
}

async function waitFrame(predicate, timeout = 25000) {
  const end = Date.now() + timeout;
  let last = await readFrame().catch(() => null);
  while (Date.now() < end && !predicate(last)) {
    await sleep(400);
    last = await readFrame().catch(() => null);
  }
  return last;
}

try {
  await login(page);
  for (const [key, id] of [['videojs', 'p-i0aecb28w3'], ['native', 'p-pchm59hhyv']]) {
    await page.goto(`${BASE}/#/players/edit/${id}`);
    await page.getByRole('heading', { name: '플레이어 미리보기' }).waitFor({ timeout: 15000 });
    await sleep(3500);
    const initial = { poster: await page.locator('#aa-preset-display-poster').isChecked(), title: await page.locator('#aa-preset-display-title').isChecked().catch(() => null), titleDisabled: await page.locator('#aa-preset-display-title').isDisabled().catch(() => null) };
    result[`${key}Initial`] = { ...initial, frame: await readFrame() };
    const combos = key === 'videojs' ? [[true, true], [true, false], [false, true], [false, false]] : [[true, null], [false, null]];
    for (const [poster, title] of combos) {
      await set('aa-preset-display-poster', poster);
      if (title !== null) await set('aa-preset-display-title', title);
      await sleep(600);
      const r = await waitFrame((x) => x && x.tree && Boolean(x.poster) === poster && (title === null || Boolean(x.contentTitle) === title));
      const label = `${key}-poster-${poster ? 'on' : 'off'}${title === null ? '' : `-title-${title ? 'on' : 'off'}`}`;
      result[key].push({ label, poster, title, frame: r });
      await page.locator('.sa-stage-frame iframe').first().screenshot({ path: `${(await import('./lib.mjs')).EV}/X01/${label}.png` }).catch(() => {});
    }
    await shot(page, `X01/${key}-editor.png`);
  }
} catch (error) {
  result.error = String(error).slice(0, 1500);
  await shot(page, 'X01/error.png', { fullPage: true }).catch(() => {});
}
result.events = req.events();
result.console = logs.map((l) => `${l.type}: ${(l.text ?? '').slice(0, 200)}`);
await context.close();
save('X01/result.json', result);
await browser.close();
