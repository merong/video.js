// A2-E-QA E06: the public help tables (public/examples/options.js) against the admin option table
// (ui/src/player/player-options.ts) for every row, with the A2-E rows and preset fields picked out. Read only.
import { writeFileSync } from 'node:fs';
import { INSTALL_OPTIONS, PRESET_FIELDS, optionAnchor, fieldAnchor, stageText } from '../../../../../../integrations/ads-manager/public/examples/options.js';
import { playerOptions } from '../../../../../../integrations/ads-manager/ui/src/player/player-options.ts';

const out = { groups: [], diffs: [], a2e: {} };
const pick = (r) => ({ type: r.type, defaultValue: r.defaultValue, description: r.description, presetField: r.presetField ?? null });
for (const admin of playerOptions) {
  const pub = INSTALL_OPTIONS.find((g) => g.id === admin.id);
  const pubRows = (pub?.rows ?? []).filter((r) => !r.help);
  out.groups.push({ id: admin.id, admin: admin.rows.length, public: pubRows.length, publicHelpOnly: (pub?.rows ?? []).length - pubRows.length });
  const names = new Set([...admin.rows.map((r) => r.name), ...pubRows.map((r) => r.name)]);
  for (const name of names) {
    const a = admin.rows.find((r) => r.name === name);
    const p = pubRows.find((r) => r.name === name);
    if (!a || !p) { out.diffs.push({ group: admin.id, name, only: a ? 'admin' : 'public' }); continue; }
    for (const [k, v] of Object.entries(pick(a))) if (JSON.stringify(v) !== JSON.stringify(pick(p)[k])) out.diffs.push({ group: admin.id, name, field: k, admin: v, public: pick(p)[k] });
  }
}
out.publicOnlyGroups = INSTALL_OPTIONS.filter((g) => !playerOptions.some((a) => a.id === g.id)).map((g) => `${g.id}(${g.rows.length})`);
const want = { loaderData: ['data-captions'], element: [], controller: ['captions', 'preview.logo', 'preview'], exampleQuery: ['seekButtons', 'captions', 'captionsUrl', 'logo', 'logoPosition', 'logoWidth', 'logoOpacity', 'logoMargin', 'logoHref', 'logoAlt', 'logoHideDuringAds', 'logoHideWithControls'] };
for (const g of INSTALL_OPTIONS) for (const r of g.rows) {
  if (Object.values(want).flat().includes(r.name) || /captions|logo|seek/i.test(r.name)) out.a2e[`${g.id}:${r.name}`] = { anchor: optionAnchor(r.name, g.id), type: r.type, defaultValue: r.defaultValue, presetField: r.presetField ?? null, help: Boolean(r.help) };
}
out.presetFields = PRESET_FIELDS.filter((f) => /^controls\.|^logo\./.test(f.path)).map((f) => ({ path: f.path, anchor: fieldAnchor(f.path), stage: f.stage, stageText: stageText(f.stage), accepts: f.accepts, defaultText: f.defaultText, players: f.players }));
writeFileSync(new URL('../E06/options.json', import.meta.url), JSON.stringify(out, null, 2));
console.log(JSON.stringify({ groups: out.groups, publicOnly: out.publicOnlyGroups, diffs: out.diffs.length }, null, 0));
for (const d of out.diffs) console.log('DIFF', JSON.stringify(d).slice(0, 300));
for (const [k, v] of Object.entries(out.a2e)) console.log('ROW', k, v.anchor, v.presetField ?? '', v.help ? 'help' : '');
for (const f of out.presetFields) console.log('FIELD', f.path, f.anchor, f.stage, f.stageText, JSON.stringify(f.accepts), f.defaultText, f.players.join('/'));
