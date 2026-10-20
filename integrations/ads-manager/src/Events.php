<?php
declare(strict_types=1);

namespace AdsManager;

final class Events
{
    private const TERMINALS = ['complete', 'skip', 'error', 'cancel'];

    public function __construct(private readonly Database $db, private readonly array $config, private readonly Schedules $schedules) {}

    private function sign(string $payload): string
    {
        return hash_hmac('sha256', $payload, $this->db->meta('signing_key'));
    }

    public function issue(array $schedule): array
    {
        $id = 'session-' . Value::uuid();
        $expiry = time() + $this->config['sessionSeconds'];
        $claims = ['siteId' => $schedule['siteId'], 'videoId' => $schedule['videoId'], 'boardId' => $schedule['boardId'], 'categoryId' => $schedule['categoryId'], 'scheduleId' => $schedule['scheduleId'], 'scheduleVersion' => $schedule['scheduleVersion'], 'playbackSessionId' => $id, 'expires' => $expiry];
        $payload = rtrim(strtr(base64_encode(Value::json($claims)), '+/', '-_'), '=');
        return ['schedule' => $schedule, 'playbackSessionId' => $id, 'eventToken' => $payload . '.' . $this->sign($payload), 'expiresAt' => gmdate('Y-m-d\TH:i:s\Z', $expiry), 'eventsUrl' => $this->config['apiUrl'] . '?action=events'];
    }

    private function claims(array $input): array
    {
        $token = $input['eventToken'] ?? null;
        if (!is_string($token) || strlen($token) > 8192 || substr_count($token, '.') !== 1) {
            throw new ApiError(403, 'invalid_session', '재생 세션이 유효하지 않습니다.');
        }
        [$payload, $signature] = explode('.', $token);
        if (!hash_equals($this->sign($payload), $signature)) {
            throw new ApiError(403, 'invalid_session', '재생 세션이 유효하지 않습니다.');
        }
        $decoded = base64_decode(strtr($payload, '-_', '+/'), true);
        $claims = $decoded === false ? [] : Value::decode($decoded);
        if (($claims['expires'] ?? 0) <= time() || ($claims['siteId'] ?? null) !== $this->config['siteId'] || ($claims['playbackSessionId'] ?? null) !== ($input['playbackSessionId'] ?? null)) {
            throw new ApiError(403, 'invalid_session', '재생 세션이 만료되었거나 유효하지 않습니다.');
        }
        return $claims;
    }

    public function collect(array $input): array
    {
        $claims = $this->claims($input);
        $events = $input['events'] ?? null;
        if (!is_array($events) || !array_is_list($events) || count($events) < 1 || count($events) > 50) {
            Value::fail('events', '이벤트는 한 번에 1~50개 전송해 주세요.');
        }
        $snapshot = $this->schedules->frozen($claims);
        return $this->db->write(function () use ($claims, $events, $snapshot): array {
            $sessionId = $claims['playbackSessionId'];
            $this->db->limit('events:' . $sessionId, 120);
            $this->db->limit('events-global', 2000);
            $stored = $this->db->one('SELECT snapshot_json FROM ' . $this->db->table('sessions') . ' WHERE session_id = ?', [$sessionId]);
            if (!$stored) {
                $this->db->run('INSERT INTO ' . $this->db->table('sessions') . ' (session_id, snapshot_json, expires_at) VALUES (?, ?, ?)', [$sessionId, Value::json($snapshot), $claims['expires']]);
            } elseif ($stored['snapshot_json'] !== Value::json($snapshot)) {
                throw new ApiError(409, 'session_conflict', '재생 세션의 편성이 다릅니다.');
            }

            $result = ['accepted' => 0, 'duplicates' => 0, 'rejected' => 0];
            foreach ($events as $event) {
                try {
                    if (!is_array($event)) {
                        Value::fail('event');
                    }
                    $result[$this->accept($event, $sessionId, $snapshot)]++;
                } catch (ApiError $error) {
                    $result['rejected']++;
                    $diagnostic = ['payloadSha256' => hash('sha256', Value::json($event))];
                    if (is_array($event)) {
                        foreach (['eventId', 'adAttemptId', 'breakAttemptId', 'breakId', 'itemId'] as $key) {
                            if (is_string($event[$key] ?? null) && preg_match('/^[a-zA-Z0-9:_-]{1,128}$/D', $event[$key])) {
                                $diagnostic[$key] = $event[$key];
                            }
                        }
                        if (in_array($event['type'] ?? null, ['start', 'complete', 'skip', 'click', 'error', 'cancel'], true)) {
                            $diagnostic['type'] = $event['type'];
                        }
                    }
                    $this->db->run('INSERT INTO ' . $this->db->table('rejections') . ' (rejection_id, session_id, reason, received_at, payload) VALUES (?, ?, ?, ?, ?)', [Value::uuid(), $sessionId, $error->errorCode, Value::now(), Value::json($diagnostic)]);
                }
            }
            return $result;
        });
    }

