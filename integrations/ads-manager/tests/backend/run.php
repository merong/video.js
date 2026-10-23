<?php
declare(strict_types=1);

require dirname(__DIR__, 2) . '/src/load.php';

use AdsManager\ApiError;
use AdsManager\App;
use AdsManager\Config;
use AdsManager\Database;
use AdsManager\GnuBoard;
use AdsManager\Host;
use AdsManager\Lms;
use AdsManager\Http;
use AdsManager\PlayerPresets;
use AdsManager\Standalone;
use AdsManager\Value;

// A1 additions are counted separately so the v1 baseline stays comparable.
$checks = ['v1' => 0, 'a1' => 0, 'presets' => 0, 'videoId' => 0, 'lms' => 0];
function same(mixed $actual, mixed $expected, string $message, string $group = 'v1'): void
{
    global $checks;
    $checks[$group]++;
    if ($actual !== $expected) {
        throw new RuntimeException($message . ': expected ' . Value::json($expected) . ', received ' . Value::json($actual));
    }
}
function fails(callable $work, int $status, string $message): void
{
    try {
        $work();
    } catch (ApiError $error) {
        same($error->status, $status, $message);
        return;
    }
    throw new RuntimeException($message . ': unexpectedly succeeded');
}

$options = getopt('', ['mysql-credentials:']);
$directory = realpath(sys_get_temp_dir()) . '/ads-backend-' . bin2hex(random_bytes(6));
mkdir($directory, 0700, true);
mkdir($directory . '/uploads', 0700);
$config = ['dsn' => 'sqlite:' . $directory . '/ads.sqlite', 'uploadRoot' => realpath($directory . '/uploads')];
if (isset($options['mysql-credentials'])) {
    $path = realpath($options['mysql-credentials']);
    if (!$path || basename($path) !== 'credentials.json' || !preg_match('/^ads-qa-[a-zA-Z0-9]+$/D', basename(dirname($path)))) {
        throw new RuntimeException('Only the explicitly isolated QA credential path is allowed.');
    }
    $qa = Value::decode(file_get_contents($path));
    if (!is_string($qa['mysql_socket'] ?? null) || realpath(dirname($qa['mysql_socket'])) !== dirname($path) || !preg_match('/^[a-zA-Z0-9_]+$/D', $qa['ads_database'] ?? '')) {
        throw new RuntimeException('The QA socket must be inside its isolated fixture directory.');
    }
    $config = [...$config, 'dsn' => 'mysql:unix_socket=' . $qa['mysql_socket'] . ';dbname=' . $qa['ads_database'] . ';charset=utf8mb4', 'dbUser' => $qa['ads_user'], 'dbPassword' => $qa['ads_password'], 'tablePrefix' => 'backend_' . bin2hex(random_bytes(5)) . '_'];
    unset($qa);
}
$config = Config::validate($config);
try {
    $db = new Database($config);
} catch (PDOException $error) {
    fwrite(STDERR, "Test database connection unavailable; inspect the isolated environment permissions.\n");
    exit(2);
}
$db->migrate($config['siteId']);
$signingKey = $db->meta('signing_key');
$db->migrate($config['siteId']);
same($db->meta('signing_key'), $signingKey, 'idempotent migration preserves signing key');
$db->run('INSERT INTO ' . $db->table('admins') . ' (username, password_hash) VALUES (?, ?)', ['tester', password_hash('test-password-12345', PASSWORD_DEFAULT)]);
$_SESSION = [];
$host = new Standalone($db, $config);
$app = new App($db, $config, $host);
$anon = $app->dispatch('GET', 'bootstrap', []);
same(array_key_exists('site', $anon), false, 'anonymous bootstrap omits protected configuration');
same(array_key_exists('user', $anon), false, 'anonymous bootstrap omits user', 'a1');
fails(fn () => $app->dispatch('GET', 'creatives', []), 401, 'anonymous admin read');
fails(fn () => $app->dispatch('POST', 'login', ['username' => 'tester', 'password' => 'test-password-12345'], 'wrong'), 403, 'login CSRF enforced');
$app->dispatch('POST', 'login', ['username' => 'tester', 'password' => 'test-password-12345'], $anon['csrfToken']);
same($host->authenticated(), true, 'hashed account login');
same($host->csrfToken() !== $anon['csrfToken'], true, 'login rotates CSRF');
same($app->dispatch('GET', 'bootstrap', [])['user'], ['displayName' => 'tester'], 'standalone bootstrap user is the login ID', 'a1');
fails(fn () => $app->dispatch('GET', 'creative-save', []), 400, 'GET cannot mutate');

// Real persisted versions are used to canonicalize the shared playback fixture.
$fixture = Value::decode(file_get_contents(dirname(__DIR__, 2) . '/contract/playback-v1.json'));
$assets = [];
foreach ($fixture['breaks'] as &$break) {
    foreach ($break['ads'] as &$ad) {
        $key = $ad['creativeId'];
        if (!isset($assets[$key])) {
            $assets[$key] = $app->creatives->save(['name' => $key, 'url' => $ad['url'], 'mime' => $ad['mime'], 'alt' => $ad['alt']])['creative'];
        }
        $ad['creativeId'] = $assets[$key]['creativeId'];
        $ad['adId'] = 'untrusted-ad-alias';
        $ad['url'] = 'https://untrusted.example/override';
    }
    unset($ad);
}
unset($break);
$site = ['type' => 'site', 'id' => 'site-local'];
$siteDraft = ['target' => $site, 'mode' => 'replace', 'revision' => 0, 'breaks' => $fixture['breaks']];
$saved = $app->schedules->save($siteDraft);
same($saved['draft']['revision'], 1, 'draft revision increments');
same($saved['draft']['breaks'][0]['ads'][0]['url'], $assets['creative-image']['url'], 'submitted URL cannot override stored creative');
same($saved['draft']['breaks'][0]['ads'][0]['adId'], $assets['creative-image']['creativeId'], 'ad identity is creative identity');
fails(fn () => $app->schedules->save($siteDraft), 409, 'stale draft save');
same($app->dispatch('GET', 'schedule', ['videoId' => 'video-1'])['schedule']['breaks'], [], 'draft is not live');
$published = $app->schedules->publish(['target' => $site, 'revision' => 1]);
fails(fn () => $app->schedules->publish(['target' => $site, 'revision' => 2]), 409, 'publish requires saved revision');
$before = (int) $db->one('SELECT COUNT(*) AS n FROM ' . $db->table('sessions'))['n'];
$transport = $app->dispatch('GET', 'schedule', ['videoId' => 'video-1', 'boardId' => 'visitor-forgery']);
same((int) $db->one('SELECT COUNT(*) AS n FROM ' . $db->table('sessions'))['n'], $before, 'GET schedule does not persist a session');
same($transport['schedule']['boardId'], null, 'unknown manual video ignores visitor context');
same($transport['schedule']['scheduleVersion'], 1, 'published version returned');

$publishMode = function (array $target, string $mode, array $breaks = []) use ($app): void {
    $draft = $app->schedules->draft($target)['draft'];
    $draft = $app->schedules->save([...$draft, 'mode' => $mode, 'breaks' => $breaks])['draft'];
    $app->schedules->publish(['target' => $target, 'revision' => $draft['revision']]);
};
$host->saveVideoContext(['videoId' => 'video-1', 'label' => '실제 영상', 'boardId' => 'free', 'categoryId' => 'news']);
$board = ['type' => 'board', 'id' => 'free'];
$category = ['type' => 'category', 'id' => 'news', 'boardId' => 'free'];
$video = ['type' => 'video', 'id' => 'video-1'];
$publishMode($board, 'disabled');
same($app->dispatch('GET', 'schedule', ['videoId' => 'video-1'])['schedule']['breaks'], [], 'board disabled stops site fallback');
$publishMode($category, 'replace', $saved['draft']['breaks']);
same(count($app->dispatch('GET', 'schedule', ['videoId' => 'video-1'])['schedule']['breaks']), 4, 'category takes priority over board');
$publishMode($video, 'disabled');
same($app->dispatch('GET', 'schedule', ['videoId' => 'video-1', 'boardId' => 'other'])['schedule']['breaks'], [], 'video disabled cannot be bypassed by visitor board');
$publishMode($video, 'inherit');
$publishMode($category, 'disabled');
$preview = $app->schedules->preview([...$saved['draft'], 'videoId' => 'video-1', 'boardId' => 'forged']);
same($preview['schedule']['breaks'], [], 'site draft preview respects actual video category disabled');
same($preview['schedule']['boardId'], 'free', 'preview preserves trusted board');
same($preview['schedule']['categoryId'], 'news', 'preview preserves trusted category');
$host->saveVideoContext(['videoId' => 'preview', 'label' => '실제 preview ID', 'boardId' => null, 'categoryId' => null]);
$publishMode(['type' => 'video', 'id' => 'preview'], 'disabled');
same($app->schedules->draft($site)['resolvedFrom'], $site, 'video named preview cannot hijack site draft resolution');
same(count($app->schedules->preview($saved['draft'])['schedule']['breaks']), 4, 'target-only preview excludes unrelated video rule');
$publishMode($category, 'inherit');
$publishMode($board, 'inherit');

// Immutable publication survives both replacement and archive of its asset.
$image = $assets['creative-image'];
$replacement = $app->creatives->save(['creativeId' => $image['creativeId'], 'name' => '새 버전', 'url' => '/new.png', 'mime' => 'image/png', 'alt' => '새 소재'])['creative'];
same($replacement['version'], 2, 'replacement increments asset version');
$app->creatives->archive(['creativeId' => $image['creativeId']]);
fails(fn () => $app->schedules->publish(['target' => $site, 'revision' => 1]), 422, 'archive blocks new publication');
same($app->schedules->draft($site)['publishedVersion'], 1, 'failed publish leaves old live version');
same($app->dispatch('GET', 'schedule', ['videoId' => 'video-1'])['schedule']['breaks'][0]['ads'][0]['url'], $image['url'], 'old live snapshot remains intact');
$reopenedDb = new Database($config);
$reopened = new App($reopenedDb, $config, new Standalone($reopenedDb, $config));
same($reopened->schedules->draft($site)['publishedVersion'], 1, 'publication persists on new connection');
same($reopened->creatives->version($image['creativeId'], 1)['archived'], true, 'archive persists without deleting old media version');

