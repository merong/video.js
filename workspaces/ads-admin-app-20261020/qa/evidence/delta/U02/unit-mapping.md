# A1-QA-DELTA unit mapping (2026-10-21)

Commands (repo root, read-only, no build):
- `pnpm -F @videojs/ads-manager-ui test` → test.log (17 files, 486 passed, 0 failed, 0 skipped, exit 0)
- `pnpm -F @videojs/ads-manager-ui exec vp test run --reporter=verbose` → test-verbose.log, names in test-names.txt (486)
- `pnpm -F @videojs/ads-manager-ui typecheck` (tsgo, noEmit) → typecheck.log (exit 0)
- `pnpm exec vp check integrations/ads-manager/ui` → vp-check.log (format pass 97 files; lint 0 errors, 12 anti-slop warnings; exit 0)

| ID | Verdict | Tests (file > describe > name) | Gap |
| --- | --- | --- | --- |
| U02 | PASS | all of the above exit 0 | 12 lint warnings (anti-slop no-unknown-parameters 9, no-unsafe-dictionary-type 2) — observation |
| U03 | PASS | api.test.ts > AdminApi: "adopts a rotated token from an error response"; "sends a JSON write once … adopts the rotated token"; "adds the token as a multipart field …"; "reports 409 as a conflict status without retrying"; "does not retry a write after a network failure"; "reports a timeout once and does not retry the write"; "turns an unreadable body into an ApiError …"; envelope ok:false → ApiError {status, code, fields} (api.test.ts:103-114); app.test.tsx > describeError | — |
| U04 | FAIL (test gap) | app.test.tsx > App > "keeps the editor and offers a reload after a 409 on save" (schedule-save 409: input kept, real alert text, 저장하지 않은 변경 stays) | No screen test for F2/F3 save failure by validation (422) or network failure; no creative-save/creative-upload failure screen test at all (grep: only api.test.ts uses those actions) |
| U05 | PASS | app.test.tsx > routesFor > "lists the canvas menus for each host" (standalone 대시보드·캠페인·소재·지면 편성·플레이어·승인함·리포트·설정; gnuboard 광고 요청·하우스 광고·지면 편성·플레이어·통계·설정); app.test.tsx:244 집행 만들기 right action; app.test.tsx:223-226 사이트 보기/관리자 | — |
| U06 | PARTIAL (test gap) | app.test.tsx:225-226 no opener → no "광고 관리 창 닫기"; app.test.tsx "links GnuBoard site and admin only from safe capability URLs"; components.test.tsx TopNav "shows only the tag as plain text without a brand" (광고 관리) | No test with `window.opener` present asserting the button shows and calls `window.close()` (implemented at src/app/Workspace.tsx:257,308) |
| U07 | PASS | mocks.test.tsx > mockScreens: standalone.{dashboard,campaigns,approvals,reportV2,settings,newLineItem}, gnuboard.{requests,settings} "shows the mock badge, calls no API, and disables writes" (disabled + visible reason via aria-describedby, mocks.test.tsx:23-34) | — |
| U08 | PASS | player.test.tsx > PreviewPlayer: "connects one video and its container with preview true and no tracking", "destroys the controller on unmount", "replaces the controller when schedule or content changes", "records controller observations with the v1 wording", "sends no collector requests of its own during preview" | — |
| U09 | PASS | player.test.tsx > PlayerTestLinks: "opens both examples in a new tab with video and content", "resolves a relative content address against the admin page, not the examples", preset passing cases | rel is `noopener noreferrer` (superset of noopener) — observation |
| HL02 (unit) | PASS | admin-help.test.tsx > App help > "puts 도움말 before 사이트 보기 in the gnuboard top bar"; "puts 도움말 before 집행 만들기 in the standalone top bar"; "keeps help out of the menu on both hosts" | siteUrl-absent ordering is not asserted; Workspace.tsx renders 도움말 first unconditionally (source reading) |
| HL14 (help.test.tsx) | PASS | help.test.tsx (all passed) incl. helpTerms "has no duplicate ids and a term and motion for each", "has one card per term across both hosts and no duplicate element ids" | — |
| PL07 (UI) | PASS (with note) | admin-players.test.tsx > "blocks new presets and duplicates at 20 saved presets"; preset-form.test.ts:162 maps preset_limit → "20개까지예요" | No screen test that a server 400 preset_limit keeps the form input (generic keep-input covered by 409/422 tests) |
| PL21 (table test) | PASS | player-options.test.tsx > playerOptions (reads packages/extensions/ads sources: element.ts, controller.ts, overlay.styles.ts) | — |
| PL24 (G-U unit) | PARTIAL | admin-players.test.tsx "sits right after 지면 편성 on gnuboard"; admin-help.test.tsx "lists the player menu after 지면 편성 … on gnuboard" | GnuBoard install text (/ads/, 게시판:글번호:영상키 with main, read permission, 자동 삽입 준비 중) is in src/screens/PlayerSetup.tsx:86-101 but no test asserts it; real env NOT_RUN (D1) |
