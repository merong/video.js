<?php
declare(strict_types=1);

ini_set('display_errors', '0');
// The repository keeps src/ beside public/. The GnuBoard package (<G5>/ads) puts public/'s files beside src/.
$adsRoot = is_dir(__DIR__ . '/src') ? __DIR__ : dirname(__DIR__);
require_once $adsRoot . '/src/load.php';
// A GnuBoard package without a configuration opens its web installer instead of a JSON error.
if (!is_file(\AdsManager\Config::defaultPath()) && is_file(__DIR__ . '/setup.php') && is_file(dirname($adsRoot) . '/common.php')) {
    header('Location: setup.php', true, 302);
    exit;
}
try {
    // The UI owns rendering and receives only its documented endpoint bootstrap.
    // The React shell is the default; ?ui=v1 keeps the previous view for comparison.
    $adsConfig = \AdsManager\Config::load();
    $adsPage = ['apiUrl' => $adsConfig['apiUrl']];
    $adsView = ($_GET['ui'] ?? null) === 'v1' ? 'index.php' : 'app.php';
    require $adsRoot . '/admin/' . $adsView;
} catch (\Throwable $adsError) {
    \AdsManager\Http::error($adsError);
}
