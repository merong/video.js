// L-3-QA fixture: one demo preroll (3 s /demo-media/ad.mp4) published on the isolated install's site target.
// Uses the logged-in admin session; prints only ids and statuses.
import { BASE, launch, login, save } from './lib.mjs';

const b = await launch();
const page = await (await b.newContext()).newPage();
await login(page);
const out = await page.evaluate(async () => {
  const boot = await (await fetch('/api/index.php?action=bootstrap')).json();
  const csrf = boot.data.csrfToken;
  const siteId = boot.data.site?.siteId ?? boot.data.site?.id ?? 'site-local';
  const post = async (action, body) => { const res = await fetch(`/api/index.php?action=${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }, body: JSON.stringify(body) }); return { status: res.status, body: await res.json() }; };
  const creative = await post('creative-save', { name: 'QA 프리롤 3초', url: '/demo-media/ad.mp4', mime: 'video/mp4', alt: 'QA 데모 광고' });
  const creativeId = creative.body.data?.creative?.creativeId;
  const target = { type: 'site', id: siteId };
  const saved = await post('schedule-save', { target, mode: 'replace', revision: 0, breaks: [{ breakId: 'qa-pre', position: 'pre', ads: [{ itemId: 'qa-pre-1', creativeId, creativeVersion: 1, skipAfterSeconds: null, clickUrl: null }] }] });
  const published = await post('schedule-publish', { target, revision: saved.body.data?.draft?.revision ?? 1 });
  return { siteId, creative: { status: creative.status, creativeId }, save: { status: saved.status, error: saved.body.error ?? null }, publish: { status: published.status, data: published.body.data ?? published.body.error } };
});
console.log(JSON.stringify(out));
save('fixture-preroll.json', out);
await b.close();
