<?php
declare(strict_types=1);

namespace AdsManager;

final class Statistics
{
    public function __construct(private readonly Database $db, private readonly array $config) {}

    public function get(array $filters): array
    {
        $zone = new \DateTimeZone($this->config['timeZone']);
        $dates = [];
        foreach (['from', 'to'] as $key) {
            $value = $filters[$key] ?? null;
            if (!is_string($value) || !preg_match('/^\d{4}-\d{2}-\d{2}$/D', $value)) {
                Value::fail($key);
            }
            $date = \DateTimeImmutable::createFromFormat('!Y-m-d', $value, $zone);
            if (!$date || $date->format('Y-m-d') !== $value) {
                Value::fail($key);
            }
            $dates[$key] = $date;
        }
        if ($dates['from'] > $dates['to']) {
            Value::fail('to');
        }
        $utc = new \DateTimeZone('UTC');
        $from = $dates['from']->setTimezone($utc)->format('Y-m-d\TH:i:s\Z');
        $to = $dates['to']->modify('+1 day')->setTimezone($utc)->format('Y-m-d\TH:i:s\Z');
        $where = [];
        $params = [];
        foreach (['adId' => 'ad_id', 'videoId' => 'video_id', 'boardId' => 'board_id'] as $key => $column) {
            if (isset($filters[$key]) && $filters[$key] !== '') {
                $where[] = 'a.' . $column . ' = ?';
                $params[] = Value::id($filters[$key], $key);
            }
        }

        $sql = 'SELECT a.attempt_id, a.ad_id, a.video_id, a.board_id,
            MAX(CASE WHEN e.type = \'start\' THEN e.received_at END) AS start_at,
            MAX(CASE WHEN e.type = \'error\' THEN e.received_at END) AS error_at,
            MAX(CASE WHEN e.type = \'complete\' THEN 1 ELSE 0 END) AS completes,
            MAX(CASE WHEN e.type = \'skip\' THEN 1 ELSE 0 END) AS skips,
            SUM(CASE WHEN e.type = \'click\' THEN 1 ELSE 0 END) AS clicks,
            MAX(CASE WHEN e.type = \'error\' THEN 1 ELSE 0 END) AS errors
            FROM ' . $this->db->table('attempts') . ' a JOIN ' . $this->db->table('events') . ' e ON e.attempt_id = a.attempt_id';
        if ($where) {
            $sql .= ' WHERE ' . implode(' AND ', $where);
        }
        $sql .= ' GROUP BY a.attempt_id, a.ad_id, a.video_id, a.board_id';
        $sql = 'SELECT * FROM (' . $sql . ') cohorts WHERE (start_at >= ? AND start_at < ?) OR (start_at IS NULL AND error_at >= ? AND error_at < ?)';
        array_push($params, $from, $to, $from, $to);
        $totals = self::empty();
        $rows = [];
        foreach ($this->db->run($sql, $params) as $attempt) {
            $key = Value::json([$attempt['ad_id'], $attempt['video_id'], $attempt['board_id']]);
            $rows[$key] ??= ['adId' => $attempt['ad_id'], 'videoId' => $attempt['video_id'], 'boardId' => $attempt['board_id'], ...self::empty()];
            $started = $attempt['start_at'] !== null;
            $counts = ['starts' => (int) $started, 'completes' => $started ? (int) $attempt['completes'] : 0, 'skips' => $started ? (int) $attempt['skips'] : 0, 'clicks' => $started ? (int) $attempt['clicks'] : 0, 'clickedStarts' => (int) ($started && $attempt['clicks'] > 0), 'errors' => (int) $attempt['errors']];
            foreach ($counts as $metric => $value) {
                $rows[$key][$metric] += $value;
                $totals[$metric] += $value;
            }
        }
        ksort($rows);
        return ['totals' => self::rates($totals), 'rows' => array_map(self::rates(...), array_values($rows)), 'timeZone' => $this->config['timeZone'], 'asOf' => Value::now()];
    }

    private static function empty(): array
    {
        return ['starts' => 0, 'completes' => 0, 'skips' => 0, 'clicks' => 0, 'clickedStarts' => 0, 'errors' => 0, 'completionRate' => null, 'clickRate' => null];
    }

    private static function rates(array $row): array
    {
        $row['completionRate'] = $row['starts'] === 0 ? null : $row['completes'] / $row['starts'];
        $row['clickRate'] = $row['starts'] === 0 ? null : $row['clickedStarts'] / $row['starts'];
        return $row;
    }

    public function csv(array $filters): string
    {
        $data = $this->get($filters);
        $stream = fopen('php://temp', 'w+');
        fwrite($stream, "\xEF\xBB\xBF");
        $columns = ['adId', 'videoId', 'boardId', ...array_keys(self::empty())];
        fputcsv($stream, $columns, ',', '"', '');
        foreach ($data['rows'] as $row) {
            $cells = [];
            foreach ($columns as $column) {
                $value = $row[$column];
                if (is_string($value) && preg_match('/^[\s]*[=+\-@\t\r\n]/u', $value)) {
                    $value = "'" . $value;
                }
                $cells[] = $value;
            }
            fputcsv($stream, $cells, ',', '"', '');
        }
        rewind($stream);
        $csv = stream_get_contents($stream);
        fclose($stream);
        return $csv;
    }
}
