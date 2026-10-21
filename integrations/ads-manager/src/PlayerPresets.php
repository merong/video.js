<?php
declare(strict_types=1);

namespace AdsManager;

/** Named player configurations stored as one document in the meta table (schema v2, .agents/plans/ads-player-schema-v2.md). */
final class PlayerPresets
{
    public const LIMIT = 20;
    private const KEY = 'player_presets';
    private const SCHEMA = 2;
    private const THEME = ['accentColor', 'accentTextColor', 'borderColor', 'borderRadius', 'fontFamily', 'objectFit', 'scaleUnit'];
    // AdsLabels order (packages/extensions/ads/src/dom/ui.ts) without mediaAlt, which would override each creative's own alternative text.
    private const LABELS = [
        'advertisement' => [], 'sequence' => ['{index}', '{count}'], 'playPause' => [], 'mute' => [], 'volume' => [], 'advertiser' => [], 'newWindow' => [],
        'skip' => [], 'skipCountdown' => ['{seconds}'], 'timer' => ['{elapsed}', '{duration}', '{remaining}'],
        'loading' => [], 'paused' => [], 'blocked' => [], 'enterFullscreen' => [], 'exitFullscreen' => [], 'fullscreenError' => [],
    ];
    private const ATTRIBUTES = ['skip' => 'skip-label', 'skipCountdown' => 'skip-countdown-label', 'timer' => 'timer-label'];
    private const CONTROLS = ['captions', 'quality', 'audioTrack', 'playbackRate', 'pip', 'fullscreen', 'thumbnails'];
    private const LMS_TABS = ['chapters', 'materials', 'transcript', 'notes'];
    // `DEFAULT_RATES` values a lecture may cap playback at (ads-lms-spec 1.1).
    private const LMS_RATES = [1, 1.2, 1.5, 1.7, 2];
    // Fixed in code, listed first in this order, never modified or deleted (contract 2.4).
    private const BUILT_IN = [
        'default' => ['name' => '기본'],
        'flat' => ['name' => '플랫', 'theme' => ['borderRadius' => 0, 'borderColor' => '#00000000']],
        'rounded' => ['name' => '둥근 테두리', 'theme' => ['borderRadius' => 12]],
        'accent' => ['name' => '강조색', 'theme' => ['accentColor' => '#2563eb', 'accentTextColor' => '#ffffff'], 'ads' => ['accentColor' => '#2563eb']],
        'lms' => ['name' => '강의', 'lms' => ['enabled' => true], 'controls' => ['seekButtons' => 10, 'captions' => true]],
    ];
    // Server-owned list fields a client may echo back; they are never taken from input.
    private const READ_ONLY = ['builtIn', 'createdAt', 'updatedAt'];

    public function __construct(private readonly Database $db) {}

    public function list(): array
    {
        $document = $this->document();
        $builtIn = array_map(self::builtIn(...), array_keys(self::BUILT_IN));
        return [
            'revision' => $document['revision'],
            'defaultPresetId' => $document['defaultPresetId'],
            'presets' => [...$builtIn, ...array_map(static fn (array $preset): array => [...$preset, 'builtIn' => false], $document['presets'])],
            'migratedNeutral' => $document['migratedNeutral'],
            'migratedLabels' => $document['migratedLabels'],
        ];
    }

    public function save(array $input): array
    {
        $revision = Value::integer($input['revision'] ?? null, 'revision');
        $preset = self::normalize(is_array($input['preset'] ?? null) ? $input['preset'] : Value::fail('preset'));
        $id = $preset['id'];
        if ($id !== null) {
            self::requireStoredId($id);
        }

        $saved = $this->change($revision, function (array &$document) use ($preset, $id): array {
            $now = Value::now();
            if ($id === null) {
                if (count($document['presets']) >= self::LIMIT) {
                    throw new ApiError(400, 'preset_limit', '플레이어 프리셋은 ' . self::LIMIT . '개까지 저장할 수 있습니다.');
                }
                $ids = array_column($document['presets'], 'id');
                do {
                    $id = self::newId();
                } while (in_array($id, $ids, true));
                $document['presets'][] = $preset = [...$preset, 'id' => $id, 'createdAt' => $now, 'updatedAt' => $now];
                return $preset;
            }
            $index = self::find($document, $id);
            $document['presets'][$index] = $preset = [...$preset, 'createdAt' => $document['presets'][$index]['createdAt'], 'updatedAt' => $now];
            return $preset;
        });
        return [...$this->list(), 'preset' => [...$saved, 'builtIn' => false]];
    }

