// A2-E-QA E01 API: built-in list order and names, theme.borderColor #rrggbb/#rrggbbaa, other colors refuse 8 digits,
// uppercase handling, the public render css --media-border-color. Two fixture presets are saved in the isolated DB
// (QA 테두리 8자리 #00000026, QA 테두리 투명색 #ff000000) for the editor checks; nothing else is kept.
import { BASE, launch, newContext, login, save } from './lib.mjs';
import { adminCall } from './a2.mjs';

const browser = await launch();
const context = await newContext(browser);
const page = await context.newPage();
const result = {};
await login(page);

const list = await adminCall(page, 'player-presets');
result.list = { status: list.status, defaultPresetId: list.data?.defaultPresetId, revision: list.data?.revision, presets: list.data?.presets.map((p) => ({ id: p.id, name: p.name, builtIn: p.builtIn, playerType: p.playerType, theme: p.theme })) };
const pub = async (id) => page.evaluate(async (id) => { const r = await fetch(`/api/index.php?action=player-preset&id=${id}`, { credentials: 'omit' }); const b = await r.json(); return { status: r.status, theme: b.data?.preset?.theme ?? null, css: b.data?.render?.css ?? b.data?.css ?? null, keys: Object.keys(b.data ?? {}), renderKeys: Object.keys(b.data?.render ?? {}), logo: b.data?.render?.logo }; }, id);
result.public = {};
for (const id of ['default', 'flat', 'rounded', 'accent']) result.public[id] = await pub(id);

const base = (theme, extra = {}) => ({ id: null, name: 'QA A2-E 색 검사', playerType: 'videojs', theme, ...extra });
let revision = list.data.revision;
const attempt = async (label, preset, keep = false) => {
  const r = await adminCall(page, 'player-preset-save', { revision, preset });
  const entry = { label, status: r.status, code: r.code, fields: r.fields, message: r.message, saved: r.data?.preset ? { id: r.data.preset.id, theme: r.data.preset.theme } : null };
  if (r.status === 200) {
    revision = r.data.revision;
    if (!keep) {
      const d = await adminCall(page, 'player-preset-delete', { revision, id: r.data.preset.id });
      entry.deleted = d.status;
      revision = d.data?.revision ?? revision;
    }
  }
  return entry;
};
result.save = [];
result.save.push(await attempt('border 6', base({ borderColor: '#112233' })));
result.save.push(await attempt('border 8 #00000026 (keep)', { ...base({ borderColor: '#00000026' }), name: 'QA 테두리 8자리' }, true));
result.save.push(await attempt('border 8 #ff000000 (keep)', { ...base({ borderColor: '#ff000000' }), name: 'QA 테두리 투명색' }, true));
result.save.push(await attempt('border 8 upper #00000026 -> #0000002A? use #ABCDEF12', base({ borderColor: '#ABCDEF12' })));
result.save.push(await attempt('border 6 upper', base({ borderColor: '#ABCDEF' })));
result.save.push(await attempt('accent 6 upper', base({ accentColor: '#ABCDEF' })));
result.save.push(await attempt('border 7 digits', base({ borderColor: '#0000002' })));
result.save.push(await attempt('border 9 digits', base({ borderColor: '#000000261' })));
result.save.push(await attempt('border no hash', base({ borderColor: '00000026' })));
result.save.push(await attempt('accent 8', base({ accentColor: '#cdf35280' })));
result.save.push(await attempt('accentText 8', base({ accentTextColor: '#00000080' })));
result.save.push(await attempt('ads.accent 8', base({}, { ads: { accentColor: '#cdf35280' } })));
result.save.push(await attempt('native + border 8', { ...base({ borderColor: '#00000026' }), playerType: 'native' }));

const after = await adminCall(page, 'player-presets');
result.after = after.data.presets.map((p) => ({ id: p.id, name: p.name, builtIn: p.builtIn, borderColor: p.theme?.borderColor ?? null }));
for (const p of after.data.presets.filter((p) => /^QA 테두리/.test(p.name))) result.public[p.id] = await pub(p.id);
await context.close();
save('E01/api.json', result);
await browser.close();
