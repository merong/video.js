<?php
declare(strict_types=1);

namespace AdsManager;

final class Schedules
{
    public function __construct(private readonly Database $db, private readonly array $config, private readonly Host $host, private readonly Creatives $creatives) {}

    public function target(array $target): array
    {
        $target = Value::target($target, $this->config['siteId']);
        $this->host->validateTarget($target);
        return $target;
    }

    public function validate(array $input): array
    {
        $target = $this->target(is_array($input['target'] ?? null) ? $input['target'] : []);
        $mode = $input['mode'] ?? null;
        if (!in_array($mode, ['inherit', 'replace', 'disabled'], true) || ($target['type'] === 'site' && $mode === 'inherit')) {
            Value::fail('mode');
        }
        $revision = Value::integer($input['revision'] ?? null, 'revision');
        $breaks = $input['breaks'] ?? null;
        if (!is_array($breaks) || !array_is_list($breaks) || count($breaks) > 100) {
            Value::fail('breaks');
        }
        if ($mode !== 'replace' && $breaks !== []) {
            Value::fail('breaks', '상속 또는 광고 없음 모드에는 광고 구간을 저장할 수 없습니다.');
        }

        $seenBreaks = $seenItems = $positions = [];
        $canonical = [];
        foreach ($breaks as $break) {
            if (!is_array($break)) {
                Value::fail('breaks');
            }
            $id = Value::id($break['breakId'] ?? null, 'breakId');
            if (isset($seenBreaks[$id])) {
                Value::fail('breakId', '구간 ID가 중복되었습니다.');
            }
            $seenBreaks[$id] = true;
            $position = $break['position'] ?? null;
            if (!in_array($position, ['pre', 'mid', 'post'], true)) {
                Value::fail('position');
            }
            $out = ['breakId' => $id, 'position' => $position];
            $key = $position;
            if ($position === 'mid') {
                $at = Value::number($break['atSeconds'] ?? null, 'atSeconds');
                if ($at <= 0) {
                    Value::fail('atSeconds');
                }
                $out['atSeconds'] = $at;
                $key .= ':' . $at;
            } elseif (array_key_exists('atSeconds', $break)) {
                Value::fail('atSeconds');
            }
            if (isset($positions[$key])) {
                Value::fail('position', '같은 위치의 광고는 한 구간으로 구성해 주세요.');
            }
            $positions[$key] = true;
            if (!is_array($break['ads'] ?? null) || !array_is_list($break['ads']) || count($break['ads']) < 1 || count($break['ads']) > 20) {
                Value::fail('ads');
            }
            $out['ads'] = [];
            foreach ($break['ads'] as $ad) {
                if (!is_array($ad)) {
                    Value::fail('ads');
                }
                $itemId = Value::id($ad['itemId'] ?? null, 'itemId');
                if (isset($seenItems[$itemId])) {
                    Value::fail('itemId', '광고 항목 ID가 중복되었습니다.');
                }
                $seenItems[$itemId] = true;
                $creativeId = Value::id($ad['creativeId'] ?? null, 'creativeId');
                $version = Value::integer($ad['creativeVersion'] ?? null, 'creativeVersion', 1);
                $creative = $this->creatives->version($creativeId, $version);
                if ($creative['archived']) {
                    Value::fail('creativeId', '보관한 소재는 게시할 수 없습니다.');
                }
                if (!array_key_exists('skipAfterSeconds', $ad)) {
                    Value::fail('skipAfterSeconds');
                }
                $skip = $ad['skipAfterSeconds'] === null ? null : Value::integer($ad['skipAfterSeconds'], 'skipAfterSeconds', 1, 3600);
                $click = ($ad['clickUrl'] ?? null) === null ? null : Value::url($ad['clickUrl'], 'clickUrl');
                $item = ['itemId' => $itemId, 'adId' => $creativeId, 'creativeId' => $creativeId, 'creativeVersion' => $version, 'kind' => $creative['kind'], 'url' => $creative['url'], 'mime' => $creative['mime'], 'alt' => $creative['alt'], 'clickUrl' => $click, 'skipAfterSeconds' => $skip];
                if ($creative['kind'] === 'image') {
                    $duration = Value::number($ad['displaySeconds'] ?? null, 'displaySeconds', 0, 3600);
                    if ($duration <= 0 || ($skip !== null && $skip >= $duration)) {
                        Value::fail('displaySeconds');
                    }
                    $item['displaySeconds'] = $duration;
                } elseif (array_key_exists('displaySeconds', $ad)) {
                    Value::fail('displaySeconds', '영상은 실제 재생 종료로 완료를 판단합니다.');
                }
                $out['ads'][] = $item;
            }
            $canonical[] = $out;
        }
        usort($canonical, static function ($a, $b): int {
            $order = ['pre' => 0, 'mid' => 1, 'post' => 2];
            return ($order[$a['position']] <=> $order[$b['position']]) ?: (($a['atSeconds'] ?? 0) <=> ($b['atSeconds'] ?? 0));
        });
        return ['target' => $target, 'mode' => $mode, 'revision' => $revision, 'breaks' => $canonical];
    }