    public function delete(array $input): array
    {
        $revision = Value::integer($input['revision'] ?? null, 'revision');
        $id = self::requireStoredId($input['id'] ?? null);

        $this->change($revision, function (array &$document) use ($id): void {
            array_splice($document['presets'], self::find($document, $id), 1);
            if ($document['defaultPresetId'] === $id) {
                $document['defaultPresetId'] = 'default';
            }
        });
        return $this->list();
    }

    public function setDefault(array $input): array
    {
        $revision = Value::integer($input['revision'] ?? null, 'revision');
        $id = self::id($input['id'] ?? null);

        $this->change($revision, function (array &$document) use ($id): void {
            if (!isset(self::BUILT_IN[$id])) {
                self::find($document, $id);
            }
            $document['defaultPresetId'] = $id;
        });
        return $this->list();
    }

    /** Public, unauthenticated render. Never includes the administrator-facing name. */
    public function render(array $input): array
    {
        $document = $this->document();
        $id = array_key_exists('id', $input) ? self::id($input['id']) : $document['defaultPresetId'];
        $preset = isset(self::BUILT_IN[$id]) ? self::builtIn($id) : $document['presets'][self::find($document, $id)];
        return self::renderPreset($preset, $document['revision']);
    }

    /** The values a player applies: null fields resolved to the built-in defaults (contract 3). */
    public static function renderPreset(array $preset, int $revision): array
    {
        // Schema table order, shared with the TypeScript presetRender.
        $theme = $preset['theme'];
        $css = array_filter([
            '--media-accent-color' => $theme['accentColor'],
            '--media-accent-text-color' => $theme['accentTextColor'],
            '--media-border-color' => $theme['borderColor'],
            '--media-border-radius' => $theme['borderRadius'] === null ? null : $theme['borderRadius'] . 'px',
            '--media-font-family' => $theme['fontFamily'] === 'system' ? 'system-ui, sans-serif' : null,
            '--media-object-fit' => $theme['objectFit'],
            '--media-scale-unit' => $theme['scaleUnit'] === 'root' ? '1rem' : null,
        ], static fn (?string $value): bool => $value !== null);
        $ads = $preset['ads'];
        if ($ads['accentColor'] !== null) {
            $css['--ads-accent-color'] = $ads['accentColor'];
        }
        foreach (['skipRadius' => '--ads-skip-radius', 'fontSize' => '--ads-font-size'] as $field => $name) {
            if ($ads[$field] !== null) {
                $css[$name] = $ads[$field] . 'px';
            }
        }
        $labels = array_filter($ads['labels'], static fn (?string $label): bool => $label !== null);

        $playback = $preset['playback'];
        $display = $preset['display'];
        $progress = $ads['progress'];
        $rendered = [
            'id' => $preset['id'], 'revision' => $revision, 'playerType' => $preset['playerType'], 'language' => $preset['language'],
            'playback' => ['autoplay' => $playback['autoplay'] ?? false, 'muted' => $playback['muted'] ?? false, 'loop' => $playback['loop'] ?? false, 'preload' => $playback['preload'] ?? 'metadata'],
        ];
        $progress = ['sequence' => $progress['sequence'] ?? true, 'timer' => $progress['timer'] ?? true, 'bar' => $progress['bar'] ?? false];
        if ($preset['playerType'] === 'videojs') {
            $controls = $preset['controls'];
            // Ads speak Korean only (decision 29); the player language is separate.
            $attributes = ['lang' => 'ko'];
            foreach (self::ATTRIBUTES as $field => $attribute) {
                if (isset($labels[$field])) {
                    $attributes[$attribute] = $labels[$field];
                }
            }
            $lms = $preset['lms'];
            return [
                ...$rendered,
                'display' => ['poster' => $display['poster'] ?? true, 'title' => $display['title'] ?? true],
                'input' => ['hotkeys' => $preset['input']['hotkeys'] ?? true, 'gestures' => $preset['input']['gestures'] ?? true],
                'controls' => [...array_map(static fn (?bool $shown): bool => $shown ?? true, array_intersect_key($controls, array_flip(self::CONTROLS))), 'seekButtons' => $controls['seekButtons']],
                // Logo uploads arrive in A2-3; until then no preset can carry a logo.
                'logo' => null,
                'progress' => $progress,
                'labels' => (object) $labels,
                'skinTag' => 'video-skin',
                'styles' => ['css' => 'video.css', 'js' => 'video.js'],
                'css' => (object) $css,
                'attributes' => $attributes,
                // Only an enabled lms group renders, every value filled (ads-lms-spec 1.1).
                ...($lms['enabled'] !== true ? [] : ['lms' => [
                    'resume' => $lms['resume'] ?? 'ask',
                    'seekLimit' => $lms['seekLimit'] ?? 'free',
                    'maxRate' => $lms['maxRate'] ?? 2,
                    'completion' => $lms['completion'] ?? 90,
                    'tabs' => array_map(static fn (?bool $shown): bool => $shown ?? true, $lms['tabs']),
                    'bookmarks' => $lms['bookmarks'] ?? true,
                    'ads' => $lms['ads'] ?? 'off',
                ]]),
            ];
        }

        $timeouts = array_filter($ads['timeouts'], static fn (?int $seconds): bool => $seconds !== null);
        return [
            ...$rendered,
            'display' => ['poster' => $display['poster'] ?? true],
            'progress' => $progress,
            'labels' => (object) $labels,
            'skinTag' => null,
            'styles' => null,
            'css' => (object) $css,
            'ui' => ['locale' => 'ko', ...($labels === [] ? [] : ['labels' => $labels])],
            ...($timeouts === [] ? [] : ['timeouts' => $timeouts]),
        ];
    }

