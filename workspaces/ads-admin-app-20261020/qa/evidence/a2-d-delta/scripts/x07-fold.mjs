import { BASE, launch, newContext, login, save, shot, sleep } from '/Users/brian/works/tools/videojs/video.js/workspaces/ads-admin-app-20261020/qa/evidence/a2-d-delta/scripts/lib.mjs';
const browser = await launch();
const result = {};
for (const width of [768, 390]) {
  const context = await newContext(browser, { width, height: 1000 });
  const page = await context.newPage();
  await login(page);
  const state = async (label) => {
    await page.getByRole('heading', { name: '플레이어 미리보기' }).waitFor({ timeout: 15000 });
    await sleep(800);
    const b = page.locator('aside.sa-ppv .sa-ppv-h button[aria-expanded]');
    return { label, url: page.url().replace(BASE, ''), expanded: await b.getAttribute('aria-expanded'), text: await b.innerText() };
  };
  const steps = [];
  const go = async (hash) => { await page.goto(`${BASE}/${hash}`); };
  const open = async () => { await page.locator('aside.sa-ppv .sa-ppv-h button[aria-expanded="false"]').click(); await sleep(400); };
  // a: fresh document load of rounded
  await page.goto('about:blank'); await go('#/players/edit/rounded'); steps.push(await state('fresh load rounded'));
  // b: open on rounded, hash-navigate to accent
  await open(); steps.push(await state('rounded after 열기'));
  await go('#/players/edit/accent'); steps.push(await state('hash nav rounded(open) → accent'));
  // c: via the list
  await go('#/players'); await page.getByRole('table').first().waitFor(); await sleep(500);
  await go('#/players/edit/default'); steps.push(await state('hash nav accent(open) → list → default'));
  // d: via list row link click
  await go('#/players'); await page.getByRole('table').first().waitFor(); await sleep(500);
  const link = page.getByRole('link', { name: '둥근 테두리', exact: true }).or(page.getByRole('button', { name: '둥근 테두리 보기', exact: true })).first();
  steps.push({ label: 'list link count', count: await link.count() });
  // e: editor of a saved preset after a built-in was opened
  await go('#/players/edit/p-i0aecb28w3'); steps.push(await state('hash nav → editor p-i0aecb28w3'));
  // f: reload on accent
  await go('#/players/edit/accent'); await page.reload(); steps.push(await state('reload accent'));
  await shot(page, `X07/fold-${width}.png`);
  result[width] = steps;
  await context.close();
}
save('X07/fold.json', result);
console.log(JSON.stringify(result, null, 1));
await browser.close();
