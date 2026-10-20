<?php
declare(strict_types=1);

namespace AdsManager;

final class Database
{
    public readonly \PDO $pdo;
    public readonly string $driver;

    public function __construct(array $config)
    {
        $prefix = $config['tablePrefix'];
        if (!preg_match('/^[a-zA-Z][a-zA-Z0-9_]{0,31}$/D', $prefix)) {
            throw new \InvalidArgumentException('Invalid table prefix.');
        }
        $this->prefix = $prefix;
        $this->pdo = new \PDO($config['dsn'], $config['dbUser'] ?? null, $config['dbPassword'] ?? null, [
            \PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION,
            \PDO::ATTR_DEFAULT_FETCH_MODE => \PDO::FETCH_ASSOC,
            \PDO::ATTR_EMULATE_PREPARES => false,
        ]);
        $this->driver = $this->pdo->getAttribute(\PDO::ATTR_DRIVER_NAME);
        if (!in_array($this->driver, ['sqlite', 'mysql'], true)) {
            throw new \InvalidArgumentException('Only PDO MySQL and SQLite are supported.');
        }
        if ($this->driver === 'sqlite') {
            $this->pdo->exec('PRAGMA busy_timeout = 10000');
            $this->pdo->exec('PRAGMA foreign_keys = ON');
        } else {
            $this->pdo->exec("SET NAMES utf8mb4 COLLATE utf8mb4_bin");
        }
    }

    private readonly string $prefix;

    public function table(string $name): string
    {
        if (!preg_match('/^[a-z_]+$/D', $name)) {
            throw new \InvalidArgumentException('Invalid table name.');
        }

        return '`' . $this->prefix . $name . '`';
    }

    public function run(string $sql, array $params = []): \PDOStatement
    {
        $statement = $this->pdo->prepare($sql);
        $statement->execute($params);
        return $statement;
    }

    public function one(string $sql, array $params = []): ?array
    {
        return $this->run($sql, $params)->fetch() ?: null;
    }

    /** A single installation lock serializes short writes on both supported engines. */
    public function write(callable $work): mixed
    {
        $this->pdo->beginTransaction();
        try {
            $this->run('UPDATE ' . $this->table('meta') . " SET value = value WHERE name = 'write_lock'");
            $result = $work();
            $this->pdo->commit();
            return $result;
        } catch (\Throwable $error) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            throw $error;
        }
    }

    public function meta(string $name): ?string
    {
        return $this->one('SELECT value FROM ' . $this->table('meta') . ' WHERE name = ?', [$name])['value'] ?? null;
    }

    public function migrate(string $siteId): void
    {
        $sql = file_get_contents(dirname(__DIR__) . '/database/001.sql');
        $sql = preg_replace_callback('/\{\{([a-z_]+)\}\}/', fn ($m) => $m[1] === 'options' ? $m[0] : $this->table($m[1]), $sql);
        $sql = str_replace('{{options}}', $this->driver === 'mysql' ? 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin' : '', $sql);
        // DDL is deliberately only reachable from the installer, never from the request bootstrap.
        foreach (explode(';', $sql) as $statement) {
            if (trim($statement) !== '') {
                $this->pdo->exec($statement);
            }
        }

        $existing = $this->meta('site_id');
        if ($existing !== null && $existing !== $siteId) {
            throw new \RuntimeException('Installed siteId differs from configuration.');
        }
        foreach (['write_lock' => '1', 'site_id' => $siteId, 'schema_version' => '1', 'signing_key' => bin2hex(random_bytes(32))] as $key => $value) {
            if ($this->meta($key) === null) {
                $this->run('INSERT INTO ' . $this->table('meta') . ' (name, value) VALUES (?, ?)', [$key, $value]);
            }
        }
    }

    public function limit(string $key, int $maximum, int $seconds = 60): void
    {
        $bucket = hash('sha256', $key);
        $now = time();
        $row = $this->one('SELECT * FROM ' . $this->table('rate_limits') . ' WHERE bucket_key = ?', [$bucket]);
        if ($row && (int) $row['window_start'] > $now - $seconds) {
            if ((int) $row['hits'] >= $maximum) {
                throw new ApiError(429, 'rate_limit', '잠시 후 다시 시도해 주세요.');
            }
            $this->run('UPDATE ' . $this->table('rate_limits') . ' SET hits = hits + 1 WHERE bucket_key = ?', [$bucket]);
        } elseif ($row) {
            $this->run('UPDATE ' . $this->table('rate_limits') . ' SET hits = 1, window_start = ? WHERE bucket_key = ?', [$now, $bucket]);
        } else {
            $this->run('INSERT INTO ' . $this->table('rate_limits') . ' (bucket_key, hits, window_start) VALUES (?, 1, ?)', [$bucket, $now]);
        }
    }
}
