// No DOM/browser or product test suite. Uses the current built runtime-neutral parser.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parsePlaybackSchedule } from '../../../packages/extensions/ads/dist/default/core/playback.js';

const directory = new URL('./', import.meta.url);
const base = 'http://127.0.0.1:18766/demo-media/';
const cases = [];
const sha = (value) => createHash('sha256').update(value).digest('hex');
let requested;
for (const variant of ['requested', 'valid']) {
  const name = `ux-review-${variant}-20261018`;
  const response = await fetch(`${base}${name}.json.js`);
  if (response.status !== 200) throw new Error(`${variant}: HTTP ${response.status}`);
  // Explicit Response.json() acceptance of the raw-data .js transport.
  const schedule = await response.json();
  const original = JSON.parse(await readFile(new URL(`${name}.json`, directory), 'utf8'));
  if (JSON.stringify(schedule) !== JSON.stringify(original)) throw new Error('HTTP JSON mismatch');
  const parsed = parsePlaybackSchedule(schedule);
  const expected = variant === 'valid';
  if (parsed.ok !== expected) throw new Error(`${variant}: parser changed; retain evidence and reassess`);
  if (variant === 'requested') requested = schedule;
  cases.push({ id: `${variant}-fetch-json-parser`, status: 'PASS', httpStatus: response.status,
    contentType: response.headers.get('content-type'), videoId: schedule.videoId,
    expectedParserAccepted: expected, actualParserAccepted: parsed.ok,
    issues: parsed.ok ? [] : parsed.issues,
    meaning: expected ? 'valid data accepted; not browser playback proof' : 'negative input rejected; not zero-second-skip success' });
}

// The original fails at its first image. Isolate the post0 boundary independently
// in memory without altering either saved fixture or the product contract.
const postOnlyZero = structuredClone(requested);
postOnlyZero.breaks[0].ads[1].skipAfterSeconds = 1;
const postResult = parsePlaybackSchedule(postOnlyZero);
if (postResult.ok || !postResult.issues.some((issue) => issue.path === 'breaks[2].ads[0].skipAfterSeconds')) {
  throw new Error('post0 no longer rejected at expected path');
}
cases.push({ id: 'isolated-post0-negative', status: 'PASS', actualParserAccepted: false, issues: postResult.issues });

const served = await fetch('http://127.0.0.1:18766/assets/ads.js');
if (served.status !== 200) throw new Error('served bundle unavailable');
const bundle = Buffer.from(await served.arrayBuffer());
const parserPath = new URL('../../../packages/extensions/ads/dist/default/core/playback.js', directory);
const report = { observedAt: new Date().toISOString(),
  layer: 'actual HTTP fetch().json() plus built pure parser; no browser',
  parserPath: fileURLToPath(parserPath), parserSha256: sha(await readFile(parserPath)),
  servedBundleSha256: sha(bundle), servedBundleBytes: bundle.length, cases,
  browserStatus: 'NOT_RUN', rawZeroSkipUiStatus: 'BLOCKED_BY_C0; negative rejection expected' };
await writeFile(new URL('http-parser-evidence.json', directory), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ checks: cases.map(({id, status}) => ({id, status})), browserStatus: report.browserStatus }));