function eventFor(array $transport, string $type, int $sequence, float $elapsed, string $attempt = 'attempt-a', string $itemId = 'pre-image'): array
{
    $schedule = $transport['schedule'];
    foreach ($schedule['breaks'] as $break) {
        foreach ($break['ads'] as $ad) {
            if ($ad['itemId'] === $itemId) {
                return ['schemaVersion' => 1, 'eventId' => 'event-' . Value::uuid(), 'playbackSessionId' => $transport['playbackSessionId'], 'breakAttemptId' => 'break-' . $transport['playbackSessionId'] . '-' . $break['breakId'], 'adAttemptId' => $attempt, 'breakId' => $break['breakId'], 'itemId' => $ad['itemId'], 'adId' => $ad['adId'], 'creativeId' => $ad['creativeId'], 'creativeVersion' => $ad['creativeVersion'], 'scheduleId' => $schedule['scheduleId'], 'scheduleVersion' => $schedule['scheduleVersion'], 'sequence' => $sequence, 'occurredAt' => '2026-10-18T00:00:00.000Z', 'contentTimeSeconds' => 0, 'adElapsedSeconds' => $elapsed, 'type' => $type];
            }
        }
    }
    throw new RuntimeException('Fixture item is missing.');
}
$send = function (array $session, array $events) use ($app): array {
    return $app->events->collect(['playbackSessionId' => $session['playbackSessionId'], 'eventToken' => $session['eventToken'], 'events' => $events]);
};
$today = (new DateTimeImmutable('now', new DateTimeZone($config['timeZone'])))->format('Y-m-d');
$filters = ['from' => $today, 'to' => $today];
$session = $app->dispatch('GET', 'schedule', ['videoId' => 'video-1']);
$complete = eventFor($session, 'complete', 4, 5);
$click = eventFor($session, 'click', 2, 2);
same($send($session, [$complete, $click]), ['accepted' => 2, 'duplicates' => 0, 'rejected' => 0], 'out-of-order terminal and click are retained');
same($app->statistics->get($filters)['totals']['completes'], 0, 'missing start never inferred');
$start = eventFor($session, 'start', 1, 0);
$click2 = eventFor($session, 'click', 3, 3);
same($send($session, [$start, $click2, $start]), ['accepted' => 2, 'duplicates' => 1, 'rejected' => 0], 'late start reconciles and exact retry is idempotent');
$totals = $app->statistics->get($filters)['totals'];
same($totals, ['starts' => 1, 'completes' => 1, 'skips' => 0, 'clicks' => 2, 'clickedStarts' => 1, 'errors' => 0, 'completionRate' => 1, 'clickRate' => 1], 'CTR counts clicked attempts, not raw clicks');
same($send($session, [[...$start, 'contentTimeSeconds' => 1]])['rejected'], 1, 'same event ID changed content conflicts');
same($send($session, [eventFor($session, 'skip', 5, 5)])['rejected'], 1, 'contradictory terminal rejected');
same($send($session, [eventFor($session, 'click', 5, 5)])['rejected'], 1, 'click after terminal rejected');
same($send($session, [eventFor($session, 'start', 1, 0, 'attempt-duplicate')])['rejected'], 1, 'same schedule item cannot acquire second attempt');

$other = $app->dispatch('GET', 'schedule', ['videoId' => 'video-1']);
same($send($other, [eventFor($other, 'start', 1, 0)])['rejected'], 1, 'attempt ID cannot cross sessions');
$wrongItem = eventFor($other, 'start', 1, 0, 'attempt-b');
$wrongItem['breakId'] = 'mid-10';
same($send($other, [$wrongItem])['rejected'], 1, 'item must belong to advertised break');
same($send($other, [eventFor($other, 'skip', 2, 1, 'attempt-b')])['rejected'], 1, 'advertised skip threshold enforced');
same($send($other, [eventFor($other, 'complete', 2, 1, 'attempt-b')])['rejected'], 1, 'image cannot complete early');
same($send($other, [eventFor($other, 'start', 1, 0, 'attempt-b'), eventFor($other, 'skip', 2, 2, 'attempt-b')])['accepted'], 2, 'threshold skip accepted');
$errorSession = $app->dispatch('GET', 'schedule', ['videoId' => 'video-1']);
same($send($errorSession, [eventFor($errorSession, 'error', 1, 0, 'attempt-load-error', 'pre-video')])['accepted'], 1, 'pre-start load failure is an error');
$totals = $app->statistics->get($filters)['totals'];
same([$totals['starts'], $totals['completes'], $totals['skips'], $totals['errors'], $totals['completionRate'], $totals['clickRate']], [2, 1, 1, 1, 0.5, 0.5], 'errors do not create starts and rates use start cohort');
$empty = $app->statistics->get([...$filters, 'videoId' => 'unknown'])['totals'];
same([$empty['starts'], $empty['completionRate'], $empty['clickRate']], [0, null, null], 'empty filtered denominators are null');
$forged = $session;
$forged['eventToken'][0] = $forged['eventToken'][0] === 'x' ? 'y' : 'x';
fails(fn () => $send($forged, [$start]), 403, 'signed token tampering denied');

// Optional click facts cannot starve required terminal/start facts, even in reverse arrival order.
foreach ([false, true] as $startLate) {
    $full = $app->dispatch('GET', 'schedule', ['videoId' => 'cap-' . (int) $startLate]);
    $attempt = 'attempt-cap-' . (int) $startLate;
    if (!$startLate) {
        same($send($full, [eventFor($full, 'start', 1, 0, $attempt)])['accepted'], 1, 'start before click cap');
    }
    $clicks = [];
    for ($i = 0; $i < 127; $i++) {
        $clicks[] = eventFor($full, 'click', $i + 2, 2, $attempt);
    }
    foreach (array_chunk($clicks, 50) as $chunk) {
        same($send($full, $chunk)['accepted'], count($chunk), 'bounded clicks accepted');
    }
    same($send($full, [eventFor($full, 'click', 129, 2, $attempt)])['rejected'], 1, 'click count bounded');
    same($send($full, [eventFor($full, 'complete', 130, 5, $attempt)])['accepted'], 1, 'terminal has reserved capacity');
    if ($startLate) {
        same($send($full, [eventFor($full, 'start', 1, 0, $attempt)])['accepted'], 1, 'late start has reserved capacity');
    }
    same($app->statistics->get([...$filters, 'videoId' => 'cap-' . (int) $startLate])['totals']['completes'], 1, 'cap does not lose completion');
}
$redacted = eventFor($other, 'start', 1, 0, 'attempt-redact');
$redacted['eventToken'] = $session['eventToken'];
$redacted['code'] = ['nested' => ['eventToken' => 'private-nested-token']];
same($send($other, [$redacted])['rejected'], 1, 'unknown and nested rejected fields');
$rejections = $db->run('SELECT payload FROM ' . $db->table('rejections'))->fetchAll();
$rejectionText = Value::json($rejections);
same(str_contains($rejectionText, $session['eventToken']), false, 'transport token never persisted in rejection');
same(str_contains($rejectionText, 'private-nested-token'), false, 'nested token never persisted in rejection');
same(str_contains($rejectionText, 'payloadSha256'), true, 'rejection retains one-way diagnostic hash');

// Explicit raw-fact fixture dates independently exercise local-midnight cohort boundaries.
$dateSession = $app->dispatch('GET', 'schedule', ['videoId' => '=SUM(1,2)']);
$dateStart = eventFor($dateSession, 'start', 1, 0, 'attempt-date');
$dateComplete = eventFor($dateSession, 'complete', 2, 5, 'attempt-date');
$send($dateSession, [$dateStart, $dateComplete]);
$db->run('UPDATE ' . $db->table('events') . ' SET received_at = ? WHERE event_id = ?', ['2026-10-17T15:00:00Z', $dateStart['eventId']]);
$db->run('UPDATE ' . $db->table('events') . ' SET received_at = ? WHERE event_id = ?', ['2026-10-19T01:00:00Z', $dateComplete['eventId']]);
$dateFilter = ['from' => '2026-10-18', 'to' => '2026-10-18', 'videoId' => '=SUM(1,2)', 'adId' => $image['creativeId']];
same($app->statistics->get($dateFilter)['totals']['completes'], 1, 'late completion belongs to first start local-date cohort');
same($app->statistics->get([...$dateFilter, 'from' => '2026-10-17', 'to' => '2026-10-17'])['totals']['starts'], 0, 'UTC boundary converted from site-local day');
$csv = $app->statistics->csv($dateFilter);
same(str_starts_with($csv, "\xEF\xBB\xBF"), true, 'CSV has UTF-8 BOM');
same(str_contains($csv, "'=SUM(1,2)"), true, 'CSV neutralizes spreadsheet formula');
fails(fn () => $app->statistics->get(['from' => '2026-02-30', 'to' => '2026-03-01']), 422, 'invalid calendar date rejected');

// GnuBoard display name reads the host member global; its runtime login is not exercised here.
$gnuboard = new GnuBoard($db, $config);
$member = ['mb_id' => 'host-admin', 'mb_nick' => '운영 담당'];
same($gnuboard->displayName(), '운영 담당', 'GnuBoard display name is the member nickname', 'a1');
$member = ['mb_id' => 'host-admin', 'mb_nick' => ' '];
same($gnuboard->displayName(), 'host-admin', 'GnuBoard display name falls back to the member ID', 'a1');
unset($member);

// Host links: GnuBoard constants are test values standing in for the host's config.php.
same($host->capabilities(), ['host' => 'standalone', 'manualTargets' => true, 'uploads' => true, 'loginUrl' => null, 'siteUrl' => null, 'adminUrl' => null], 'standalone capabilities have no host links', 'a1');
same(array_intersect_key($anon['capabilities'], ['siteUrl' => 0, 'adminUrl' => 0]), ['siteUrl' => null, 'adminUrl' => null], 'anonymous bootstrap carries host link capabilities', 'a1');
define('G5_URL', 'https://g5.example.test');
define('G5_ADMIN_URL', G5_URL . '/adm');
define('G5_BBS_URL', G5_URL . '/bbs');
same($gnuboard->capabilities(), ['host' => 'gnuboard', 'manualTargets' => false, 'uploads' => true, 'loginUrl' => 'https://g5.example.test/bbs/login.php', 'siteUrl' => 'https://g5.example.test', 'adminUrl' => 'https://g5.example.test/adm'], 'GnuBoard capabilities link the host site and admin as-is', 'a1');

