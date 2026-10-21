// HL10 order/alt/status, HL13 standalone term set, HL14 DOM termIds vs HF 2절 + PF 5절.
import { BASE, launch, newContext, login, save, sleep } from './lib.mjs';
const HF = 'ad-break pre-roll mid-roll post-roll ad-item creative creative-source alt-text click-through-url archive image-display-time skip-offset ad-skip target-scope inherit replace disabled fixed-video-id video-context draft draft-revision revision-conflict publish publish-version preview play-test start completion click click-through-rate stats-csv advertiser campaign line-item approval tier delivery-status impression house-ad ad-request'.split(' ');
const PF = 'player-preset player-default-preset player-type player-skin player-theme-property player-accent-color player-object-fit player-ad-overlay player-ad-language player-install-snippet player-media-engine player-video-id'.split(' ');
const browser = await launch();
const context = await newContext(browser);
const page = await context.newPage();
await login(page);
await page.goto(`${BASE}/#/help`);
await sleep(1500);
const terms = await page.evaluate(() => [...document.querySelectorAll('article.sa-term')].map((a) => {
  const h = a.querySelector('h4');
  const body = a.querySelector('p.sa-body');
  const fig = a.querySelector('figure');
  const stage = fig?.querySelector('.sa-motion-stage');
  const cat = a.closest('section, [role=region]')?.querySelector('h3')?.textContent.trim() ?? null;
  return {
    id: h?.id?.replace('sa-help-', ''), headingIds: a.querySelectorAll('[id^="sa-help-"]').length, title: h?.textContent.trim(), status: a.querySelector('.sa-badge')?.textContent.trim(), statusKey: a.querySelector('.sa-badge')?.dataset.st, category: cat,
    bodyBeforeFigure: Boolean(body && fig && (body.compareDocumentPosition(fig) & Node.DOCUMENT_POSITION_FOLLOWING)),
    figRole: stage?.getAttribute('role') ?? null, figLabel: stage?.getAttribute('aria-label') ?? null, figHidden: stage?.getAttribute('aria-hidden') ?? null,
    body: body?.textContent.trim(),
  };
}));
const menuStatus = await page.evaluate(() => [...document.querySelectorAll('section, [role=region]')].find((s) => s.querySelector('h2')?.textContent.trim() === '기능 안내')?.querySelectorAll('li') ?? []).catch(() => []);
const menu = await page.evaluate(() => {
  const region = [...document.querySelectorAll('h3')].find((h) => h.textContent.trim() === '메뉴별 화면')?.nextElementSibling;
  return [...(region?.querySelectorAll(':scope > li') ?? [])].map((li) => ({ name: li.querySelector('a')?.textContent.trim(), status: [...li.querySelectorAll('.sa-badge')].map((b) => b.textContent.trim()), text: li.querySelector('p')?.textContent.trim() }));
});
const notes = await page.evaluate(() => [...document.querySelectorAll('[role=note], .sa-note, aside')].map((n) => n.textContent.replace(/\s+/g, ' ').trim()).slice(0, 5));
void menuStatus;
const ids = terms.map((t) => t.id);
const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
const out = {
  count: terms.length,
  HL14: { dom: ids, missingFromDomHF: HF.filter((x) => !ids.includes(x)), missingFromDomPF: PF.filter((x) => !ids.includes(x)), notInFacts: ids.filter((x) => !HF.includes(x) && !PF.includes(x)), duplicates: dup, withoutHeading: terms.filter((t) => t.headingIds !== 1).map((t) => t.id) },
  HL13: { hasHouseAd: ids.includes('house-ad'), hasAdRequest: ids.includes('ad-request'), mockTerms: terms.filter((t) => ['advertiser', 'campaign', 'line-item', 'approval', 'tier', 'delivery-status', 'impression'].includes(t.id)).map((t) => `${t.id}:${t.status}`) },
  HL10: { orderViolations: terms.filter((t) => !t.bodyBeforeFigure).map((t) => t.id), altMissing: terms.filter((t) => !(t.figRole === 'img' && t.figLabel) && t.figHidden !== 'true').map((t) => t.id), statusCounts: terms.reduce((m, t) => ((m[t.status] = (m[t.status] ?? 0) + 1), m), {}), nonActive: terms.filter((t) => t.statusKey !== 'active').map((t) => `${t.id}:${t.status}`), menu, notes, previewVsPlayTest: terms.filter((t) => ['preview', 'play-test'].includes(t.id)).map((t) => ({ id: t.id, body: t.body })) },
  terms,
};
// player-video-id alias: where does it resolve?
await page.goto(`${BASE}/#/help/player-video-id`);
await sleep(800);
out.HL14.aliasPlayerVideoId = await page.evaluate(() => ({ hash: location.hash, active: document.activeElement?.id, text: document.activeElement?.textContent?.trim().slice(0, 40) }));
save('HL10/terms.json', out);
console.log(JSON.stringify({ count: out.count, HL14: { ...out.HL14, dom: undefined }, HL13: out.HL13, HL10: { ...out.HL10, menu: out.HL10.menu.map((m) => `${m.name}:${m.status.join('/')}`) } }, null, 1));
await browser.close();
