<?php
declare(strict_types=1);

namespace AdsManager;

/**
 * Ad request board posts (skin solad_request, see its request.lib.php) shaped for the admin. The host reads the rows;
 * this keeps the field meaning, the plain-text body and the masking for read-only administrators in one place.
 */
final class AdRequests
{
    public const PER_PAGE = 20;
    // Category name => the admin status tone; the order is the board's stage order (SOLAD_REQUEST_STAGES).
    public const STAGES = ['접수' => 'draft', '검토' => 'pending', '보완 요청' => 'paused', '집행 예정' => 'scheduled', '집행' => 'active', '종료' => 'done', '반려' => 'rejected'];

    /** Validated list filters from query-string input. */
    public static function query(array $input): array
    {
        $status = $input['status'] ?? '';
        if ($status !== '' && !isset(self::STAGES[$status])) {
            Value::fail('status');
        }
        $query = trim(Value::text($input['query'] ?? '', 'query', 100, true));
        return ['status' => $status === '' ? null : $status, 'query' => $query, 'page' => self::number($input['page'] ?? '1', 'page')];
    }

    /** A positive integer given as a query-string value or a JSON number. */
    public static function number(mixed $value, string $field): int
    {
        if (is_int($value) ? $value < 1 || $value > 999999999 : !is_string($value) || !preg_match('/^[1-9][0-9]{0,8}$/D', $value)) {
            Value::fail($field);
        }
        return (int) $value;
    }

    /** Any category outside the stage list (or none) is a new request. */
    public static function status(?string $category): string
    {
        return isset(self::STAGES[$category ?? '']) ? $category : '접수';
    }

    public static function stages(): array
    {
        return array_map(static fn (string $name, string $tone): array => ['name' => $name, 'tone' => $tone], array_keys(self::STAGES), self::STAGES);
    }

    /** `counts` from category => posts, with every stage present. */
    public static function counts(array $categories): array
    {
        $counts = ['all' => 0, ...array_fill_keys(array_keys(self::STAGES), 0)];
        foreach ($categories as $category => $posts) {
            $counts[self::status((string) $category)] += (int) $posts;
            $counts['all'] += (int) $posts;
        }
        return $counts;
    }

    /** One list row. `$row` is a post with `bo_table`; `$hasFile` says whether its first attachment exists. */
    public static function item(array $row, string $url, bool $hasFile, string $timeZone): array
    {
        $status = self::status($row['ca_name'] ?? '');
        return [
            'boardId' => $row['bo_table'], 'postId' => (int) $row['wr_id'], 'title' => (string) $row['wr_subject'],
            'status' => $status, 'tone' => self::STAGES[$status],
            'advertiser' => self::value($row['wr_1'] ?? null), 'startDate' => self::date($row['wr_2'] ?? null), 'endDate' => self::date($row['wr_3'] ?? null),
            'position' => self::value($row['wr_4'] ?? null), 'impressions' => self::count($row['wr_5'] ?? null),
            'createdAt' => self::time($row['wr_datetime'] ?? null, $timeZone), 'comments' => (int) ($row['wr_comment'] ?? 0),
            'hasMedia' => $hasFile || self::value($row['wr_7'] ?? null) !== null, 'secret' => str_contains((string) ($row['wr_option'] ?? ''), 'secret'),
            'url' => $url,
        ];
    }

