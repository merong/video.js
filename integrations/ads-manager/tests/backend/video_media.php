<?php
declare(strict_types=1);

// VideoMedia and UploadedVideos without a gnuboard install: the few gnuboard functions they call are stubbed below.
// Real ffmpeg runs only when it is installed; those checks are skipped otherwise.

require dirname(__DIR__, 2) . '/src/load.php';

use AdsManager\ApiError;
use AdsManager\UploadedVideos;
use AdsManager\VideoMedia;

$checks = 0;
function same(mixed $actual, mixed $expected, string $message): void
{
    global $checks;
    $checks++;
    if ($actual !== $expected) {
        throw new RuntimeException($message . ': expected ' . json_encode($expected, JSON_UNESCAPED_UNICODE) . ', received ' . json_encode($actual, JSON_UNESCAPED_UNICODE));
    }
}

$root = realpath(sys_get_temp_dir()) . '/ads-video-media-' . bin2hex(random_bytes(6));
$data = $root . '/data';
mkdir($data . '/file/video', 0700, true);
mkdir($data . '/file/other', 0700, true);
mkdir($data . '/cache', 0700, true);
$sample = dirname(__DIR__, 2) . '/public/demo-media/ad.mp4';
copy($sample, $data . '/file/video/clip.mp4');
copy($sample, $data . '/file/other/clip.mp4');
copy($sample, $root . '/outside.mp4');
symlink($root . '/outside.mp4', $data . '/file/video/link.mp4');

// Detection
$blocked = new VideoMedia($data, '/data', processes: false);
same($blocked->detect()['reason'], 'proc_open', 'blocked proc_open is the reason');
same($blocked->detect()['available'], false, 'blocked proc_open is unavailable');

$missing = new VideoMedia($data, '/data', '/nowhere/ffmpeg', runner: fn () => ['code' => -1, 'out' => '', 'err' => '']);
same($missing->detect()['reason'], 'not_found', 'no ffmpeg anywhere');

$tried = [];
$noProbe = new VideoMedia($data, '/data', '/opt/x/ffmpeg', runner: function (array $command) use (&$tried) {
    $tried[] = $command[0];
    return $command[0] === '/opt/x/ffmpeg' ? ['code' => 0, 'out' => "ffmpeg version 9.9 Copyright\n", 'err' => ''] : ['code' => -1, 'out' => '', 'err' => ''];
});
$result = $noProbe->detect();
same([$result['ffmpeg'], $result['reason']], [['path' => '/opt/x/ffmpeg', 'version' => '9.9'], 'ffprobe_not_found'], 'configured ffmpeg first, ffprobe missing');
same($tried[0], '/opt/x/ffmpeg', 'the configured path runs first');
same($tried[1], '/opt/x/ffprobe', 'ffprobe beside ffmpeg runs next');

$cache = $data . '/cache/solad-ffmpeg.json';
$calls = 0;
$runner = function (array $command) use (&$calls) {
    $calls++;
    return ['code' => 0, 'out' => basename($command[0]) . " version 1.0\n", 'err' => ''];
};
$counting = fn () => new VideoMedia($data, '/data', '/opt/x/ffmpeg', '/opt/x/ffprobe', $cache, runner: $runner);
same($counting()->detect()['available'], true, 'both found');
$counting()->detect();
same($calls, 2, 'a second request reads the file cache');
$counting()->detect(true);
same($calls, 4, 'fresh detection skips the cache');

// Board option, input paths, URLs
$board = ['bo_table' => 'video', 'bo_3_subj' => '솔애드 추가 기능', 'bo_3' => ' highlight, cover ,nope'];
same($blocked->boardFeatures($board), ['cover', 'highlight'], 'enabled features in order, unknown names dropped');
same($blocked->boardFeatures(['bo_1_subj' => '다른 칸', 'bo_1' => 'cover']), [], 'another extra field is ignored');
same($blocked->inputPath('video', $data . '/file/video/clip.mp4'), realpath($data . '/file/video/clip.mp4'), 'a file under the board folder');
same($blocked->inputPath('video', $data . '/file/video/../other/clip.mp4'), null, 'another board folder is rejected');
same($blocked->inputPath('video', $data . '/file/video/link.mp4'), null, 'a link out of the data folder is rejected');
same($blocked->inputPath('video', $root . '/outside.mp4'), null, 'a path outside data/file is rejected');
same($blocked->pathFromUrl('/data/file/video/hls/3/t/%ED%95%9C.m3u8'), $data . '/file/video/hls/3/t/한.m3u8', 'data URL to path');
same($blocked->pathFromUrl('https://cdn.example/x.m3u8'), null, 'a remote URL has no path');

