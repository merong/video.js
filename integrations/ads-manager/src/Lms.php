<?php
declare(strict_types=1);

namespace AdsManager;

/**
 * Lecture progress and notes per learner (.agents/plans/ads-lms-spec.md 3). The tables come from database/lms and
 * are optional: without them every LMS action except lms-settings is 503 and the player stores in its browser.
 * Progress and notes never take the installation write_lock; each request is one transaction that first
 * updates its learner's rate-limit row, which also serializes that learner's own reports.
 */
final class Lms
{
    public const PAGE_SIZE = 50;
    // The built-in `lms` preset values, used when the selected preset has LMS turned off.
    private const RULES = ['completion' => 90, 'seekLimit' => 'free', 'maxRate' => 2];
    private const REASONS = ['interval', 'pause', 'ended', 'seeked', 'ratechange', 'hidden', 'pagehide'];
    private const SUBJECT = '/^[A-Za-z0-9._:@-]{1,64}$/D';
    private const SEGMENTS = 500;
    private const STORED_SEGMENTS = 1000;
    private const NOTES = 200;
    private const LEARNER_LIMIT = 60;
    // Wall-clock seconds a first report in a session may cover, and the slack added to later intervals.
    private const FIRST_REPORT = 30;
    private const SLACK = 5;
    private const DURATION_TOLERANCE = 2;
    private const PROGRESS_COLUMNS = ['learner', 'videoId', 'percent', 'completedAt', 'activeSeconds', 'position', 'duration', 'updatedAt'];

    public function __construct(private readonly Database $db, private readonly array $config, private readonly Host $host, private readonly PlayerPresets $presets) {}

    public function installed(): bool
    {
        return $this->db->meta('lms_schema_version') === '1';
    }

    private function requireInstalled(): void
    {
        if (!$this->installed()) {
            throw new ApiError(503, 'lms_unavailable', '강의 기록 저장이 설치되지 않았어요.');
        }
    }

    public function session(array $input): array
    {
        $this->requireInstalled();
        $videoId = Value::videoId($input['videoId'] ?? null);
        $presetId = $input['presetId'] ?? null;
        $this->host->resolveVideoContext($videoId);
        try {
            $render = $this->presets->render($presetId === null ? [] : ['id' => $presetId]);
        } catch (ApiError $error) {
            // A deleted preset falls back to the site default, as the loader does.
            if ($error->errorCode !== 'preset_not_found') {
                throw $error;
            }
            $render = $this->presets->render([]);
        }
        $lms = $render['lms'] ?? self::RULES;
        $rules = ['completion' => $lms['completion'], 'seekLimit' => $lms['seekLimit'], 'maxRate' => $lms['maxRate']];
        $this->db->hit('lms-global', $this->config['lmsRateLimitPerMinute']);

        [$learner, $kind, $learnerError, $duration] = $this->learner($input['learnerToken'] ?? null);
        $result = ['storage' => $learner === null ? 'local' : 'server', 'learner' => $kind];
        if ($learnerError !== null) {
            $result['learnerError'] = $learnerError;
        }
        if ($learner === null) {
            return [...$result, 'rules' => $rules, 'progress' => null, 'notes' => []];
        }

        $this->db->hit('lms:' . $learner . ':' . $videoId, self::LEARNER_LIMIT);
        $expiry = time() + $this->config['sessionSeconds'];
        $claims = ['siteId' => $this->config['siteId'], 'learner' => $learner, 'videoId' => $videoId, 'sessionId' => 'lms-' . Value::uuid(), ...$rules, 'duration' => $duration, 'exp' => $expiry];
        $payload = self::encode(Value::json($claims));
        $row = $this->row($learner, $videoId);
        return [...$result, 'lmsToken' => $payload . '.' . $this->sign($payload), 'expiresAt' => gmdate('Y-m-d\TH:i:s\Z', $expiry), 'rules' => $rules,
            'progress' => $row === null ? null : ['segments' => Value::decode($row['segments']), 'position' => (float) $row['position'], 'duration' => $row['duration'] === null ? null : (float) $row['duration'], 'maxWatched' => (float) $row['max_watched'], 'percent' => (int) $row['percent'], 'completedAt' => $row['completed_at']],
            'notes' => $this->noteList($learner, $videoId)];
    }

