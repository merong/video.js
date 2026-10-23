# Ads manager

Customer-installed PHP backend and shared administrator UI for the Video.js ads extension. The C0 API is `public/api/index.php?action=ACTION`; all writes use POST. Only `public/` is web-accessible. There is no central service, billing, remote media download or implicit database migration.

## Requirements

- PHP 8.2+ syntax; PDO with `pdo_mysql` or `pdo_sqlite`, `fileinfo`, `mbstring`, sessions and JSON.
- A dedicated MySQL/MariaDB database using InnoDB and utf8mb4, or a private SQLite file for local use. The common schema avoids engine-specific JSON queries. Actual engine/version compatibility must be verified on the deployment target.
- A private, non-symlink upload directory writable by PHP. Its public media route must never execute scripts.
- The UI and player bundle are separate workstreams. Root provides `public/assets/ads.js`, `public/assets/videojs/`, and demo media. These generated assets are ignored; this backend does not build them.

## Explicit local installation

Run from the repository root. Choose a fresh private directory, and keep the password file private; the installer reads it from standard input and never prints it:

```sh
php integrations/ads-manager/bin/install.php \
  --config=/absolute/private/ads/config.php \
  --sqlite=/absolute/private/ads/ads.sqlite \
  --uploads=/absolute/private/ads/uploads \
  --admin=admin --password-stdin \
  --player-module-url=/assets/ads.js < /absolute/private/admin-password
```

The installer creates schema version 1 and a password hash. It refuses to overwrite an existing configuration or administrator. Omitting `--player-module-url` leaves preview unavailable until a real player bundle is configured. With an existing configuration, run only the explicit migration command:

```sh
php integrations/ads-manager/bin/install.php --config=/absolute/private/ads/config.php
```

Both commands also add the lecture (LMS) progress and notes tables (`database/lms/001.sql`, meta `lms_schema_version`); until then the `lms-*` actions answer 503 `lms_unavailable` and everything else works as before. Learner IDs are stored only in those two tables, and IP addresses are never stored.

Start the development router on an unused local port (the coordinator owns 18766 in the current integration environment):

```sh
ADS_CONFIG=/absolute/private/ads/config.php php \
  -d upload_max_filesize=100M -d post_max_size=101M \
  -S 127.0.0.1:18766 \
  -t integrations/ads-manager/public \
  integrations/ads-manager/public/router.php
```

Open `/`. `public/index.php` passes only `$adsPage['apiUrl']` to the shared UI. The router serves uploaded bytes at the configured `uploadUrl`; client filenames are never used as paths. Uploaded media and static MP4/WebM files support bounded single byte ranges for native video seeking: full responses use 200, valid closed/open-ended/suffix ranges use 206, and unsatisfiable or unsupported multiple byte ranges use 416. HEAD returns metadata without a body. Production media serving remains the static web server's responsibility.

For production, use PHP-FPM/your PHP host rather than the development server. Set the document root to `public/`; route `/api/index.php` to PHP and map the private upload directory to `uploadUrl` as **static files only**. Deny script execution, directory listing and symlink traversal there; send `X-Content-Type-Options: nosniff`. Do not expose `src/`, `database/`, `hosts/`, `bin/`, configuration, SQLite files or test artifacts. With a path-prefix mount, configure matching `apiUrl`, `uploadUrl` and `playerModuleUrl` and provide equivalent web-server routing. The included development router mounts at `/`.

## Administrator UI

The administrator screens are a React app in `ui/` (`@videojs/ads-manager-ui`). Build it from the repository root:

```sh
pnpm -F @videojs/ads-manager-ui build
```

The build writes exactly three generated, untracked files: `public/assets/admin-app/admin-app.js` (one ES module with React bundled), `public/assets/admin-app/admin-app.css` (design tokens, design-system components and app layout) and `public/assets/admin-app/design.css` (the design system alone — `design/components/fonts.css`, `design/tokens.css`, `design/components/bundle.css` in that order — for the public example pages). The vanilla PHP shell `admin/app.php` loads both and prints `#ads-admin-root` plus a JSON `#ads-config` (`apiUrl`, `assetUrl`); the module mounts itself when both elements exist. Other hosts can call `mountAdsAdmin(element, { apiUrl })`, which returns `{ unmount }`. The v1 screen (`admin/index.php`, `public/assets/admin/`) stays unchanged for regression comparison.

