<?php
declare(strict_types=1);

// React admin shell. Same apiUrl contract and escaping as the v1 view (admin/index.php).
$apiUrl = $adsPage['apiUrl'] ?? null;
if (!is_string($apiUrl) || !preg_match('~^(?:https?://[^/]+)?/[^\s]*api/index\.php(?:\?[^\s]*)?$~D', $apiUrl)) {
    http_response_code(503);
    header('Content-Type: text/plain; charset=utf-8');
    header('Cache-Control: no-store');
    echo '광고 관리자 연결 설정을 확인하세요.';
    return;
}

// Build output of the ui package; it is generated and not tracked.
$bundleDirectory = dirname(__DIR__) . '/public/assets/admin-app/';
$bundleFiles = ['css' => $bundleDirectory . 'admin-app.css', 'js' => $bundleDirectory . 'admin-app.js'];
foreach ($bundleFiles as $file) {
    if (!is_file($file)) {
        http_response_code(503);
        header('Content-Type: text/plain; charset=utf-8');
        header('Cache-Control: no-store');
        echo '관리자 화면 파일이 없습니다. ui를 빌드해 주세요.';
        return;
    }
}

$escape = static fn (string $value): string => htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
$assetUrl = preg_replace('~api/index\.php(?:\?.*)?$~', 'assets/admin-app/', $apiUrl);
$version = static fn (string $file): string => '?v=' . filemtime($file);
// The shell references versioned bundle URLs, so it must be revalidated after each build.
header('Cache-Control: no-cache');
?>
<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="referrer" content="same-origin">
  <title>솔애드 관리자</title>
  <link rel="stylesheet" href="<?= $escape($assetUrl . 'admin-app.css' . $version($bundleFiles['css'])) ?>">
  <script type="module" src="<?= $escape($assetUrl . 'admin-app.js' . $version($bundleFiles['js'])) ?>"></script>
</head>
<body>
<script id="ads-config" type="application/json"><?= json_encode(['apiUrl' => $apiUrl, 'assetUrl' => $assetUrl], JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_THROW_ON_ERROR) ?></script>
<noscript><p>광고 관리에는 JavaScript가 필요합니다. 브라우저에서 활성화한 뒤 다시 열어주세요.</p></noscript>
<div id="ads-admin-root"></div>
</body>
</html>
