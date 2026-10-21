<?php
declare(strict_types=1);

// A1-QA-RUN D8 only: development-server router for the isolated QA install.
// Serves generated install-code pages from ./paste at /__qa/paste/<name>.html; every other request goes to the product router.
$qaPath = rawurldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/');
if (str_starts_with($qaPath, '/__qa/paste/')) {
    $qaName = substr($qaPath, strlen('/__qa/paste/'));
    $qaRoot = realpath(__DIR__ . '/paste');
    $qaFile = $qaRoot && preg_match('/^[a-z0-9-]+\.html$/D', $qaName) ? realpath($qaRoot . '/' . $qaName) : false;
    if (!$qaFile || !str_starts_with($qaFile, $qaRoot . '/') || !is_file($qaFile)) {
        http_response_code(404);
        exit;
    }
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store');
    readfile($qaFile);
    exit;
}

return require dirname(__DIR__, 4) . '/integrations/ads-manager/public/router.php';
