<?php
declare(strict_types=1);

namespace AdsManager;

final class App
{
    public readonly Creatives $creatives;
    public readonly Schedules $schedules;
    public readonly Events $events;
    public readonly Statistics $statistics;
    public readonly PlayerPresets $playerPresets;
    public readonly Lms $lms;

    public function __construct(public readonly Database $db, public readonly array $config, public readonly Host $host)
    {
        if ($db->meta('schema_version') !== '1' || $db->meta('site_id') !== $config['siteId']) {
            throw new ApiError(500, 'installation_required', '관리자 설치 설정을 확인해 주세요.');
        }
        $this->creatives = new Creatives($db, $config);
        $this->schedules = new Schedules($db, $config, $host, $this->creatives);
        $this->events = new Events($db, $config, $this->schedules);
        $this->statistics = new Statistics($db, $config);
        $this->playerPresets = new PlayerPresets($db);
        $this->lms = new Lms($db, $config, $host, $this->playerPresets);
    }

    public function dispatch(string $method, string $action, array $input, mixed $csrf = null, array $files = []): array|string
    {
        $reads = ['bootstrap', 'creatives', 'targets', 'schedule-draft', 'stats', 'stats-csv', 'schedule', 'player-presets', 'player-preset', 'lms-settings', 'lms-progress-list', 'lms-progress-csv'];
        $writes = ['login', 'logout', 'creative-save', 'creative-upload', 'creative-archive', 'video-context-save', 'schedule-save', 'schedule-publish', 'schedule-preview', 'events', 'player-preset-save', 'player-preset-delete', 'player-preset-default', 'lms-session', 'lms-progress', 'lms-notes', 'lms-key-rotate', 'lms-test-token'];
        if (!in_array($action, [...$reads, ...$writes], true)) {
            throw new ApiError(404, 'action_not_found', '요청을 찾을 수 없습니다.');
        }
        if (($method === 'GET' && !in_array($action, $reads, true)) || ($method === 'POST' && !in_array($action, $writes, true)) || !in_array($method, ['GET', 'POST'], true)) {
            throw new ApiError(400, 'method', '요청 방식을 확인해 주세요.');
        }

        if ($action === 'bootstrap') {
            $base = ['authenticated' => $this->host->authenticated(), 'csrfToken' => $this->host->csrfToken(), 'apiUrl' => $this->config['apiUrl'], 'capabilities' => [...$this->host->capabilities(), 'playerPresets' => true, 'lms' => ['installed' => $this->lms->installed()]]];
            if (!$base['authenticated']) {
                return $base;
            }
            $this->host->requireAdmin();
            return [...$base, 'user' => ['displayName' => $this->host->displayName()], 'site' => ['siteId' => $this->config['siteId'], 'timeZone' => $this->config['timeZone']], 'playerModuleUrl' => $this->config['playerModuleUrl'], 'limits' => ['uploadBytes' => Creatives::uploadLimit($this->config)]];
        }
        if ($action === 'schedule') {
            $videoId = Value::videoId($input['videoId'] ?? null);
            $breaks = $input['breaks'] ?? null;
            if ($breaks !== null && $breaks !== 'preroll') {
                Value::fail('breaks');
            }
            $context = $this->host->resolveVideoContext($videoId);
            $schedule = $this->schedules->resolve($context)['schedule'];
            return $this->events->issue($breaks === 'preroll' ? Schedules::preroll($schedule) : $schedule, $breaks);
        }
        if ($action === 'events') {
            return $this->events->collect($input);
        }
        if ($action === 'player-preset') {
            return Http::revalidate($this->playerPresets->render($input));
        }
        if ($action === 'lms-session') {
            return $this->lms->session($input);
        }
        if ($action === 'lms-progress') {
            return $this->lms->progress($input);
        }
        if ($action === 'lms-notes') {
            return $this->lms->notes($input);
        }
        if ($action !== 'login') {
            $this->host->requireAdmin($method === 'POST');
        }
        if ($method === 'POST') {
            $this->host->verifyCsrf($csrf);
        }

        return match ($action) {
            'login' => $this->host->login($input),
            'logout' => $this->host->logout(),
            'creatives' => $this->creatives->list(),
            'creative-save' => $this->creatives->save($input),
            'creative-upload' => $this->creatives->upload($input, $files['file'] ?? []),
            'creative-archive' => $this->creatives->archive($input),
            'video-context-save' => $this->host->saveVideoContext($input),
            'targets' => $this->targets($input),
            'schedule-draft' => $this->schedules->draft(['type' => $input['targetType'] ?? null, 'id' => $input['targetId'] ?? null, 'boardId' => $input['boardId'] ?? null]),
            'schedule-save' => $this->schedules->save($input),
            'schedule-publish' => $this->schedules->publish($input),
            'schedule-preview' => $this->schedules->preview($input),
            'stats' => $this->statistics->get($input),
            'stats-csv' => $this->statistics->csv($input),
            'player-presets' => $this->playerPresets->list(),
            'player-preset-save' => $this->playerPresets->save($input),
            'player-preset-delete' => $this->playerPresets->delete($input),
            'player-preset-default' => $this->playerPresets->setDefault($input),
            'lms-settings' => $this->lms->settings(),
            'lms-key-rotate' => $this->lms->rotateKey(),
            'lms-test-token' => $this->lms->testToken($input),
            'lms-progress-list' => $this->lms->progressList($input),
            'lms-progress-csv' => $this->lms->csv($input),
        };
    }

    private function targets(array $input): array
    {
        $type = $input['type'] ?? 'site';
        if (!in_array($type, ['site', 'board', 'category', 'video'], true)) {
            Value::fail('type');
        }
        $query = Value::text($input['query'] ?? '', 'query', 128, true);
        return ['items' => $this->host->targets($type, $query, Value::nullableId($input['boardId'] ?? null, 'boardId'))];
    }
}
