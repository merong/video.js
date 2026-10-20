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
- Public GET `schedule` is read-only. It returns a signed, expiring token binding the new playback session to the exact publication and trusted context. The first POST `events` persists that frozen session; publication edits cannot change it.
- The collector checks signatures, snapshot membership, all correlation IDs, unique events/sequences, nondecreasing ad elapsed time and a single ordered terminal result. Skip elapsed time must satisfy the advertised policy; image completion must reach its display duration. Video completion is a browser observation, not independent proof that media was watched.
- Up to 50 events fit in one 1 MiB request. A session accepts at most 120 collector requests/minute; the installation limit is 2,000/minute. Each attempt allows 127 click facts and independent start/terminal slots, including out-of-order arrival. Login has a 30/minute installation limit. These are local abuse bounds, not a billing/fraud system.
- Accepted facts are immutable. Exact retries are duplicates; changed content under the same ID is a conflict. Rejections store bounded diagnostic identifiers/types and a one-way payload hash, never arbitrary submitted bodies or transport tokens.

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
