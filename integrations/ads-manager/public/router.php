<?php
declare(strict_types=1);

// Development server only. Production must use public/ as its document root.
require_once dirname(__DIR__) . '/src/load.php';
$adsPath = rawurldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/');
if (str_contains($adsPath, "\0") || str_contains($adsPath, '\\') || preg_match('#(?:^|/)\.#', $adsPath)) {
    http_response_code(404);
    exit;
}
try {
    $adsConfig = \AdsManager\Config::load();
    $adsMediaPrefix = rtrim(parse_url($adsConfig['uploadUrl'], PHP_URL_PATH), '/') . '/';
    if (str_starts_with($adsPath, $adsMediaPrefix)) {
        $adsName = substr($adsPath, strlen($adsMediaPrefix));
        if (!preg_match('/^[a-f0-9]{32}\.(mp4|webm|jpg|png|webp|gif)$/D', $adsName)) {
            http_response_code(404);
            exit;
        }
        $adsFile = \AdsManager\Creatives::storageRoot($adsConfig['uploadRoot']) . '/' . $adsName;
        if (!is_file($adsFile) || is_link($adsFile)) {
            http_response_code(404);
            exit;
        }
        \AdsManager\MediaResponse::send($adsFile, (new finfo(FILEINFO_MIME_TYPE))->file($adsFile), 'public, max-age=31536000, immutable');
        exit;
    }
} catch (Throwable $adsError) {
    \AdsManager\Http::error($adsError);
    exit;
}

if ($adsPath === '/' || $adsPath === '/index.php') {
    require __DIR__ . '/index.php';
} elseif ($adsPath === '/api/index.php') {
    require __DIR__ . '/api/index.php';
} else {
    $adsFile = realpath(__DIR__ . $adsPath);
    // Never execute arbitrary PHP added to a static or upload directory.
    if ($adsFile && str_starts_with($adsFile, __DIR__ . '/') && is_file($adsFile) && !is_link(__DIR__ . $adsPath) && preg_match('/\.(?:html|js|css|map|png|jpg|jpeg|webp|gif|svg|mp4|webm|m3u8|ts|m4s|woff2)$/i', $adsFile)) {
        if (preg_match('/\.(mp4|webm)$/i', $adsFile, $adsExtension)) {
            try {
                \AdsManager\MediaResponse::send($adsFile, strtolower($adsExtension[1]) === 'mp4' ? 'video/mp4' : 'video/webm', 'no-cache');
            } catch (Throwable $adsError) {
                \AdsManager\Http::error($adsError);
            }
            exit;
        }
        return false;
    }
    http_response_code(404);
}