// gnuboard stubs for UploadedVideos
const G5_URL = 'http://site.test';
const G5_ADMIN_URL = 'http://site.test/adm';
const G5_BBS_URL = 'http://site.test/bbs';
$g5 = ['write_prefix' => 'g5_write_', 'board_table' => 'g5_board', 'board_file_table' => 'g5_board_file'];
$posts = [
    1 => ['wr_id' => '1', 'wr_subject' => '외부 영상', 'wr_option' => '', 'wr_datetime' => '2026-10-20 10:00:00', 'wr_1' => 'https://cdn.example/a.mp4', 'wr_2' => '30', 'wr_3' => 'url'],
    2 => ['wr_id' => '2', 'wr_subject' => '비밀 HLS', 'wr_option' => 'html1,secret', 'wr_datetime' => '2026-10-21 10:00:00', 'wr_1' => 'https://cdn.example/a.m3u8', 'wr_2' => '', 'wr_3' => ''],
    3 => ['wr_id' => '3', 'wr_subject' => '첨부 영상', 'wr_option' => '', 'wr_datetime' => '2026-10-22 10:00:00', 'wr_1' => '', 'wr_2' => '3', 'wr_3' => 'file'],
    4 => ['wr_id' => '4', 'wr_subject' => '비밀 HLS 묶음', 'wr_option' => 'secret', 'wr_datetime' => '2026-10-19 10:00:00', 'wr_1' => '/data/file/video/hls/4/t/index.m3u8', 'wr_2' => '8', 'wr_3' => 'hls_zip'],
    5 => ['wr_id' => '5', 'wr_subject' => '파일 없는 글', 'wr_option' => '', 'wr_datetime' => '2026-10-18 10:00:00', 'wr_1' => ' ', 'wr_2' => '', 'wr_3' => 'old'],
];
mkdir($data . '/file/video/hls/4/t', 0700, true);
copy($sample, $data . '/file/video/hls/4/t/index.m3u8');
// Write-table queries run in SQLite so the WHERE that sorts internal from external is really evaluated.
$sqlite = new PDO('sqlite::memory:', options: [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
$sqlite->exec("CREATE TABLE g5_write_video (wr_id INTEGER, wr_is_comment INTEGER DEFAULT 0, wr_subject TEXT, wr_option TEXT, wr_datetime TEXT, wr_1 TEXT, wr_2 TEXT, wr_3 TEXT)");
foreach ($posts as $post) {
    $sqlite->prepare('INSERT INTO g5_write_video (wr_id, wr_subject, wr_option, wr_datetime, wr_1, wr_2, wr_3) VALUES (?, ?, ?, ?, ?, ?, ?)')->execute(array_values($post));
}
$queue = [];
function sql_real_escape_string(string $value): string { return addslashes($value); }
function sql_query(string $sql): string
{
    global $queue, $posts;
    if (str_contains($sql, 'g5_board_file')) {
        $queue = str_contains($sql, 'wr_id = 3') ? [['bf_file' => 'clip.mp4', 'bf_source' => '내 영상.mp4']] : [];
    } elseif (str_contains($sql, 'FROM g5_board ')) {
        $queue = [['bo_table' => 'video']];
    } else {
        $queue = $GLOBALS['sqlite']->query($sql)->fetchAll();
    }
    return 'result';
}
function sql_fetch_array(string $result): array|false { global $queue; return array_shift($queue) ?? false; }
function sql_fetch(string $sql): array { return $GLOBALS['sqlite']->query($sql)->fetch() ?: []; }
function get_board_db(string $table, bool $cache = false): array { global $board; return $board + ['bo_subject' => '동영상']; }
// Like gnuboard without short URLs: an HTML-escaped query string.
function get_pretty_url(string $table, int $id): string { return G5_BBS_URL . '/board.php?bo_table=' . $table . '&amp;wr_id=' . $id; }

$videos = new UploadedVideos(new VideoMedia($data, '/data', processes: false));
$external = $videos->item(['boardId' => 'video', 'postId' => '1'])['item'];
same($external['features']['cover'], ['status' => 'unsupported', 'url' => null, 'message' => VideoMedia::UNSUPPORTED], 'an external URL is unsupported');
same(array_key_exists('mb_id', $external) || array_key_exists('wr_ip', $external) || array_key_exists('name', $external), false, 'no author fields');
$secret = $videos->item(['boardId' => 'video', 'postId' => '2'])['item'];
same([$secret['source'], $secret['secret'], $secret['features']['highlight']['status']], ['hls_url', true, 'unsupported'], 'an HLS address without a type is hls_url');
$file = $videos->item(['boardId' => 'video', 'postId' => '3'])['item'];
same([$file['features']['cover']['status'], $file['features']['thumbnails']['status'], $file['features']['highlight']['status']], ['none', 'disabled', 'none'], 'a local file: off in the board is disabled');
same($file['postUrl'], '/bbs/board.php?bo_table=video&wr_id=3', 'root-relative post URL without &amp;');
$list = $videos->list(['page' => '1']);
same([array_column($list['items'], 'postId'), $list['total'], $list['boards'][0]['features'], $list['boards'][0]['formUrl']], [[3, 2, 1, 4, 5], 5, ['cover', 'highlight'], '/adm/board_form.php?w=u&bo_table=video'], 'list is newest first with board features');

// Internal (file, hls_zip) and external (url, hls_url) places, decided like source()
same($list['counts'], ['internal' => 3, 'external' => 2], 'counts split every post');
$internal = $videos->list(['page' => '1', 'place' => 'internal']);
same([array_column($internal['items'], 'postId'), array_column($internal['items'], 'source'), $internal['total'], $internal['counts']], [[3, 4, 5], ['file', 'hls_zip', 'file'], 3, ['internal' => 3, 'external' => 2]], 'internal place lists uploads, an unknown type with no address included');
$external = $videos->list(['page' => '1', 'place' => 'external']);
same([array_column($external['items'], 'postId'), array_column($external['items'], 'source'), $external['total']], [[2, 1], ['hls_url', 'url'], 2], 'external place lists addresses, an untyped HLS address included');
same($videos->list(['page' => '1', 'place' => 'external', 'query' => '비밀'])['counts'], ['internal' => 1, 'external' => 1], 'counts follow the title search, not the place');
try {
    $videos->list(['page' => '1', 'place' => 'remote']);
    throw new RuntimeException('an unknown place was accepted');
} catch (ApiError $error) {
    same([$error->status, array_keys($error->fields)], [422, ['place']], 'an unknown place is a validation error');
}

// Video locations: site addresses and upload names, never server paths
same(array_column($list['items'], 'location', 'postId'), [
    3 => ['address' => '/data/file/video/clip.mp4', 'name' => '내 영상.mp4'],
    2 => ['address' => 'https://cdn.example/a.m3u8', 'name' => null],
    1 => ['address' => 'https://cdn.example/a.mp4', 'name' => null],
    4 => ['address' => '/data/file/video/hls/4/t/index.m3u8', 'name' => null],
    5 => ['address' => null, 'name' => null],
], 'each source has its location');
same(str_contains(json_encode($list), $root), false, 'no server path in the list');
same(array_values(array_filter(array_column($list['items'], 'postUrl'), fn ($url) => str_contains($url, '&amp;'))), [], 'no HTML-escaped &amp; in post URLs');
same(array_column($videos->list(['page' => '1'], true)['items'], 'location', 'postId'), [
    3 => ['address' => '/data/file/video/clip.mp4', 'name' => '내 영상.mp4'],
    2 => ['address' => null, 'name' => null],
    1 => ['address' => 'https://cdn.example/a.mp4', 'name' => null],
    4 => ['address' => null, 'name' => null],
    5 => ['address' => null, 'name' => null],
], 'a read-only account loses only secret posts\' locations');
same([$videos->item(['boardId' => 'video', 'postId' => '4'], true)['item']['location'], $videos->item(['boardId' => 'video', 'postId' => '4'])['item']['location']['address']], [['address' => null, 'name' => null], '/data/file/video/hls/4/t/index.m3u8'], 'item masks a secret location the same way');
$found = new UploadedVideos($counting());
same([$found->list(['page' => '1'], true)['media']['ffmpeg'], $found->list(['page' => '1'])['media']['ffprobe']['path']], [['path' => null, 'version' => '1.0'], '/opt/x/ffprobe'], 'a read-only account sees versions without tool paths');
try {
    $videos->generate(['boardId' => 'video', 'postId' => '1', 'feature' => 'cover']);
    throw new RuntimeException('external generation unexpectedly succeeded');
} catch (ApiError $error) {
    same($error->errorCode, 'unsupported', 'generating from an external URL is refused');
}
try {
    $videos->generate(['boardId' => 'video', 'postId' => '3', 'feature' => 'thumbnails']);
    throw new RuntimeException('disabled generation unexpectedly succeeded');
} catch (ApiError $error) {
    same($error->errorCode, 'feature_disabled', 'a feature off in the board is refused');
}

// Cover frame choice with a stand-in ffmpeg: the scan's keyframe statistics pick the -ss time, a failed scan falls back to 10%.
$coverRunner = function (array $scan) use (&$commands) {
    return function (array $command) use ($scan, &$commands) {
        $commands[] = $command;
        if (in_array('-version', $command, true)) {
            return ['code' => 0, 'out' => basename($command[0]) . " version 4.2.7\n", 'err' => ''];
        }
        if (basename($command[0]) === 'ffprobe') {
            return ['code' => 0, 'out' => "20.0\n", 'err' => ''];
        }
        if (in_array('-skip_frame', $command, true)) {
            return $scan;
        }
        file_put_contents(end($command), 'jpeg');
        return ['code' => 0, 'out' => '', 'err' => ''];
    };
};
$frame = fn (float $time, float $average, float $low, float $high) => "frame:0    pts:0       pts_time:$time\nlavfi.signalstats.YMIN=0\nlavfi.signalstats.YLOW=$low\nlavfi.signalstats.YAVG=$average\nlavfi.signalstats.YHIGH=$high\n";
$commands = [];
$seek = function () use (&$commands) {
    $last = end($commands);
    return $last[array_search('-ss', $last, true) + 1];
};
$stats = $frame(0, 120, 20, 230) . $frame(4, 12, 2, 20) . $frame(8, 240, 236, 250) . $frame(12, 90, 30, 160) . $frame(16, 110, 40, 150) . $frame(19.5, 128, 0, 255);
$stub = new VideoMedia($data, '/data', '/opt/x/ffmpeg', '/opt/x/ffprobe', runner: $coverRunner(['code' => 0, 'out' => $stats, 'err' => '']));
same($stub->generate('video', 5, $data . '/file/video/clip.mp4', 'cover'), null, 'a stand-in cover generates');
same($seek(), '12.000', 'the widest spread inside 5–95% wins over dark, white and edge frames');
same(array_values(array_filter($commands, fn ($command) => $command[0] === '/opt/x/ffmpeg' && !in_array('-version', $command, true))) === array_values(array_filter($commands, fn ($command) => $command[0] === '/opt/x/ffmpeg' && in_array('-protocol_whitelist', $command, true) && in_array('-nostdin', $command, true))), true, 'every ffmpeg run keeps the whitelist and -nostdin');
$commands = [];
$failed = new VideoMedia($data, '/data', '/opt/x/ffmpeg', '/opt/x/ffprobe', runner: $coverRunner(['code' => 1, 'out' => '', 'err' => 'scan failed']));
same([$failed->generate('video', 5, $data . '/file/video/clip.mp4', 'cover'), $seek()], [null, '2.000'], 'a failed scan falls back to 10%');
$commands = [];
$black = new VideoMedia($data, '/data', '/opt/x/ffmpeg', '/opt/x/ffprobe', runner: $coverRunner(['code' => 0, 'out' => $frame(0, 16, 16, 16) . $frame(2, 16, 16, 16) . $frame(6, 17, 16, 18), 'err' => '']));
same([$black->generate('video', 5, $data . '/file/video/clip.mp4', 'cover'), $seek()], [null, '6.000'], 'an all-dark video still gets its least dark frame');
same(glob($data . '/file/video/solad/5/*'), [$data . '/file/video/solad/5/cover.jpg'], 'only cover.jpg remains');
$blocked->remove('video', 5);

// Real ffmpeg
$real = new VideoMedia($data, '/data');
if ($real->detect()['available']) {
    $input = $real->inputPath('video', $data . '/file/video/clip.mp4');
    foreach (VideoMedia::FEATURES as $feature) {
        same($real->generate('video', 3, $input, $feature), null, "$feature generates");
    }
    $files = $real->files('video', 3);
    same(array_map(fn ($url) => is_string($url) ? preg_replace('/\?v=\d+$/', '', $url) : $url, $files), ['cover' => '/data/file/video/solad/3/cover.jpg', 'thumbnails' => '/data/file/video/solad/3/thumbnails.vtt', 'highlight' => '/data/file/video/solad/3/highlight.mp4'], 'files are root-relative');
    $vtt = (string) file_get_contents($data . '/file/video/solad/3/thumbnails.vtt');
    same((bool) preg_match('/^WEBVTT\n\n00:00:00\.000 --> 00:00:02\.000\nthumbnails\.jpg\?v=\d+#xywh=0,0,160,\d+\n/', $vtt), true, 'VTT cues point at the sprite relatively');
    same(glob($data . '/file/video/solad/3/*.tmp.*'), [], 'no temporary files remain');
    $real->remove('video', 3, 'highlight');
    same($real->files('video', 3)['highlight'], null, 'one feature removed');
    $real->remove('video', 3);
    same(is_dir($data . '/file/video/solad/3'), false, 'the post folder removed');
    same($real->generate('video', 4, $root . '/outside.mp4', 'cover'), '영상 파일을 찾지 못했어요.', 'generate rechecks the input path');

    // A video whose first 60% is black: the old 10% frame was black. Also through an unpacked HLS playlist.
    $ffmpeg = $real->detect()['ffmpeg']['path'];
    $make = function (array $arguments) use ($ffmpeg) {
        $process = proc_open([$ffmpeg, '-nostdin', '-hide_banner', '-loglevel', 'error', '-y', ...$arguments], [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
        $error = stream_get_contents($pipes[2]);
        fclose($pipes[1]);
        fclose($pipes[2]);
        if (proc_close($process) !== 0) {
            throw new RuntimeException('ffmpeg fixture failed: ' . $error);
        }
    };
    $dark = $data . '/file/video/dark.mp4';
    $make(['-f', 'lavfi', '-i', 'color=c=black:s=320x180:r=10:d=10', '-f', 'lavfi', '-i', 'testsrc=s=320x180:r=10:d=10', '-filter_complex', "[0:v][1:v]overlay=enable='gte(t,6)'", '-c:v', 'libx264', '-g', '10', '-pix_fmt', 'yuv420p', $dark]);
    mkdir($data . '/file/video/hls/6', 0700, true);
    $make(['-i', $dark, '-c', 'copy', '-hls_time', '2', '-hls_playlist_type', 'vod', '-f', 'hls', $data . '/file/video/hls/6/index.m3u8']);
    $brightness = function (string $file): float {
        $image = imagecreatefromjpeg($file);
        [$width, $height] = [imagesx($image), imagesy($image)];
        $sum = 0;
        $count = 0;
        for ($y = 0; $y < $height; $y += 4) {
            for ($x = 0; $x < $width; $x += 4) {
                $rgb = imagecolorat($image, $x, $y);
                $sum += 0.299 * ($rgb >> 16 & 255) + 0.587 * ($rgb >> 8 & 255) + 0.114 * ($rgb & 255);
                $count++;
            }
        }
        return $sum / $count;
    };
    foreach ([5 => $dark, 6 => $data . '/file/video/hls/6/index.m3u8'] as $post => $source) {
        same($real->generate('video', $post, $real->inputPath('video', $source), 'cover'), null, "cover $post generates");
        same(glob($data . "/file/video/solad/$post/*"), [$data . "/file/video/solad/$post/cover.jpg"], "cover $post leaves only cover.jpg");
        if (function_exists('imagecreatefromjpeg')) {
            same($brightness($data . "/file/video/solad/$post/cover.jpg") > 60, true, "cover $post avoids the black opening");
        }
    }
} else {
    echo "ffmpeg not found; generation checks skipped\n";
}

$items = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
foreach ($items as $item) {
    $item->isDir() && !$item->isLink() ? rmdir($item->getPathname()) : unlink($item->getPathname());
}
rmdir($root);
echo "video media checks passed: $checks\n";