// A1-API-4 and A2-1 player presets. Counted as their own group.
function rejects(callable $work, int $status, string $code, ?string $field, string $message, string $group = 'presets'): void
{
    try {
        $work();
    } catch (ApiError $error) {
        same([$error->status, $error->errorCode, $field === null ? null : array_keys($error->fields)], [$status, $code, $field === null ? null : [$field]], $message, $group);
        return;
    }
    throw new RuntimeException($message . ': unexpectedly succeeded');
}
$metaSnapshot = fn (): string => Value::json($db->run('SELECT name, value FROM ' . $db->table('meta') . ' ORDER BY name')->fetchAll());
$sqliteFile = substr($config['dsn'], strlen('sqlite:'));
$beforeMeta = $metaSnapshot();
$beforeFile = hash_file('sha256', $sqliteFile);
$emptyList = $app->dispatch('GET', 'player-presets', []);
$emptyRender = $app->dispatch('GET', 'player-preset', []);
same([$metaSnapshot(), hash_file('sha256', $sqliteFile)], [$beforeMeta, $beforeFile], 'reading presets without the meta key writes nothing', 'presets');
same($db->meta('player_presets'), null, 'meta key stays absent after reads', 'presets');
// A2-1 schema v2: the shared fixture is the single table PHP, TS and the loader validate against.
$presetRaw = file_get_contents(dirname(__DIR__) . '/fixtures/player-preset-v2.json');
$presetFixture = Value::decode($presetRaw);
$presetObjects = json_decode($presetRaw, false, 64, JSON_THROW_ON_ERROR);
$builtIns = $presetFixture['builtIn'];
same(array_column($builtIns, 'id'), ['default', 'flat', 'rounded', 'accent', 'lms'], 'fixture lists the five built-ins in order', 'presets');
same($emptyList, ['revision' => 0, 'defaultPresetId' => 'default', 'presets' => $builtIns, 'migratedNeutral' => [], 'migratedLabels' => []], 'absent document lists only the built-ins', 'presets');
same(Value::json($emptyRender), '{"id":"default","revision":0,"playerType":"videojs","language":null,"playback":{"autoplay":false,"muted":false,"loop":false,"preload":"metadata"},"display":{"poster":true,"title":true},"input":{"hotkeys":true,"gestures":true},"controls":{"captions":true,"quality":true,"audioTrack":true,"playbackRate":true,"pip":true,"fullscreen":true,"thumbnails":true,"seekButtons":null,"seekPlacement":"bar"},"logo":null,"progress":{"sequence":true,"timer":true,"bar":false},"labels":{},"skinTag":"video-skin","styles":{"css":"video.css","js":"video.js"},"css":{},"attributes":{"lang":"ko"}}', 'built-in render has empty objects', 'presets');
same($app->dispatch('GET', 'bootstrap', [])['capabilities']['playerPresets'], true, 'bootstrap advertises player presets', 'presets');
foreach ($presetFixture['normalize'] as $case) {
    try {
        $outcome = ['ok' => true, 'preset' => PlayerPresets::normalize($case['input'])];
    } catch (ApiError $error) {
        $outcome = ['ok' => false, 'status' => $error->status, 'field' => array_keys($error->fields)];
        $case['expect'] = ['ok' => false, 'status' => $case['expect']['field'] === 'id' ? 400 : 422, 'field' => [$case['expect']['field']]];
    }
    same($outcome, $case['expect'], 'fixture normalize: ' . $case['name'], 'presets');
}
foreach ($presetFixture['render'] as $index => $case) {
    same(Value::json(PlayerPresets::renderPreset($case['preset'], $case['revision'])), Value::json($presetObjects->render[$index]->render), 'fixture render: ' . $case['name'], 'presets');
}
foreach ($presetFixture['migrate'] as $case) {
    same(PlayerPresets::migrate($case['stored']), $case['expect'], 'fixture migrate: ' . $case['name'], 'presets');
}

// Schema boundaries kept from A1-API-4, now on the v2 shape.
$base = ['name' => '테스트', 'playerType' => 'videojs'];
$nativeBase = ['name' => '기본 video', 'playerType' => 'native'];
$accept = fn (array $preset): array => PlayerPresets::normalize($preset);
$reject = function (array $preset, string $field, string $message) use ($accept): void {
    rejects(fn () => $accept($preset), 422, 'validation', $field, $message);
};
$ads = fn (array $values): array => [...$base, 'ads' => $values];
$labelKeys = ['advertisement', 'sequence', 'playPause', 'mute', 'volume', 'advertiser', 'newWindow', 'skip', 'skipCountdown', 'timer', 'loading', 'paused', 'blocked', 'enterFullscreen', 'exitFullscreen', 'fullscreenError'];
$labels = fn (array $values): array => [...array_fill_keys($labelKeys, null), ...$values];
same(array_keys($accept($base)), ['id', 'name', 'playerType', 'language', 'theme', 'playback', 'display', 'input', 'controls', 'logo', 'ads', 'lms'], 'normalized preset keeps the v2 key order', 'presets');
same(array_keys($accept($base)['ads']), ['labels', 'accentColor', 'skipRadius', 'fontSize', 'progress', 'timeouts'], 'normalized ads keeps the v2 key order', 'presets');
same(array_keys($accept($base)['ads']['labels']), $labelKeys, 'normalized labels keep the 16-key order', 'presets');
same($accept([...$base, 'name' => '  앞뒤 공백  '])['name'], '앞뒤 공백', 'name is trimmed', 'presets');
same($accept([...$base, 'name' => str_repeat('가', 40)])['name'], str_repeat('가', 40), 'name accepts 40 characters', 'presets');
$reject([...$base, 'name' => '   '], 'name', 'blank name rejected');
$reject([...$base, 'name' => str_repeat('가', 41)], 'name', '41-character name rejected');
$reject([...$base, 'name' => "탭\t이름"], 'name', 'control character in name rejected');
$reject([...$base, 'name' => "C1\u{0085}"], 'name', 'C1 control character in name rejected');
$reject(['name' => 'x'], 'playerType', 'player type required');
$reject([...$base, 'playerType' => 'flash'], 'playerType', 'unknown player type rejected');
$reject([...$base, 'unknown' => 1], 'unknown', 'unknown top-level key rejected');
same($accept([...$base, 'builtIn' => true, 'createdAt' => 'x', 'updatedAt' => 'y'])['name'], '테스트', 'echoed server-owned list fields are ignored', 'presets');
same(array_key_exists('skin', $accept($base)), false, 'v2 presets have no skin', 'presets');
foreach (['empty' => '', 'default' => 'default', 'neutral' => 'neutral', 'compat' => 'compat'] as $kind => $skin) {
    $reject([...$base, 'skin' => $skin], 'skin', $kind . ' skin rejected as a removed key');
}
foreach (['array' => ['x'], 'object' => ['name' => 'default'], 'number' => 1, 'boolean' => true] as $kind => $skin) {
    $reject([...$base, 'skin' => $skin], 'skin', $kind . ' skin rejected without a type error');
}
same(array_key_exists('skin', $accept($nativeBase)), false, 'native has no skin', 'presets');
$reject([...$nativeBase, 'skin' => 'default'], 'skin', 'native skin rejected');
foreach (['accentColor', 'accentTextColor', 'borderColor'] as $field) {
    same($accept([...$base, 'theme' => [$field => '#0a1b2c']])['theme'][$field], '#0a1b2c', "theme.$field accepts lowercase #rrggbb", 'presets');
    $reject([...$base, 'theme' => [$field => '#0A1B2C']], "theme.$field", "theme.$field rejects uppercase");
}
same($accept([...$base, 'theme' => ['accentColor' => '']])['theme']['accentColor'], null, 'empty color becomes null', 'presets');
same([$accept([...$base, 'theme' => ['borderColor' => '#00000026']])['theme']['borderColor'], $accept([...$base, 'theme' => ['borderColor' => '#00000000']])['theme']['borderColor']], ['#00000026', '#00000000'], 'border color accepts #rrggbbaa', 'presets');
$reject([...$base, 'theme' => ['borderColor' => '#0000002']], 'theme.borderColor', '7-digit border color rejected');
$reject([...$base, 'theme' => ['borderColor' => '#000000260']], 'theme.borderColor', '9-digit border color rejected');
$reject([...$base, 'theme' => ['borderColor' => '#0000002A']], 'theme.borderColor', 'uppercase alpha border color rejected');
foreach (['theme.accentColor' => ['theme' => ['accentColor' => '#2563eb80']], 'theme.accentTextColor' => ['theme' => ['accentTextColor' => '#ffffff80']], 'ads.accentColor' => ['ads' => ['accentColor' => '#2563eb80']]] as $field => $values) {
    $reject([...$base, ...$values], $field, $field . ' keeps rejecting #rrggbbaa');
}
$reject([...$base, 'theme' => ['borderColor' => '#abc']], 'theme.borderColor', 'short hex rejected');
same([$accept([...$base, 'theme' => ['borderRadius' => 0]])['theme']['borderRadius'], $accept([...$base, 'theme' => ['borderRadius' => 32]])['theme']['borderRadius']], [0, 32], 'border radius bounds accepted', 'presets');
$reject([...$base, 'theme' => ['borderRadius' => 33]], 'theme.borderRadius', 'border radius above 32 rejected');
$reject([...$base, 'theme' => ['borderRadius' => '12']], 'theme.borderRadius', 'string radius rejected');
$reject([...$base, 'theme' => ['borderRadius' => 12.0]], 'theme.borderRadius', 'float radius rejected');
same($accept([...$base, 'theme' => ['fontFamily' => 'system', 'objectFit' => 'cover', 'scaleUnit' => 'root']])['theme']['objectFit'], 'cover', 'theme enums accepted', 'presets');
$reject([...$base, 'theme' => ['fontFamily' => 'serif']], 'theme.fontFamily', 'unknown font family rejected');
$reject([...$base, 'theme' => ['objectFit' => 'fill']], 'theme.objectFit', 'unknown object fit rejected');
$reject([...$base, 'theme' => ['scaleUnit' => 'px']], 'theme.scaleUnit', 'unknown scale unit rejected');
$reject([...$base, 'theme' => ['shadow' => 1]], 'theme.shadow', 'unknown theme key rejected');
$reject([...$base, 'theme' => 'dark'], 'theme', 'non-object theme rejected');
$reject([...$nativeBase, 'theme' => ['accentColor' => '#112233']], 'theme.accentColor', 'native theme value rejected');
same($accept([...$base, 'language' => 'en'])['language'], 'en', 'language replaces ads.locale', 'presets');
$reject($ads(['locale' => 'en']), 'ads.locale', 'removed ads.locale rejected');
$reject($ads(['locale' => 'ja']), 'ads.locale', 'removed ads.locale rejected for any value');
same($accept($ads(['labels' => ['skip' => ' 건너뛰기 ']]))['ads']['labels'], $labels(['skip' => '건너뛰기']), 'plain labels trimmed', 'presets');
same($accept($ads(['labels' => ['skip' => '   ']]))['ads']['labels']['skip'], null, 'blank label becomes null', 'presets');
$reject($ads(['labels' => ['skip' => str_repeat('a', 41)]]), 'ads.labels.skip', '41-character label rejected');
$reject($ads(['labels' => ['skip' => "건너\u{0007}뛰기"]]), 'ads.labels.skip', 'control character label rejected');
// Same table as ui/tests/player-preset.test.tsx: PHP trims what String.prototype.trim trims.
foreach (['NBSP' => "\u{00A0}건너뛰기\u{00A0}", 'U+3000' => "\u{3000}건너뛰기\u{3000}", 'U+FEFF' => "\u{FEFF}건너뛰기"] as $kind => $value) {
    $trimmed = $accept([...$ads(['labels' => ['skip' => $value]]), 'name' => $value]);
    same([$trimmed['name'], $trimmed['ads']['labels']['skip']], ['건너뛰기', '건너뛰기'], $kind . ' trimmed like String.prototype.trim', 'presets');
}
same($accept($ads(['labels' => ['skip' => "건너\u{00A0}뛰기\u{2029}"]]))['ads']['labels']['skip'], "건너\u{00A0}뛰기", 'inner space kept, trailing paragraph separator trimmed', 'presets');
foreach (['RLO U+202E' => "\u{202E}기뛰너건", 'LRE U+202A' => "\u{202A}건너뛰기", 'LRI U+2066' => "\u{2066}건너뛰기\u{2069}", 'PDI U+2069' => "건너뛰기\u{2069}"] as $kind => $value) {
    $reject([...$base, 'name' => $value], 'name', $kind . ' rejected in name');
    $reject($ads(['labels' => ['skip' => $value]]), 'ads.labels.skip', $kind . ' rejected in skip label');
    $reject($ads(['labels' => ['timer' => $value]]), 'ads.labels.timer', $kind . ' rejected in timer label');
}
same($accept($ads(['labels' => ['skip' => "\u{200F}건너뛰기"]]))['ads']['labels']['skip'], "\u{200F}건너뛰기", 'direction mark U+200F kept', 'presets');
$reject($ads(['labels' => ['skip' => '{seconds}']]), 'ads.labels.skip', 'skip label rejects placeholders');
$reject($ads(['labels' => ['mediaAlt' => '광고 영상']]), 'ads.labels.mediaAlt', 'mediaAlt is not part of the schema');
same($accept($ads(['labels' => ['skipCountdown' => '{seconds}초 뒤 건너뛰기']]))['ads']['labels']['skipCountdown'], '{seconds}초 뒤 건너뛰기', 'countdown accepts {seconds}', 'presets');
$reject($ads(['labels' => ['skipCountdown' => '{elapsed}초']]), 'ads.labels.skipCountdown', 'countdown rejects other placeholders');
$reject($ads(['labels' => ['skipCountdown' => '{seconds']]), 'ads.labels.skipCountdown', 'countdown rejects broken placeholder');
same($accept($ads(['labels' => ['timer' => '{elapsed} / {duration}']]))['ads']['labels']['timer'], '{elapsed} / {duration}', 'timer accepts elapsed and duration', 'presets');
$reject($ads(['labels' => ['timer' => '{seconds}']]), 'ads.labels.timer', 'timer rejects seconds');
same($accept($ads(['labels' => ['timer' => '{remaining}초 남음']]))['ads']['labels']['timer'], '{remaining}초 남음', 'timer accepts remaining', 'presets');
same($accept($ads(['labels' => ['timer' => '{elapsed}/{duration} · {remaining}']]))['ads']['labels']['timer'], '{elapsed}/{duration} · {remaining}', 'timer accepts all three placeholders', 'presets');
$reject($ads(['labels' => ['timer' => '{remain}초']]), 'ads.labels.timer', 'timer still rejects unknown placeholders');
$reject($ads(['labels' => ['title' => '광고']]), 'ads.labels.title', 'unknown label rejected');
same($accept($ads(['accentColor' => '#ff6600']))['ads']['accentColor'], '#ff6600', 'ads accent accepted', 'presets');
$reject($ads(['accentColor' => '#gg6600']), 'ads.accentColor', 'invalid ads accent rejected');
same([$accept($ads(['skipRadius' => 0]))['ads']['skipRadius'], $accept($ads(['skipRadius' => 24]))['ads']['skipRadius']], [0, 24], 'skip radius bounds accepted', 'presets');
$reject($ads(['skipRadius' => 25]), 'ads.skipRadius', 'skip radius above 24 rejected');
same([$accept($ads(['fontSize' => 11]))['ads']['fontSize'], $accept($ads(['fontSize' => 18]))['ads']['fontSize']], [11, 18], 'font size bounds accepted', 'presets');
$reject($ads(['fontSize' => 10]), 'ads.fontSize', 'font size below 11 rejected');
$reject($ads(['fontSize' => 19]), 'ads.fontSize', 'font size above 18 rejected');
same($accept([...$nativeBase, 'ads' => ['timeouts' => ['loadSeconds' => 60, 'stallSeconds' => 120]]])['ads']['timeouts'], ['loadSeconds' => 60, 'stallSeconds' => 120], 'native timeout upper bounds accepted', 'presets');
$reject([...$nativeBase, 'ads' => ['timeouts' => ['loadSeconds' => 0]]], 'ads.timeouts.loadSeconds', 'load timeout below 1 rejected');
$reject([...$nativeBase, 'ads' => ['timeouts' => ['stallSeconds' => 121]]], 'ads.timeouts.stallSeconds', 'stall timeout above 120 rejected');
$reject($ads(['timeouts' => ['loadSeconds' => 5]]), 'ads.timeouts.loadSeconds', 'Video.js timeout rejected');
$reject($ads(['volume' => 1]), 'ads.volume', 'unknown ads key rejected');

