// PL16: paste the generator's Video.js MP4 and native MP4 codes unmodified into D8 pages and play them to the end.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { BASE, EV, launch, newContext, login, recordNetwork, save, sleep } from './lib.mjs';
import { playToEnd, trackEvents } from './play.mjs';

const PASTE = `${EV}/../fixtures/paste`;
const browser = await launch();
const result = { codes: {}, plays: [] };

// 1. Generate the two codes from the admin generator.
{
  const context = await newContext(browser, { height: 1600 });
  const page = await context.newPage();
  await login(page);
  await page.goto(`${BASE}/#/players/setup`);
  const region = page.getByRole('region', { name: '설치 코드 만들기' });
  await region.waitFor();
  await sleep(1000);
  const code = () => region.locator('pre, textarea, code').filter({ visible: true }).evaluateAll((els) => els.map((e) => (e.tagName === 'TEXTAREA' ? e.value : e.textContent)).sort((a, b) => b.length - a.length)[0] ?? null);
  for (const [key, preset] of [['videojs-mp4', 'QA Video.js 중립 v2 (기본 프리셋)'], ['native-mp4', 'QA 기본 video']]) {
    await region.getByRole('combobox', { name: '프리셋' }).selectOption({ label: preset });
    await region.getByRole('textbox', { name: '영상 ID' }).fill('a1-qa-preset-1');
    await region.getByRole('radio', { name: 'MP4', exact: true }).check();
    await sleep(600);
    const text = await code();
    const html = `<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>A1-QA PL16 ${key}</title>\n</head>\n<body>\n${text}\n</body>\n</html>\n`;
    fs.writeFileSync(`${PASTE}/pl16-${key}.html`, html);
    fs.writeFileSync(`${EV}/PL16/generator-${key}.txt`, text);
    result.codes[key] = { preset, length: text.length, sha256: crypto.createHash('sha256').update(text).digest('hex'), containedUnmodified: fs.readFileSync(`${PASTE}/pl16-${key}.html`, 'utf8').includes(text) };
  }
  await context.close();
}

// 2. Play each page as a cookie-less visitor.
for (const key of ['videojs-mp4', 'native-mp4']) {
  const context = await newContext(browser, { height: 900 });
  const net = recordNetwork(context);
  const events = trackEvents(context);
  const page = await context.newPage();
  try {
    await page.goto(`${BASE}/__qa/paste/pl16-${key}.html`);
    if (key === 'videojs-mp4') {
      await sleep(2000);
      result.theme = await page.evaluate(() => {
        const skin = document.querySelector('video-neutral-skin');
        const cs = skin && getComputedStyle(skin);
        return { skinDefined: Boolean(customElements.get('video-neutral-skin')), accent: cs?.getPropertyValue('--media-accent-color').trim(), radius: cs?.getPropertyValue('--media-border-radius').trim(), adsFont: cs?.getPropertyValue('--ads-font-size').trim(), css: [...document.styleSheets].map((s) => s.href).filter(Boolean) };
      });
    }
    const r = await playToEnd(page, { label: key, shotDir: 'PL16', net });
    r.events = events;
    r.schedule = net.filter((e) => e.action === 'schedule').map((e) => `${e.method} ${e.status}`);
    r.non2xx = net.filter((e) => e.status >= 400 || e.failed).map((e) => `${e.method} ${e.url.replace(BASE, '')} ${e.status} ${e.failed ?? ''}`);
    result.plays.push(r);
  } catch (error) {
    result.plays.push({ label: key, error: String(error).slice(0, 1200) });
    await page.screenshot({ path: `${EV}/PL16/${key}-error.png` }).catch(() => {});
  }
  await context.close();
}

save('PL16/result.json', result);
await browser.close();