    /** @return array{0: ?string, 1: ?string, 2: ?string, 3: int|float|null} learner, kind, error and the LMS-known duration */
    private function learner(mixed $token): array
    {
        $member = $this->host->learnerId();
        if ($member !== null) {
            return ['g:' . $member, 'member', null, null];
        }
        if ($token === null) {
            return [null, null, null, null];
        }
        $payload = self::verify($token, $this->db->meta('lms_key'));
        $now = time();
        if ($payload === null || $payload['exp'] > $now + 86400) {
            return [null, null, 'invalid', null];
        }
        if ($payload['exp'] <= $now) {
            return [null, null, 'expired', null];
        }
        return ['x:' . $payload['sub'], 'external', null, $payload['dur'] ?? null];
    }

    /**
     * An external LMS learner token: `base64url(payload) "." base64url(HMAC-SHA256(key, payload part))`, where the key is
     * the 64-character hex text exactly as the administrator copied it. Returns the payload, or null for any defect.
     */
    public static function verify(mixed $token, ?string $key): ?array
    {
        if ($key === null || !is_string($token) || strlen($token) > 2048 || !preg_match('/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/D', $token)) {
            return null;
        }
        [$payload, $signature] = explode('.', $token);
        if (!hash_equals(self::encode(hash_hmac('sha256', $payload, $key, true)), $signature)) {
            return null;
        }
        $json = base64_decode(strtr($payload, '-_', '+/'), true);
        try {
            $claims = $json === false ? [] : Value::decode($json);
        } catch (\JsonException|ApiError $error) {
            return null;
        }
        $dur = $claims['dur'] ?? 1;
        if (array_diff(array_keys($claims), ['v', 'sub', 'exp', 'dur']) !== [] || ($claims['v'] ?? null) !== 1 || !is_string($claims['sub'] ?? null) || !preg_match(self::SUBJECT, $claims['sub']) || !is_int($claims['exp'] ?? null) || (!is_int($dur) && !is_float($dur)) || $dur <= 0 || $dur > 86400) {
            return null;
        }
        return $claims;
    }

    public static function learnerToken(array $payload, string $key): string
    {
        $encoded = self::encode(Value::json($payload));
        return $encoded . '.' . self::encode(hash_hmac('sha256', $encoded, $key, true));
    }

    private static function encode(string $bytes): string
    {
        return rtrim(strtr(base64_encode($bytes), '+/', '-_'), '=');
    }

    /** Event tokens sign with signing_key itself; this per-purpose key keeps the two from verifying as each other. */
    private function sign(string $payload): string
    {
        return hash_hmac('sha256', $payload, hash_hmac('sha256', 'lms-session', $this->db->meta('signing_key')));
    }

    private function claims(array $input): array
    {
        $this->requireInstalled();
        $invalid = static fn () => throw new ApiError(403, 'invalid_session', '학습 세션이 만료됐거나 유효하지 않아요. 다시 불러와 주세요.');
        $token = $input['lmsToken'] ?? null;
        if (!is_string($token) || strlen($token) > 4096 || substr_count($token, '.') !== 1) {
            $invalid();
        }
        [$payload, $signature] = explode('.', $token);
        if (!hash_equals($this->sign($payload), $signature)) {
            $invalid();
        }
        $decoded = base64_decode(strtr($payload, '-_', '+/'), true);
        $claims = $decoded === false ? [] : Value::decode($decoded);
        // videoId is repeated in the body so a token for one lecture cannot write another.
        if (($claims['exp'] ?? 0) <= time() || ($claims['siteId'] ?? null) !== $this->config['siteId'] || ($claims['videoId'] ?? null) !== ($input['videoId'] ?? null)) {
            $invalid();
        }
        // A member token stays bound to the signed-in member that requested it.
        if (str_starts_with($claims['learner'], 'g:') && 'g:' . $this->host->learnerId() !== $claims['learner']) {
            $invalid();
        }
        return $claims;
    }

