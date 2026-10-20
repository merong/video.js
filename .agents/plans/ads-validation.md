# Ads v1 validation and handoff

Observed 2026-10-18 KST. The agreed local implementation is present, known integration defects were repaired, and the tested paths below passed. This is not customer deployment or universal browser compatibility approval.

## Delivered source

- `packages/extensions/ads/`: private optional package, runtime-neutral JSON/scheduler, DOM controller, HTML element, ESM CDN output.
- `integrations/ads-manager/`: PHP/PDO manager, immutable creative/publication versions, upload/URL registration, preview, signed collection, statistics/CSV, standalone and GnuBoard adapters.
- Root integration changes: ads TS project reference, commitlint scope and 22-line ads-only lockfile importer. No unrelated dependency upgrade.
- Original baseline: `2d40a220e`; sibling `../v10` reference `9cb7abec` remained read-only. No commit, push or customer deployment occurred.

## Herdr organization

Five real GPT-6-Astra xhigh sessions: source reviewer, player implementer, API implementer, UI implementer and independent QA. Root assigned work, owned shared contracts/integration, inspected reported findings and reran checks.

Actual `herdr tab list --workspace wB` showed every tab at two panes or fewer. Ads tabs: `wB:t6` player/review (2), `wB:t7` API/UI (2), `wB:t8` QA (1). Existing user panes were preserved. Session identifiers and final task status are in `ads-orchestration.json`.

## Executed checks

Node commands used Node 24.14.0 and pnpm 12.6.0 through `mise exec node@24.14.0 -- corepack pnpm@12.6.0 --config.verify-deps-before-run=false`.

| Layer | Actual result | Evidence boundary |
| --- | --- | --- |
| Ads unit/DOM/HTML | Root final `pnpm -F @videojs/ads test`: 130 passed in 6 files | Simulated media observations; browser proof is separate below |
| UI components | Root: 48 passed in 4 files | Mocked form/API boundary |
| Build/types | Package build and scoped types passed; root whole `pnpm typecheck` passed after final changes | Native TypeScript preview warnings are toolchain notices |
| Workspace | Root `pnpm check:workspace`: 11 passed after adding missing ads commitlint scope | No later manifest/rule change |
| PHP persistence | Actual isolated MySQL backend suite: 70 assertions passed | Separate random backend table prefix; not production DB |
| HTTP installation/runtime | Root `python3 integrations/ads-manager/tests/backend/http_test.py`: 110 passed | Fresh SQLite installation, real ephemeral PHP server, auth/CSRF/uploads/range/persistence |
| GnuBoard keys | Root actual `gnuboard_keys.php`: 5 passed | Native host bootstrap, real public post, main/unknown/multikey/callback checks |
| GnuBoard HTTP | UI agent: 32 passed, 0 failed; root inspected detailed results | Real super/member/read-only identities, content permissions and consumed CSRF rotation |
| Independent HTTP | QA: 55 checks | Auth, publication/overrides, immutable versions, collector and statistics oracle |
| Source review | Analyst final `SOURCE READY`; root inspected affected code | Three final initialization/postroll findings closed; not blanket platform approval |
| Formatting | Package/UI scoped lint and `git diff --check` passed | Repository formatter excludes HTML/Markdown examples; an attempted example-only formatter run had no eligible targets |

Final built and served ads bundle: SHA-256 `10812294dc033576dc3c03c5015b1200e7b5e16d691f21f62cf55a4b93373e08`, 59,843 bytes.

## Actual browser and persistence

Independent QA used one Ego TaskSpace 57, p1; root used p2 for GnuBoard and serialized final playback rounds to avoid hidden-tab clock interference.

- Actual standalone forms: login, URL creative, MP4 upload, trusted video context, draft save and publish. A draft alone did not change public playback. GIF/WebM registration, hierarchy/disabled/inherit/version policies also have real HTTP evidence.
- Final MP4 with Video.js skin: MP4 current-only skip, PNG, GIF and WebM in order; seek to 25 starts only mid10; back to 5 then forward to 22 starts only mid20; postroll starts/completes and content remains ended. Fourteen actual events, zero playback diagnostics.
- Native, SPF HLS and hls.js postroll: each start/complete, no play rejection, content remains ended. HLS requests master, child playlist, initialization MP4 and segments and plays actual content.
- Real missing media emits error and advances; replacing content source during an image emits cancel, removes overlay and leaves replacement content paused at zero.
- Real Video.js fullscreen: ad overlay remains inside fullscreen `VIDEO-SKIN`; Tab/Shift+Tab keeps tested focus in ad controls; Space pauses/resumes; image countdown remains unchanged during the observed two-second pause.
- Independent exact-ID MySQL comparison: 26 browser events from six evidence files each persisted exactly once. The earlier 23-event report preceded the additional fullscreen/control case.
- Independent synthetic collector oracle: starts 5, completes 2, skips 1, clicks 2, errors 2, completion rate 0.4 and click rate 0.2. Actual filtered UI/CSV agrees. Synthetic events are collector/statistics evidence, not viewed ads.