The screen is a dashboard layout: a fixed left sidebar (`SideNav`) with the app name, grouped menus and the signed-in user at the bottom, and a top bar with the breadcrumb (group / menu) and the 도움말, 사이트 보기 and 관리자 buttons. At 960px and narrower the sidebar becomes a drawer opened from a menu button in the top bar; opening it moves focus to the current menu, Escape or a backdrop click closes it and returns focus to that button, and choosing a menu closes it and moves focus to the new screen's title. The base text size is 13px (`design/tokens.json`).

Menus follow `bootstrap.capabilities.host`, grouped in the sidebar. Standalone shows 개요 (대시보드), 광고 (캠페인, 소재, 지면 편성), 플레이어 (플레이어, 강의), 운영 (승인함, 리포트) and 시스템 (설정); GnuBoard shows 광고 (광고 요청, 하우스 광고, 지면 편성), 플레이어 (플레이어 설정), 분석 (통계) and 시스템 (설정), with no 강의 menu. Only creatives (소재 / 하우스 광고), schedule editing with preview playback and published-schedule test links with a player preset choice (지면 편성), player presets (플레이어), and basic statistics with CSV (리포트 / 통계) call the API; the creative list loads the first time 소재 / 하우스 광고 or 지면 편성 opens, and a failed load shows a retry on those two menus only (a 401 or 403 offers to reconnect, then reads the list again); 지면 편성 can also re-read it with 소재 목록 새로고침. The other menus are static mocks marked "목업 · 아직 동작하지 않아요": they send no requests and their write buttons are disabled. The UI uses the same API conventions as v1: it adopts every `X-CSRF-Token` response header, sends writes once without retry, and keeps the editor intact after a 409 so the operator can reload the server draft.

On GnuBoard, 플레이어 설정 (`#/players`) edits the site's one player setting in place: the editor and live preview without a preset list, name, duplicate, delete or apply step, and without the section list, so the preview takes the wider column (above the sections below 1100px). Both editors pick the theme from six drawn cards (the four built-in looks, 다크 and 따뜻한 색) with fine-tuning folded under them, and the 로고 section turns the sample logo on in one of the four corners. Saving creates the setting the first time and updates it after that, and it is always the site preset; old `#/players/…` links open the same page.

On standalone, 플레이어 has three pages under `#/players`: the preset list and editor (`#/players`, `#/players/new`, `#/players/edit/<id>`) with a live preview of the whole preset from `examples/preview.html` (the Grok sample, no statistics), the install-code generator with per-host setup steps (`#/players/setup`, needs `bootstrap.playerModuleUrl`), and the static option reference (`#/players/options`, no API requests). Any other sub path opens the list. The preset list is read again on each visit to 플레이어; a failed re-read keeps the old list and says so. After a 409, or a 404/400 for a preset id, the screen offers to reload the list in place and keeps the input; input for a preset deleted elsewhere can be kept as a new preset or dropped. When the reloaded list (or any newer list, checked again before each save) has a change made elsewhere, the editor takes the fields only that save changed, names them, and asks for another save; a field both sides changed blocks saving until the operator keeps their input or takes the saved value. Features in contract 3.2 that are not built yet are listed as "준비 중" on the list, editor and setup pages. Values the chosen player cannot apply stay in the form but are sent as `null`; the built-in presets (`default`, `flat`, `rounded`, `accent`) can only be duplicated or applied to the site.

도움말 is a hidden route opened from the top-bar button on both hosts (before 집행 만들기 or 사이트 보기): `#/help` shows the menu guide and glossary, and `#/help/<term>` opens it focused on that term's heading. An unknown term, or one the host does not show, rewrites the address to `#/help`. A query (`?…`) and one trailing slash are ignored. The "?" links beside screen fields point to `#/help/<term>`. Help sends no API requests besides `bootstrap`.

For UI work, `pnpm -F @videojs/ads-manager-ui dev` serves `ui/index.html` with `apiUrl` set to `/api/index.php` on the Vite origin. The dev server has no API proxy, so API calls fail there and the screen stops at the connection error; it is useful only for layout. To work against a running manager API, build the bundle and open `/` on that installation (`public/index.php` renders `admin/app.php`; `/?ui=v1` keeps the v1 screen), so the page and the API share an origin and session cookie. Check changes with the package's `test` and `typecheck` scripts.

