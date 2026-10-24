<?php
declare(strict_types=1);

namespace AdsManager;

/**
 * ffmpeg extras for uploaded board videos: a cover image, progress-bar thumbnails and a short highlight clip.
 * The gnuboard extend and skin require this file on its own (scratchpad MEDIA.md), so it uses PHP built-ins only.
 */
final class VideoMedia
{
    public const FEATURES = ['cover', 'thumbnails', 'highlight'];
    public const OPTION_SUBJECT = '솔애드 추가 기능';
    public const UNSUPPORTED = '외부 주소 영상이라 만들 수 없어요.';
    private const CACHE_SECONDS = 300;
    private const TIMEOUTS = ['probe' => 20, 'version' => 10, 'cover' => 60, 'thumbnails' => 180, 'highlight' => 180];
    private const SEARCH = ['/usr/bin', '/usr/local/bin', '/opt/homebrew/bin'];
    private const FILES = ['cover' => ['cover.jpg'], 'thumbnails' => ['thumbnails.vtt', 'thumbnails.jpg'], 'highlight' => ['highlight.mp4']];
    private const SPRITE_COLUMNS = 10;
    private const SPRITE_WIDTH = 160;
    private const SPRITE_MAX = 100;
    private const HIGHLIGHT_SECONDS = 4;
    // The cover keyframe scan's share of the cover time limit; the frame extraction gets the rest.
    private const COVER_SCAN_SECONDS = 40;
    // Covers prefer this part of the video: the first and last moments are often black or a title card.
    private const COVER_RANGE = [0.05, 0.95];
    // stdout keeps the scan's per-keyframe statistics (about 1 KB each); stderr only needs its last lines.
    private const OUTPUT_LIMITS = [8388608, 65536];

    private static ?self $gnuboard = null;
    private ?array $detected = null;

    /**
     * @param ?bool $processes Whether proc_open may run; null reads the PHP configuration.
     * @param ?\Closure $runner Replaces process execution in tests: fn (array $command, int $timeout): array{code:int,out:string,err:string}.
     */
    public function __construct(
        private readonly string $dataPath,
        private readonly string $dataUrl,
        private readonly ?string $ffmpegPath = null,
        private readonly ?string $ffprobePath = null,
        private readonly ?string $cacheFile = null,
        private readonly ?bool $processes = null,
        private readonly ?\Closure $runner = null,
    ) {}

    public static function gnuboard(): self
    {
        $data = rtrim(G5_DATA_PATH, '/');

        return self::$gnuboard ??= new self(
            $data,
            rtrim((string) parse_url(G5_DATA_URL, PHP_URL_PATH), '/'),
            defined('SOLAD_FFMPEG_PATH') && SOLAD_FFMPEG_PATH !== '' ? (string) SOLAD_FFMPEG_PATH : null,
            defined('SOLAD_FFPROBE_PATH') && SOLAD_FFPROBE_PATH !== '' ? (string) SOLAD_FFPROBE_PATH : null,
            $data . '/cache/solad-ffmpeg.json',
        );
    }

    /** Finds ffmpeg and ffprobe by running `-version`: file checks fail under open_basedir. */
    public function detect(bool $fresh = false): array
    {
        if (!$fresh && $this->detected !== null) {
            return $this->detected;
        }

        $key = md5($this->ffmpegPath . '|' . $this->ffprobePath . '|' . getenv('PATH'));
        if (!$fresh && $this->cacheFile !== null && is_file($this->cacheFile)) {
            $cached = json_decode((string) @file_get_contents($this->cacheFile), true);
            if (is_array($cached) && ($cached['key'] ?? null) === $key && time() - (int) ($cached['result']['checkedAt'] ?? 0) < self::CACHE_SECONDS) {
                return $this->detected = $cached['result'];
            }
        }

        $result = ['available' => false, 'ffmpeg' => null, 'ffprobe' => null, 'reason' => null, 'message' => null, 'checkedAt' => time()];
        if (!$this->processesAllowed()) {
            $result = [...$result, 'reason' => 'proc_open', 'message' => 'PHP 설정에서 proc_open이 꺼져 있어 ffmpeg를 실행할 수 없어요.'];
        } else {
            $result['ffmpeg'] = $this->find('ffmpeg', $this->ffmpegPath, []);
            $sibling = $result['ffmpeg'] && str_contains($result['ffmpeg']['path'], '/') ? [dirname($result['ffmpeg']['path']) . '/ffprobe'] : [];
            $result['ffprobe'] = $result['ffmpeg'] ? $this->find('ffprobe', $this->ffprobePath, $sibling) : null;
            if (!$result['ffmpeg']) {
                $result = [...$result, 'reason' => 'not_found', 'message' => 'ffmpeg를 찾지 못했어요.'];
            } elseif (!$result['ffprobe']) {
                $result = [...$result, 'reason' => 'ffprobe_not_found', 'message' => 'ffprobe를 찾지 못했어요.'];
            } else {
                $result['available'] = true;
            }
        }

        if ($this->cacheFile !== null && is_dir(dirname($this->cacheFile))) {
            @file_put_contents($this->cacheFile, json_encode(['key' => $key, 'result' => $result], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), LOCK_EX);
        }
        return $this->detected = $result;
    }