    /** Validates schema v2 input. Unknown keys and out-of-range values fail; empty values become null. */
    public static function normalize(array $input): array
    {
        self::known($input, ['id', 'name', 'playerType', 'language', 'theme', 'playback', 'display', 'input', 'controls', 'logo', 'ads', 'lms', ...self::READ_ONLY], '');
        $id = ($input['id'] ?? null) === null ? null : self::id($input['id']);
        $name = self::label($input['name'] ?? null, 'name', []);
        if ($name === null) {
            Value::fail('name', '이름을 입력해 주세요.');
        }
        $type = $input['playerType'] ?? null;
        if (!in_array($type, ['videojs', 'native'], true)) {
            Value::fail('playerType');
        }
        $language = self::choice($input['language'] ?? null, 'language', ['ko', 'en', 'ja', 'zh-CN']);

        $themeInput = self::group($input, 'theme', '', self::THEME);
        $theme = [
            'accentColor' => self::color($themeInput['accentColor'] ?? null, 'theme.accentColor'),
            'accentTextColor' => self::color($themeInput['accentTextColor'] ?? null, 'theme.accentTextColor'),
            'borderColor' => self::color($themeInput['borderColor'] ?? null, 'theme.borderColor', true),
            'borderRadius' => self::integer($themeInput['borderRadius'] ?? null, 'theme.borderRadius', 0, 32),
            'fontFamily' => self::choice($themeInput['fontFamily'] ?? null, 'theme.fontFamily', ['system']),
            'objectFit' => self::choice($themeInput['objectFit'] ?? null, 'theme.objectFit', ['contain', 'cover']),
            'scaleUnit' => self::choice($themeInput['scaleUnit'] ?? null, 'theme.scaleUnit', ['root']),
        ];

        $playbackInput = self::group($input, 'playback', '', ['autoplay', 'muted', 'loop', 'preload']);
        $playback = [
            'autoplay' => self::bool($playbackInput['autoplay'] ?? null, 'playback.autoplay'),
            'muted' => self::bool($playbackInput['muted'] ?? null, 'playback.muted'),
            'loop' => self::bool($playbackInput['loop'] ?? null, 'playback.loop'),
            'preload' => self::choice($playbackInput['preload'] ?? null, 'playback.preload', ['none', 'metadata', 'auto']),
        ];
        // Browsers only autoplay muted media; an explicit unmuted autoplay could never start.
        if ($playback['autoplay'] === true && $playback['muted'] === false) {
            Value::fail('playback.muted', '자동재생을 켜면 음소거로 시작해야 해요.');
        }
        $displayInput = self::group($input, 'display', '', ['poster', 'title']);
        $display = ['poster' => self::bool($displayInput['poster'] ?? null, 'display.poster'), 'title' => self::bool($displayInput['title'] ?? null, 'display.title')];
        $inputInput = self::group($input, 'input', '', ['hotkeys', 'gestures']);
        $playerInput = ['hotkeys' => self::bool($inputInput['hotkeys'] ?? null, 'input.hotkeys'), 'gestures' => self::bool($inputInput['gestures'] ?? null, 'input.gestures')];
        $controlsInput = self::group($input, 'controls', '', [...self::CONTROLS, 'seekButtons']);
        $controls = [];
        foreach (self::CONTROLS as $field) {
            $controls[$field] = self::bool($controlsInput[$field] ?? null, 'controls.' . $field);
        }
        // An integer field like the others: '' is not null here (the accepted v1 difference).
        $seek = $controlsInput['seekButtons'] ?? null;
        if ($seek !== null && !in_array($seek, [5, 10, 15, 30], true)) {
            Value::fail('controls.seekButtons');
        }
        $controls['seekButtons'] = $seek;

        $logoInput = self::group($input, 'logo', '', ['assetId', 'position', 'margin', 'width', 'opacity', 'href', 'alt', 'hideDuringAds', 'hideWithControls']);
        if (self::empty($logoInput['assetId'] ?? null) !== null) {
            Value::fail('logo.assetId', '로고 업로드는 아직 준비 중이에요.');
        }
        $logo = [
            'assetId' => null,
            'position' => self::choice($logoInput['position'] ?? null, 'logo.position', ['top-left', 'top-right', 'bottom-left', 'bottom-right']),
            'margin' => self::integer($logoInput['margin'] ?? null, 'logo.margin', 0, 48),
            'width' => self::integer($logoInput['width'] ?? null, 'logo.width', 24, 240),
            'opacity' => self::integer($logoInput['opacity'] ?? null, 'logo.opacity', 10, 100),
            'href' => self::href($logoInput['href'] ?? null),
            'alt' => self::label($logoInput['alt'] ?? null, 'logo.alt', [], 80),
            'hideDuringAds' => self::bool($logoInput['hideDuringAds'] ?? null, 'logo.hideDuringAds'),
            'hideWithControls' => self::bool($logoInput['hideWithControls'] ?? null, 'logo.hideWithControls'),
        ];
        if ($logo['href'] !== null && $logo['alt'] === null) {
            Value::fail('logo.alt', '링크가 있으면 대체 텍스트를 입력해 주세요.');
        }

        $adsInput = self::group($input, 'ads', '', ['labels', 'accentColor', 'skipRadius', 'fontSize', 'progress', 'timeouts']);
        $labelInput = self::group($adsInput, 'labels', 'ads.', array_keys(self::LABELS));
        $progressInput = self::group($adsInput, 'progress', 'ads.', ['sequence', 'timer', 'bar']);
        $timeoutInput = self::group($adsInput, 'timeouts', 'ads.', ['loadSeconds', 'stallSeconds']);
        $labels = [];
        foreach (self::LABELS as $field => $placeholders) {
            $labels[$field] = self::label($labelInput[$field] ?? null, 'ads.labels.' . $field, $placeholders);
        }
        $ads = [
            'labels' => $labels,
            'accentColor' => self::color($adsInput['accentColor'] ?? null, 'ads.accentColor'),
            'skipRadius' => self::integer($adsInput['skipRadius'] ?? null, 'ads.skipRadius', 0, 24),
            'fontSize' => self::integer($adsInput['fontSize'] ?? null, 'ads.fontSize', 11, 18),
            'progress' => [
                'sequence' => self::bool($progressInput['sequence'] ?? null, 'ads.progress.sequence'),
                'timer' => self::bool($progressInput['timer'] ?? null, 'ads.progress.timer'),
                'bar' => self::bool($progressInput['bar'] ?? null, 'ads.progress.bar'),
            ],
            'timeouts' => [
                'loadSeconds' => self::integer($timeoutInput['loadSeconds'] ?? null, 'ads.timeouts.loadSeconds', 1, 60),
                'stallSeconds' => self::integer($timeoutInput['stallSeconds'] ?? null, 'ads.timeouts.stallSeconds', 1, 120),
            ],
        ];

        $lmsInput = self::group($input, 'lms', '', ['enabled', 'resume', 'seekLimit', 'maxRate', 'completion', 'tabs', 'bookmarks', 'ads']);
        $tabInput = self::group($lmsInput, 'tabs', 'lms.', self::LMS_TABS);
        $lms = [
            'enabled' => self::bool($lmsInput['enabled'] ?? null, 'lms.enabled'),
            'resume' => self::choice($lmsInput['resume'] ?? null, 'lms.resume', ['ask', 'auto', 'off']),
            'seekLimit' => self::choice($lmsInput['seekLimit'] ?? null, 'lms.seekLimit', ['free', 'watched']),
            'maxRate' => self::rate($lmsInput['maxRate'] ?? null, 'lms.maxRate', self::LMS_RATES),
            'completion' => self::integer($lmsInput['completion'] ?? null, 'lms.completion', 50, 100),
            'tabs' => array_combine(self::LMS_TABS, array_map(static fn (string $tab): ?bool => self::bool($tabInput[$tab] ?? null, 'lms.tabs.' . $tab), self::LMS_TABS)),
            'bookmarks' => self::bool($lmsInput['bookmarks'] ?? null, 'lms.bookmarks'),
            'ads' => self::choice($lmsInput['ads'] ?? null, 'lms.ads', ['off', 'preroll']),
        ];

        // Values that the selected player cannot apply are rejected rather than kept silently.
        if ($type === 'native') {
            $unused = [
                ...self::paths('theme.', $theme, '기본 video에는 스킨 테마를 적용할 수 없습니다.'),
                ...self::paths('display.', ['title' => $display['title']], '기본 video에서는 쓸 수 없는 설정입니다.'),
                ...self::paths('input.', $playerInput, '기본 video에서는 쓸 수 없는 설정입니다.'),
                ...self::paths('controls.', $controls, '기본 video에서는 쓸 수 없는 설정입니다.'),
                ...self::paths('logo.', $logo, '기본 video에서는 쓸 수 없는 설정입니다.'),
                // tabs sits between completion and bookmarks, so the first failing path matches the JS readers.
                ...self::paths('lms.', array_slice($lms, 0, 5), '기본 video에서는 강의 기능을 쓸 수 없습니다.'),
                ...self::paths('lms.tabs.', $lms['tabs'], '기본 video에서는 강의 기능을 쓸 수 없습니다.'),
                ...self::paths('lms.', array_slice($lms, 6), '기본 video에서는 강의 기능을 쓸 수 없습니다.'),
            ];
        } else {
            $unused = self::paths('ads.timeouts.', $ads['timeouts'], 'Video.js 플레이어에서는 아직 시간 제한을 설정할 수 없습니다.');
        }
        foreach ($unused as [$field, $value, $message]) {
            if ($value !== null) {
                Value::fail($field, $message);
            }
        }

        return ['id' => $id, 'name' => $name, 'playerType' => $type, 'language' => $language, 'theme' => $theme, 'playback' => $playback, 'display' => $display, 'input' => $playerInput, 'controls' => $controls, 'logo' => $logo, 'ads' => $ads, 'lms' => $lms];
    }