## MySQL / MariaDB

Copy `config.example.php` to a private config file and set `dsn`, `dbUser`, `dbPassword`, `tablePrefix`, `uploadRoot` and the public URLs. For example, use a dedicated socket DSN `mysql:unix_socket=/isolated/mysql.sock;dbname=ads;charset=utf8mb4`. Provide credentials through the private config, never API parameters or URLs. The installer creates only prefixed product tables; it does not create databases, grant privileges or modify host tables. DDL privileges are necessary during installation only; normal operation needs product-table SELECT/INSERT/UPDATE.

```sh
php integrations/ads-manager/bin/install.php \
  --config=/absolute/private/mysql-config.php \
  --admin=admin --password-stdin < /absolute/private/admin-password
```

Migrations are idempotent and run only through this CLI. Do not change an installed `siteId` or point the configuration at a customer database for a test. Short writes acquire a per-installation transaction lock, keeping revision checks, publication and event uniqueness atomic on both engines.

## GnuBoard / YoungCart adapter

Use `host => 'gnuboard'`, an absolute `gnuboardRoot`, a separate product-table prefix (for example `g5ads_`), and an explicit menu code such as `gnuboardMenu => '300950'`. Configure the product PDO connection independently; no host credential file is copied to the browser. Run the installer **without** `--admin`; GnuBoard owns login and password storage.

Mount `public/` under the host site (for example `/ads/`) with `apiUrl => '/ads/api/index.php'` and matching media/module URLs. Link the manager from the host's existing menu/custom menu hook and grant native read/write menu permissions as appropriate. Do not patch core files. The adapter loads the existing `common.php`, validates the logged-in member/session and native super/menu access, then uses `auth_check_menu` and `check_admin_token`. Unknown/missing host configuration fails closed.

Native admin tokens are single-use. Every authenticated administrator API response supplies the current token through `X-CSRF-Token`, **including validation-error responses after token consumption**. Clients adopt the header before handling the response; the next write sends it as `X-CSRF-Token` (multipart also accepts `csrfToken`). Public schedule/events responses never carry an admin token. Do not automatically retry writes after ambiguous network failures.

The canonical video ID is `bo_table:wr_id:main`: one stable content video per post by default. The adapter validates the post, read level, group membership, certification, secret-post access, device restriction and any required prior paid-point host view. It never spends reading points. Board/category context comes from that post, not visitor query parameters. For multiple videos, the trusted installation can supply:

```php
'gnuboardVideoKeys' => static function (array $board, array $post): array {
    // Read your host-owned identity metadata here. Keys remain stable across URL changes.
    return ['main', 'trailer'];
},
```

The callback must return the real allowed keys for that particular post. Keys use ASCII letters, digits, `_` or `-`, up to 80 characters; the complete video ID must fit the wire limit of 128 characters. Unknown keys return 404. Do not derive keys from DOM positions, expiring media URLs or a visitor's claimed mapping. `video-context-save` is unavailable on GnuBoard. For standalone installations, an authenticated admin uses that endpoint to register trusted board/category mappings; unknown videos ignore visitor-supplied board/category values.

Host request variables are isolated while loading GnuBoard's common bootstrap, preventing its `extract()` and SQL-escaping behavior from replacing API configuration or altering API input. Additional site-specific content access restrictions require host integration review; the local upstream source is a reference, not a universal host-version compatibility claim.

## Persistence and public boundaries