// The ETag is a content hash of the render; matching follows contract 3.1.
same(Http::etag(['id' => 'default']), '"' . substr(hash('sha256', '{"id":"default"}'), 0, 32) . '"', 'ETag is the quoted first 32 hex of the data sha256', 'presets');
same(preg_match('/^"[0-9a-f]{32}"$/D', Http::etag($emptyRender)), 1, 'ETag is a strong 32-hex tag', 'presets');
$tag = Http::etag($emptyRender);
same([Http::matches(null, $tag), Http::matches($tag, $tag), Http::matches('W/' . $tag, $tag), Http::matches('"x", ' . $tag, $tag), Http::matches('*', $tag), Http::matches('"x"', $tag), Http::matches(trim($tag, '"'), $tag)], [false, true, true, true, true, false, false], 'If-None-Match exact, weak, list and * matching', 'presets');

// Create, update and duplicate (a create from copied fields) through the admin actions.
$vjsInput = ['name' => '브랜드 Video.js', 'playerType' => 'videojs', 'language' => 'ko',
    'theme' => ['accentColor' => '#ff6600', 'accentTextColor' => '#ffffff', 'borderColor' => '#222222', 'borderRadius' => 12, 'fontFamily' => 'system', 'objectFit' => 'cover', 'scaleUnit' => 'root'],
    'controls' => ['pip' => false, 'seekButtons' => 10],
    'ads' => ['labels' => ['skip' => '건너뛰기', 'skipCountdown' => '{seconds}초 뒤 건너뛰기', 'timer' => '{elapsed} / {duration} ({remaining})'], 'accentColor' => '#00aa55', 'skipRadius' => 8, 'fontSize' => 14]];
$created = $app->dispatch('POST', 'player-preset-save', ['preset' => $vjsInput, 'revision' => 0], $host->csrfToken());
$vjs = $created['preset'];
same([$created['revision'], preg_match('/^p-[a-z0-9]{10}$/D', $vjs['id']), $vjs['builtIn'], preg_match('/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/D', $vjs['createdAt']), $vjs['createdAt'] === $vjs['updatedAt']], [1, 1, false, 1, true], 'create assigns server ID, revision and timestamps', 'presets');
same(array_column($created['presets'], 'id'), ['default', 'flat', 'rounded', 'accent', 'lms', $vjs['id']], 'list keeps built-ins first', 'presets');
same([Value::decode($db->meta('player_presets'))['schema'], $created['migratedNeutral'], $created['migratedLabels']], [2, [], []], 'writes store a schema 2 document', 'presets');
$copy = $app->dispatch('POST', 'player-preset-save', ['preset' => [...array_diff_key($vjs, ['id' => 0]), 'name' => '브랜드 복제'], 'revision' => 1], $host->csrfToken())['preset'];
same([$copy['id'] !== $vjs['id'], $copy['theme'], $copy['controls'], $copy['name']], [true, $vjs['theme'], $vjs['controls'], '브랜드 복제'], 'duplicate creates a new ID with copied settings', 'presets');
$builtInCopy = $app->dispatch('POST', 'player-preset-save', ['preset' => [...array_diff_key($builtIns[3], ['id' => 0]), 'name' => '강조색 복제'], 'revision' => 2], $host->csrfToken())['preset'];
same([$builtInCopy['builtIn'], $builtInCopy['theme'], $builtInCopy['ads']['accentColor']], [false, $builtIns[3]['theme'], '#2563eb'], 'a built-in duplicates into a stored preset', 'presets');
$app->dispatch('POST', 'player-preset-delete', ['id' => $builtInCopy['id'], 'revision' => 3], $host->csrfToken());
rejects(fn () => $app->dispatch('POST', 'player-preset-save', ['preset' => $vjsInput, 'revision' => 3], $host->csrfToken()), 409, 'revision_conflict', null, 'stale revision conflicts');
$updated = $app->dispatch('POST', 'player-preset-save', ['preset' => [...$vjs, 'name' => '브랜드 수정'], 'revision' => 4], $host->csrfToken());
same([$updated['revision'], $updated['preset']['id'], $updated['preset']['name'], $updated['preset']['createdAt'], count($updated['presets'])], [5, $vjs['id'], '브랜드 수정', $vjs['createdAt'], 7], 'update keeps ID and createdAt', 'presets');
foreach (['default', 'flat', 'rounded', 'accent', 'lms'] as $id) {
    rejects(fn () => $app->dispatch('POST', 'player-preset-save', ['preset' => [...$vjsInput, 'id' => $id], 'revision' => 5], $host->csrfToken()), 400, 'preset_builtin', null, "built-in $id cannot be modified");
    rejects(fn () => $app->dispatch('POST', 'player-preset-delete', ['id' => $id, 'revision' => 5], $host->csrfToken()), 400, 'preset_builtin', null, "built-in $id cannot be deleted");
}
rejects(fn () => $app->dispatch('POST', 'player-preset-save', ['preset' => [...$vjsInput, 'id' => 'p-0000000000'], 'revision' => 5], $host->csrfToken()), 404, 'preset_not_found', null, 'unknown update target');
rejects(fn () => $app->dispatch('POST', 'player-preset-save', ['preset' => [...$vjsInput, 'theme' => ['accentColor' => 'orange']], 'revision' => 5], $host->csrfToken()), 422, 'validation', 'theme.accentColor', 'save reports field path');
rejects(fn () => $app->dispatch('POST', 'player-preset-save', ['preset' => [...$vjsInput, 'playback' => ['autoplay' => true, 'muted' => false]], 'revision' => 5], $host->csrfToken()), 422, 'validation', 'playback.muted', 'save rejects unmuted autoplay');
rejects(fn () => $app->dispatch('POST', 'player-preset-delete', ['id' => 'P-BAD', 'revision' => 5], $host->csrfToken()), 400, 'invalid_preset_id', 'id', 'malformed delete ID');
same($db->meta('player_presets') !== null && Value::decode($db->meta('player_presets'))['revision'] === 5, true, 'failed writes keep revision', 'presets');

