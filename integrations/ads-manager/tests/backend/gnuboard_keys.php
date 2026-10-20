<?php
declare(strict_types=1);

// Uses the actual installed host bootstrap and public post lookup, never host mocks.
// Reads product tables only. Select an isolated QA public post; no customer host.
require dirname(__DIR__, 2) . '/src/load.php';

$options = getopt('', ['config:', 'video:']);
if (PHP_SAPI !== 'cli' || !isset($options['config'], $options['video'])) {
    fwrite(STDERR, "Usage: php tests/backend/gnuboard_keys.php --config=/isolated/g5-config.php --video=board:post:main\n");
    exit(2);
}

try {
    $fixtureConfig = \AdsManager\Config::load($options['config']);
    if ($fixtureConfig['host'] !== 'gnuboard' || !str_ends_with($options['video'], ':main')) {
        throw new RuntimeException('A real GnuBoard QA installation and canonical :main video are required.');
    }
    $root = $fixtureConfig['gnuboardRoot'];
    $_SERVER += ['REQUEST_METHOD' => 'GET', 'SERVER_NAME' => '127.0.0.1', 'HTTP_HOST' => '127.0.0.1:18765', 'SERVER_PORT' => '18765', 'SERVER_ADDR' => '127.0.0.1', 'REMOTE_ADDR' => '127.0.0.1', 'HTTP_USER_AGENT' => 'AdsBackendKeyRegression', 'DOCUMENT_ROOT' => $root];
    $_SERVER['SCRIPT_NAME'] = '/ads/api/index.php';
    $_SERVER['SCRIPT_FILENAME'] = $root . '/ads/api/index.php';
    $_SERVER['PHP_SELF'] = '/ads/api/index.php';
    $_SERVER['REQUEST_URI'] = '/ads/api/index.php?action=schedule';
    $_GET = $_POST = $_REQUEST = [];
    putenv('ADS_CONFIG=' . $options['config']);
    require dirname(__DIR__, 2) . '/src/bootstrap.php';

    $videoId = $options['video'];
    $defaultHost = new \AdsManager\GnuBoard($adsDatabase, [...$adsConfig, 'gnuboardVideoKeys' => null]);
    $context = $defaultHost->resolveVideoContext($videoId);
    if ($context['videoId'] !== $videoId) {
        throw new RuntimeException('Canonical main identity failed.');
    }
    $base = substr($videoId, 0, -4);
    $reject = static function (\AdsManager\GnuBoard $host, string $id): void {
        try {
            $host->resolveVideoContext($id);
        } catch (\AdsManager\ApiError $error) {
            if ($error->status === 404 && $error->errorCode === 'video_not_found') {
                return;
            }
            throw new RuntimeException('Unknown key failed for an unrelated reason.');
        }
        throw new RuntimeException('Unknown video suffix bypassed ownership.');
    };
    $reject($defaultHost, $base . 'visitor-invented');
    $observed = [];
    $multiHost = new \AdsManager\GnuBoard($adsDatabase, [...$adsConfig, 'gnuboardVideoKeys' => static function (array $board, array $post) use (&$observed): array {
        $observed = [$board['bo_table'], (string) $post['wr_id']];
        return ['main', 'trailer'];
    }]);
    $multi = $multiHost->resolveVideoContext($base . 'trailer');
    if ($multi['boardId'] !== $context['boardId'] || $observed !== array_slice(explode(':', $videoId), 0, 2)) {
        throw new RuntimeException('Multivideo keys were not resolved from the actual host post.');
    }
    $reject($multiHost, $base . 'visitor-invented');
    $denyHost = new \AdsManager\GnuBoard($adsDatabase, [...$adsConfig, 'gnuboardVideoKeys' => static fn (array $board, array $post): array => []]);
    $reject($denyHost, $videoId);
    fwrite(STDOUT, "PASS 5 real GnuBoard main/unknown/multikey/callback/post-ownership assertions.\n");
} catch (Throwable $error) {
    // Host/driver exceptions may carry private configuration. Report no connection details.
    fwrite(STDERR, "GnuBoard key regression did not pass; check the isolated host, public fixture and local socket permissions.\n");
    exit(1);
}