    /** Features switched on in the board's extra field titled OPTION_SUBJECT, in FEATURES order. */
    public function boardFeatures(array $board): array
    {
        $value = '';
        for ($i = 1; $i <= 10; $i++) {
            if (trim((string) ($board['bo_' . $i . '_subj'] ?? '')) === self::OPTION_SUBJECT) {
                $value = (string) ($board['bo_' . $i] ?? '');
                break;
            }
        }
        $names = array_map('trim', explode(',', $value));

        return array_values(array_filter(self::FEATURES, fn ($feature) => in_array($feature, $names, true)));
    }

    /** Root-relative URLs of the generated files, or null where a feature has none. */
    public function files(string $boTable, int $postId): array
    {
        $directory = $this->directory($boTable, $postId);
        $url = $this->dataUrl . '/file/' . $boTable . '/solad/' . $postId . '/';
        $files = [];
        foreach (self::FILES as $feature => $names) {
            $complete = array_reduce($names, fn ($ok, $name) => $ok && is_file($directory . '/' . $name), true);
            $files[$feature] = $complete ? $url . $names[0] . '?v=' . filemtime($directory . '/' . $names[0]) : null;
        }
        return $files;
    }

    /** Removes one feature's files, or the whole post folder when $feature is null. */
    public function remove(string $boTable, int $postId, ?string $feature = null): void
    {
        $directory = $this->directory($boTable, $postId);
        if (!is_dir($directory)) {
            return;
        }
        if ($feature !== null) {
            foreach (self::FILES[$this->feature($feature)] as $name) {
                @unlink($directory . '/' . $name);
            }
            $this->recordError($boTable, $postId, $feature, null);
            return;
        }
        foreach (scandir($directory) ?: [] as $name) {
            if ($name !== '.' && $name !== '..' && is_file($directory . '/' . $name)) {
                @unlink($directory . '/' . $name);
            }
        }
        @rmdir($directory);
    }

    /** The last generation error per feature. */
    public function errors(string $boTable, int $postId): array
    {
        $errors = json_decode((string) @file_get_contents($this->directory($boTable, $postId) . '/status.json'), true);
        return is_array($errors) ? array_filter($errors, 'is_string') : [];
    }

    /**
     * A local input video under data/file/<bo_table>/, or null when the candidate resolves anywhere else.
     * Values come from the database, so a stored path must never reach ffmpeg unchecked.
     */
    public function inputPath(string $boTable, string $candidate): ?string
    {
        $root = realpath($this->dataPath . '/file/' . $this->board($boTable));
        $path = realpath($candidate);
        if ($root === false || $path === false || !is_file($path) || !str_starts_with($path, $root . DIRECTORY_SEPARATOR)) {
            return null;
        }
        return $path;
    }

    /** Where gnuboard keeps a board attachment (g5_board_file.bf_file). */
    public function attachmentPath(string $boTable, string $file): string
    {
        return $this->dataPath . '/file/' . $this->board($boTable) . '/' . $file;
    }

    /** The root-relative URL of a board attachment. */
    public function attachmentUrl(string $boTable, string $file): string
    {
        return $this->dataUrl . '/file/' . $this->board($boTable) . '/' . rawurlencode($file);
    }

    /** The local file behind a root-relative data URL such as an unpacked HLS playlist. */
    public function pathFromUrl(string $url): ?string
    {
        $path = parse_url($url, PHP_URL_PATH);
        if (!is_string($path) || !str_starts_with($path, $this->dataUrl . '/')) {
            return null;
        }
        return $this->dataPath . rawurldecode(substr($path, strlen($this->dataUrl)));
    }