    /**
     * One request with its fields, body, attachments and comment history. `$files` are [name, size, url, media] in
     * attachment order (`media`: the first slot, the ad creative), `$comments` the comment rows oldest first and
     * `$target` the wr_9 board or null.
     */
    public static function detail(array $board, array $row, array $files, array $comments, ?array $target, string $url, bool $masked, string $timeZone): array
    {
        $item = self::item($row, $url, in_array(true, array_column($files, 'media'), true), $timeZone);
        $extra = [];
        for ($i = 1; $i <= 10; $i++) {
            $extra['wr_' . $i] = self::value($row['wr_' . $i] ?? null);
        }
        if ($masked) {
            $extra['wr_8'] = self::maskContact($extra['wr_8']);
        }
        $name = self::value($row['wr_name'] ?? null);

        return [
            'boardId' => $item['boardId'], 'boardName' => (string) $board['bo_subject'], 'postId' => $item['postId'], 'title' => $item['title'],
            'status' => $item['status'], 'tone' => $item['tone'], 'secret' => $item['secret'],
            'createdAt' => $item['createdAt'], 'updatedAt' => self::time($row['wr_last'] ?? null, $timeZone),
            'advertiser' => $item['advertiser'], 'startDate' => $item['startDate'], 'endDate' => $item['endDate'],
            'position' => $item['position'], 'impressions' => $item['impressions'],
            'clickUrl' => $extra['wr_6'], 'mediaUrl' => $extra['wr_7'], 'contact' => $extra['wr_8'],
            'targetBoard' => $target,
            'extra' => $extra,
            'author' => $masked
                ? ['name' => self::maskName($name), 'memberId' => null, 'email' => null]
                : ['name' => $name, 'memberId' => self::value($row['mb_id'] ?? null), 'email' => self::value($row['wr_email'] ?? null)],
            'content' => self::text((string) $row['wr_content'], (string) ($row['wr_option'] ?? '')),
            'files' => array_map(static fn (array $file): array => [
                'name' => $file['name'], 'kind' => self::kind($file['name']), 'size' => $file['size'], 'url' => $file['url'], 'media' => $file['media'],
            ], $files),
            'history' => array_map(static fn (array $comment): array => [
                'commentId' => (int) $comment['wr_id'], 'createdAt' => self::time($comment['wr_datetime'] ?? null, $timeZone),
                'author' => $masked ? self::maskName(self::value($comment['wr_name'] ?? null)) : self::value($comment['wr_name'] ?? null),
                'status' => isset(self::STAGES[$comment['wr_1'] ?? '']) ? $comment['wr_1'] : null,
                'content' => self::text((string) $comment['wr_content'], (string) ($comment['wr_option'] ?? '')),
            ], $comments),
            'url' => $url,
        ];
    }

    /** The body as plain text: an HTML post keeps its line breaks and loses its tags; the client draws it as text. */
    public static function text(string $content, string $option): string
    {
        if (str_contains($option, 'html')) {
            $content = preg_replace('~<br\s*/?>|</(p|div|li|h[1-6]|tr)>~i', "\n", $content);
            $content = html_entity_decode(strip_tags(preg_replace('~<(script|style)\b.*?</\1>~is', '', $content)), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        }
        return trim(str_replace(["\r\n", "\r"], "\n", $content));
    }

    /** Letters and digits after the first 3 and before the last 2 become `*`; under 6 of them, all do. */
    public static function maskContact(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }
        $total = preg_match_all('/[\p{L}\p{N}]/u', $value);
        $seen = 0;
        return preg_replace_callback('/[\p{L}\p{N}]/u', static function (array $match) use (&$seen, $total): string {
            $seen++;
            return $total >= 6 && ($seen <= 3 || $seen > $total - 2) ? $match[0] : '*';
        }, $value);
    }

    /** The first character and one `*` per remaining character. */
    public static function maskName(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }
        $length = mb_strlen($value);
        return mb_substr($value, 0, 1) . str_repeat('*', max(1, $length - 1));
    }

    private static function value(mixed $value): ?string
    {
        $value = trim((string) $value);
        return $value === '' ? null : $value;
    }

    private static function date(mixed $value): ?string
    {
        return is_string($value) && preg_match('/^(\d{4})-(\d{2})-(\d{2})$/D', $value, $m) && checkdate((int) $m[2], (int) $m[3], (int) $m[1]) ? $value : null;
    }

    private static function count(mixed $value): ?int
    {
        return is_string($value) && preg_match('/^[1-9][0-9]{0,11}$/D', trim($value)) ? (int) trim($value) : null;
    }

    /** A GnuBoard local time (Y-m-d H:i:s in the site time zone) as UTC ISO 8601. */
    private static function time(mixed $value, string $timeZone): ?string
    {
        if (!is_string($value) || $value === '' || str_starts_with($value, '0000')) {
            return null;
        }
        $time = \DateTimeImmutable::createFromFormat('!Y-m-d H:i:s', $value, new \DateTimeZone($timeZone));
        return $time ? $time->setTimezone(new \DateTimeZone('UTC'))->format('Y-m-d\TH:i:s\Z') : null;
    }

    private static function kind(string $name): string
    {
        $extension = strtolower(pathinfo((string) parse_url($name, PHP_URL_PATH), PATHINFO_EXTENSION));
        return match (true) {
            in_array($extension, ['mp4', 'm4v', 'webm'], true) => 'video',
            in_array($extension, ['jpg', 'jpeg', 'png', 'gif', 'webp'], true) => 'image',
            default => 'other',
        };
    }
}
