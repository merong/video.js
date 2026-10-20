<?php
declare(strict_types=1);

namespace AdsManager;

final class Standalone extends Host
{
    public function authenticated(): bool
    {
        $username = $_SESSION['ads_admin'] ?? null;
        return is_string($username) && $this->db->one('SELECT username FROM ' . $this->db->table('admins') . ' WHERE username = ?', [$username]) !== null;
    }

    public function csrfToken(): string
    {
        return $_SESSION['ads_csrf'] ??= bin2hex(random_bytes(32));
    }

    public function verifyCsrf(mixed $token): void
    {
        if (!is_string($token) || !hash_equals($this->csrfToken(), $token)) {
            throw new ApiError(403, 'csrf', '화면을 새로고침한 뒤 다시 시도해 주세요.');
        }
    }

    public function login(array $input): array
    {
        $username = Value::text($input['username'] ?? null, 'username');
        $password = $input['password'] ?? null;
        if (!is_string($password) || strlen($password) > 1024) {
            Value::fail('password');
        }

        $this->db->write(fn () => $this->db->limit('login', 30));
        $account = $this->db->one('SELECT password_hash FROM ' . $this->db->table('admins') . ' WHERE username = ?', [$username]);
        // A constant valid hash also makes missing usernames take the password-verification path.
        $hash = $account['password_hash'] ?? '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.';
        if (!password_verify($password, $hash) || !$account) {
            throw new ApiError(401, 'invalid_login', '아이디 또는 비밀번호를 확인해 주세요.');
        }

        if (session_status() === PHP_SESSION_ACTIVE) {
            session_regenerate_id(true);
        }
        $_SESSION['ads_admin'] = $username;
        $_SESSION['ads_csrf'] = bin2hex(random_bytes(32));
        return ['authenticated' => true];
    }

    public function logout(): array
    {
        unset($_SESSION['ads_admin']);
        $_SESSION['ads_csrf'] = bin2hex(random_bytes(32));
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_regenerate_id(true);
        }
        return ['authenticated' => false];
    }

    public function capabilities(): array
    {
        return ['host' => 'standalone', 'manualTargets' => true, 'uploads' => true, 'loginUrl' => null];
    }

    public function resolveVideoContext(string $videoId): array
    {
        $row = $this->db->one('SELECT * FROM ' . $this->db->table('video_contexts') . ' WHERE video_id = ?', [$videoId]);
        return ['videoId' => $videoId, 'boardId' => $row['board_id'] ?? null, 'categoryId' => $row['category_id'] ?? null];
    }

    public function saveVideoContext(array $input): array
    {
        $id = Value::id($input['videoId'] ?? null, 'videoId');
        $label = Value::text($input['label'] ?? null, 'label', 255);
        $board = Value::nullableId($input['boardId'] ?? null, 'boardId');
        $category = Value::nullableId($input['categoryId'] ?? null, 'categoryId');
        if ($category !== null && $board === null) {
            Value::fail('boardId');
        }

        $this->db->write(function () use ($id, $label, $board, $category): void {
            $existing = $this->db->one('SELECT video_id FROM ' . $this->db->table('video_contexts') . ' WHERE video_id = ?', [$id]);
            if ($existing) {
                $this->db->run('UPDATE ' . $this->db->table('video_contexts') . ' SET label = ?, board_id = ?, category_id = ? WHERE video_id = ?', [$label, $board, $category, $id]);
            } else {
                $this->db->run('INSERT INTO ' . $this->db->table('video_contexts') . ' (video_id, label, board_id, category_id) VALUES (?, ?, ?, ?)', [$id, $label, $board, $category]);
            }
        });
        return ['saved' => true];
    }

    public function targets(string $type, string $query, ?string $boardId): array
    {
        if ($type === 'site') {
            return [['target' => ['type' => 'site', 'id' => $this->config['siteId']], 'label' => '사이트 기본']];
        }

        $items = [];
        $add = static function (array $target, string $label) use (&$items, $query): void {
            if ($query === '' || mb_stripos($label . ' ' . $target['id'], $query) !== false) {
                $items[Value::targetKey($target)] = ['target' => $target, 'label' => $label];
            }
        };
        foreach ($this->db->run('SELECT * FROM ' . $this->db->table('video_contexts') . ' ORDER BY video_id LIMIT 1000') as $row) {
            if ($type === 'video') {
                $add(['type' => 'video', 'id' => $row['video_id']], $row['label']);
            } elseif ($type === 'board' && $row['board_id'] !== null) {
                $add(['type' => 'board', 'id' => $row['board_id']], $row['board_id']);
            } elseif ($type === 'category' && $row['board_id'] === $boardId && $row['category_id'] !== null) {
                $add(['type' => 'category', 'id' => $row['category_id'], 'boardId' => $boardId], $row['category_id']);
            }
        }
        foreach ($this->db->run('SELECT target_json FROM ' . $this->db->table('drafts') . ' LIMIT 1000') as $row) {
            $target = Value::decode($row['target_json']);
            if ($target['type'] === $type && ($type !== 'category' || $target['boardId'] === $boardId)) {
                $add($target, $target['id']);
            }
        }
        return array_slice(array_values($items), 0, 100);
    }
}