    /**
     * Generates one feature from a local input video and returns null, or the error message it also records.
     * The caller passes a path that inputPath() accepted.
     */
    public function generate(string $boTable, int $postId, string $input, string $feature, ?float $knownDuration = null): ?string
    {
        $feature = $this->feature($feature);
        $detect = $this->detect();
        if (!$detect['available']) {
            return $detect['message'];
        }
        if ($this->inputPath($boTable, $input) === null) {
            return $this->recordError($boTable, $postId, $feature, '영상 파일을 찾지 못했어요.');
        }

        $directory = $this->directory($boTable, $postId);
        if (!is_dir($directory) && !@mkdir($directory, 0755, true) && !is_dir($directory)) {
            return $this->recordError($boTable, $postId, $feature, '결과 폴더를 만들지 못했어요.');
        }
        $whitelist = preg_match('/\.m3u8$/i', $input) ? 'file,crypto' : 'file';
        $duration = $this->duration($input, $whitelist) ?? ($knownDuration > 0 ? $knownDuration : null);
        if ($duration === null) {
            return $this->recordError($boTable, $postId, $feature, '영상 길이를 알 수 없어요.');
        }

        $error = match ($feature) {
            'cover' => $this->cover($input, $whitelist, $duration, $directory),
            'thumbnails' => $this->thumbnails($input, $whitelist, $duration, $directory),
            'highlight' => $this->highlight($input, $whitelist, $duration, $directory),
        };
        return $this->recordError($boTable, $postId, $feature, $error === null ? null : $this->sanitize($error, [$input, $directory]));
    }

    private function cover(string $input, string $whitelist, float $duration, string $directory): ?string
    {
        $started = microtime(true);
        $at = sprintf('%.3f', $this->coverTime($input, $whitelist, $duration) ?? $duration * 0.1);
        $timeout = max(5, self::TIMEOUTS['cover'] - (int) ceil(microtime(true) - $started));
        return $this->encode($directory, 'cover.jpg', 'cover', fn ($out) => ['-ss', $at, '-i', $input, '-frames:v', '1', '-vf', "scale='min(1280,iw)':-2", '-q:v', '3', $out], $whitelist, $timeout);
    }

    /**
     * The time of the keyframe that looks best as a cover, or null when the scan fails (the cover then uses 10%).
     * Only keyframes are decoded, and signalstats gives each one's mean luma (YAVG) and its 10th–90th percentile spread
     * (YLOW–YHIGH): the spread scores the frame, scaled down near black or white, so dark, blank and flat scenes lose.
     * Every option here exists in ffmpeg 4.2.
     */
    private function coverTime(string $input, string $whitelist, float $duration): ?float
    {
        $run = $this->run([$this->detect()['ffmpeg']['path'], '-nostdin', '-hide_banner', '-loglevel', 'error', '-protocol_whitelist', $whitelist, '-skip_frame', 'nokey', '-i', $input, '-an', '-sn', '-dn', '-vf', 'scale=160:-2,format=yuv420p,signalstats,metadata=mode=print:file=-', '-f', 'null', '-'], self::COVER_SCAN_SECONDS);
        if ($run['code'] !== 0) {
            return null;
        }

        $frames = [];
        foreach (preg_split('/\R/', $run['out']) ?: [] as $line) {
            if (preg_match('/pts_time:(-?[0-9.]+)/', $line, $match)) {
                $frames[] = ['time' => (float) $match[1]];
            } elseif ($frames && preg_match('/^lavfi\.signalstats\.(YAVG|YLOW|YHIGH)=([0-9.]+)/', $line, $match)) {
                $frames[count($frames) - 1][$match[1]] = (float) $match[2];
            }
        }
        $best = null;
        foreach ($frames as $frame) {
            if (!isset($frame['YAVG'], $frame['YLOW'], $frame['YHIGH'])) {
                continue;
            }
            $inside = $frame['time'] >= $duration * self::COVER_RANGE[0] && $frame['time'] <= $duration * self::COVER_RANGE[1];
            $score = ($frame['YHIGH'] - $frame['YLOW']) * min(1, $frame['YAVG'] / 80) * min(1, (255 - $frame['YAVG']) / 80);
            // Inside the range first, then the score; the earliest of equal frames stays.
            if ($best === null || [$inside, $score] > $best['rank']) {
                $best = ['rank' => [$inside, $score], 'time' => max(0, $frame['time'])];
            }
        }
        return $best['time'] ?? null;
    }

