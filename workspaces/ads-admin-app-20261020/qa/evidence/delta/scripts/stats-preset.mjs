// Stage 5 check: stats for a1-qa-preset-1 (PL16–PL19 playback) and a1-qa-video-1 (B11 figure must be unchanged by stage 5).
import { launch, newContext, login, save } from './lib.mjs';
import { queryStats } from './stats.mjs';
const browser = await launch();
const context = await newContext(browser);
const page = await context.newPage();
await login(page);
const out = {};
for (const vid of ['a1-qa-preset-1', 'a1-qa-video-1']) {
  const s = await queryStats(page, { '영상 ID': vid });
  out[vid] = { status: s.status, formStatus: s.formStatus, rows: (s.tables.find((t) => t[0]?.[0] === '광고 ID') ?? []) };
}
save('stage5-stats/result.json', out);
console.log(JSON.stringify(out, null, 1));
await browser.close();
