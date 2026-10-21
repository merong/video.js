# A1-QA-DELTA-2 unit mapping (2026-10-21)

Commands (repo root, read-only, no build):
- `pnpm -F @videojs/ads-manager-ui test` → test.log (17 files, 504 passed, 0 failed, exit 0; DELTA was 486)
- `pnpm -F @videojs/ads-manager-ui exec vp test run --reporter=verbose` → test-verbose.log, names in test-names.txt (504, 0 failed)
- `pnpm -F @videojs/ads-manager-ui typecheck` (tsgo) → typecheck.log (exit 0)
- `pnpm exec vp check integrations/ads-manager/ui` → vp-check.log (format 97 files pass; lint 0 errors, 12 warnings; exit 0)

| ID | Verdict | Tests (file > describe > name) | Remaining gap |
| --- | --- | --- | --- |
| U04 | PASS (DELTA gap closed) | app.test.tsx > App flows > "keeps the schedule input and shows the error after {a 422, a network failure} on save (QA U04)"; "keeps the creative input … on URL save (QA U04)" ×2; "keeps the chosen file … on upload (QA U04)" ×2 — each asserts the alert text, input kept, no success text, exactly one write request (creative: list not reloaded) | Focus after a failed write is not asserted in units (covered by browser FOCUS/B06 runs) — observation |
| U06 | PASS (DELTA gap closed) | app.test.tsx > App > "offers 광고 관리 창 닫기 on GnuBoard only when an opener window exists (QA U06)" — opener stubbed, click calls window.close once; standalone with opener shows no button | — |
| PL07 (UI) | PASS (DELTA gap closed) | admin-players.test.tsx > PlayersScreen > "keeps the new preset input after the server refuses a 21st preset (QA PL07)" — 400 preset_limit → alert "저장 프리셋은 20개까지예요. …", name/font input kept, hash stays #/players/new, leave warning on, one save request | — |
| PL24 (G-U unit) | PASS (unit); real env NOT_RUN (D1) | admin-players.test.tsx > PlayerSetup > "gives the GnuBoard install steps: /ads/ on the same origin, video IDs and read permission (QA PL24)" (게시판:글번호:영상키, 기본 main, 읽기 권한, 자동 삽입 준비 중 note with /ads/ 같은 출처) + "keeps the GnuBoard video ID format out of the standalone install steps" | Real GnuBoard install not run (D1) |
| U02 | PASS | all four commands exit 0 | 12 lint warnings (anti-slop no-unknown-parameters 9, no-unsafe-dictionary-type 3); total same as DELTA (12) — observation |