    /**
     * Reads one stored v1 preset as v2 (contract 2.3): ads.locale becomes language, a neutral skin keeps
     * its 12px corners, skin and mediaAlt go, and every new field is null. Unknown v1 keys are dropped.
     * English v1 ad labels are dropped so ads speak the Korean defaults (ads-a2e-spec 6.3).
     */
    public static function migrate(array $preset): array
    {
        if (self::englishLabels($preset)) {
            $preset['ads']['labels'] = [];
        }
        $theme = is_array($preset['theme'] ?? null) ? $preset['theme'] : [];
        if (($preset['skin'] ?? null) === 'neutral' && ($theme['borderRadius'] ?? null) === null) {
            $theme['borderRadius'] = 12;
        }
        return self::fill(self::template(), [...$preset, 'language' => $preset['ads']['locale'] ?? null, 'theme' => $theme]);
    }

    private function document(): array
    {
        $stored = $this->db->meta(self::KEY);
        if ($stored === null) {
            return ['revision' => 0, 'defaultPresetId' => 'default', 'presets' => [], 'migratedNeutral' => [], 'migratedLabels' => []];
        }
        $document = Value::decode($stored);
        if (!is_int($document['revision'] ?? null) || !is_string($document['defaultPresetId'] ?? null) || !is_array($document['presets'] ?? null)) {
            throw new \RuntimeException('Invalid stored player presets.');
        }
        $migratedNeutral = $migratedLabels = [];
        if (!array_key_exists('schema', $document)) {
            // v1 is converted in memory only; reads never write, and the next write stores v2.
            foreach ($document['presets'] as $preset) {
                if (($preset['skin'] ?? null) === 'neutral') {
                    $migratedNeutral[] = $preset['id'];
                }
                if (self::englishLabels($preset)) {
                    $migratedLabels[] = $preset['id'];
                }
            }
            $document['presets'] = array_map(self::migrate(...), $document['presets']);
        } elseif ($document['schema'] !== self::SCHEMA) {
            throw new \RuntimeException('Unsupported player preset schema.');
        } else {
            // Presets stored before a group existed (lms) read it as empty.
            $template = self::template();
            $document['presets'] = array_map(static fn (array $preset): array => self::fill($template, $preset), $document['presets']);
        }
        return ['revision' => $document['revision'], 'defaultPresetId' => $document['defaultPresetId'], 'presets' => $document['presets'], 'migratedNeutral' => $migratedNeutral, 'migratedLabels' => $migratedLabels];
    }

