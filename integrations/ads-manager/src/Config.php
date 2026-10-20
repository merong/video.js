<?php
declare(strict_types=1);

namespace AdsManager;

final class Config
{
    public static function load(?string $path = null): array
    {
        $path ??= getenv('ADS_CONFIG') ?: dirname(__DIR__) . '/config.php';
        if (!is_file($path) || is_link($path)) {
            throw new ApiError(500, 'installation_required', '설치 설정 파일이 필요합니다.');
        }
        $config = require $path;
        if (!is_array($config)) {
            throw new \RuntimeException('Invalid configuration.');
        }
        return self::validate($config);
    }

    public static function validate(array $config): array
    {
        $config += ['host' => 'standalone', 'siteId' => 'site-local', 'timeZone' => 'Asia/Seoul', 'tablePrefix' => 'ads_', 'dbUser' => null, 'dbPassword' => null, 'apiUrl' => '/api/index.php', 'playerModuleUrl' => null, 'uploadBytes' => 100 * 1024 * 1024, 'uploadUrl' => '/media', 'sessionSeconds' => 7200, 'retentionDays' => 90, 'gnuboardRoot' => null, 'gnuboardMenu' => '300950', 'gnuboardVideoKeys' => null];
        if (!in_array($config['host'], ['standalone', 'gnuboard'], true) || !is_string($config['dsn'] ?? null) || !preg_match('/^(sqlite:|mysql:)/', $config['dsn'])) {
            throw new \RuntimeException('Invalid host or PDO configuration.');
        }
        Value::id($config['siteId'], 'siteId');
        new \DateTimeZone($config['timeZone']);
        foreach (['apiUrl', 'uploadUrl'] as $key) {
            Value::url($config[$key], $key);
            if (str_contains($config[$key], '?') || str_contains($config[$key], '#')) {
                throw new \RuntimeException('Endpoint URLs cannot contain a query or fragment.');
            }
        }
        if ($config['playerModuleUrl'] !== null) {
            Value::url($config['playerModuleUrl'], 'playerModuleUrl');
        }
        if (!is_string($config['uploadRoot'] ?? null) || !str_starts_with($config['uploadRoot'], '/') || str_contains($config['uploadRoot'], '/..')) {
            throw new \RuntimeException('An absolute uploadRoot is required.');
        }
        Value::integer($config['uploadBytes'], 'uploadBytes', 1, 1024 * 1024 * 1024);
        Value::integer($config['sessionSeconds'], 'sessionSeconds', 60, 86400);
        Value::integer($config['retentionDays'], 'retentionDays', 1, 3650);
        if ($config['gnuboardVideoKeys'] !== null && !is_callable($config['gnuboardVideoKeys'])) {
            throw new \RuntimeException('gnuboardVideoKeys must be callable.');
        }
        return $config;
    }
}