// Default selection, public render and fallback when the default preset is deleted.
$native = $app->dispatch('POST', 'player-preset-save', ['preset' => ['name' => '기본 video 영어', 'playerType' => 'native', 'language' => 'en', 'ads' => ['labels' => ['skip' => 'Skip ad'], 'accentColor' => '#3366ff', 'fontSize' => 12, 'timeouts' => ['loadSeconds' => 8]]], 'revision' => 5], $host->csrfToken())['preset'];
$withDefault = $app->dispatch('POST', 'player-preset-default', ['id' => $vjs['id'], 'revision' => 6], $host->csrfToken());
same([$withDefault['revision'], $withDefault['defaultPresetId']], [7, $vjs['id']], 'stored preset becomes default', 'presets');
rejects(fn () => $app->dispatch('POST', 'player-preset-default', ['id' => 'p-zzzzzzzzzz', 'revision' => 7], $host->csrfToken()), 404, 'preset_not_found', null, 'unknown default rejected');
$vjsRender = $app->dispatch('GET', 'player-preset', []);
same(Value::json($vjsRender), Value::json(['id' => $vjs['id'], 'revision' => 7, 'playerType' => 'videojs', 'language' => 'ko',
    'playback' => ['autoplay' => false, 'muted' => false, 'loop' => false, 'preload' => 'metadata'], 'display' => ['poster' => true, 'title' => true], 'input' => ['hotkeys' => true, 'gestures' => true],
    'controls' => ['captions' => true, 'quality' => true, 'audioTrack' => true, 'playbackRate' => true, 'pip' => false, 'fullscreen' => true, 'thumbnails' => true, 'seekButtons' => 10, 'seekPlacement' => 'bar'],
    'logo' => null, 'progress' => ['sequence' => true, 'timer' => true, 'bar' => false],
    'labels' => ['skip' => '건너뛰기', 'skipCountdown' => '{seconds}초 뒤 건너뛰기', 'timer' => '{elapsed} / {duration} ({remaining})'],
    'skinTag' => 'video-skin', 'styles' => ['css' => 'video.css', 'js' => 'video.js'],
    'css' => ['--media-accent-color' => '#ff6600', '--media-accent-text-color' => '#ffffff', '--media-border-color' => '#222222', '--media-border-radius' => '12px', '--media-font-family' => 'system-ui, sans-serif', '--media-object-fit' => 'cover', '--media-scale-unit' => '1rem', '--ads-accent-color' => '#00aa55', '--ads-skip-radius' => '8px', '--ads-font-size' => '14px'],
    'attributes' => ['lang' => 'ko', 'skip-label' => '건너뛰기', 'skip-countdown-label' => '{seconds}초 뒤 건너뛰기', 'timer-label' => '{elapsed} / {duration} ({remaining})']]), 'default render follows the selected Video.js preset', 'presets');
$nativeRender = $app->dispatch('GET', 'player-preset', ['id' => $native['id']]);
same(Value::json($nativeRender), Value::json(['id' => $native['id'], 'revision' => 7, 'playerType' => 'native', 'language' => 'en',
    'playback' => ['autoplay' => false, 'muted' => false, 'loop' => false, 'preload' => 'metadata'], 'display' => ['poster' => true],
    'progress' => ['sequence' => true, 'timer' => true, 'bar' => false], 'labels' => ['skip' => 'Skip ad'], 'skinTag' => null, 'styles' => null,
    'css' => ['--ads-accent-color' => '#3366ff', '--ads-font-size' => '12px'], 'ui' => ['locale' => 'ko', 'labels' => ['skip' => 'Skip ad']], 'timeouts' => ['loadSeconds' => 8]]), 'native render uses ui and timeouts without attributes', 'presets');
same(array_key_exists('name', $vjsRender) || array_key_exists('name', $nativeRender) || array_key_exists('skin', $vjsRender), false, 'public render omits name and skin', 'presets');
foreach ($presetFixture['render'] as $index => $case) {
    if (in_array($case['preset']['id'], ['default', 'flat', 'rounded', 'accent', 'lms'], true)) {
        $expected = json_decode(Value::json($presetObjects->render[$index]->render), false, 64, JSON_THROW_ON_ERROR);
        $expected->revision = 7;
        same(Value::json($app->dispatch('GET', 'player-preset', ['id' => $case['preset']['id']])), Value::json($expected), 'built-in ' . $case['preset']['id'] . ' remains addressable', 'presets');
    }
}
$accentDefault = $app->dispatch('POST', 'player-preset-default', ['id' => 'accent', 'revision' => 7], $host->csrfToken());
same([$accentDefault['revision'], $accentDefault['defaultPresetId'], Value::json($app->dispatch('GET', 'player-preset', [])['css'])], [8, 'accent', '{"--media-accent-color":"#2563eb","--media-accent-text-color":"#ffffff","--ads-accent-color":"#2563eb"}'], 'a built-in can be applied to the site', 'presets');
$flatDefault = $app->dispatch('POST', 'player-preset-default', ['id' => 'flat', 'revision' => 8], $host->csrfToken());
$flatRender = $app->dispatch('GET', 'player-preset', []);
same([$flatDefault['defaultPresetId'], $flatRender['id'], Value::json($flatRender['css'])], ['flat', 'flat', '{"--media-border-color":"#00000000","--media-border-radius":"0px"}'], 'flat applied to the site renders no border and square corners', 'presets');
$app->dispatch('POST', 'player-preset-default', ['id' => $vjs['id'], 'revision' => 9], $host->csrfToken());
rejects(fn () => $app->dispatch('GET', 'player-preset', ['id' => 'p-zzzzzzzzzz']), 404, 'preset_not_found', null, 'unknown public preset');
rejects(fn () => $app->dispatch('GET', 'player-preset', ['id' => '../x']), 400, 'invalid_preset_id', 'id', 'malformed public preset ID');
$afterDelete = $app->dispatch('POST', 'player-preset-delete', ['id' => $vjs['id'], 'revision' => 10], $host->csrfToken());
same([$afterDelete['revision'], $afterDelete['defaultPresetId'], in_array($vjs['id'], array_column($afterDelete['presets'], 'id'), true)], [11, 'default', false], 'deleting the default falls back to built-in', 'presets');
same($app->dispatch('GET', 'player-preset', [])['id'], 'default', 'public default follows fallback', 'presets');

// The limit counts stored presets only; the 21st create fails without changing the document.
$revision = 11;
for ($count = count($afterDelete['presets']) - 5; $count < PlayerPresets::LIMIT; $count++) {
    $revision = $app->dispatch('POST', 'player-preset-save', ['preset' => [...$base, 'name' => '한도 ' . $count], 'revision' => $revision], $host->csrfToken())['revision'];
}
same(count($app->dispatch('GET', 'player-presets', [])['presets']), PlayerPresets::LIMIT + 5, '20 stored presets plus five built-ins', 'presets');
rejects(fn () => $app->dispatch('POST', 'player-preset-save', ['preset' => $base, 'revision' => $revision], $host->csrfToken()), 400, 'preset_limit', null, '21st stored preset rejected');
same(Value::decode($db->meta('player_presets'))['revision'], $revision, 'limit failure keeps revision', 'presets');

// A v1 document (no schema key) is read as v2 in memory only; the first write stores v2.
$v1Stored = array_column($presetFixture['migrate'], 'stored');
$v1Neutral = array_values(array_column(array_filter($v1Stored, fn (array $preset): bool => $preset['skin'] === 'neutral'), 'id'));
$v1Raw = Value::json(['revision' => 30, 'defaultPresetId' => $v1Stored[0]['id'], 'presets' => $v1Stored]);
$db->run('UPDATE ' . $db->table('meta') . ' SET value = ? WHERE name = ?', [$v1Raw, 'player_presets']);
$v1List = $app->dispatch('GET', 'player-presets', []);
same([$v1List['revision'], $v1List['defaultPresetId'], $v1List['migratedNeutral']], [30, $v1Stored[0]['id'], $v1Neutral], 'v1 document lists its neutral presets', 'presets');
// ads-a2e-spec 6.3: English labels saved under locale en fall back to the Korean defaults.
same($v1List['migratedLabels'], ['p-migrate001'], 'v1 document lists the presets whose English labels were dropped', 'presets');
same(array_slice($v1List['presets'], 5), array_map(fn (array $case): array => [...$case['expect'], 'builtIn' => false], $presetFixture['migrate']), 'v1 presets are listed in the v2 shape', 'presets');
$v1Render = $app->dispatch('GET', 'player-preset', []);
same([$v1Render['language'], array_key_exists('skin', $v1Render), Value::json($v1Render['labels'])], ['en', false, '{}'], 'v1 site preset renders as v2 without its English labels', 'presets');
same(str_contains(Value::json($app->dispatch('GET', 'player-preset', ['id' => 'p-migrate005'])), '예전 대체 텍스트'), false, 'stored mediaAlt is never rendered', 'presets');
same($db->meta('player_presets'), $v1Raw, 'reading a v1 document leaves it untouched', 'presets');
$v2Write = $app->dispatch('POST', 'player-preset-default', ['id' => 'p-migrate003', 'revision' => 30], $host->csrfToken());
$v2Doc = Value::decode($db->meta('player_presets'));
$v2List = $app->dispatch('GET', 'player-presets', []);
same([$v2Write['migratedNeutral'], $v2Write['migratedLabels'], array_keys($v2Doc), $v2Doc['revision'], $v2Doc['presets'], $v2List['migratedNeutral'], $v2List['migratedLabels']],
    [[], [], ['schema', 'revision', 'defaultPresetId', 'presets'], 31, array_column($presetFixture['migrate'], 'expect'), [], []], 'first write stores the v2 document and clears migratedNeutral and migratedLabels', 'presets');
same([str_contains($db->meta('player_presets'), 'mediaAlt'), str_contains($db->meta('player_presets'), '"skin"'), str_contains($db->meta('player_presets'), '"locale"')], [false, false, false], 'next write removes v1 keys', 'presets');
$db->run('UPDATE ' . $db->table('meta') . ' SET value = ? WHERE name = ?', [Value::json([...$v2Doc, 'schema' => 3]), 'player_presets']);
try {
    $app->dispatch('GET', 'player-presets', []);
    $unknownSchema = 'read';
} catch (RuntimeException $error) {
    $unknownSchema = $error->getMessage();
}
same($unknownSchema, 'Unsupported player preset schema.', 'an unknown schema is not guessed', 'presets');
$db->run('UPDATE ' . $db->table('meta') . ' SET value = ? WHERE name = ?', [Value::json($v2Doc), 'player_presets']);
$autoplayPreset = $app->dispatch('POST', 'player-preset-save', ['preset' => [...$base, 'name' => '자동재생', 'playback' => ['autoplay' => true]], 'revision' => 31], $host->csrfToken())['preset'];
same($app->dispatch('GET', 'player-preset', ['id' => $autoplayPreset['id']])['playback'], ['autoplay' => true, 'muted' => false, 'loop' => false, 'preload' => 'metadata'], 'render keeps an empty muted false even with autoplay; the loader mutes after merging', 'presets');