    private function thumbnails(string $input, string $whitelist, float $duration, string $directory): ?string
    {
        $interval = max(2, (int) ceil($duration / self::SPRITE_MAX));
        $count = max(1, min(self::SPRITE_MAX, (int) ceil($duration / $interval)));
        $columns = min(self::SPRITE_COLUMNS, $count);
        $rows = (int) ceil($count / $columns);
        $filter = sprintf('fps=1/%d,scale=%d:-2,tile=%dx%d', $interval, self::SPRITE_WIDTH, $columns, $rows);
        $error = $this->encode($directory, 'thumbnails.jpg', 'thumbnails', fn ($out) => ['-i', $input, '-an', '-vf', $filter, '-frames:v', '1', '-q:v', '4', $out], $whitelist);
        if ($error !== null) {
            return $error;
        }

        $size = @getimagesize($directory . '/thumbnails.jpg');
        if (!$size || $size[1] < $rows) {
            return '썸네일 이미지를 읽지 못했어요.';
        }
        $height = intdiv($size[1], $rows);
        $version = filemtime($directory . '/thumbnails.jpg');
        $lines = ['WEBVTT', ''];
        for ($i = 0; $i < $count; $i++) {
            $lines[] = self::timestamp($i * $interval) . ' --> ' . self::timestamp(min(($i + 1) * $interval, $duration));
            $lines[] = sprintf('thumbnails.jpg?v=%d#xywh=%d,%d,%d,%d', $version, ($i % $columns) * self::SPRITE_WIDTH, intdiv($i, $columns) * $height, self::SPRITE_WIDTH, $height);
            $lines[] = '';
        }
        $temporary = $directory . '/thumbnails.' . bin2hex(random_bytes(4)) . '.tmp.vtt';
        if (@file_put_contents($temporary, implode("\n", $lines)) === false || !@rename($temporary, $directory . '/thumbnails.vtt')) {
            @unlink($temporary);
            return '썸네일 자막 파일을 쓰지 못했어요.';
        }
        return null;
    }

    private function highlight(string $input, string $whitelist, float $duration, string $directory): ?string
    {
        $length = min(self::HIGHLIGHT_SECONDS, $duration);
        $start = sprintf('%.3f', max(0, $duration / 2 - $length / 2));
        return $this->encode($directory, 'highlight.mp4', 'highlight', fn ($out) => ['-ss', $start, '-i', $input, '-t', sprintf('%.3f', $length), '-an', '-vf', "scale='trunc(min(640,iw)/2)*2':-2", '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', $out], $whitelist);
    }

    /** Runs ffmpeg into a temporary file beside the target, then moves it into place. */
    private function encode(string $directory, string $name, string $feature, \Closure $arguments, string $whitelist, ?int $timeout = null): ?string
    {
        $temporary = $directory . '/' . pathinfo($name, PATHINFO_FILENAME) . '.' . bin2hex(random_bytes(4)) . '.tmp.' . pathinfo($name, PATHINFO_EXTENSION);
        $command = [$this->detect()['ffmpeg']['path'], '-nostdin', '-hide_banner', '-loglevel', 'error', '-y', '-protocol_whitelist', $whitelist, ...$arguments($temporary)];
        $run = $this->run($command, $timeout ?? self::TIMEOUTS[$feature]);

        if ($run['code'] !== 0 || !is_file($temporary) || filesize($temporary) === 0) {
            @unlink($temporary);
            return $run['code'] === -2 ? '시간 안에 끝나지 않았어요.' : ($run['err'] !== '' ? $run['err'] : 'ffmpeg가 결과를 만들지 못했어요.');
        }
        if (!@rename($temporary, $directory . '/' . $name)) {
            @unlink($temporary);
            return '결과 파일을 옮기지 못했어요.';
        }
        return null;
    }

    private function duration(string $input, string $whitelist): ?float
    {
        $run = $this->run([$this->detect()['ffprobe']['path'], '-v', 'error', '-protocol_whitelist', $whitelist, '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', $input], self::TIMEOUTS['probe']);
        $seconds = (float) trim($run['out']);
        return $run['code'] === 0 && $seconds > 0 ? $seconds : null;
    }

    private function find(string $name, ?string $configured, array $first): ?array
    {
        $directories = array_merge(array_filter(explode(PATH_SEPARATOR, (string) getenv('PATH'))), self::SEARCH);
        $candidates = array_values(array_unique([...($configured !== null ? [$configured] : []), ...$first, ...array_map(fn ($dir) => rtrim($dir, '/') . '/' . $name, $directories)]));
        foreach ($candidates as $path) {
            $run = $this->run([$path, '-version'], self::TIMEOUTS['version']);
            if ($run['code'] === 0 && preg_match('/^' . $name . ' version (\S+)/', $run['out'], $match)) {
                return ['path' => $path, 'version' => $match[1]];
            }
        }
        return null;
    }