- A creative ID is the advertisement ID. Edits create immutable media versions. Archive blocks new selection/publication; it does not modify old snapshots or delete files.
- Draft save increments `revision` and returns 409 for a stale revision. Publish validates assets atomically and creates an immutable `scheduleVersion`. Resolution is video → board-scoped category → board → site, with whole-schedule `replace`, explicit `disabled`, or `inherit`.
- Preview returns the same schedule DTO without production tracking metadata. An actual preview video retains its host-resolved context. Target-only preview/draft lookup deliberately excludes unrelated video-level rules.
- A video ID is a 1–128 character UTF-8 string. It is rejected with 422 `validation` and `fields.videoId` (`target.id` for a video target) when it is only whitespace in the JS `String.prototype.trim` sense, or contains a control character (`\p{Cc}`) or a bidirectional embedding, override or isolate (U+202A–U+202E, U+2066–U+2069). The same rule applies to `schedule`, `video-context-save`, `schedule-preview` and video targets. Any other ID, including one with `<` or surrounding spaces, is kept and echoed verbatim, because the player requires `schedule.videoId` to equal its `video-id` exactly. GnuBoard additionally requires its `board:post:key` form.
- Public GET `schedule` is read-only. It returns a signed, expiring token binding the new playback session to the exact publication and trusted context. The first POST `events` persists that frozen session; publication edits cannot change it.
- The collector checks signatures, snapshot membership, all correlation IDs, unique events/sequences, nondecreasing ad elapsed time and a single ordered terminal result. Skip elapsed time must satisfy the advertised policy; image completion must reach its display duration. Video completion is a browser observation, not independent proof that media was watched.
- Up to 50 events fit in one 1 MiB request. A session accepts at most 120 collector requests/minute; the installation limit is 2,000/minute. Each attempt allows 127 click facts and independent start/terminal slots, including out-of-order arrival. Login has a 30/minute installation limit. These are local abuse bounds, not a billing/fraud system.
- In the standalone host the public actions (`schedule`, `events`, `player-preset`) start no PHP session, so a visitor without a cookie receives no `Set-Cookie` and only the action's own `Cache-Control` (`no-store`, or `no-cache` for `player-preset`). The GnuBoard host still starts the host session, because `common.php` does so before any action runs.
- Accepted facts are immutable. Exact retries are duplicates; changed content under the same ID is a conflict. Rejections store bounded diagnostic identifiers/types and a one-way payload hash, never arbitrary submitted bodies or transport tokens.

## Player presets