// GnuBoard keeps one stored preset as the site preset and has no lectures; the document is restored afterwards.
$siteHost = new class($db, $config) extends Host {
    public function authenticated(): bool { return true; }
    public function displayName(): string { return '운영 담당'; }
    public function csrfToken(): string { return 'site-token'; }
    public function verifyCsrf(mixed $token): void {}
    public function resolveVideoContext(string $videoId): array { return ['videoId' => $videoId, 'boardId' => null, 'categoryId' => null]; }
    public function capabilities(): array { return ['host' => 'gnuboard']; }
    public function targets(string $type, string $query, ?string $boardId): array { return []; }
    public function lectures(): bool { return false; }
    public function singlePlayerPreset(): bool { return true; }
};
$siteApp = new App($db, $config, $siteHost);
$storedPresets = $db->meta('player_presets');
$db->run('DELETE FROM ' . $db->table('meta') . ' WHERE name = ?', ['player_presets']);
$siteList = $siteApp->dispatch('GET', 'player-presets', []);
same([array_column($siteList['presets'], 'id'), $siteList['defaultPresetId']], [['default', 'flat', 'rounded', 'accent'], 'default'], 'without lectures the lecture built-in is not listed', 'presets');
same($siteApp->dispatch('GET', 'bootstrap', [])['capabilities']['lms'], false, 'bootstrap reports no lectures', 'presets');
foreach (['lms-session' => 'POST', 'lms-progress' => 'POST', 'lms-notes' => 'POST', 'lms-settings' => 'GET', 'lms-key-rotate' => 'POST', 'lms-test-token' => 'POST', 'lms-progress-list' => 'GET', 'lms-progress-csv' => 'GET'] as $action => $method) {
    rejects(fn () => $siteApp->dispatch($method, $action, [], 'site-token'), 404, 'action_not_found', null, $action . ' does not exist without lectures');
}
rejects(fn () => $siteApp->dispatch('GET', 'player-preset', ['id' => 'lms']), 404, 'preset_not_found', null, 'the lecture built-in does not render without lectures');
$siteSaved = $siteApp->dispatch('POST', 'player-preset-save', ['preset' => [...$base, 'name' => '플레이어 설정', 'lms' => ['enabled' => true]], 'revision' => 0], 'site-token');
$siteId = $siteSaved['preset']['id'];
$siteRender = $siteApp->dispatch('GET', 'player-preset', []);
same([$siteSaved['defaultPresetId'], $siteSaved['preset']['lms']['enabled'], $siteRender['id'], array_key_exists('lms', $siteRender)], [$siteId, null, $siteId, false], 'the first save becomes the site preset with lectures off', 'presets');
rejects(fn () => $siteApp->dispatch('POST', 'player-preset-save', ['preset' => [...$base, 'name' => '둘째'], 'revision' => 1], 'site-token'), 400, 'preset_single', null, 'a second stored preset is refused');
$siteUpdated = $siteApp->dispatch('POST', 'player-preset-save', ['preset' => [...$base, 'id' => $siteId, 'name' => '플레이어 설정', 'controls' => ['seekButtons' => 15]], 'revision' => 1], 'site-token');
same([$siteUpdated['revision'], $siteUpdated['defaultPresetId'], count($siteUpdated['presets']), $siteApp->dispatch('GET', 'player-preset', [])['controls']['seekButtons']], [2, $siteId, 5, 15], 'later saves update the one site preset', 'presets');
rejects(fn () => $siteApp->dispatch('POST', 'player-preset-default', ['id' => 'flat', 'revision' => 2], 'site-token'), 400, 'preset_fixed', null, 'the site preset cannot be switched');
rejects(fn () => $siteApp->dispatch('POST', 'player-preset-delete', ['id' => $siteId, 'revision' => 2], 'site-token'), 400, 'preset_fixed', null, 'the site preset cannot be deleted');
$db->run('UPDATE ' . $db->table('meta') . ' SET value = ? WHERE name = ?', [Value::json([...Value::decode($db->meta('player_presets')), 'defaultPresetId' => 'lms']), 'player_presets']);
same([$siteApp->dispatch('GET', 'player-presets', [])['defaultPresetId'], $siteApp->dispatch('GET', 'player-preset', [])['id']], ['default', 'default'], 'a lecture site preset chosen before reads as the plain default', 'presets');
$db->run('UPDATE ' . $db->table('meta') . ' SET value = ? WHERE name = ?', [$storedPresets, 'player_presets']);

// A1-FIX-API-2 video IDs: contract 4.1 string rules, echoed verbatim because players compare it exactly.
$schedule = fn (mixed $videoId): array => $app->dispatch('GET', 'schedule', ['videoId' => $videoId]);
foreach (['<bad>', ' 앞뒤 공백 ', "가\u{00A0}나", "\u{200F}영상", str_repeat('v', 128)] as $videoId) {
    same($schedule($videoId)['schedule']['videoId'], $videoId, 'valid video ID ' . Value::json($videoId) . ' echoed verbatim', 'videoId');
}
$invalidIds = ['empty' => '', 'array' => ['video-1'], 'number' => 1, 'C0' => "영상\u{0001}", 'C1' => "영상\u{0085}", 'RLO' => "\u{202E}영상", 'LRI/PDI' => "\u{2066}영상\u{2069}",
    'ASCII spaces only' => '   ', 'NBSP only' => "\u{00A0}", 'U+3000 only' => "\u{3000}\u{3000}", 'U+FEFF only' => "\u{FEFF}", '129 characters' => str_repeat('v', 129), 'invalid UTF-8' => "\xff"];
$sessionsBefore = $db->one('SELECT COUNT(*) AS n FROM ' . $db->table('sessions'))['n'];
foreach ($invalidIds as $kind => $videoId) {
    rejects(fn () => $schedule($videoId), 422, 'validation', 'videoId', 'public schedule rejects ' . $kind . ' video ID', 'videoId');
}
rejects(fn () => $app->dispatch('GET', 'schedule', []), 422, 'validation', 'videoId', 'public schedule requires a video ID', 'videoId');
same($db->one('SELECT COUNT(*) AS n FROM ' . $db->table('sessions'))['n'], $sessionsBefore, 'rejected schedule requests store nothing', 'videoId');
rejects(fn () => $app->dispatch('POST', 'video-context-save', ['videoId' => "\u{202E}영상", 'label' => '영상'], $host->csrfToken()), 422, 'validation', 'videoId', 'video context uses the same video ID rule', 'videoId');
rejects(fn () => $app->dispatch('POST', 'schedule-save', ['target' => ['type' => 'video', 'id' => "\u{3000}"], 'mode' => 'disabled', 'revision' => 0, 'breaks' => []], $host->csrfToken()), 422, 'validation', 'target.id', 'video targets use the same video ID rule', 'videoId');
rejects(fn () => $app->dispatch('POST', 'schedule-preview', ['target' => $site, 'mode' => 'replace', 'revision' => 0, 'breaks' => [], 'videoId' => "영상\u{0085}"], $host->csrfToken()), 422, 'validation', 'videoId', 'preview video ID uses the same rule', 'videoId');

// L-1 lecture (LMS) progress and notes (.agents/plans/ads-lms-spec.md 3). Counted as their own group.
$lmsPublic = fn (string $action, array $input): array => $app->dispatch('POST', $action, $input);
$lmsAdmin = fn (string $method, string $action, array $input = []): array|string => $app->dispatch($method, $action, $input, $host->csrfToken());
$claimsOf = fn (string $token): array => Value::decode(base64_decode(strtr(explode('.', $token)[0], '-_', '+/')));
$resetLimits = fn () => $db->run('UPDATE ' . $db->table('rate_limits') . ' SET hits = 0');
foreach (['lms-session' => ['videoId' => 'lms-video'], 'lms-progress' => ['lmsToken' => 'x.y', 'videoId' => 'lms-video'], 'lms-notes' => ['lmsToken' => 'x.y', 'videoId' => 'lms-video', 'op' => 'list']] as $action => $input) {
    rejects(fn () => $lmsPublic($action, $input), 503, 'lms_unavailable', null, $action . ' is 503 without the LMS tables', 'lms');
}
foreach (['lms-key-rotate' => ['POST', []], 'lms-test-token' => ['POST', ['learnerId' => 'alice', 'minutes' => 1]], 'lms-progress-list' => ['GET', []], 'lms-progress-csv' => ['GET', []]] as $action => [$method, $input]) {
    rejects(fn () => $lmsAdmin($method, $action, $input), 503, 'lms_unavailable', null, $action . ' is 503 without the LMS tables', 'lms');
}
same($lmsAdmin('GET', 'lms-settings'), ['installed' => false, 'keySet' => false, 'keyHint' => null, 'rotatedAt' => null], 'lms-settings reports a missing installation instead of failing', 'lms');
same($app->dispatch('GET', 'bootstrap', [])['capabilities']['lms'], ['installed' => false], 'bootstrap advertises LMS as not installed', 'lms');
$fullSchedule = $app->dispatch('GET', 'schedule', ['videoId' => 'lms-video']);
same(count($fullSchedule['schedule']['breaks']) > 1, true, 'other public actions keep working without the LMS tables', 'lms');
$db->migrateLms();
$db->migrateLms();
same([$db->meta('lms_schema_version'), $db->meta('schema_version'), $app->dispatch('GET', 'bootstrap', [])['capabilities']['lms']], ['1', '1', ['installed' => true]], 'the LMS migration is idempotent and leaves the core schema version', 'lms');

// The integration key and learner tokens (3.2).
rejects(fn () => $lmsAdmin('POST', 'lms-test-token', ['learnerId' => 'alice', 'minutes' => 10]), 400, 'lms_key_missing', null, 'a test token needs a key first', 'lms');
$rotated = $lmsAdmin('POST', 'lms-key-rotate');
$lmsKey = $rotated['key'];
same([preg_match('/^[0-9a-f]{64}$/D', $lmsKey), $rotated['keyHint'], $lmsAdmin('GET', 'lms-settings')], [1, '…' . substr($lmsKey, -4), ['installed' => true, 'keySet' => true, 'keyHint' => '…' . substr($lmsKey, -4), 'rotatedAt' => $rotated['rotatedAt']]], 'rotation returns the key once and settings show only its hint', 'lms');
rejects(fn () => $lmsAdmin('POST', 'lms-test-token', ['learnerId' => 'a b', 'minutes' => 10]), 422, 'validation', 'learnerId', 'test token learner ID pattern', 'lms');
rejects(fn () => $lmsAdmin('POST', 'lms-test-token', ['learnerId' => 'alice', 'minutes' => 1441]), 422, 'validation', 'minutes', 'test token lasts at most a day', 'lms');
$learnerToken = fn (array $payload, ?string $key = null): string => Lms::learnerToken($payload, $key ?? $lmsKey);
$session = fn (array $input = []): array => $lmsPublic('lms-session', ['videoId' => 'lms-video', ...$input]);
$defaultRules = ['completion' => 90, 'seekLimit' => 'free', 'maxRate' => 2];
same($session(), ['storage' => 'local', 'learner' => null, 'rules' => $defaultRules, 'progress' => null, 'notes' => []], 'without a learner the player stores in its browser', 'lms');
$soon = time() + 600;
foreach (['forged signature' => [$learnerToken(['v' => 1, 'sub' => 'alice', 'exp' => $soon], str_repeat('0', 64)), 'invalid'], 'expired' => [$learnerToken(['v' => 1, 'sub' => 'alice', 'exp' => time() - 1]), 'expired'],
    'expiry beyond a day' => [$learnerToken(['v' => 1, 'sub' => 'alice', 'exp' => time() + 86500]), 'invalid'], 'bad subject' => [$learnerToken(['v' => 1, 'sub' => 'a b', 'exp' => $soon]), 'invalid'],
    'unknown version' => [$learnerToken(['v' => 2, 'sub' => 'alice', 'exp' => $soon]), 'invalid'], 'extra claim' => [$learnerToken(['v' => 1, 'sub' => 'alice', 'exp' => $soon, 'role' => 'admin']), 'invalid'],
    'zero duration' => [$learnerToken(['v' => 1, 'sub' => 'alice', 'exp' => $soon, 'dur' => 0]), 'invalid'], 'not a token' => ['garbage', 'invalid'], 'not a string' => [['sub' => 'alice'], 'invalid']] as $kind => [$token, $error]) {
    same($session(['learnerToken' => $token]), ['storage' => 'local', 'learner' => null, 'learnerError' => $error, 'rules' => $defaultRules, 'progress' => null, 'notes' => []], $kind . ' learner token falls back to browser storage', 'lms');
}
$aliceToken = $lmsAdmin('POST', 'lms-test-token', ['learnerId' => 'alice', 'minutes' => 10])['token'];
same(Lms::verify($aliceToken, $lmsKey)['sub'], 'alice', 'the admin test token verifies with the integration key', 'lms');
$alice = $session(['learnerToken' => $aliceToken]);
same([array_keys($alice), $alice['storage'], $alice['learner'], $alice['progress'], $alice['notes']], [['storage', 'learner', 'lmsToken', 'expiresAt', 'rules', 'progress', 'notes'], 'server', 'external', null, []], 'a signed learner gets server storage', 'lms');
same(array_keys($claimsOf($alice['lmsToken'])), ['siteId', 'learner', 'videoId', 'sessionId', 'completion', 'seekLimit', 'maxRate', 'duration', 'exp'], 'LMS session claims', 'lms');
$lmsSign = function (array $claims) use ($db): string {
    $payload = rtrim(strtr(base64_encode(Value::json($claims)), '+/', '-_'), '=');
    return $payload . '.' . hash_hmac('sha256', $payload, hash_hmac('sha256', 'lms-session', $db->meta('signing_key')));
};
same($lmsSign($claimsOf($alice['lmsToken'])), $alice['lmsToken'], 'LMS tokens are signed with the lms-session key derived from signing_key', 'lms');

