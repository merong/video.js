// A2-E-QA-DELTA end step: delete the F01 temporary preset "QA 언어 ko" from the isolated QA database and record the list
// before and after (ids, names and revision only).
import { launch, newContext, login, save } from './lib.mjs';
import { adminCall } from './a2.mjs';

const ID = 'p-a7p2mbpngr';
const browser = await launch();
const context = await newContext(browser);
const page = await context.newPage();
await login(page);
const brief = (l) => ({ revision: l.data?.revision, presets: (l.data?.presets ?? []).map((p) => `${p.id} ${p.name}`) });
const before = brief(await adminCall(page, 'player-presets'));
const del = await adminCall(page, 'player-preset-delete', { revision: before.revision, id: ID });
const after = brief(await adminCall(page, 'player-presets'));
const out = { id: ID, before, delete: { status: del.status, ok: del.ok, code: del.code, message: del.message }, after };
save('00-env/preset-cleanup.json', out);
console.log(JSON.stringify(out, null, 1));
await browser.close();
