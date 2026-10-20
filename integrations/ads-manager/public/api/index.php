<?php
declare(strict_types=1);

ini_set('display_errors', '0');
require_once dirname(__DIR__, 2) . '/src/load.php';

header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
$adsApp = null;
$adsAction = is_string($_GET['action'] ?? null) ? $_GET['action'] : '';
try {
    \AdsManager\Http::sameOrigin();
    require dirname(__DIR__, 2) . '/src/bootstrap.php';
    $adsMethod = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $adsInput = \AdsManager\Http::input($adsMethod, $adsAction, $adsConfig);
    $adsResult = $adsApp->dispatch($adsMethod, $adsAction, $adsInput, $_SERVER['HTTP_X_CSRF_TOKEN'] ?? ($adsInput['csrfToken'] ?? null), $_FILES);
    \AdsManager\Http::csrfHeader($adsApp, $adsAction);
    if ($adsAction === 'stats-csv') {
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="ads-stats.csv"');
        echo $adsResult;
    } else {
        header('Content-Type: application/json; charset=utf-8');
        echo \AdsManager\Value::json(['ok' => true, 'data' => $adsResult]);
    }
} catch (\Throwable $adsError) {
    \AdsManager\Http::csrfHeader($adsApp, $adsAction);
    \AdsManager\Http::error($adsError);
}
