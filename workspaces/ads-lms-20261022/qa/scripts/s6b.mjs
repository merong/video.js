// L-3-QA scenario 6 follow-up at 390: is the disabled captions menu item actually visible (box, clipping, display)?
import { BASE, launch, save, sleep } from './lib.mjs';
const b = await launch();
const out = {};
for (const H of [844]) {
  const page = await (await b.newContext({ viewport: { width: 390, height: H } })).newPage();
  const player = page.getByRole('group', { name: '미디어 플레이어' });
  await page.goto(`${BASE}/examples/lecture.html`);
  await player.getByRole('button', { name: '재생', exact: true }).waitFor({ timeout: 15000 });
  await sleep(1500);
  await player.getByRole('button', { name: '설정' }).click();
  await sleep(600);
  const items = player.getByRole('menuitem');
  out.items = [];
  for (let i = 0; i < await items.count(); i++) {
    const it = items.nth(i);
    out.items.push({ text: (await it.innerText()).replace(/\s+/g, ' ').trim(), visible: await it.isVisible(), box: await it.boundingBox(), style: await it.evaluate((e) => { const c = getComputedStyle(e); return { display: c.display, visibility: c.visibility, opacity: c.opacity }; }) });
  }
  const hitAt = (x, y) => page.evaluate(([x, y]) => { let el = document.elementFromPoint(x, y); for (let i = 0; i < 10 && el?.shadowRoot; i++) { const inner = el.shadowRoot.elementFromPoint(x, y); if (!inner || inner === el) break; el = inner; } return el ? `${el.localName}.${String(el.className).slice(0, 50)} «${(el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 30)}»` : null; }, [x, y]);
  for (const it of out.items) it.topElementAtCenter = await hitAt(it.box.x + it.box.width / 2, it.box.y + it.box.height / 2);
  await page.screenshot({ path: '/Users/brian/works/tools/videojs/video.js/workspaces/ads-lms-20261022/qa/evidence/s6-390-menu.png', clip: { x: 0, y: 300, width: 390, height: 220 } });
  out.menuBox = await player.getByRole('menu').boundingBox();
  out.playerBox = await player.boundingBox();
  await page.context().close();
}
console.log(JSON.stringify(out, null, 1));
save('s6-390-menu-visibility.json', out);
await b.close();