- A preset is a named player configuration (schema 2): `playerType` (`videojs` | `native`), `language` (`ko` | `en` | `ja` | `zh-CN`), `theme` (skin CSS properties; colors are lowercase `#rrggbb`, and only `theme.borderColor` also takes `#rrggbbaa`, where `#00000000` draws no border), `playback` (autoplay, muted, loop, preload), `display` (poster, title), `input` (hotkeys, gestures), `controls` (seven toggles, `seekButtons` 5/10/15/30 and `seekPlacement` `bar` | `center` | `both`, where `center` puts the seek pair around a play button in the middle of the video; empty is `bar`, and it is kept while `seekButtons` is empty), `logo` (`assetId`, which only takes `"sample"` for the built-in sample logo `public/player/logo-sample.svg` until uploads exist, then position, margin, width, opacity, link and its alternative text, visibility) and `ads` (16 labels, ad-screen CSS properties, progress toggles, native-only timeouts). Booleans must be JSON booleans. Autoplay with `muted: false` is rejected, and a logo link needs alternative text. Only `sequence` (`{index}`, `{count}`), `skipCountdown` (`{seconds}`) and `timer` (`{elapsed}`, `{duration}`, `{remaining}`) accept placeholders; any other brace is rejected. The name, labels and logo alternative text are trimmed with the same set as JS `String.prototype.trim` (Unicode space separators, U+0009–U+000D, U+2028, U+2029 and U+FEFF) and reject control characters and the bidirectional embeddings, overrides and isolates U+202A–U+202E and U+2066–U+2069. Unknown keys, including the removed `skin`, `ads.locale` and `ads.labels.mediaAlt`, and out-of-range values return 422 with a field path such as `theme.accentColor`; nothing is silently corrected. Empty values are `null`, and `null` means the built-in default. Native presets reject the values that only Video.js can apply, and Video.js presets reject timeouts.
- All presets live in one JSON document under the meta key `player_presets` (`{schema: 2, revision, defaultPresetId, presets}`); the database schema and tables are unchanged. Without that key the manager reads only the built-in presets and writes nothing. A document without `schema` is v1: it is converted in memory on every read (`ads.locale` becomes `language`, a `neutral` skin without corners gets `theme.borderRadius: 12`, `skin` and `mediaAlt` are dropped, new fields are `null`), and the next write stores the whole document as schema 2. An unknown schema is an error rather than a guess. Writes run under the installation write lock. At most 20 stored presets, not counting built-ins; IDs (`p-` plus 10 lowercase letters/digits) are server-generated.
- Four read-only built-ins come first, in this order: `default` (기본), `flat` (플랫, square corners and border `#00000000`), `rounded` (둥근 테두리, 12px corners) and `accent` (강조색, `#2563eb` accent with white text). They can be applied to the site and duplicated, not changed or deleted.
- Admin GET `player-presets` lists the document with the built-ins first (`builtIn: true`) and `migratedNeutral`: the IDs of stored presets that used the v1 `neutral` skin, empty once the document is schema 2. POST `player-preset-save {preset, revision}` creates (no `id`) or updates, POST `player-preset-delete {id, revision}` deletes (the site preset falls back to `default`), POST `player-preset-default {id, revision}` selects the site preset. Each write returns the new list (save adds `preset`). A stale document revision returns 409 `revision_conflict` without the list. Errors: 400 `preset_builtin` (modify/delete a built-in), 400 `preset_limit`, 400 `invalid_preset_id`, 404 `preset_not_found`.
- Public GET `player-preset[&id=]` needs no login. It renders the site (or the given) preset with every default filled in (`playback.muted` is the preset's own value, `false` when empty; the loader mutes autoplay after merging page options): `{id, revision, playerType, language, playback, display, input, controls, logo, progress, labels, skinTag, styles, css, attributes}` for Video.js (`logo` is `null` without an `assetId`; otherwise it is `{src, position, margin, width, opacity, href, alt, hideDuringAds, hideWithControls}` with every default filled in and `src` relative to `public/player/`, which the loader resolves against its own URL) or `{id, revision, playerType, language, playback, display, progress, labels, skinTag, styles, css, ui, timeouts?}` for native, using only the listed `--media-*`/`--ads-*` properties and `<media-ads>` attributes. It never includes the preset name. Only this action sends `Cache-Control: no-cache` and a strong `ETag`, the quoted first 32 hex digits of the sha256 of the response `data` JSON, so any change to the rendered values, including a manager upgrade, changes it. An `If-None-Match` of `*` or any listed tag (a `W/` prefix is ignored) gets 304 with no body. Errors carry no `ETag` and keep `no-store`.
- GnuBoard keeps a single preset and no lectures (`Host::singlePlayerPreset()` and `Host::lectures()`). The first save without `id` creates the one stored preset; a second one returns 400 `preset_single`. Every save makes it the site preset, and `player-preset-delete` and `player-preset-default` return 400 `preset_fixed`. Until the first save the site preset reads as `default`, including an older `lms` site preset. The `lms` built-in is not listed, every preset is stored and rendered with `lms.enabled` off, `bootstrap.capabilities.lms` is `false`, and every `lms-*` action, public ones included, returns 404. Existing LMS tables are left untouched.
- `tests/fixtures/player-preset-v2.json` holds the shared normalize, render and v1-read cases that the PHP, admin UI and loader validators run.
- `bootstrap.capabilities.playerPresets` is `true`.
- `public/examples/` holds the player pages, all built on `player/loader.js`: `index.html` (demo: pick any built-in or the site preset, plus every saved preset when signed in to the admin on the same origin; change options live and copy the matching install code; nothing is saved), `guide.html` (설명서), `help.html` (도움말: every `data-*` attribute, JS API option, event and preset field, with fixed anchors the admin links to), `play-test.html` (the published schedule with statistics; the admin's 재생 테스트 links open it) and `preview.html` (the admin preview frame). The demo and the preview play `public/demo-media/grok-20261018/` (untracked) with `mount(…, { preview })` and send no statistics; its ad URLs start with `/demo-media/`, so ads show only when `public/` is the server root. A Video.js preview given a schedule object rather than a URL (the 지면 편성 draft preview), or mounted at the midroll or end scene (which plays a copy of the schedule without the breaks before that scene), attaches the ads controller directly instead of `<media-ads>`, so keyboard shortcuts pressed during an ad reach the content; this is a preview-only limit.

## Statistics and CSV

Start cohort dates use the server-received timestamp of the first valid start, interpreted in configured `timeZone`. Inclusive `from`/`to` local dates become UTC half-open boundaries. Client `occurredAt` is retained separately and cannot move a cohort. Late terminals update their original start cohort. Errors without a start use error receipt date; a missing start or terminal is never inferred.

`completes` and `skips` count unique started attempts; `clicks` counts accepted click facts for started attempts; `clickedStarts` counts started attempts with at least one click. Completion rate is `completes / starts`; click rate is `clickedStarts / starts`; both are `null` when the denominator is zero. Rows group by advertisement/video/board. JSON and CSV share the same date/ad/video/board filters. CSV uses UTF-8 BOM and neutralizes spreadsheet formula prefixes. Analytics does not require visitor identities/IP storage.

`retentionDays` defaults to 90 as an operational policy setting. No automatic deletion or physical-file cleanup runs in v1. Operators must arrange reviewed retention/backup procedures; archive is not deletion. Expired tokens are rejected, and existing stored facts remain available for reporting.

## Verification

From the repository root:

```sh
php integrations/ads-manager/tests/backend/run.php
python3 integrations/ads-manager/tests/backend/http_test.py
```

The first test uses a fresh real SQLite database and exercises authentication, persistence, publication/inheritance, immutable assets, signed sessions, duplicate/conflicting/out-of-order events, skip timing, click-cap reconciliation, rejection redaction, local-date cohorts and CSV. It leaves its isolated temp directory for inspection and prints its location. The HTTP test creates and removes a separate SQLite installation and a private copy of the runtime files, runs a temporary PHP server on an OS-selected port, checks session rotation/CSRF, real multipart uploads and 200/206/416 media range responses, and always stops that server. Its transport fixtures verify byte accuracy rather than media decoding. It does not use 18765/18766 or modify shared demo assets.
- A break may set `rotation: "random"` (2 or more ads): each playback session, and each preview, gets one of its ads chosen uniformly, signed into the session so events for the other ads are rejected. The served break keeps the playback-v1 shape (one ad, no `rotation` key). The default `"none"` plays every ad in order and is not stored.

Each test prints one PASS line per group so earlier baselines stay comparable: v1 (SQLite 70, HTTP 110), A1 shell selection and bootstrap user/capabilities (SQLite 7, HTTP 25), player presets (SQLite 401, HTTP 54), cookieless public actions (HTTP 7), video IDs (SQLite 23, HTTP 4), and lectures (SQLite 94, HTTP 20). The SQLite preset group runs every case in the shared fixture plus the schema boundaries, built-in rules, the 21st-preset limit, a byte-for-byte check that reading presets without the meta key leaves the database file unchanged, and a v1 document that reads unchanged until its first write. The HTTP preset group checks the ETag bytes, 304 matching and which responses carry no ETag.

For this project's explicitly isolated QA fixture only:

```sh
php integrations/ads-manager/tests/backend/run.php \
  --mysql-credentials=/private/tmp/ads-qa-txrhuzog/credentials.json
```

The optional fixture file must be named `credentials.json` under an `ads-qa-<identifier>` directory, with its `mysql_socket` in the same directory and `ads_database`, `ads_user`, `ads_password` fields. The test creates a fresh `backend_<random>_` prefix and never changes the installed `ads_`/`g5ads_` tables. It does not print credentials or use a default TCP/3306 connection. It leaves its own tables for inspection.

To exercise key ownership through an actual isolated GnuBoard bootstrap and an existing public fixture post (no product-table writes):

```sh
php integrations/ads-manager/tests/backend/gnuboard_keys.php \
  --config=/absolute/private/qa-gnuboard-config.php --video=BOARD:POST:main
```

If the isolated host's own DB configuration uses `localhost`, its native mysqli connection needs the fixture socket independently of the manager's PDO DSN. Supply a per-command PHP override rather than changing host configuration or using the default socket:

```sh
php -d mysqli.default_socket=/private/tmp/ads-qa-txrhuzog/mysql.sock \
  integrations/ads-manager/tests/backend/gnuboard_keys.php \
  --config=/tmp/ads-qa-txrhuzog/manager-gnuboard/config.php --video=free:1:main
```

Require the explicit `PASS 5` result. A native GnuBoard DB error may terminate with exit code 0 before the assertions run; that is not a passing test.

This covers the canonical main key, rejection of invented suffixes, a host-configured multikey callback receiving the real board/post, and a callback denying all keys. It does not simulate a host database or claim to test browser login. Native login plus consecutive writes and invalid-then-valid CSRF writes remain real HTTP/UI acceptance scenarios.

Evidence boundaries: SQLite assertions prove local persistence, not MySQL or GnuBoard runtime compatibility. HTTP tests prove the tested API surface, not browser ad playback. Actual GnuBoard login/menu/CSRF flows, player playback, MySQL execution and any deployment require their own evidence. No customer deployment is part of this implementation.
