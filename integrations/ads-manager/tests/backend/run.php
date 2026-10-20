<?php
declare(strict_types=1);

require dirname(__DIR__, 2) . '/src/load.php';

use AdsManager\ApiError;
use AdsManager\App;
use AdsManager\Config;
use AdsManager\Database;
use AdsManager\Standalone;
use AdsManager\Value;

$checks = 0;
function same(mixed $actual, mixed $expected, string $message): void
{
    global $checks;
    $checks++;
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
fails(fn () => $app->dispatch('GET', 'creatives', []), 401, 'anonymous admin read');
fails(fn () => $app->dispatch('POST', 'login', ['username' => 'tester', 'password' => 'test-password-12345'], 'wrong'), 403, 'login CSRF enforced');
$app->dispatch('POST', 'login', ['username' => 'tester', 'password' => 'test-password-12345'], $anon['csrfToken']);
same($host->authenticated(), true, 'hashed account login');
same($host->csrfToken() !== $anon['csrfToken'], true, 'login rotates CSRF');
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

fwrite(STDOUT, 'PASS ' . $checks . ' persistence/authorization/publication/collector/statistics assertions (' . $db->driver . ").\n");
fwrite(STDOUT, 'Isolated test prefix: ' . $config['tablePrefix'] . '; SQLite/test files: ' . $directory . "\n");
