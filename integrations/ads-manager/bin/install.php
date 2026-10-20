<?php
declare(strict_types=1);

require dirname(__DIR__) . '/src/load.php';
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$options = getopt('', ['config:', 'sqlite:', 'uploads:', 'admin:', 'password-stdin', 'player-module-url:', 'help']);
if (isset($options['help'])) {
    fwrite(STDOUT, "New SQLite: php bin/install.php --config=/absolute/config.php --sqlite=/absolute/ads.sqlite --uploads=/absolute/uploads --admin=admin --password-stdin\nExisting config / MySQL / migrations: php bin/install.php --config=/absolute/config.php [--admin=admin --password-stdin]\nPasswords are read from stdin and never printed. Existing administrators are never overwritten.\n");
    exit;
}

try {
    $path = $options['config'] ?? (getenv('ADS_CONFIG') ?: dirname(__DIR__) . '/config.php');
    if (isset($options['sqlite'])) {
        if (file_exists($path) || is_link($path)) {
            throw new RuntimeException('Configuration already exists. Omit --sqlite to migrate it.');
        }
        $databasePath = $options['sqlite'];
        $uploadPath = $options['uploads'] ?? dirname($databasePath) . '/uploads';
        foreach ([dirname($path), dirname($databasePath), $uploadPath] as $directory) {
            if (!str_starts_with($directory, '/') || is_link($directory)) {
                throw new RuntimeException('Use absolute non-symlink directories.');
            }
            if (!is_dir($directory) && !mkdir($directory, 0700, true)) {
                throw new RuntimeException('Cannot create installation directory.');
            }
        }
        $config = \AdsManager\Config::validate(['dsn' => 'sqlite:' . realpath(dirname($databasePath)) . '/' . basename($databasePath), 'uploadRoot' => realpath($uploadPath), 'playerModuleUrl' => $options['player-module-url'] ?? null]);
        $handle = fopen($path, 'x');
        if (!$handle) {
            throw new RuntimeException('Cannot create configuration.');
        }
        chmod($path, 0600);
        fwrite($handle, "<?php\nreturn " . var_export($config, true) . ";\n");
        fclose($handle);
    } else {
        $config = \AdsManager\Config::load($path);
        $uploadPath = $config['uploadRoot'];
        if (!is_dir($uploadPath) && !mkdir($uploadPath, 0700, true)) {
            throw new RuntimeException('Cannot create upload directory.');
        }
        \AdsManager\Creatives::storageRoot($uploadPath);
        if (str_starts_with($config['dsn'], 'sqlite:') && $config['dsn'] !== 'sqlite::memory:') {
            $parent = dirname(substr($config['dsn'], 7));
            if (!is_dir($parent) && !mkdir($parent, 0700, true)) {
                throw new RuntimeException('Cannot create database directory.');
            }
        }
    }

    $db = new \AdsManager\Database($config);
    $db->migrate($config['siteId']);
    if (isset($options['admin'])) {
        if ($config['host'] !== 'standalone' || !isset($options['password-stdin'])) {
            throw new RuntimeException('Standalone account creation requires --password-stdin.');
        }
        $username = \AdsManager\Value::id($options['admin'], 'username');
        $password = rtrim(stream_get_contents(STDIN, 1025), "\r\n");
        if (strlen($password) < 12 || strlen($password) > 1024) {
            throw new RuntimeException('Use a password of 12 to 1024 bytes.');
        }
        $hash = password_hash($password, PASSWORD_DEFAULT);
        unset($password);
        $db->write(function () use ($db, $username, $hash): void {
            if ($db->one('SELECT username FROM ' . $db->table('admins') . ' WHERE username = ?', [$username])) {
                throw new RuntimeException('Administrator already exists. No password was changed.');
            }
            $db->run('INSERT INTO ' . $db->table('admins') . ' (username, password_hash) VALUES (?, ?)', [$username, $hash]);
        });
    }
    fwrite(STDOUT, "Installed schema version 1 (" . $db->driver . "). No customer data imported.\n");
} catch (Throwable $error) {
    // PDO exceptions can contain connection details. Do not print them.
    fwrite(STDERR, $error instanceof PDOException ? "Database installation failed; check the private configuration.\n" : $error->getMessage() . "\n");
    exit(1);
}