// Progress (3.3): merge, plausibility, idempotency, duration, completion.
$report = fn (array $session, int $seq, array $segments, array $extra = []): array => $lmsPublic('lms-progress', ['lmsToken' => $session['lmsToken'], 'videoId' => 'lms-video', 'seq' => $seq, 'reason' => 'interval', 'segments' => $segments, 'position' => 0, 'duration' => 100, 'rate' => 1, 'activeSecondsDelta' => 10, ...$extra]);
$rewind = fn (string $learner) => $db->run('UPDATE ' . $db->table('lms_progress') . ' SET reported_at = reported_at - 1000 WHERE learner = ?', [$learner]);
$first = $report($alice, 1, [[0, 100]]);
same($first, ['percent' => 60, 'completedAt' => null, 'maxWatched' => 60.0, 'segments' => [[0.0, 60.0]]], 'a first report keeps at most 30 s × maxRate of new coverage', 'lms');
same($report($alice, 1, [[0, 100]]), $first, 'a repeated seq returns the stored state unchanged', 'lms');
$rewind('x:alice');
same($report($alice, 2, [[50, 80], [0, 10]]), ['percent' => 80, 'completedAt' => null, 'maxWatched' => 80.0, 'segments' => [[0.0, 80.0]]], 'overlapping ranges are counted once', 'lms');
$rewind('x:alice');
$done = $report($alice, 3, [[80, 100]], ['position' => 100, 'reason' => 'ended']);
same([$done['percent'], preg_match('/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/D', (string) $done['completedAt'])], [100, 1], 'the server sets completedAt when the threshold is reached', 'lms');
$rewind('x:alice');
same($report($alice, 4, [[0, 5]])['completedAt'], $done['completedAt'], 'completedAt never changes once set', 'lms');
rejects(fn () => $report($alice, 5, [], ['duration' => 103]), 400, 'duration_mismatch', null, 'a duration more than 2 s off the first report is refused', 'lms');
same($report($alice, 5, [], ['duration' => 101.5])['percent'], 100, 'a duration within 2 s is accepted', 'lms');
rejects(fn () => $report($alice, 6, [], ['videoId' => 'other-video']), 403, 'invalid_session', null, 'a token for another video is refused', 'lms');
$tampered = substr($alice['lmsToken'], 0, -1) . (str_ends_with($alice['lmsToken'], '0') ? '1' : '0');
rejects(fn () => $report([...$alice, 'lmsToken' => $tampered], 6, []), 403, 'invalid_session', null, 'a forged LMS token is refused', 'lms');
rejects(fn () => $report([...$alice, 'lmsToken' => $lmsSign([...$claimsOf($alice['lmsToken']), 'exp' => time() - 1])], 6, []), 403, 'invalid_session', null, 'an expired LMS token is refused', 'lms');
rejects(fn () => $report([...$alice, 'lmsToken' => $fullSchedule['eventToken']], 6, []), 403, 'invalid_session', null, 'an ad event token is not an LMS token', 'lms');
rejects(fn () => $app->events->collect(['playbackSessionId' => $claimsOf($alice['lmsToken'])['sessionId'], 'eventToken' => $alice['lmsToken'], 'events' => [[]]]), 403, 'invalid_session', null, 'an LMS token is not an ad event token', 'lms');
rejects(fn () => $report($alice, 6, array_fill(0, 501, [0, 1])), 400, 'segment_limit', null, 'more than 500 ranges are refused', 'lms');
rejects(fn () => $report($alice, 6, [[5, 1]]), 422, 'validation', 'segments.0', 'a reversed range is refused', 'lms');
rejects(fn () => $report($alice, 6, [], ['reason' => 'tick']), 422, 'validation', 'reason', 'an unknown reason is refused', 'lms');
$bob = $session(['learnerToken' => $learnerToken(['v' => 1, 'sub' => 'bob', 'exp' => $soon])]);
same($bob['progress'], null, 'a second learner starts without the first one’s progress', 'lms');
same($report($bob, 1, [[0, 20]], ['activeSecondsDelta' => 100])['percent'], 20, 'the second learner reports separately', 'lms');
$activeOf = fn (string $learner): float => (float) $db->one('SELECT active_seconds FROM ' . $db->table('lms_progress') . ' WHERE learner = ?', [$learner])['active_seconds'];
same([$activeOf('x:bob'), $session(['learnerToken' => $aliceToken])['progress']['percent']], [30.0, 100], 'active seconds are capped by wall time and learners stay apart', 'lms');
$carol = $session(['learnerToken' => $learnerToken(['v' => 1, 'sub' => 'carol', 'exp' => $soon, 'dur' => 120])]);
rejects(fn () => $report($carol, 1, [[0, 10]]), 400, 'duration_mismatch', null, 'the LMS-signed duration wins over the reported one', 'lms');
same($report($carol, 1, [[0, 12]], ['duration' => 121])['percent'], 10, 'progress uses the signed duration', 'lms');

// Rules come from the preset; seekLimit watched until completion.
$lecture = $app->dispatch('POST', 'player-preset-save', ['preset' => [...$base, 'name' => '규칙 강의', 'lms' => ['enabled' => true, 'seekLimit' => 'watched', 'maxRate' => 1.5, 'completion' => 80]], 'revision' => $app->dispatch('GET', 'player-presets', [])['revision']], $host->csrfToken())['preset'];
$dave = $session(['presetId' => $lecture['id'], 'learnerToken' => $learnerToken(['v' => 1, 'sub' => 'dave', 'exp' => $soon])]);
same([$dave['rules'], $session(['presetId' => 'lms'])['rules'], $session(['presetId' => 'p-zzzzzzzzzz'])['rules']], [['completion' => 80, 'seekLimit' => 'watched', 'maxRate' => 1.5], $defaultRules, $defaultRules], 'rules come from the preset; the built-in and a deleted preset use the defaults', 'lms');
rejects(fn () => $session(['presetId' => '../x']), 400, 'invalid_preset_id', 'id', 'a malformed preset ID is refused', 'lms');
same($report($dave, 1, [[0, 10], [50, 60]]), ['percent' => 10, 'completedAt' => null, 'maxWatched' => 10.0, 'segments' => [[0.0, 10.0]]], 'seekLimit watched drops a range that starts past what was watched', 'lms');
$rewind('x:dave');
same($report($dave, 2, [[10.5, 20]])['segments'], [[0.0, 10.0], [10.5, 20.0]], 'one second past what was watched is allowed', 'lms');
$rewind('x:dave');
same(is_string($report($dave, 3, [[10, 90]])['completedAt']), true, 'the preset completion threshold applies', 'lms');
$rewind('x:dave');
same($report($dave, 4, [[95, 100]])['segments'], [[0.0, 90.0], [95.0, 100.0]], 'the seek rule is lifted after completion', 'lms');

// A signed-in host member wins over a learner token and stays bound to its token.
$memberHost = new class($db, $config) extends Host {
    public ?string $member = 'kim';
    public function authenticated(): bool { return false; }
    public function displayName(): string { return ''; }
    public function csrfToken(): string { return ''; }
    public function verifyCsrf(mixed $token): void {}
    public function resolveVideoContext(string $videoId): array { return ['videoId' => $videoId, 'boardId' => null, 'categoryId' => null]; }
    public function capabilities(): array { return []; }
    public function targets(string $type, string $query, ?string $boardId): array { return []; }
    public function learnerId(): ?string { return $this->member; }
};
$memberApp = new App($db, $config, $memberHost);
$kim = $memberApp->dispatch('POST', 'lms-session', ['videoId' => 'lms-video', 'learnerToken' => $aliceToken]);
same([$kim['storage'], $kim['learner'], $claimsOf($kim['lmsToken'])['learner']], ['server', 'member', 'g:kim'], 'a signed-in member wins over a learner token', 'lms');
$memberHost->member = 'lee';
rejects(fn () => $memberApp->dispatch('POST', 'lms-progress', ['lmsToken' => $kim['lmsToken'], 'videoId' => 'lms-video', 'seq' => 1, 'reason' => 'interval', 'segments' => [], 'position' => 0, 'duration' => 100, 'rate' => 1, 'activeSecondsDelta' => 0]), 403, 'invalid_session', null, 'a member token is refused once the member changes', 'lms');
if (!function_exists('verify_mb_key')) {
    function verify_mb_key(array $member): bool
    {
        return ($member['test_key'] ?? false) === true;
    }
}
$GLOBALS['member'] = ['mb_id' => 'kim', 'test_key' => true];
$memberIds = [$gnuboard->learnerId()];
$GLOBALS['member'] = ['mb_id' => 'kim', 'test_key' => false];
$memberIds[] = $gnuboard->learnerId();
$GLOBALS['member'] = ['mb_id' => '', 'test_key' => true];
$memberIds[] = $gnuboard->learnerId();
unset($GLOBALS['member']);
same([...$memberIds, $host->learnerId()], ['kim', null, null, null], 'GnuBoard learners are verified members; standalone has none', 'lms');