    public function draft(array $target): array
    {
        $target = $this->target($target);
        $row = $this->db->one('SELECT * FROM ' . $this->db->table('drafts') . ' WHERE target_key = ?', [Value::targetKey($target)]);
        $draft = ['target' => $target, 'mode' => $row['mode'] ?? ($target['type'] === 'site' ? 'disabled' : 'inherit'), 'revision' => (int) ($row['revision'] ?? 0), 'breaks' => $row ? Value::decode($row['breaks_json']) : []];
        $context = $this->contextForTarget($target);
        $resolved = $this->resolve($context, null, $target['type'] === 'video');
        return ['draft' => $draft, 'publishedVersion' => isset($row['live_version']) ? (int) $row['live_version'] : null, 'resolvedFrom' => $resolved['target']];
    }

    public function save(array $input): array
    {
        return $this->db->write(function () use ($input): array {
            $draft = $this->validate($input);
            $key = Value::targetKey($draft['target']);
            $existing = $this->db->one('SELECT revision FROM ' . $this->db->table('drafts') . ' WHERE target_key = ?', [$key]);
            if ($draft['revision'] !== (int) ($existing['revision'] ?? 0)) {
                throw new ApiError(409, 'revision_conflict', '다른 변경이 저장되었습니다. 다시 불러와 주세요.');
            }
            $revision = $draft['revision'] + 1;
            if ($existing) {
                $this->db->run('UPDATE ' . $this->db->table('drafts') . ' SET mode = ?, revision = ?, breaks_json = ?, updated_at = ? WHERE target_key = ?', [$draft['mode'], $revision, Value::json($draft['breaks']), Value::now(), $key]);
            } else {
                $this->db->run('INSERT INTO ' . $this->db->table('drafts') . ' (target_key, target_json, mode, revision, breaks_json, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [$key, Value::json($draft['target']), $draft['mode'], $revision, Value::json($draft['breaks']), Value::now()]);
            }
            return $this->draft($draft['target']);
        });
    }

    public function publish(array $input): array
    {
        $target = $this->target(is_array($input['target'] ?? null) ? $input['target'] : []);
        $revision = Value::integer($input['revision'] ?? null, 'revision', 1);
        return $this->db->write(function () use ($target, $revision): array {
            $key = Value::targetKey($target);
            $row = $this->db->one('SELECT * FROM ' . $this->db->table('drafts') . ' WHERE target_key = ?', [$key]);
            if (!$row || (int) $row['revision'] !== $revision) {
                throw new ApiError(409, 'revision_conflict', '저장된 초안 버전을 확인해 주세요.');
            }
            $draft = $this->validate(['target' => $target, 'mode' => $row['mode'], 'revision' => $revision, 'breaks' => Value::decode($row['breaks_json'])]);
            $version = (int) ($row['live_version'] ?? 0) + 1;
            $id = 'schedule-' . $key;
            $this->db->run('INSERT INTO ' . $this->db->table('publications') . ' (schedule_id, version, target_json, mode, breaks_json, created_at) VALUES (?, ?, ?, ?, ?, ?)', [$id, $version, Value::json($target), $draft['mode'], Value::json($draft['breaks']), Value::now()]);
            $this->db->run('UPDATE ' . $this->db->table('drafts') . ' SET live_version = ? WHERE target_key = ?', [$version, $key]);
            return ['scheduleId' => $id, 'scheduleVersion' => $version];
        });
    }

    private function contextForTarget(array $target): array
    {
        if ($target['type'] === 'video') {
            return $this->host->resolveVideoContext($target['id']);
        }
        return ['videoId' => 'preview', 'boardId' => $target['type'] === 'board' ? $target['id'] : ($target['boardId'] ?? null), 'categoryId' => $target['type'] === 'category' ? $target['id'] : null];
    }

    public function resolve(array $context, ?array $override = null, bool $includeVideo = true): array
    {
        $targets = $includeVideo ? [['type' => 'video', 'id' => $context['videoId']]] : [];
        if ($context['boardId'] !== null) {
            if ($context['categoryId'] !== null) {
                $targets[] = ['type' => 'category', 'id' => $context['categoryId'], 'boardId' => $context['boardId']];
            }
            $targets[] = ['type' => 'board', 'id' => $context['boardId']];
        }
        $targets[] = ['type' => 'site', 'id' => $this->config['siteId']];
        foreach ($targets as $target) {
            $key = Value::targetKey($target);
            if ($override && Value::targetKey($override['target']) === $key) {
                if ($override['mode'] === 'inherit') {
                    continue;
                }
                return ['target' => $target, 'schedule' => $this->dto($context, 'preview-' . $key, 1, $override['mode'] === 'disabled' ? [] : $override['breaks'])];
            }
            $row = $this->db->one('SELECT p.* FROM ' . $this->db->table('drafts') . ' d JOIN ' . $this->db->table('publications') . ' p ON p.schedule_id = ? AND p.version = d.live_version WHERE d.target_key = ?', ['schedule-' . $key, $key]);
            if (!$row || $row['mode'] === 'inherit') {
                continue;
            }
            return ['target' => $target, 'schedule' => $this->dto($context, $row['schedule_id'], (int) $row['version'], $row['mode'] === 'disabled' ? [] : Value::decode($row['breaks_json']))];
        }
        return ['target' => null, 'schedule' => $this->dto($context, 'none', 1, [])];
    }

    public function preview(array $input): array
    {
        $draft = $this->validate($input);
        // Preview is administrator-only; context is still host-derived for video targets.
        $hasVideo = isset($input['videoId']) && $input['videoId'] !== '';
        $context = $hasVideo ? $this->host->resolveVideoContext(Value::id($input['videoId'], 'videoId')) : $this->contextForTarget($draft['target']);
        return ['schedule' => $this->resolve($context, $draft, $hasVideo || $draft['target']['type'] === 'video')['schedule']];
    }

    public function dto(array $context, string $id, int $version, array $breaks): array
    {
        return ['schemaVersion' => 1, 'siteId' => $this->config['siteId'], 'videoId' => $context['videoId'], 'boardId' => $context['boardId'], 'categoryId' => $context['categoryId'], 'scheduleId' => $id, 'scheduleVersion' => $version, 'breaks' => $breaks];
    }

    public function frozen(array $claims): array
    {
        if ($claims['scheduleId'] === 'none' && $claims['scheduleVersion'] === 1) {
            return $this->dto($claims, 'none', 1, []);
        }
        $row = $this->db->one('SELECT * FROM ' . $this->db->table('publications') . ' WHERE schedule_id = ? AND version = ?', [$claims['scheduleId'], $claims['scheduleVersion']]);
        if (!$row) {
            throw new ApiError(403, 'invalid_session', '재생 세션이 유효하지 않습니다.');
        }
        return $this->dto($claims, $claims['scheduleId'], $claims['scheduleVersion'], $row['mode'] === 'disabled' ? [] : Value::decode($row['breaks_json']));
    }
}