    public function progress(array $input): array
    {
        $claims = $this->claims($input);
        $seq = Value::integer($input['seq'] ?? null, 'seq', 1, 1000000000);
        if (!in_array($input['reason'] ?? null, self::REASONS, true)) {
            Value::fail('reason');
        }
        $segments = self::segments($input['segments'] ?? null);
        $position = Value::number($input['position'] ?? null, 'position');
        $reported = Value::number($input['duration'] ?? null, 'duration');
        if ($reported <= 0) {
            Value::fail('duration');
        }
        $rate = Value::number($input['rate'] ?? null, 'rate', 0, 16);
        if ($rate <= 0) {
            Value::fail('rate');
        }
        $delta = Value::number($input['activeSecondsDelta'] ?? null, 'activeSecondsDelta', 0, 86400);
        $this->db->hit('lms-global', $this->config['lmsRateLimitPerMinute']);

        return $this->db->transaction(function () use ($claims, $seq, $segments, $position, $reported, $delta): array {
            $this->db->hit('lms:' . $claims['learner'] . ':' . $claims['videoId'], self::LEARNER_LIMIT);
            $row = $this->row($claims['learner'], $claims['videoId']);
            if ($row !== null && $row['session_id'] === $claims['sessionId'] && $seq <= (int) $row['seq']) {
                return self::progressResult($row);
            }

            $fixed = $claims['duration'] ?? ($row['duration'] ?? null);
            if ($fixed !== null && abs($reported - (float) $fixed) > self::DURATION_TOLERANCE) {
                throw new ApiError(400, 'duration_mismatch', '영상 길이가 처음 보고와 달라요.');
            }
            $duration = (float) ($fixed ?? $reported);
            $now = time();
            $first = $row === null || $row['session_id'] !== $claims['sessionId'] || $row['reported_at'] === null;
            $window = $first ? self::FIRST_REPORT : max(0, $now - (int) $row['reported_at']) + self::SLACK;
            $stored = $row === null ? [] : Value::decode($row['segments']);
            $completedAt = $row['completed_at'] ?? null;
            $maxWatched = (float) ($row['max_watched'] ?? 0);
            $clipped = [];
            foreach ($segments as [$start, $end]) {
                [$start, $end] = [max(0.0, $start), min($duration, $end)];
                if ($end > $start) {
                    $clipped[] = [$start, $end];
                }
            }
            $frontier = $claims['seekLimit'] === 'watched' && $completedAt === null ? $maxWatched : null;
            $merged = self::merge([...$stored, ...self::accept($stored, $clipped, $frontier, $window * $claims['maxRate'])]);
            if (count($merged) > self::STORED_SEGMENTS) {
                throw new ApiError(400, 'segment_limit', '시청 구간이 너무 많아요.');
            }

            $watched = array_sum(array_map(static fn (array $segment): float => $segment[1] - $segment[0], $merged));
            $percent = (int) min(100, floor($watched / $duration * 100 + 1e-9));
            $maxWatched = max($maxWatched, $merged === [] ? 0.0 : $merged[count($merged) - 1][1]);
            if ($completedAt === null && $percent >= $claims['completion']) {
                $completedAt = Value::now();
            }
            $active = round((float) ($row['active_seconds'] ?? 0) + min($delta, $window), 3);
            $values = [$claims['sessionId'], $seq, Value::json($merged), round(min((float) $position, $duration), 3), $duration, $maxWatched, round($watched, 3), $percent, $active, $completedAt, $now, Value::now()];
            $keys = [$this->config['siteId'], $claims['learner'], $claims['videoId']];
            if ($row === null) {
                $this->db->run('INSERT INTO ' . $this->db->table('lms_progress') . ' (session_id, seq, segments, position, duration, max_watched, watched_seconds, percent, active_seconds, completed_at, reported_at, updated_at, site_id, learner, video_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [...$values, ...$keys, Value::now()]);
            } else {
                $this->db->run('UPDATE ' . $this->db->table('lms_progress') . ' SET session_id = ?, seq = ?, segments = ?, position = ?, duration = ?, max_watched = ?, watched_seconds = ?, percent = ?, active_seconds = ?, completed_at = ?, reported_at = ?, updated_at = ? WHERE site_id = ? AND learner = ? AND video_id = ?', [...$values, ...$keys]);
            }
            return ['percent' => $percent, 'completedAt' => $completedAt, 'maxWatched' => $maxWatched, 'segments' => $merged];
        });
    }

    private static function progressResult(array $row): array
    {
        return ['percent' => (int) $row['percent'], 'completedAt' => $row['completed_at'], 'maxWatched' => (float) $row['max_watched'], 'segments' => Value::decode($row['segments'])];
    }

    /** @return list<array{0: float, 1: float}> */
    private static function segments(mixed $value): array
    {
        if (!is_array($value) || !array_is_list($value)) {
            Value::fail('segments');
        }
        if (count($value) > self::SEGMENTS) {
            throw new ApiError(400, 'segment_limit', '구간은 한 번에 ' . self::SEGMENTS . '개까지 보낼 수 있어요.');
        }
        $segments = [];
        foreach ($value as $index => $segment) {
            $field = 'segments.' . $index;
            if (!is_array($segment) || !array_is_list($segment) || count($segment) !== 2) {
                Value::fail($field);
            }
            $start = round((float) Value::number($segment[0], $field), 3);
            $end = round((float) Value::number($segment[1], $field), 3);
            if ($end < $start) {
                Value::fail($field);
            }
            $segments[] = [$start, $end];
        }
        return $segments;
    }

    /** Sorted, with overlapping or touching ranges joined. */
    private static function merge(array $segments): array
    {
        usort($segments, static fn (array $a, array $b): int => $a[0] <=> $b[0]);
        $merged = [];
        foreach ($segments as $segment) {
            $last = count($merged) - 1;
            if ($last >= 0 && $segment[0] <= $merged[$last][1]) {
                $merged[$last][1] = max($merged[$last][1], $segment[1]);
            } else {
                $merged[] = $segment;
            }
        }
        return $merged;
    }

    /**
     * New coverage in time order. With a frontier (seekLimit watched, not yet completed) a range starting more than
     * one second past what was watched is dropped. What is already stored never spends the budget, and coverage
     * beyond the budget (wall time × maxRate) is cut off.
     */
    private static function accept(array $stored, array $segments, ?float $frontier, float $budget): array
    {
        usort($segments, static fn (array $a, array $b): int => $a[0] <=> $b[0]);
        $added = [];
        foreach ($segments as [$start, $end]) {
            if ($frontier !== null && $start > $frontier + 1) {
                continue;
            }
            $covered = self::merge([...$stored, ...$added]);
            foreach (self::uncovered($start, $end, $covered) as [$from, $to]) {
                $to = min($to, round($from + $budget, 3));
                if ($to <= $from) {
                    return $added;
                }
                $budget -= $to - $from;
                $added[] = [$from, $to];
            }
            if ($frontier !== null) {
                $frontier = max($frontier, $end);
            }
        }
        return $added;
    }

    private static function uncovered(float $start, float $end, array $covered): array
    {
        $gaps = [];
        foreach ($covered as [$from, $to]) {
            if ($to <= $start || $from >= $end) {
                continue;
            }
            if ($from > $start) {
                $gaps[] = [$start, $from];
            }
            $start = max($start, $to);
        }
        if ($end > $start) {
            $gaps[] = [$start, $end];
        }
        return $gaps;
    }

    private function row(string $learner, string $videoId): ?array
    {
        return $this->db->one('SELECT * FROM ' . $this->db->table('lms_progress') . ' WHERE site_id = ? AND learner = ? AND video_id = ?', [$this->config['siteId'], $learner, $videoId]);
    }

    public function notes(array $input): array
    {
        $claims = $this->claims($input);
        $op = $input['op'] ?? null;
        if (!in_array($op, ['list', 'save', 'delete'], true)) {
            Value::fail('op');
        }
        $note = $op === 'save' ? self::note($input['note'] ?? null) : null;
        $deleteId = $op === 'delete' ? self::noteId(is_array($input['note'] ?? null) ? ($input['note']['id'] ?? null) : null) : null;
        $this->db->hit('lms-global', $this->config['lmsRateLimitPerMinute']);

        return $this->db->transaction(function () use ($claims, $note, $deleteId): array {
            [$learner, $videoId] = [$claims['learner'], $claims['videoId']];
            $this->db->hit('lms:' . $learner . ':' . $videoId, self::LEARNER_LIMIT);
            $table = $this->db->table('lms_notes');
            $now = Value::now();
            $own = function (string $id) use ($table, $learner, $videoId): void {
                if ($this->db->one("SELECT id FROM $table WHERE site_id = ? AND id = ? AND learner = ? AND video_id = ? AND deleted_at IS NULL", [$this->config['siteId'], $id, $learner, $videoId]) === null) {
                    throw new ApiError(404, 'note_not_found', '메모를 찾을 수 없어요.');
                }
            };
            if ($note !== null && $note['id'] === null) {
                $count = (int) $this->db->one("SELECT COUNT(*) AS total FROM $table WHERE site_id = ? AND learner = ? AND video_id = ? AND deleted_at IS NULL", [$this->config['siteId'], $learner, $videoId])['total'];
                if ($count >= self::NOTES) {
                    throw new ApiError(400, 'note_limit', '메모와 북마크는 영상마다 ' . self::NOTES . '개까지 남길 수 있어요.');
                }
                do {
                    $id = self::newId();
                } while ($this->db->one("SELECT id FROM $table WHERE site_id = ? AND id = ?", [$this->config['siteId'], $id]) !== null);
                $this->db->run("INSERT INTO $table (site_id, id, learner, video_id, kind, time_seconds, text, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", [$this->config['siteId'], $id, $learner, $videoId, $note['kind'], $note['time'], $note['text'], $now, $now]);
            } elseif ($note !== null) {
                $own($note['id']);
                $this->db->run("UPDATE $table SET kind = ?, time_seconds = ?, text = ?, updated_at = ? WHERE site_id = ? AND id = ?", [$note['kind'], $note['time'], $note['text'], $now, $this->config['siteId'], $note['id']]);
            } elseif ($deleteId !== null) {
                $own($deleteId);
                // Operating accounts have no DELETE grant (README); a note is hidden, not removed.
                $this->db->run("UPDATE $table SET deleted_at = ?, updated_at = ? WHERE site_id = ? AND id = ?", [$now, $now, $this->config['siteId'], $deleteId]);
            }
            return ['notes' => $this->noteList($learner, $videoId)];
        });
    }

    private static function note(mixed $value): array
    {
        if (!is_array($value) || array_is_list($value)) {
            Value::fail('note');
        }
        foreach (array_keys($value) as $key) {
            if (!in_array($key, ['id', 'kind', 'time', 'text'], true)) {
                Value::fail('note.' . $key);
            }
        }
        $id = ($value['id'] ?? null) === null ? null : self::noteId($value['id']);
        $kind = $value['kind'] ?? null;
        if (!in_array($kind, ['note', 'bookmark'], true)) {
            Value::fail('note.kind');
        }
        $time = round((float) Value::number($value['time'] ?? null, 'note.time'), 3);
        // The preset name rules: no control or bidirectional control characters, trimmed like JS.
        $text = $value['text'] ?? null;
        if (!is_string($text) || !preg_match('//u', $text) || preg_match('/\p{Cc}|' . Value::BIDI_CONTROL . '/u', $text)) {
            Value::fail('note.text');
        }
        $text = preg_replace('/^' . Value::SPACE . '+|' . Value::SPACE . '+$/Du', '', $text);
        $max = $kind === 'note' ? 1000 : 80;
        if (mb_strlen($text) > $max || ($kind === 'note' && $text === '')) {
            Value::fail('note.text', $kind === 'note' ? '메모는 1~1000자로 입력해 주세요.' : '북마크 이름은 80자 이내로 입력해 주세요.');
        }
        return ['id' => $id, 'kind' => $kind, 'time' => $time, 'text' => $text];
    }

    private static function noteId(mixed $value): string
    {
        if (!is_string($value) || !preg_match('/^n-[a-z0-9]{10}$/D', $value)) {
            Value::fail('note.id');
        }
        return $value;
    }

    private static function newId(): string
    {
        $alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
        $id = 'n-';
        for ($i = 0; $i < 10; $i++) {
            $id .= $alphabet[random_int(0, 35)];
        }
        return $id;
    }

    private function noteList(string $learner, string $videoId): array
    {
        $rows = $this->db->run('SELECT id, kind, time_seconds, text FROM ' . $this->db->table('lms_notes') . ' WHERE site_id = ? AND learner = ? AND video_id = ? AND deleted_at IS NULL ORDER BY time_seconds, created_at, id', [$this->config['siteId'], $learner, $videoId])->fetchAll();
        return array_map(static fn (array $row): array => ['id' => $row['id'], 'kind' => $row['kind'], 'time' => (float) $row['time_seconds'], 'text' => $row['text']], $rows);
    }

    public function settings(): array
    {
        $key = $this->db->meta('lms_key');
        return ['installed' => $this->installed(), 'keySet' => $key !== null, 'keyHint' => $key === null ? null : '…' . substr($key, -4), 'rotatedAt' => $this->db->meta('lms_key_rotated_at')];
    }

    /** The full key is returned only here, once; later reads show its last four characters. */
    public function rotateKey(): array
    {
        $this->requireInstalled();
        $key = bin2hex(random_bytes(32));
        $now = Value::now();
        $this->db->write(function () use ($key, $now): void {
            foreach (['lms_key' => $key, 'lms_key_rotated_at' => $now] as $name => $value) {
                $sql = $this->db->meta($name) === null ? 'INSERT INTO ' . $this->db->table('meta') . ' (value, name) VALUES (?, ?)' : 'UPDATE ' . $this->db->table('meta') . ' SET value = ? WHERE name = ?';
                $this->db->run($sql, [$value, $name]);
            }
        });
        return ['key' => $key, 'keyHint' => '…' . substr($key, -4), 'rotatedAt' => $now];
    }

    public function testToken(array $input): array
    {
        $this->requireInstalled();
        $subject = $input['learnerId'] ?? null;
        if (!is_string($subject) || !preg_match(self::SUBJECT, $subject)) {
            Value::fail('learnerId', '학습자 ID는 영문, 숫자, . _ : @ - 로 1~64자예요.');
        }
        $minutes = Value::integer($input['minutes'] ?? null, 'minutes', 1, 1440);
        $payload = ['v' => 1, 'sub' => $subject, 'exp' => time() + $minutes * 60];
        if (($input['dur'] ?? null) !== null) {
            $payload['dur'] = Value::number($input['dur'], 'dur', 0, 86400);
            if ($payload['dur'] <= 0) {
                Value::fail('dur');
            }
        }
        $key = $this->db->meta('lms_key');
        if ($key === null) {
            throw new ApiError(400, 'lms_key_missing', 'LMS 연동 키를 먼저 만들어 주세요.');
        }
        return ['token' => self::learnerToken($payload, $key), 'expiresAt' => gmdate('Y-m-d\TH:i:s\Z', $payload['exp'])];
    }

    public function progressList(array $input): array
    {
        $this->requireInstalled();
        [$where, $params] = $this->filters($input);
        $page = $input['page'] ?? '1';
        if (!(is_int($page) && $page >= 1) && !(is_string($page) && preg_match('/^[1-9][0-9]{0,5}$/D', $page))) {
            Value::fail('page');
        }
        $page = (int) $page;
        $table = $this->db->table('lms_progress');
        $total = (int) $this->db->one("SELECT COUNT(*) AS total FROM $table WHERE $where", $params)['total'];
        $offset = ($page - 1) * self::PAGE_SIZE;
        $rows = $this->db->run("SELECT * FROM $table WHERE $where ORDER BY updated_at DESC, learner, video_id LIMIT " . self::PAGE_SIZE . " OFFSET $offset", $params)->fetchAll();
        return ['rows' => array_map(self::progressRow(...), $rows), 'total' => $total, 'page' => $page, 'pageSize' => self::PAGE_SIZE];
    }

    /** UTF-8 with BOM; text cells that a spreadsheet would read as a formula start with a quote, as in stats-csv. */
    public function csv(array $input): string
    {
        $this->requireInstalled();
        [$where, $params] = $this->filters($input);
        $stream = fopen('php://temp', 'w+');
        fwrite($stream, "\xEF\xBB\xBF");
        fputcsv($stream, self::PROGRESS_COLUMNS, ',', '"', '');
        foreach ($this->db->run('SELECT * FROM ' . $this->db->table('lms_progress') . " WHERE $where ORDER BY updated_at DESC, learner, video_id", $params) as $row) {
            $cells = [];
            foreach (self::progressRow($row) as $value) {
                $cells[] = is_string($value) && preg_match('/^[\s]*[=+\-@\t\r\n]/u', $value) ? "'" . $value : $value;
            }
            fputcsv($stream, $cells, ',', '"', '');
        }
        rewind($stream);
        $csv = stream_get_contents($stream);
        fclose($stream);
        return $csv;
    }

    /** GET filters arrive as strings; an empty value means no filter. A learner matches with or without its g:/x: prefix. */
    private function filters(array $input): array
    {
        $where = ['site_id = ?'];
        $params = [$this->config['siteId']];
        if (($input['videoId'] ?? '') !== '') {
            $where[] = 'video_id = ?';
            $params[] = Value::videoId($input['videoId']);
        }
        if (($input['learner'] ?? '') !== '') {
            $learner = Value::text($input['learner'], 'learner', 80);
            $where[] = '(learner = ? OR learner = ? OR learner = ?)';
            array_push($params, $learner, 'g:' . $learner, 'x:' . $learner);
        }
        $status = ($input['status'] ?? '') === '' ? 'all' : $input['status'];
        if (!in_array($status, ['all', 'done', 'doing'], true)) {
            Value::fail('status');
        }
        if ($status !== 'all') {
            $where[] = $status === 'done' ? 'completed_at IS NOT NULL' : 'completed_at IS NULL';
        }
        return [implode(' AND ', $where), $params];
    }

    private static function progressRow(array $row): array
    {
        return ['learner' => $row['learner'], 'videoId' => $row['video_id'], 'percent' => (int) $row['percent'], 'completedAt' => $row['completed_at'], 'activeSeconds' => (float) $row['active_seconds'], 'position' => (float) $row['position'], 'duration' => $row['duration'] === null ? null : (float) $row['duration'], 'updatedAt' => $row['updated_at']];
    }
}
