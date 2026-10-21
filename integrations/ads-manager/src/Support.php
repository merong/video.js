<?php
declare(strict_types=1);

namespace AdsManager;

final class ApiError extends \RuntimeException
{
    public function __construct(public readonly int $status, public readonly string $errorCode, string $message, public readonly array $fields = [])
    {
        parent::__construct($message);
    }
}

final class Value
{
    // ECMAScript WhiteSpace + LineTerminator, the set String.prototype.trim removes:
    // U+0009–U+000D, U+FEFF, Zs (U+0020, U+00A0, U+1680, U+2000–U+200A, U+202F, U+205F, U+3000), U+2028, U+2029.
    // Not U+0085: JS keeps it, and \p{Cc} rejects it anyway.
    public const SPACE = '[\x{0009}-\x{000D}\x{FEFF}\p{Zs}\x{2028}\x{2029}]';
    // Embeddings, overrides and isolates can reverse how text reads. Marks such as U+200F stay allowed.
    public const BIDI_CONTROL = '[\x{202A}-\x{202E}\x{2066}-\x{2069}]';
    public const MIMES = ['video/mp4' => 'mp4', 'video/webm' => 'webm', 'image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif'];

    public static function fail(string $field, string $message = '입력값을 확인해 주세요.'): never
    {
        throw new ApiError(422, 'validation', $message, [$field => $message]);
    }

    public static function text(mixed $value, string $field, int $max = 128, bool $empty = false): string
    {
        if (!is_string($value) || !preg_match('//u', $value) || mb_strlen($value) > $max || (!$empty && trim($value) === '') || preg_match('/[\x00-\x1f\x7f]/u', $value)) {
            self::fail($field);
        }

        return $value;
    }

    public static function id(mixed $value, string $field): string
    {
        return self::text($value, $field);
    }

    /**
     * A content video ID: id() tightened by the contract 4.1 string rules (no \p{Cc} or bidirectional
     * controls, not empty or only JS whitespace). Never trimmed: players require the echoed ID verbatim.
     */
    public static function videoId(mixed $value, string $field = 'videoId'): string
    {
        if (!is_string($value) || !preg_match('//u', $value) || mb_strlen($value) > 128 || preg_match('/\p{Cc}|' . self::BIDI_CONTROL . '|^' . self::SPACE . '*$/Du', $value)) {
            self::fail($field, '영상 ID를 확인해 주세요.');
        }
        return $value;
    }

    public static function nullableId(mixed $value, string $field): ?string
    {
        return $value === null ? null : self::id($value, $field);
    }

    public static function integer(mixed $value, string $field, int $min = 0, int $max = PHP_INT_MAX): int
    {
        if (!is_int($value) || $value < $min || $value > $max) {
            self::fail($field);
        }

        return $value;
    }

    public static function number(mixed $value, string $field, float $min = 0, float $max = 31536000): float|int
    {
        if ((!is_float($value) && !is_int($value)) || !is_finite((float) $value) || $value < $min || $value > $max) {
            self::fail($field);
        }

        return $value;
    }

    public static function url(mixed $value, string $field): string
    {
        $url = self::text($value, $field, 4096);
        if (preg_match('/[\s\\\\]/u', $url) || preg_match('/%(?:0[0-9a-f]|1[0-9a-f]|7f)/i', $url)) {
            self::fail($field, 'HTTP(S) 또는 사이트 내 절대 경로를 입력해 주세요.');
        }
        if (str_starts_with($url, '/') && !str_starts_with($url, '//')) {
            return $url;
        }

        $parts = parse_url($url);
        if (!$parts || !in_array(strtolower($parts['scheme'] ?? ''), ['http', 'https'], true) || empty($parts['host']) || isset($parts['user']) || isset($parts['pass'])) {
            self::fail($field, 'HTTP(S) 또는 사이트 내 절대 경로를 입력해 주세요.');
        }

        return $url;
    }

    public static function json(mixed $value): string
    {
        return json_encode($value, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION);
    }

    public static function decode(string $value): array
    {
        $decoded = json_decode($value, true, 64, JSON_THROW_ON_ERROR);
        if (!is_array($decoded)) {
            throw new ApiError(400, 'invalid_json', 'JSON 객체가 필요합니다.');
        }

        return $decoded;
    }

    public static function canonical(array $value): string
    {
        $sort = static function (array $item) use (&$sort): array {
            if (!array_is_list($item)) {
                ksort($item);
            }
            foreach ($item as &$child) {
                if (is_array($child)) {
                    $child = $sort($child);
                }
            }
            return $item;
        };

        return self::json($sort($value));
    }

    public static function now(): string
    {
        return gmdate('Y-m-d\TH:i:s\Z');
    }

    public static function uuid(): string
    {
        return bin2hex(random_bytes(16));
    }

    public static function target(array $value, string $siteId): array
    {
        $type = $value['type'] ?? null;
        if (!in_array($type, ['site', 'board', 'category', 'video'], true)) {
            self::fail('target.type');
        }

        $target = ['type' => $type, 'id' => $type === 'video' ? self::videoId($value['id'] ?? null, 'target.id') : self::id($value['id'] ?? null, 'target.id')];
        if ($type === 'site' && $target['id'] !== $siteId) {
            self::fail('target.id');
        }
        if ($type === 'category') {
            $target['boardId'] = self::id($value['boardId'] ?? null, 'target.boardId');
        }

        return $target;
    }

    public static function targetKey(array $target): string
    {
        return hash('sha256', self::canonical($target));
    }
}
