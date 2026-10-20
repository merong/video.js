<?php
declare(strict_types=1);

ini_set('display_errors', '0');
require_once dirname(__DIR__) . '/src/load.php';
try {
    // The UI owns rendering and receives only its documented endpoint bootstrap.
    $adsConfig = \AdsManager\Config::load();
    $adsPage = ['apiUrl' => $adsConfig['apiUrl']];
    require dirname(__DIR__) . '/admin/index.php';
} catch (\Throwable $adsError) {
    \AdsManager\Http::error($adsError);
}
