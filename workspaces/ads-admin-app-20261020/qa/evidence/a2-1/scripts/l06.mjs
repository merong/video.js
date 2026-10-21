// A2-1-QA L06: player screen language (preset language, else the page lang normalised as contract 4.4) while ad text
// stays Korean, for Video.js and 기본 video presets. Player text = control labels before play; ad text = during the pre-roll.
import { launch, newContext, save, shot, sleep } from './lib.mjs';
import { CONTENT, LOADER_TAG, clickPlay, openPage, placeholder, players, waitQa, writePaste } from './a2.mjs';

const JA = 'p-04uhxwffri';
const NATIVE = 'p-dz06hj5w17';
const NATIVE_JA = 'p-qpmllkxi62';
const el = (preset) => `${placeholder({ 'data-solad-player': true, 'data-video-id': 'a1-qa-video-1', 'data-src': CONTENT, 'data-preset': preset })}\n${LOADER_TAG}`;

const CASES = [
  { key: 'preset-ja/page-ko', preset: JA, lang: 'ko', expect: 'ja' },
  { key: 'empty/page-ko', preset: 'default', lang: 'ko', expect: 'ko' },
  { key: 'empty/page-en-US', preset: 'default', lang: 'en-US', expect: 'en' },
  { key: 'empty/page-ja-JP', preset: 'default', lang: 'ja-JP', expect: 'ja' },
  { key: 'empty/page-zh-Hant-TW', preset: 'default', lang: 'zh-Hant-TW', expect: 'en' },
  { key: 'empty/page-zh-SG', preset: 'default', lang: 'zh-SG', expect: 'zh-CN' },
  { key: 'empty/page-fr', preset: 'default', lang: 'fr', expect: 'en' },
  { key: 'empty/page-none', preset: 'default', lang: null, expect: 'en' },
  { key: 'native/page-en', preset: NATIVE, lang: 'en', expect: null },
  { key: 'native-ja/page-en', preset: NATIVE_JA, lang: 'en', expect: null },
];

const browser = await launch();
const result = {};
for (const c of CASES) {
  const name = `l06-${c.key.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}`;
  const url = writePaste(name, el(c.preset), { lang: c.lang });
  const context = await newContext(browser);
  const r = { page: `qa/fixtures/paste/a2-1-${name}.html`, htmlLang: c.lang, expectI18n: c.expect };
  try {
    const { page, solad } = await openPage(context, url);
    r.ready = (await waitQa(page, (q) => q.ready.length || q.errors.length, 12000)).ready;
    await sleep(1200);
    const before = (await players(page))[0];
    r.tree = before.tree;
    r.i18nLang = before.i18nLang;
    r.adsLang = before.ads?.lang ?? null;
    r.playerLabels = before.buttonLabels;
    await shot(page, `L06/${name}-player.png`);
    await clickPlay(page);
    const q = await waitQa(page, (s) => s.ads.some((a) => a.type === 'start'), 15000);
    await sleep(1500);
    const during = (await players(page))[0];
    r.adStarted = q.ads.some((a) => a.type === 'start');
    r.adText = during.visibleText.filter((t) => !t.startsWith('@'));
    r.adLabels = during.buttonLabels.filter((l) => !before.buttonLabels.includes(l));
    await shot(page, `L06/${name}-ad.png`);
    r.solad = solad;
  } catch (error) {
    r.error = String(error).slice(0, 1200);
  }
  result[c.key] = r;
  await context.close();
}
save('L06/result.json', result);
await browser.close();