    private function change(int $revision, callable $work): mixed
    {
        return $this->db->write(function () use ($revision, $work): mixed {
            $document = $this->document();
            if ($document['revision'] !== $revision) {
                throw new ApiError(409, 'revision_conflict', '다른 변경이 저장되었습니다. 다시 불러와 주세요.');
            }
            $result = $work($document);
            $stored = ['schema' => self::SCHEMA, 'revision' => $document['revision'] + 1, 'defaultPresetId' => $document['defaultPresetId'], 'presets' => $document['presets']];
            $exists = $this->db->meta(self::KEY) !== null;
            $sql = $exists ? 'UPDATE ' . $this->db->table('meta') . ' SET value = ? WHERE name = ?' : 'INSERT INTO ' . $this->db->table('meta') . ' (value, name) VALUES (?, ?)';
            $this->db->run($sql, [Value::json($stored), self::KEY]);
            return $result;
        });
    }

    private static function builtIn(string $id): array
    {
        $values = self::normalize([...self::BUILT_IN[$id], 'playerType' => 'videojs']);
        return [...$values, 'id' => $id, 'createdAt' => null, 'updatedAt' => null, 'builtIn' => true];
    }

    private static function find(array $document, string $id): int
    {
        foreach ($document['presets'] as $index => $preset) {
            if ($preset['id'] === $id) {
                return $index;
            }
        }
        throw new ApiError(404, 'preset_not_found', '플레이어 프리셋을 찾을 수 없습니다.');
    }

