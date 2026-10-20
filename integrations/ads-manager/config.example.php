<?php
// Copy outside public/ as config.php, or point ADS_CONFIG at an absolute private file.
return [
    'host' => 'standalone',
    'siteId' => 'site-local',
    'timeZone' => 'Asia/Seoul',
    'dsn' => 'sqlite:' . __DIR__ . '/var/ads.sqlite',
    // MySQL: mysql:host=127.0.0.1;port=YOUR_ISOLATED_PORT;dbname=ads;charset=utf8mb4
    'dbUser' => null,
    'dbPassword' => null,
    'tablePrefix' => 'ads_',
    'uploadRoot' => __DIR__ . '/var/uploads',
    'uploadUrl' => '/media',
    'uploadBytes' => 100 * 1024 * 1024,
    'apiUrl' => '/api/index.php',
    'playerModuleUrl' => null,
    'sessionSeconds' => 7200,
    'retentionDays' => 90,
    'gnuboardRoot' => null,
    'gnuboardMenu' => '300950',
    // Default canonical ID is bo_table:wr_id:main. For multiple videos only the
    // trusted host supplies keys: fn(array $board, array $post): array => ['main', 'trailer'].
    'gnuboardVideoKeys' => null,
];
