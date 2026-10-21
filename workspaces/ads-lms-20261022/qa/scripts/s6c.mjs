// L-3-QA scenario 6 comparison: the default demo (no chapters track) at 390: are all settings menu items on top?
import { BASE, launch, save, sleep } from './lib.mjs';
const b = await launch();
const page = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
const player = page.getByRole('group', { name: '미디어 플레이어' }).first();
await page.goto(`${BASE}/examples/index.html`);
await player.getByRole('button', { name: '재생', exact: true }).waitFor({ timeout: 15000 });
await sleep(1500);
await player.getByRole('button', { name: '설정' }).click();
await sleep(600);
const hitAt = (x, y) => page.evaluate(([x, y]) => { let el = document.elementFromPoint(x, y); for (let i = 0; i < 10 && el?.shadowRoot; i++) { const inner = el.shadowRoot.elementFromPoint(x, y); if (!inner || inner === el) break; el = inner; } return el ? `${el.localName}.${String(el.className).slice(0, 50)}` : null; }, [x, y]);
const items = player.getByRole('menuitem');
const out = { playerBox: await player.boundingBox(), items: [] };
for (let i = 0; i < await items.count(); i++) { const box = await items.nth(i).boundingBox(); out.items.push({ text: (await items.nth(i).innerText()).replace(/\s+/g, ' ').trim(), box, top: await hitAt(box.x + box.width / 2, box.y + box.height / 2) }); }
console.log(JSON.stringify(out));
save('s6-390-default-demo-menu.json', out);
await b.close();
