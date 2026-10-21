// A1-QA-DELTA PL09 + ColorField: `#GGG` blocks both the save button and Enter (no request); the colour picker and
// the text box share the same description and error; labelAside HelpLink does not leak into control names. No save.
import { BASE, launch, newContext, login, recordNetwork, consoleCollector, save, shot, sleep, apiCalls, deepActive } from './lib.mjs';
import { presetForm, fill, liveTexts } from './presets.mjs';

const browser = await launch();
const context = await newContext(browser, { height: 1400 });
const net = recordNetwork(context);
const page = await context.newPage();
const logs = consoleCollector(page);
const result = {};
const mark = () => (net.length ? net[net.length - 1].t + 1 : 0);
const calls = (t) => apiCalls(net, t).map((c) => `${c.method} ${c.action} ${c.status}`);

/** Accessible name and description of the text box and the picker of one ColorField, via the CDP accessibility tree. */
async function colorField(label) {
  const box = presetForm(page).getByRole('textbox', { name: label, exact: true });
  const wrap = box.locator('xpath=ancestor::*[contains(concat(" ",normalize-space(@class)," ")," sa-color ")][1]');
  const pick = wrap.locator('input[type="color"], [role="button"], button').first();
  const describe = (loc) => loc.evaluate((el) => {
    const ids = (attr) => (el.getAttribute(attr) || '').split(/\s+/).filter(Boolean);
    const text = (id) => {
      const n = document.getElementById(id);
      return n ? (n.hidden ? n.textContent.trim() + ' [hidden]' : n.textContent.trim()) : null;
    };
    return { tag: el.tagName, type: el.getAttribute('type'), labelledBy: ids('aria-labelledby').map(text), describedBy: ids('aria-describedby').map(text), invalid: el.getAttribute('aria-invalid'), labels: [...(el.labels ?? [])].map((l) => l.textContent.trim()) };
  });
  const snapshot = await wrap.locator('xpath=..').ariaSnapshot().catch(() => null);
  return { text: await describe(box), picker: (await pick.count()) ? await describe(pick) : null, snapshot };
}

async function accessibleNames(labels) {
  const cdp = await context.newCDPSession(page);
  const { nodes } = await cdp.send('Accessibility.getFullAXTree');
  const out = {};
  for (const n of nodes) {
    const name = n.name?.value ?? '';
    if (!name || !labels.some((l) => name.startsWith(l))) continue;
    if (!['textbox', 'spinbutton', 'combobox', 'ColorWell', 'button'].includes(n.role?.value)) continue;
    (out[name] ??= []).push({ role: n.role?.value, description: n.description?.value ?? null, invalid: n.properties?.find((p) => p.name === 'invalid')?.value?.value ?? null });
  }
  await cdp.detach();
  return out;
}

try {
  await login(page);
  await page.goto(`${BASE}/#/players/new`);
  await presetForm(page).waitFor();
  await sleep(1000);
  await fill(page, { 이름: 'QA PL09 delta (저장 안 함)' });

  const COLOR_LABELS = ['강조색', '강조 글자색', '테두리 색', '광고 음량 막대 색'];
  result.labelNames = await accessibleNames([...COLOR_LABELS, '모서리 둥글기', '광고 글자 크기', '이름', '스킨']);
  result.namesWithHelp = Object.keys(result.labelNames).filter((n) => /도움말|\?/.test(n));
  result.colorEmpty = await colorField('강조색');

  // Type #GGG, leave the field.
  const accent = presetForm(page).getByRole('textbox', { name: '강조색', exact: true });
  await accent.fill('#GGG');
  await page.keyboard.press('Tab');
  await sleep(300);
  result.colorInvalid = await colorField('강조색');
  result.namesAfterInvalid = await accessibleNames(['강조색']);
  await shot(page, 'PL09/accent-GGG.png', { fullPage: true });

  // Save button.
  let t = mark();
  await presetForm(page).getByRole('button', { name: '프리셋 저장' }).click();
  await sleep(1500);
  result.saveClick = { api: calls(t), live: await liveTexts(page), focus: await deepActive(page), value: await accent.inputValue() };
  await shot(page, 'PL09/save-click.png', { fullPage: true });

  // Enter in the field.
  await accent.focus();
  t = mark();
  await page.keyboard.press('Enter');
  await sleep(1500);
  result.enter = { api: calls(t), live: await liveTexts(page), focus: await deepActive(page), value: await accent.inputValue() };

  // Enter in another field while 강조색 still shows #GGG.
  const radius = presetForm(page).getByRole('spinbutton', { name: '모서리 둥글기 (px)', exact: true });
  await radius.fill('10');
  t = mark();
  await page.keyboard.press('Enter');
  await sleep(1500);
  result.enterOtherField = { api: calls(t), live: await liveTexts(page), focus: await deepActive(page), accent: await accent.inputValue() };
  await shot(page, 'PL09/enter-other-field.png', { fullPage: true });

  // Valid upper-case value is normalised; nothing is saved.
  await accent.fill('#ABCDEF');
  await page.keyboard.press('Tab');
  await sleep(300);
  result.upper = { value: await accent.inputValue(), field: await colorField('강조색') };
  result.allApi = calls(0).filter((c) => !/^GET /.test(c));
} catch (error) {
  result.error = String(error).slice(0, 1500);
  await shot(page, 'PL09/error.png', { fullPage: true }).catch(() => {});
}
result.console = logs;
save('PL09/result.json', result);
await browser.close();
