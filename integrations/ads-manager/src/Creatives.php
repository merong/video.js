<?php
declare(strict_types=1);

namespace AdsManager;

final class Creatives
{
    public function __construct(private readonly Database $db, private readonly array $config) {}

    public function list(): array
    {
        $items = [];
        $sql = 'SELECT v.document, c.archived FROM ' . $this->db->table('creatives') . ' c JOIN ' . $this->db->table('creative_versions') . ' v ON v.creative_id = c.creative_id AND v.version = c.current_version ORDER BY c.creative_id';
        foreach ($this->db->run($sql) as $row) {
            $item = Value::decode($row['document']);
            $item['archived'] = (bool) $row['archived'];
            $items[] = $item;
        }
        return ['items' => $items];
    }

    public function version(string $id, int $version): array
    {
        $row = $this->db->one('SELECT v.document, c.archived FROM ' . $this->db->table('creative_versions') . ' v JOIN ' . $this->db->table('creatives') . ' c ON v.creative_id = c.creative_id WHERE v.creative_id = ? AND v.version = ?', [$id, $version]);
        if (!$row) {
            Value::fail('creativeId', '저장된 소재 버전을 찾을 수 없습니다.');
        }
        $creative = Value::decode($row['document']);
        $creative['archived'] = (bool) $row['archived'];
        return $creative;
    }

    public function save(array $input, string $source = 'url'): array
    {
        $name = Value::text($input['name'] ?? null, 'name', 255);
        $url = Value::url($input['url'] ?? null, 'url');
        $mime = $input['mime'] ?? null;
        if (!is_string($mime) || !isset(Value::MIMES[$mime])) {
            Value::fail('mime', '지원하는 영상 또는 이미지 형식을 선택해 주세요.');
        }
        $alt = Value::text($input['alt'] ?? null, 'alt', 1000, true);
        $id = isset($input['creativeId']) ? Value::id($input['creativeId'], 'creativeId') : 'creative-' . Value::uuid();

        return $this->db->write(function () use ($input, $name, $url, $mime, $alt, $id, $source): array {
            $current = $this->db->one('SELECT * FROM ' . $this->db->table('creatives') . ' WHERE creative_id = ?', [$id]);
            if (isset($input['creativeId']) && !$current) {
                throw new ApiError(404, 'creative_not_found', '소재를 찾을 수 없습니다.');
            }
            if ($current && $current['archived']) {
                Value::fail('creativeId', '보관한 소재는 수정할 수 없습니다.');
            }
            $version = $current ? (int) $current['current_version'] + 1 : 1;
            $creative = ['creativeId' => $id, 'version' => $version, 'name' => $name, 'kind' => str_starts_with($mime, 'video/') ? 'video' : 'image', 'url' => $url, 'mime' => $mime, 'alt' => $alt, 'source' => $source, 'archived' => false, 'createdAt' => Value::now()];
            if ($current) {
                $this->db->run('UPDATE ' . $this->db->table('creatives') . ' SET current_version = ? WHERE creative_id = ?', [$version, $id]);
            } else {
                $this->db->run('INSERT INTO ' . $this->db->table('creatives') . ' (creative_id, current_version, archived) VALUES (?, ?, 0)', [$id, $version]);
            }
            $this->db->run('INSERT INTO ' . $this->db->table('creative_versions') . ' (creative_id, version, document) VALUES (?, ?, ?)', [$id, $version, Value::json($creative)]);
            return ['creative' => $creative];
        });
    }

    public function archive(array $input): array
    {
        $id = Value::id($input['creativeId'] ?? null, 'creativeId');
        return $this->db->write(function () use ($id): array {
            if (!$this->db->one('SELECT creative_id FROM ' . $this->db->table('creatives') . ' WHERE creative_id = ?', [$id])) {
                throw new ApiError(404, 'creative_not_found', '소재를 찾을 수 없습니다.');
            }
            $this->db->run('UPDATE ' . $this->db->table('creatives') . ' SET archived = 1 WHERE creative_id = ?', [$id]);
            return ['saved' => true];
        });
    }

    public static function uploadLimit(array $config): int
    {
        $bytes = static function (string $raw): int {
            $raw = trim($raw);
            $number = (float) $raw;
            $power = match (strtolower(substr($raw, -1))) { 'g' => 3, 'm' => 2, 'k' => 1, default => 0 };
            return $number > 0 ? (int) ($number * (1024 ** $power)) : PHP_INT_MAX;
        };
        return min($config['uploadBytes'], $bytes(ini_get('upload_max_filesize')), max(1, $bytes(ini_get('post_max_size')) - 16384));
    }

    public function upload(array $input, array $file): array
    {
        $error = $file['error'] ?? UPLOAD_ERR_NO_FILE;
        if (in_array($error, [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)) {
            throw new ApiError(413, 'upload_size', '업로드 제한을 초과했습니다.');
        }
        if ($error !== UPLOAD_ERR_OK || !is_string($file['tmp_name'] ?? null) || !is_uploaded_file($file['tmp_name'])) {
            Value::fail('file', '업로드 파일을 확인해 주세요.');
        }
        $size = filesize($file['tmp_name']);
        if ($size === false || $size < 1 || $size > self::uploadLimit($this->config)) {
            throw new ApiError(413, 'upload_size', '업로드 제한을 초과했습니다.');
        }
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
        if (!isset(Value::MIMES[$mime])) {
            Value::fail('file', '지원하는 영상 또는 이미지 파일이 아닙니다.');
        }

        $root = self::storageRoot($this->config['uploadRoot']);
        $filename = Value::uuid() . '.' . Value::MIMES[$mime];
        $path = $root . '/' . $filename;
        if (file_exists($path) || is_link($path) || !move_uploaded_file($file['tmp_name'], $path)) {
            throw new ApiError(500, 'upload_failed', '파일 저장에 실패했습니다.');
        }
        chmod($path, 0640);
        try {
            return $this->save([...$input, 'url' => rtrim($this->config['uploadUrl'], '/') . '/' . $filename, 'mime' => $mime], 'upload');
        } catch (\Throwable $error) {
            unlink($path);
            throw $error;
        }
    }

    public static function storageRoot(string $path): string
    {
        $real = realpath($path);
        if ($real === false || !is_dir($real) || $path !== $real) {
            throw new ApiError(500, 'storage_unavailable', '업로드 저장소를 확인해 주세요.');
        }
        for ($current = $path; $current !== dirname($current); $current = dirname($current)) {
            if (is_link($current)) {
                throw new ApiError(500, 'storage_unavailable', '업로드 저장소를 확인해 주세요.');
            }
        }
        return $real;
    }
}
