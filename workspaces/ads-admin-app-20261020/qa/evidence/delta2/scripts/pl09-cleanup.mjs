// PL09 cleanup: delete the two "QA PL09 검증" presets saved by the #GGG and #ABCDEF cases (app Dialog).
import { launch, newContext, login, recordNetwork, save, sleep, apiCalls } from './lib.mjs';
import { gotoList, listJson } from './presets.mjs';

const browser = await launch();
const context = await newContext(browser, { height: 1000 });
const net = recordNetwork(context);
const page = await context.newPage();
const result = {};
await login(page);
result.before = (await listJson(page)).data.presets.map((p) => `${p.id} ${p.name} accent=${p.theme.accentColor}`);
for (let i = 0; i < 2; i++) {
  await gotoList(page);
  await page.getByRole('button', { name: 'QA PL09 검증 삭제', exact: true }).first().click();
  await page.getByRole('dialog').filter({ visible: true }).getByRole('button', { name: '삭제', exact: true }).click();
  await sleep(1200);
}
result.api = apiCalls(net).filter((c) => c.method === 'POST').map((c) => `${c.action} ${c.status}`);
result.after = (await listJson(page)).data.presets.map((p) => `${p.id} ${p.name}`);
save('PL09/cleanup.json', result);
await browser.close();
