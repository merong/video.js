// PL11: contrast warnings for accent/accent-text pairs, tied to the field, never blocking save. Temporary preset removed at the end.
import { BASE, launch, newContext, login, recordNetwork, consoleCollector, save, sleep, apiCalls } from './lib.mjs';
import { liveTexts, presetForm, field, fill, gotoList } from './presets.mjs';

const NAME = 'QA PL11 대비';
const CASES = [['yellow-white', '#ffff00', '#ffffff'], ['navy-white', '#0a3d91', '#ffffff'], ['navy-blank', '#000080', '']];
const browser = await launch();
const context = await newContext(browser, { height: 1400 });
const net = recordNetwork(context);
const page = await context.newPage();
const logs = consoleCollector(page);
const result = { cases: [] };
const mark = () => (net.length ? net[net.length - 1].t + 1 : 0);
const described = (label) => field(page, label).evaluate((el) => ({
  ariaInvalid: el.getAttribute('aria-invalid'),
  describedBy: (el.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean).map((id) => document.getElementById(id)?.textContent.trim() ?? null),
}));

try {
  await login(page);
  await page.goto(`${BASE}/#/players/new`);
  await presetForm(page).waitFor();
  await sleep(1000);
  await fill(page, { 이름: NAME });
  for (const [key, accent, text] of CASES) {
    const c = { key, accent, text };
    await fill(page, { 강조색: accent, '강조 글자색': text });
    await field(page, '이름').focus();
    await sleep(600);
    c.accent = await described('강조색');
    c.accentText = await described('강조 글자색');
    c.warnings = await presetForm(page).getByText(/대비|4\.5/).filter({ visible: true }).allInnerTexts();
    await presetForm(page).getByRole('region', { name: '스킨 테마' }).screenshot({ path: `${(await import('./lib.mjs')).EV}/PL11/${key}.png` });
    const t = mark();
    c.saveEnabled = await presetForm(page).getByRole('button', { name: '프리셋 저장' }).isEnabled();
    await presetForm(page).getByRole('button', { name: '프리셋 저장' }).click();
    await sleep(1500);
    c.save = { api: apiCalls(net, t).map((x) => `${x.method} ${x.action} ${x.status} ${x.error?.code ?? ''}`), live: await liveTexts(page) };
    result.cases.push(c);
  }
  // Remove the temporary preset.
  await gotoList(page);
  await page.getByRole('button', { name: `${NAME} 삭제`, exact: true }).click();
  await page.getByRole('dialog').filter({ visible: true }).getByRole('button', { name: '삭제', exact: true }).click();
  await sleep(1200);
  result.cleanup = apiCalls(net).filter((c) => c.action === 'player-preset-delete').map((c) => c.status);
} catch (error) {
  result.error = String(error).slice(0, 1500);
}
result.console = logs;
save('PL11/result.json', result);
await browser.close();
