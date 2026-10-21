<?php
// TASK L-1-SPIKE router for `php -S 127.0.0.1:<port> -t <ads-manager/public> router.php`.
// /spike/* comes from this folder; /assets, /player, /demo-media and /examples come from the ads-manager public tree,
// read only. Everything else (the admin API included) is 404, so nothing here touches a database.

$path = rawurldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '/');
if (!str_starts_with($path, '/assets/')) error_log('REQ ' . ($_SERVER['REQUEST_METHOD'] ?? '') . ' ' . $path . ' range=' . ($_SERVER['HTTP_RANGE'] ?? '-'));
$types = [
    'html' => 'text/html; charset=utf-8', 'js' => 'text/javascript; charset=utf-8', 'css' => 'text/css; charset=utf-8',
    'json' => 'application/json', 'vtt' => 'text/vtt; charset=utf-8', 'svg' => 'image/svg+xml', 'png' => 'image/png',
    'm3u8' => 'application/vnd.apple.mpegurl', 'm4s' => 'video/iso.segment', 'ts' => 'video/mp2t', 'mp4' => 'video/mp4',
];

if (str_contains($path, '..')) {
    http_response_code(400);
    return true;
}

if ($path === '/spike/beacon.php') {
    require __DIR__ . '/beacon.php';
    return true;
}

$serve = function (string $file) use ($types): bool {
    $extension = strtolower(pathinfo($file, PATHINFO_EXTENSION));

    if (!is_file($file) || !isset($types[$extension])) {
        http_response_code(404);
        header('Content-Type: application/json');
        echo '{"ok":false,"error":{"code":"not_found"}}';
        return true;
    }

    header('Content-Type: ' . $types[$extension]);
    header('Cache-Control: no-store');
    header('Accept-Ranges: bytes');

    // The built-in server ignores Range, and Chromium cannot seek an mp4 served without it.
    $size = filesize($file);
    $range = $_SERVER['HTTP_RANGE'] ?? '';

    if (preg_match('/^bytes=(\d*)-(\d*)$/', $range, $match)) {
        $start = $match[1] === '' ? max(0, $size - (int) $match[2]) : (int) $match[1];
        $end = $match[1] !== '' && $match[2] !== '' ? min((int) $match[2], $size - 1) : $size - 1;

        if ($start > $end || $start >= $size) {
            http_response_code(416);
            header("Content-Range: bytes */$size");
            return true;
        }

        http_response_code(206);
        header("Content-Range: bytes $start-$end/$size");
        header('Content-Length: ' . ($end - $start + 1));
        $handle = fopen($file, 'rb');
        fseek($handle, $start);
        echo fread($handle, $end - $start + 1);
        fclose($handle);
        return true;
    }

    header("Content-Length: $size");
    readfile($file);
    return true;
};

if (str_starts_with($path, '/spike/')) return $serve(__DIR__ . substr($path, strlen('/spike')));

foreach (['/assets/', '/player/', '/demo-media/', '/examples/'] as $prefix) {
    if (str_starts_with($path, $prefix)) return $serve($_SERVER['DOCUMENT_ROOT'] . $path);
}

http_response_code(404);
header('Content-Type: application/json');
echo '{"ok":false,"error":{"code":"not_found"}}';
return true;
