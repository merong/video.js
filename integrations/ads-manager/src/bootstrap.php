<?php
declare(strict_types=1);

require_once __DIR__ . '/load.php';

$adsConfig = \AdsManager\Config::load();
if ($adsConfig['host'] === 'gnuboard') {
    $adsGnuRoot = $adsConfig['gnuboardRoot'];
    if (!is_string($adsGnuRoot) || !str_starts_with($adsGnuRoot, '/') || !is_file($adsGnuRoot . '/common.php')) {
        throw new \AdsManager\ApiError(500, 'host_unavailable', '그누보드 연결 설정을 확인해 주세요.');
    }
    // Upstream common.php expects the host cwd and creates its globals at include scope.
    // It also extracts/SQL-escapes request variables. API input must neither replace
    // trusted configuration globals nor be transformed before our own validation.
    $adsOriginalGet = $_GET;
    $adsOriginalPost = $_POST;
    $adsOriginalRequest = $_REQUEST;
    $_GET = $_POST = $_REQUEST = [];
    $adsPreviousDirectory = getcwd();
    chdir($adsGnuRoot);
    try {
        require_once $adsGnuRoot . '/common.php';
    } finally {
        chdir($adsPreviousDirectory);
        $_GET = $adsOriginalGet;
        $_POST = $adsOriginalPost;
        $_REQUEST = $adsOriginalRequest;
    }
} elseif (session_status() !== PHP_SESSION_ACTIVE && !in_array($adsAction ?? null, \AdsManager\Http::PUBLIC_ACTIONS, true)) {
    // public/api/index.php sets $adsAction. Visitor actions never read the admin session,
    // so starting one would only hand every page viewer a session cookie.
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    session_name('ADS' . substr(hash('sha256', $adsConfig['dsn'] . $adsConfig['tablePrefix']), 0, 16));
    session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off', 'httponly' => true, 'samesite' => 'Lax']);
    session_start();
}

$adsDatabase = new \AdsManager\Database($adsConfig);
$adsHost = $adsConfig['host'] === 'gnuboard' ? new \AdsManager\GnuBoard($adsDatabase, $adsConfig) : new \AdsManager\Standalone($adsDatabase, $adsConfig);
$adsApp = new \AdsManager\App($adsDatabase, $adsConfig, $adsHost);
