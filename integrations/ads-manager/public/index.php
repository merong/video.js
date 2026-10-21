<?php
declare(strict_types=1);

ini_set('display_errors', '0');
require_once dirname(__DIR__) . '/src/load.php';
try {
    // The UI owns rendering and receives only its documented endpoint bootstrap.
    // The React shell is the default; ?ui=v1 keeps the previous view for comparison.
    $adsConfig = \AdsManager\Config::load();
    $adsPage = ['apiUrl' => $adsConfig['apiUrl']];
    $adsView = ($_GET['ui'] ?? null) === 'v1' ? 'index.php' : 'app.php';
    require dirname(__DIR__) . '/admin/' . $adsView;
} catch (\Throwable $adsError) {
    \AdsManager\Http::error($adsError);
}