    private function processesAllowed(): bool
    {
        if ($this->processes !== null) {
            return $this->processes;
        }
        $disabled = array_map('trim', explode(',', (string) ini_get('disable_functions')));
        return function_exists('proc_open') && function_exists('proc_get_status') && !in_array('proc_open', $disabled, true);
    }

    /** Runs a command without a shell. Code -1 means it could not start, -2 that it timed out. */
    private function run(array $command, int $timeout): array
    {
        if ($this->runner !== null) {
            return ($this->runner)($command, $timeout);
        }
        if (!$this->processesAllowed()) {
            return ['code' => -1, 'out' => '', 'err' => ''];
        }

        $process = @proc_open($command, [0 => ['file', '/dev/null', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
        if (!is_resource($process)) {
            return ['code' => -1, 'out' => '', 'err' => ''];
        }
        stream_set_blocking($pipes[1], false);
        stream_set_blocking($pipes[2], false);
        $output = ['', ''];
        $deadline = microtime(true) + $timeout;
        $code = null;

        while (true) {
            $read = [$pipes[1], $pipes[2]];
            $write = $except = null;
            if (@stream_select($read, $write, $except, 0, 200000) > 0) {
                foreach ($read as $pipe) {
                    $output[$pipe === $pipes[1] ? 0 : 1] .= (string) fread($pipe, 65536);
                }
            }
            // Keep only the tail of chatty output.
            $output = array_map(fn ($text, $limit) => strlen($text) > $limit ? substr($text, -$limit) : $text, $output, self::OUTPUT_LIMITS);
            $status = proc_get_status($process);
            if (!$status['running']) {
                $code = $status['exitcode'];
                break;
            }
            if (microtime(true) > $deadline) {
                proc_terminate($process, 9);
                $code = -2;
                break;
            }
        }
        $output[0] .= (string) stream_get_contents($pipes[1]);
        $output[1] .= (string) stream_get_contents($pipes[2]);
        fclose($pipes[1]);
        fclose($pipes[2]);
        $closed = proc_close($process);

        return ['code' => $code === -1 ? $closed : $code, 'out' => $output[0], 'err' => $output[1]];
    }

    /** The last few stderr lines with server paths replaced, short enough to show an operator. */
    private function sanitize(string $error, array $paths): string
    {
        $paths = [...$paths, $this->dataPath];
        usort($paths, fn ($a, $b) => strlen($b) - strlen($a));
        $text = str_replace($paths, '…', $error);
        $text = (string) preg_replace('#(/[^\s/:\'"]+){2,}#', '…', $text);
        $lines = array_slice(array_values(array_filter(array_map('trim', preg_split('/\R/', $text) ?: []), 'strlen')), -3);

        return mb_substr(implode(' / ', $lines), 0, 300);
    }

    private function recordError(string $boTable, int $postId, string $feature, ?string $message): ?string
    {
        $directory = $this->directory($boTable, $postId);
        $errors = $this->errors($boTable, $postId);
        if ($message === null) {
            unset($errors[$feature]);
        } else {
            $errors[$feature] = $message;
        }
        if ($errors) {
            if (is_dir($directory)) {
                @file_put_contents($directory . '/status.json', json_encode($errors, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX);
            }
        } else {
            @unlink($directory . '/status.json');
        }
        return $message;
    }

    private function directory(string $boTable, int $postId): string
    {
        if ($postId < 1) {
            throw new \InvalidArgumentException('postId');
        }
        return $this->dataPath . '/file/' . $this->board($boTable) . '/solad/' . $postId;
    }

    private function board(string $boTable): string
    {
        if (!preg_match('/^[a-zA-Z0-9_]{1,20}$/D', $boTable)) {
            throw new \InvalidArgumentException('boTable');
        }
        return $boTable;
    }

    private function feature(string $feature): string
    {
        if (!in_array($feature, self::FEATURES, true)) {
            throw new \InvalidArgumentException('feature');
        }
        return $feature;
    }

    private static function timestamp(float $seconds): string
    {
        $milliseconds = (int) round($seconds * 1000);
        return sprintf('%02d:%02d:%02d.%03d', intdiv($milliseconds, 3600000), intdiv($milliseconds, 60000) % 60, intdiv($milliseconds, 1000) % 60, $milliseconds % 1000);
    }
}