    private static function id(mixed $value): string
    {
        if (!is_string($value) || (!isset(self::BUILT_IN[$value]) && !preg_match('/^p-[a-z0-9]{10}$/D', $value))) {
            throw new ApiError(400, 'invalid_preset_id', '플레이어 프리셋 ID를 확인해 주세요.', ['id' => '플레이어 프리셋 ID를 확인해 주세요.']);
        }
        return $value;
    }

    private static function requireStoredId(mixed $value): string
    {
        if (isset(self::BUILT_IN[self::id($value)])) {
            throw new ApiError(400, 'preset_builtin', '내장 프리셋은 고치거나 지울 수 없습니다. 복제해서 사용해 주세요.');
        }
        return $value;
    }

    private static function newId(): string
    {
        $alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
        $id = 'p-';
        for ($i = 0; $i < 10; $i++) {
            $id .= $alphabet[random_int(0, 35)];
        }
        return $id;
    }

    /** A v1 preset made for English ads that carries at least one label v2 would otherwise keep. */
    private static function englishLabels(array $preset): bool
    {
        if (($preset['ads']['locale'] ?? null) !== 'en' || !is_array($preset['ads']['labels'] ?? null)) {
            return false;
        }
        foreach (array_intersect_key($preset['ads']['labels'], self::LABELS) as $label) {
            if ($label !== null && $label !== '') {
                return true;
            }
        }
        return false;
    }

    /** Every stored preset key in contract order, all empty. */
    private static function template(): array
    {
        return [...self::normalize(['name' => '-', 'playerType' => 'videojs']), 'createdAt' => null, 'updatedAt' => null];
    }

    /** Copies $values into the template's keys and order; missing keys keep the template value. */
    private static function fill(array $template, array $values): array
    {
        foreach ($template as $key => $default) {
            $value = array_key_exists($key, $values) ? $values[$key] : $default;
            $template[$key] = is_array($default) ? self::fill($default, is_array($value) ? $value : []) : $value;
        }
        return $template;
    }