Evidence: `/tmp/ads-qa-txrhuzog/acceptance/evidence/`, especially `final-mp4-final.json`, `final-native-post.json`, `final-spf-post.json`, `final-hlsjs-post.json`, `final-controls.json`, `final-browser-db.json`, `cohort-stats.json`, `cohort-browser.csv`. Independent coverage and remaining cases are in `acceptance/results.json`.

## Root GnuBoard end-to-end proof

Actual native login and manager UI creative create v1/edit v2, draft r1 save and publish v1 all succeeded without reload. Native single-use tokens rotated across writes. The QA-only host password was adjusted to the native login input's 20-character limit; standalone credentials were unchanged. All secrets remain outside the repository in private fixture files.

Final preview ran twice consecutively after the correction: ad `readyState=4` and playback time advanced while content paused; content resumed after the ad. Both runs sent zero collector requests, and a direct MySQL read still found zero production facts.

Then actual public playback of `free:1:main` emitted start/complete, each accepted with HTTP 200. Direct MySQL, the actual statistics screen and downloaded CSV all agreed: one start, one complete, zero errors, completion rate 100%. Root parsed the downloaded CSV and asserted those values. At 390x844 viewport the editor had no horizontal overflow; the screenshot was inspected.

Evidence: `/tmp/ads-qa-txrhuzog/ui-g5/` contains `consecutive-save.txt`, `published.txt`, `mobile-schedule.png`, `host-check-http-results.json`, `final-preview.json`, `final-preview-ad.png`, `final-public-play.json`, `final-statistics.txt`, `final-statistics.csv`, `final-db-and-csv.json`. Host posts/members created for permission checks are explicitly fixture seeds, not UI-authored content.

## Corrected findings and retained failures

Source review corrected pre-play preroll priority, seek notification ordering, trusted GnuBoard video keys, preview context/sentinel collisions, native token rotation, whitespace password preservation, paused/autoplay readiness, initial source tracking, final cancel flush, event click-cap reservation, rejection redaction and composed/slotted container handling.

Actual integration also found and corrected:

1. PHP development media did not support byte ranges: seekable was [0,0]. Now 200/206/416 and suffix/open-ended/HEAD behavior pass real HTTP tests; browser seekable is [0,36].
2. HLS fixtures first used MPEG-TS, then a direct media playlist, then a relative master URL. SPF requires the tested fMP4 multivariant input with an absolute base. The example now normalizes the URL. No SPF engine code changed. Earlier failure/control evidence remains retained.
3. Initial queued emptied/loadstart could destroy preview or lose held play intent. One source lifecycle now survives initial fetch/attachment; genuine later reload invalidates it. Final preview passed twice.
4. Native end queued a pause after postroll creation, aborting creative.play. The end pause no longer pauses postroll; explicit ad pause still does. Actual native/MP4/SPF/hls.js postroll retests passed.
5. An early QA skip locator missed nested shadow roots. The failed observation was retained and the harness switched to the real semantic button selector without changing timing/expected behavior.

## Running pages and limits

- Standalone manager: http://127.0.0.1:18766/
- Ready player demo: http://127.0.0.1:18766/examples/videojs.html?media=mp4&video=qa-playback-mp4-1018
- GnuBoard manager: http://127.0.0.1:18765/ads/
- Installation/examples instructions: `integrations/ads-manager/README.md`, `public/examples/README.md`.

The isolated services remain running for review: MySQL 5.7.44 private Unix socket with TCP disabled, PHP 8.5.8, official GnuBoard 5.6.25 plus YoungCart tables. Paths/PIDs are in the private QA README. Existing 3306/5173 services were preserved.

## UX1 follow-up — 2026-10-18

The later v10 custom UI/UX comparison, implementation and root browser review are recorded separately in `workspaces/ads-ux-20261018/review.md` and `.agents/plans/ads-ux-parity.md`. Final served CDN SHA-256 is `b6a7e8e4734fa37c7064d0869a51bdb9469298052631ed8ae30b90a15b88288c`. Root verified 150 ads tests, 59 admin tests, build/types/scoped lint/PHP lint/workspace checks, actual Chromium ad flows, responsive layouts and manager preview. Exact execution versions and remaining scenario coverage are in that report. Original skip0 inputs remain rejected; no contract relaxation occurred. UX1 did not rerun the full MySQL/GnuBoard/statistics matrix above. TaskSpace 63 finished once with the player and standalone manager retained; the existing services and Herdr tools workspace remain available.

Real browser proof is macOS Chromium/Ego. Safari, physical mobile devices, hidden-tab timing, long stalls, delayed fetch races, audible playback, advertiser new-window clicks and native video-only fullscreen do not have full browser coverage; corresponding unit tests are not substituted for that evidence. Use the Video.js container fullscreen path verified above. The independent `/tmp/ads-qa-txrhuzog/acceptance/QA-report.md` lists the remaining cases, including reconnect and replay combinations. PHP 8.2 syntax compatibility and other MySQL/MariaDB versions were not exercised as separate runtimes. Live/React/VAST/IMA/PiP/Cast ad playback, billing, central SaaS and automatic retention cleanup are outside v1 scope. Generated CDN/media fixtures and private QA data are not committed.
