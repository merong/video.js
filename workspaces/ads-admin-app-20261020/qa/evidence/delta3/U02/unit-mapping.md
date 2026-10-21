# A1-QA-DELTA-3 unit mapping (2026-10-21)

Commands (repo root, read-only, no build):
- `pnpm -F @videojs/ads-manager-ui exec vp test run --reporter=verbose` → test-verbose.log (17 files, 537 passed, 0 failed, exit 0), names in test-names.txt (537)
- `pnpm -F @videojs/ads-manager-ui typecheck` (tsgo) → typecheck.log (exit 0)

Only the paths the browser run cannot reach are mapped here (TASK: server 422 bypass path and GnuBoard ID format are unit-only).

| Item | Verdict | Tests (file > describe > name) |
| --- | --- | --- |
| VID-1 server 422 path (`fields["target.id"]` → 고정 대상 ID, one sentence) | PASS (unit only) | app.test.tsx > fixed video IDs > "links the server target.id message to the field and says it once" (422 with message = fields['target.id'] → aria-invalid true, describedby = message, alerts exactly ["편성을 불러오지 못했어요. 고정 대상 ID를 확인해 주세요."], message appears once in the page, focus on the field); app.test.tsx > describeError > "says a field message that repeats the summary only once and keeps it by path" |
| Schedule pre-check (unit side of item 1) | PASS | app.test.tsx > fixed video IDs > "blocks a video target ID with {RLO U+202E, C1 NEL U+0085, only ideographic spaces, 129 characters} before loading" |
| Play test pre-check (unit side of item 2) | PASS | app.test.tsx > fixed video IDs > "blocks the preview and test links for a video ID with {RLO, C1 NEL, only ideographic spaces, 129 characters}" |
| Install code pre-check (unit side of item 2) | PASS | admin-players.test.tsx > PlayerSetup review fixes > "on standalone, makes no install code for a video ID with {RLO, C1 NEL, only ideographic spaces, 129 characters}", "on gnuboard, makes no install code for a video ID with RLO U+202E" |
| GnuBoard format free:12:main (D1, unit only) | PASS (unit only) | admin-players.test.tsx > PlayerSetup review fixes > "keeps building gnuboard install code for a 게시판:글번호:영상키 ID" (free:12:main → no aria-invalid, code has video-id="free:12:main"); model.test.ts > videoIdProblem > "accepts a gnuboard ID" |
| Rule parity with Value::videoId | PASS | model.test.ts > videoIdProblem: accepts plain, gnuboard, 128 chars, 128 astral chars, inner spaces, LRM U+200E, ALM U+061C, ZWSP U+200B; refuses RLO, LRI, C1 NEL, NUL, 129 chars, only ideographic spaces, only BOM, empty "like Value::videoId"; "refuses the same control characters as the preset label rule" |