    private static function paths(string $prefix, array $values, string $message): array
    {
        return array_map(static fn (string $field): array => [$prefix . $field, $values[$field], $message], array_keys($values));
    }

    private static function known(array $input, array $keys, string $path): void
    {
        foreach (array_keys($input) as $key) {
            if (!in_array($key, $keys, true)) {
                Value::fail($path . $key, '알 수 없는 항목입니다.');
            }
        }
    }

    private static function group(array $input, string $key, string $path, array $keys): array
    {
        $value = $input[$key] ?? [];
        if (!is_array($value) || ($value !== [] && array_is_list($value))) {
            Value::fail($path . $key);
        }
        self::known($value, $keys, $path . $key . '.');
        return $value;
    }

    private static function empty(mixed $value): mixed
    {
        return $value === '' ? null : $value;
    }

    private static function choice(mixed $value, string $field, array $allowed): ?string
    {
        $value = self::empty($value);
        if ($value !== null && !in_array($value, $allowed, true)) {
            Value::fail($field);
        }
        return $value;
    }

    /** Only JSON true/false; 0, 1 and "true" are rejected. */
    private static function bool(mixed $value, string $field): ?bool
    {
        $value = self::empty($value);
        if ($value !== null && !is_bool($value)) {
            Value::fail($field);
        }
        return $value;
    }

    // Only the border may be translucent: #00000000 draws no border (A2-E 1.3).
    private static function color(mixed $value, string $field, bool $alpha = false): ?string
    {
        $value = self::empty($value);
        if ($value !== null && (!is_string($value) || !preg_match($alpha ? '/^#[0-9a-f]{6}([0-9a-f]{2})?$/D' : '/^#[0-9a-f]{6}$/D', $value))) {
            Value::fail($field, $alpha ? '#rrggbb 또는 #rrggbbaa 형식의 소문자 색을 입력해 주세요.' : '#rrggbb 형식의 소문자 색을 입력해 주세요.');
        }
        return $value;
    }

    /** A JSON number from $allowed, returned as the listed value so 2.0 reads as 2; '' and booleans are rejected. */
    private static function rate(mixed $value, string $field, array $allowed): int|float|null
    {
        if ($value === null) {
            return null;
        }
        if (is_int($value) || is_float($value)) {
            foreach ($allowed as $item) {
                if ($item == $value) {
                    return $item;
                }
            }
        }
        Value::fail($field);
    }

    private static function integer(mixed $value, string $field, int $min, int $max): ?int
    {
        return $value === null ? null : Value::integer($value, $field, $min, $max);
    }

    /** An absolute http(s) URL of at most 2048 characters without whitespace or control characters. */
    private static function href(mixed $value): ?string
    {
        $value = self::empty($value);
        if ($value === null) {
            return null;
        }
        if (!is_string($value) || !preg_match('//u', $value) || mb_strlen($value) > 2048 || !preg_match('~^https?://[^/?#]~D', $value) || preg_match('/\s|\p{Cc}|' . Value::SPACE . '/u', $value)) {
            Value::fail('logo.href', 'http:// 또는 https://로 시작하는 주소를 입력해 주세요.');
        }
        return $value;
    }

    /** Trimmed like JS (see Value::SPACE), up to $max characters, no control or bidirectional control characters; braces only as the listed placeholders. */
    private static function label(mixed $value, string $field, array $placeholders, int $max = 40): ?string
    {
        if ($value === null) {
            return null;
        }
        if (!is_string($value) || !preg_match('//u', $value) || preg_match('/\p{Cc}|' . Value::BIDI_CONTROL . '/u', $value)) {
            Value::fail($field);
        }
        $value = preg_replace('/^' . Value::SPACE . '+|' . Value::SPACE . '+$/Du', '', $value);
        if (mb_strlen($value) > $max) {
            Value::fail($field, $max . '자 이내로 입력해 주세요.');
        }
        if (str_contains($field, 'labels.') && preg_match('/[{}]/', str_replace($placeholders, '', $value))) {
            Value::fail($field, $placeholders === [] ? '{ } 문자는 쓸 수 없습니다.' : '사용할 수 있는 자리표시자는 ' . implode(' ', $placeholders) . '입니다.');
        }
        return $value === '' ? null : $value;
    }
}