    private function conflict(string $code): never
    {
        throw new ApiError(409, $code, '이벤트 식별자 또는 순서가 일치하지 않습니다.');
    }

    private function accept(array $event, string $sessionId, array $snapshot): string
    {
        $required = ['eventId', 'playbackSessionId', 'breakAttemptId', 'adAttemptId', 'breakId', 'itemId', 'adId', 'creativeId', 'scheduleId'];
        foreach ($required as $key) {
            Value::id($event[$key] ?? null, $key);
        }
        $allowed = [...$required, 'schemaVersion', 'creativeVersion', 'scheduleVersion', 'sequence', 'occurredAt', 'contentTimeSeconds', 'adElapsedSeconds', 'type', 'code', 'stage'];
        if (array_diff(array_keys($event), $allowed) !== []) {
            Value::fail('event');
        }
        if (($event['schemaVersion'] ?? null) !== 1 || $event['playbackSessionId'] !== $sessionId || $event['scheduleId'] !== $snapshot['scheduleId'] || ($event['scheduleVersion'] ?? null) !== $snapshot['scheduleVersion']) {
            $this->conflict('event_correlation');
        }
        Value::integer($event['creativeVersion'] ?? null, 'creativeVersion', 1);
        Value::integer($event['sequence'] ?? null, 'sequence', 1, 1000000);
        Value::number($event['contentTimeSeconds'] ?? null, 'contentTimeSeconds');
        Value::number($event['adElapsedSeconds'] ?? null, 'adElapsedSeconds');
        $type = $event['type'] ?? null;
        if (!in_array($type, ['start', 'complete', 'skip', 'click', 'error', 'cancel'], true)) {
            Value::fail('type');
        }
        foreach (['code', 'stage'] as $key) {
            if (array_key_exists($key, $event)) {
                Value::text($event[$key], $key, 64);
            }
        }
        $timestamp = $event['occurredAt'] ?? null;
        if (!is_string($timestamp) || !preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/D', $timestamp)) {
            Value::fail('occurredAt');
        }
        try {
            new \DateTimeImmutable($timestamp);
            $errors = \DateTimeImmutable::getLastErrors();
            if ($errors && ($errors['warning_count'] || $errors['error_count'])) {
                Value::fail('occurredAt');
            }
        } catch (\Exception $error) {
            Value::fail('occurredAt');
        }

        $ad = null;
        foreach ($snapshot['breaks'] as $break) {
            if ($break['breakId'] === $event['breakId']) {
                foreach ($break['ads'] as $item) {
                    if ($item['itemId'] === $event['itemId']) {
                        $ad = $item;
                    }
                }
            }
        }
        if (!$ad || $ad['adId'] !== $event['adId'] || $ad['creativeId'] !== $event['creativeId'] || $ad['creativeVersion'] !== $event['creativeVersion']) {
            $this->conflict('snapshot_membership');
        }
        if ($type === 'skip' && ($ad['skipAfterSeconds'] === null || $event['adElapsedSeconds'] < $ad['skipAfterSeconds'])) {
            $this->conflict('early_skip');
        }
        if ($type === 'complete' && $ad['kind'] === 'image' && $event['adElapsedSeconds'] < $ad['displaySeconds']) {
            $this->conflict('early_complete');
        }
        if ($type === 'click' && $ad['clickUrl'] === null) {
            $this->conflict('click_unavailable');
        }

        $payload = Value::canonical($event);
        $prior = $this->db->one('SELECT payload FROM ' . $this->db->table('events') . ' WHERE site_id = ? AND event_id = ?', [$this->config['siteId'], $event['eventId']]);
        if ($prior) {
            if ($prior['payload'] !== $payload) {
                $this->conflict('event_id_conflict');
            }
            return 'duplicates';
        }

        $attempt = $this->db->one('SELECT * FROM ' . $this->db->table('attempts') . ' WHERE attempt_id = ?', [$event['adAttemptId']]);
        if ($attempt && ($attempt['session_id'] !== $sessionId || $attempt['break_attempt_id'] !== $event['breakAttemptId'] || $attempt['break_id'] !== $event['breakId'] || $attempt['item_id'] !== $event['itemId'])) {
            $this->conflict('attempt_correlation');
        }
        if (!$attempt && $this->db->one('SELECT attempt_id FROM ' . $this->db->table('attempts') . ' WHERE session_id = ? AND item_id = ?', [$sessionId, $event['itemId']])) {
            $this->conflict('repeated_item');
        }
        $breakAttempt = $this->db->one('SELECT * FROM ' . $this->db->table('break_attempts') . ' WHERE break_attempt_id = ?', [$event['breakAttemptId']]);
        if ($breakAttempt && ($breakAttempt['session_id'] !== $sessionId || $breakAttempt['break_id'] !== $event['breakId'])) {
            $this->conflict('break_correlation');
        }
        if (!$breakAttempt && $this->db->one('SELECT break_attempt_id FROM ' . $this->db->table('break_attempts') . ' WHERE session_id = ? AND break_id = ?', [$sessionId, $event['breakId']])) {
            $this->conflict('repeated_break');
        }

        $existing = $this->db->run('SELECT payload FROM ' . $this->db->table('events') . ' WHERE attempt_id = ? ORDER BY sequence', [$event['adAttemptId']])->fetchAll();
        // Bound optional click facts, reserving independent slots for start and terminal.
        // Pending clicks must never prevent an out-of-order start from reconciling them.
        $clicks = 0;
        $isTerminal = in_array($type, self::TERMINALS, true);
        foreach ($existing as $row) {
            $other = Value::decode($row['payload']);
            $clicks += (int) ($other['type'] === 'click');
            $otherTerminal = in_array($other['type'], self::TERMINALS, true);
            if ($other['sequence'] === $event['sequence']) {
                $this->conflict('sequence_conflict');
            }
            if ($isTerminal && $otherTerminal) {
                $this->conflict('terminal_conflict');
            }
            if ($type === 'start' && $other['type'] === 'start') {
                $this->conflict('duplicate_start');
            }
            if (($type === 'start' && $event['sequence'] > $other['sequence']) || ($other['type'] === 'start' && $other['sequence'] > $event['sequence']) || ($isTerminal && $event['sequence'] < $other['sequence']) || ($otherTerminal && $other['sequence'] < $event['sequence'])) {
                $this->conflict('event_order');
            }
            if (($event['sequence'] > $other['sequence'] && $event['adElapsedSeconds'] < $other['adElapsedSeconds']) || ($event['sequence'] < $other['sequence'] && $event['adElapsedSeconds'] > $other['adElapsedSeconds'])) {
                $this->conflict('elapsed_order');
            }
        }
        if ($type === 'click' && $clicks >= 127) {
            $this->conflict('attempt_click_limit');
        }

        if (!$breakAttempt) {
            $this->db->run('INSERT INTO ' . $this->db->table('break_attempts') . ' (break_attempt_id, session_id, break_id) VALUES (?, ?, ?)', [$event['breakAttemptId'], $sessionId, $event['breakId']]);
        }
        if (!$attempt) {
            $this->db->run('INSERT INTO ' . $this->db->table('attempts') . ' (attempt_id, session_id, break_attempt_id, break_id, item_id, ad_id, video_id, board_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [$event['adAttemptId'], $sessionId, $event['breakAttemptId'], $event['breakId'], $event['itemId'], $event['adId'], $snapshot['videoId'], $snapshot['boardId']]);
        }
        $this->db->run('INSERT INTO ' . $this->db->table('events') . ' (site_id, event_id, attempt_id, sequence, type, received_at, payload) VALUES (?, ?, ?, ?, ?, ?, ?)', [$this->config['siteId'], $event['eventId'], $event['adAttemptId'], $event['sequence'], $type, Value::now(), $payload]);
        return 'accepted';
    }
}