// Notes and bookmarks.
$notes = fn (array $session, string $op, ?array $note = null): array => $lmsPublic('lms-notes', ['lmsToken' => $session['lmsToken'], 'videoId' => 'lms-video', 'op' => $op, ...($note === null ? [] : ['note' => $note])]);
same($notes($alice, 'list'), ['notes' => []], 'a learner starts without notes', 'lms');
$first = $notes($alice, 'save', ['kind' => 'note', 'time' => 12.5, 'text' => '  핵심 정리  '])['notes'];
same([count($first), preg_match('/^n-[a-z0-9]{10}$/D', $first[0]['id']), array_slice($first[0], 1)], [1, 1, ['kind' => 'note', 'time' => 12.5, 'text' => '핵심 정리']], 'a note is saved trimmed with a server ID', 'lms');
same(array_column($notes($alice, 'save', ['kind' => 'bookmark', 'time' => 3, 'text' => ''])['notes'], 'kind'), ['bookmark', 'note'], 'notes are listed by time and a bookmark may be empty', 'lms');
same(mb_strlen($notes($alice, 'save', ['kind' => 'note', 'time' => 20, 'text' => str_repeat('가', 1000)])['notes'][2]['text']), 1000, 'a note may have 1000 characters', 'lms');
foreach (['blank note' => ['kind' => 'note', 'time' => 1, 'text' => '   '], '1001-character note' => ['kind' => 'note', 'time' => 1, 'text' => str_repeat('가', 1001)], 'line break' => ['kind' => 'note', 'time' => 1, 'text' => "첫 줄\n둘째 줄"],
    'bidi override' => ['kind' => 'note', 'time' => 1, 'text' => "\u{202E}메모"], '81-character bookmark' => ['kind' => 'bookmark', 'time' => 1, 'text' => str_repeat('a', 81)]] as $kind => $note) {
    rejects(fn () => $notes($alice, 'save', $note), 422, 'validation', 'note.text', $kind . ' rejected', 'lms');
}
rejects(fn () => $notes($alice, 'save', ['kind' => 'quiz', 'time' => 1, 'text' => 'x']), 422, 'validation', 'note.kind', 'unknown note kind rejected', 'lms');
rejects(fn () => $notes($alice, 'save', ['kind' => 'note', 'time' => 1, 'text' => 'x', 'color' => 'red']), 422, 'validation', 'note.color', 'unknown note key rejected', 'lms');
rejects(fn () => $notes($alice, 'delete', ['id' => 'N-BAD']), 422, 'validation', 'note.id', 'malformed note ID rejected', 'lms');
rejects(fn () => $notes($alice, 'archive'), 422, 'validation', 'op', 'unknown note operation rejected', 'lms');
$edited = $notes($alice, 'save', ['id' => $first[0]['id'], 'kind' => 'note', 'time' => 13, 'text' => '고친 정리'])['notes'];
same([count($edited), $edited[1]], [3, ['id' => $first[0]['id'], 'kind' => 'note', 'time' => 13.0, 'text' => '고친 정리']], 'saving with an ID updates the note', 'lms');
same($notes($bob, 'list'), ['notes' => []], 'another learner never sees the notes', 'lms');
rejects(fn () => $notes($bob, 'delete', ['id' => $first[0]['id']]), 404, 'note_not_found', null, 'another learner cannot delete a note', 'lms');
rejects(fn () => $notes($bob, 'save', ['id' => $first[0]['id'], 'kind' => 'note', 'time' => 1, 'text' => 'x']), 404, 'note_not_found', null, 'another learner cannot edit a note', 'lms');
$remaining = $notes($alice, 'delete', ['id' => $first[0]['id']])['notes'];
same([count($remaining), $db->one('SELECT deleted_at FROM ' . $db->table('lms_notes') . ' WHERE id = ?', [$first[0]['id']])['deleted_at'] !== null], [2, true], 'deleting hides the note without removing the row', 'lms');
for ($index = 2; $index < 200; $index++) {
    $db->run('INSERT INTO ' . $db->table('lms_notes') . ' (site_id, id, learner, video_id, kind, time_seconds, text, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [$config['siteId'], sprintf('n-fill%06d', $index), 'x:alice', 'lms-video', 'bookmark', $index, '', Value::now(), Value::now()]);
}
rejects(fn () => $notes($alice, 'save', ['kind' => 'note', 'time' => 1, 'text' => '201번째']), 400, 'note_limit', null, 'a learner keeps at most 200 notes per video', 'lms');

// Rate limits: 60 a minute per learner and video, and an installation bucket apart from ad events.
$resetLimits();
$erin = $session(['learnerToken' => $learnerToken(['v' => 1, 'sub' => 'erin', 'exp' => $soon])]);
for ($index = 1; $index < 60; $index++) {
    $notes($erin, 'list');
}
rejects(fn () => $notes($erin, 'list'), 429, 'rate_limit', null, 'the 61st request in a minute for one learner is refused', 'lms');
same(count($notes($alice, 'list')['notes']), 200, 'another learner keeps its own bucket', 'lms');
$resetLimits();
$tight = new App($db, [...$config, 'lmsRateLimitPerMinute' => 2], $host);
$tight->dispatch('POST', 'lms-session', ['videoId' => 'lms-video']);
$tight->dispatch('POST', 'lms-session', ['videoId' => 'lms-video']);
rejects(fn () => $tight->dispatch('POST', 'lms-session', ['videoId' => 'lms-video']), 429, 'rate_limit', null, 'the installation LMS bucket follows lmsRateLimitPerMinute', 'lms');
same(count($tight->dispatch('GET', 'schedule', ['videoId' => 'lms-video'])['schedule']['breaks']) > 1, true, 'ads are not limited by the LMS bucket', 'lms');
$resetLimits();
rejects(fn () => Config::validate([...$config, 'lmsRateLimitPerMinute' => 0]), 422, 'validation', 'lmsRateLimitPerMinute', 'lmsRateLimitPerMinute must be positive', 'lms');

// schedule&breaks=preroll for lecture presets.
$preroll = $app->dispatch('GET', 'schedule', ['videoId' => 'lms-video', 'breaks' => 'preroll']);
same([array_column($preroll['schedule']['breaks'], 'position'), $claimsOf($preroll['eventToken'])['breaks'], array_key_exists('breaks', $claimsOf($fullSchedule['eventToken']))], [['pre'], 'preroll', false], 'breaks=preroll serves only the pre break and signs the filter', 'lms');
rejects(fn () => $app->dispatch('GET', 'schedule', ['videoId' => 'lms-video', 'breaks' => 'mid']), 422, 'validation', 'breaks', 'an unknown breaks filter is refused', 'lms');
$midItem = array_values(array_filter($fullSchedule['schedule']['breaks'], fn (array $break): bool => $break['position'] === 'mid'))[0]['ads'][0]['itemId'];
$preEvent = eventFor($preroll, 'start', 1, 0, 'attempt-lms-pre', $preroll['schedule']['breaks'][0]['ads'][0]['itemId']);
$midEvent = [...eventFor($fullSchedule, 'start', 1, 0, 'attempt-lms-mid', $midItem), 'playbackSessionId' => $preroll['playbackSessionId']];
same($send($preroll, [$preEvent, $midEvent]), ['accepted' => 1, 'duplicates' => 0, 'rejected' => 1], 'a preroll session accepts only pre break events', 'lms');
same(Value::decode($db->one('SELECT snapshot_json FROM ' . $db->table('sessions') . ' WHERE session_id = ?', [$preroll['playbackSessionId']])['snapshot_json'])['breaks'], $preroll['schedule']['breaks'], 'the stored session snapshot is the preroll schedule', 'lms');

// Administrator list and CSV.
$progressRow = fn (string $learner, string $videoId, ?string $completedAt, string $updatedAt): array => [$config['siteId'], $learner, $videoId, '[]', $completedAt, Value::now(), $updatedAt];
$insertProgress = fn (array $values) => $db->run('INSERT INTO ' . $db->table('lms_progress') . ' (site_id, learner, video_id, segments, completed_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', $values);
for ($index = 0; $index < 51; $index++) {
    $insertProgress($progressRow(sprintf('x:page%02d', $index), 'page-video', null, sprintf('2026-01-01T00:00:%02dZ', $index)));
}
$insertProgress($progressRow('x:=formula', '=1+1', '2026-01-02T00:00:00Z', '2026-01-02T00:00:00Z'));
$page = $lmsAdmin('GET', 'lms-progress-list', ['videoId' => 'page-video', 'page' => '2']);
same([$page['total'], $page['page'], $page['pageSize'], array_column($page['rows'], 'learner')], [51, 2, 50, ['x:page00']], 'the list pages 50 rows, newest first', 'lms');
same(array_keys($lmsAdmin('GET', 'lms-progress-list')['rows'][0]), ['learner', 'videoId', 'percent', 'completedAt', 'activeSeconds', 'position', 'duration', 'updatedAt'], 'progress list row keys', 'lms');
same(array_column($lmsAdmin('GET', 'lms-progress-list', ['learner' => 'alice'])['rows'], 'learner'), ['x:alice'], 'a learner filter matches without its prefix', 'lms');
$doneLearners = array_column($lmsAdmin('GET', 'lms-progress-list', ['videoId' => 'lms-video', 'status' => 'done'])['rows'], 'learner');
sort($doneLearners);
same([$doneLearners, $lmsAdmin('GET', 'lms-progress-list', ['videoId' => 'lms-video', 'status' => 'doing', 'learner' => ''])['total']], [['x:alice', 'x:dave'], 2], 'status filters completed and in-progress learners', 'lms');
rejects(fn () => $lmsAdmin('GET', 'lms-progress-list', ['status' => 'late']), 422, 'validation', 'status', 'unknown status rejected', 'lms');
rejects(fn () => $lmsAdmin('GET', 'lms-progress-list', ['page' => '0']), 422, 'validation', 'page', 'page 0 rejected', 'lms');
rejects(fn () => $lmsAdmin('GET', 'lms-progress-list', ['videoId' => ['x']]), 422, 'validation', 'videoId', 'array video ID rejected', 'lms');
$csv = $lmsAdmin('GET', 'lms-progress-csv', ['videoId' => '=1+1']);
same($csv, "\xEF\xBB\xBFlearner,videoId,percent,completedAt,activeSeconds,position,duration,updatedAt\nx:=formula,'=1+1,0,2026-01-02T00:00:00Z,0,0,,2026-01-02T00:00:00Z\n", 'CSV has a BOM and quotes formula-like cells', 'lms');

fwrite(STDOUT, 'PASS ' . $checks['v1'] . ' persistence/authorization/publication/collector/statistics assertions (' . $db->driver . ").\n");
fwrite(STDOUT, 'PASS ' . $checks['a1'] . " A1 bootstrap user/capability assertions (counted separately).\n");
fwrite(STDOUT, 'PASS ' . $checks['presets'] . " A1-API-4/A2-1 player preset assertions (counted separately).\n");
fwrite(STDOUT, 'PASS ' . $checks['videoId'] . " A1-FIX-API-2 video ID assertions (counted separately).\n");
fwrite(STDOUT, 'PASS ' . $checks['lms'] . " L-1 lecture progress, notes and preroll assertions (counted separately).\n");
fwrite(STDOUT, 'Isolated test prefix: ' . $config['tablePrefix'] . '; SQLite/test files: ' . $directory . "\n");
