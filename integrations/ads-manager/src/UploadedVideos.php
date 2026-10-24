<?php
declare(strict_types=1);

namespace AdsManager;

/** The gnuboard "업로드 동영상" admin screen: video posts of solad_video boards and their ffmpeg extras. */
final class UploadedVideos
{
    private const SKIN = 'solad_video';
    private const PAGE_SIZE = 20;
    private const SOURCES = ['file', 'hls_zip', 'hls_url', 'url'];
    private const VIDEO_EXTENSIONS = '/\.(mp4|m4v|webm)$/i';

    private ?array $boards = null;

    public function __construct(private readonly VideoMedia $media) {}

    /** @param bool $masked Hides the ffmpeg and ffprobe paths from an account that cannot write (the public demo admin). */
    public function list(array $input, bool $masked = false): array
    {
        global $g5;
        $boardId = $this->boardInput($input['boardId'] ?? '', true);
        $query = Value::text($input['query'] ?? '', 'query', 100, true);
        $page = $input['page'] ?? '1';
        if (!(is_int($page) && $page >= 1) && !(is_string($page) && preg_match('/^[1-9][0-9]{0,5}$/D', $page))) {
            Value::fail('page');
        }
        $page = (int) $page;
        $media = $this->media->detect(($input['refresh'] ?? '') === '1');
        if ($masked) {
            foreach (['ffmpeg', 'ffprobe'] as $tool) {
                $media[$tool] = $media[$tool] === null ? null : [...$media[$tool], 'path' => null];
            }
        }

        $boards = $this->boards();
        $selected = $boardId === '' ? $boards : array_filter($boards, fn ($board) => $board['bo_table'] === $boardId);
        if ($boardId !== '' && !$selected) {
            throw new ApiError(404, 'board_not_found', '게시판을 찾을 수 없습니다.');
        }
        $where = 'wr_is_comment = 0' . ($query === '' ? '' : " AND wr_subject LIKE '%" . sql_real_escape_string(addcslashes($query, '%_\\')) . "%'");
        $limit = $page * self::PAGE_SIZE;
        $total = 0;
        $rows = [];
        // Each board's newest rows up to this page, merged by date: boards are few, pages shallow.
        foreach ($selected as $board) {
            $table = $g5['write_prefix'] . $board['bo_table'];
            $total += (int) (sql_fetch("SELECT COUNT(*) AS n FROM `$table` WHERE $where")['n'] ?? 0);
            $result = sql_query("SELECT wr_id, wr_subject, wr_option, wr_datetime, wr_1, wr_2, wr_3 FROM `$table` WHERE $where ORDER BY wr_datetime DESC, wr_id DESC LIMIT $limit");
            while ($post = sql_fetch_array($result)) {
                $rows[] = [$board, $post];
            }
        }
        usort($rows, fn ($a, $b) => [$b[1]['wr_datetime'], $b[1]['wr_id']] <=> [$a[1]['wr_datetime'], $a[1]['wr_id']]);
        $rows = array_slice($rows, ($page - 1) * self::PAGE_SIZE, self::PAGE_SIZE);

        return [
            'media' => $media,
            'boards' => array_values(array_map(fn ($board) => ['id' => $board['bo_table'], 'subject' => $board['bo_subject'], 'features' => $this->media->boardFeatures($board), 'formUrl' => $this->local(G5_ADMIN_URL . '/board_form.php?w=u&bo_table=' . rawurlencode($board['bo_table']))], $boards)),
            'items' => array_map(fn ($row) => $this->row($row[0], $row[1]), $rows),
            'page' => $page,
            'pageSize' => self::PAGE_SIZE,
            'total' => $total,
        ];
    }

    public function item(array $input): array
    {
        [$board, $post] = $this->post($input);
        return ['item' => $this->row($board, $post)];
    }

    public function generate(array $input): array
    {
        [$board, $post] = $this->post($input);
        $features = $this->features($input, $board, true);
        $source = $this->source($board, $post);
        if ($source['path'] === null) {
            throw new ApiError(422, 'unsupported', $source['message']);
        }
        $detect = $this->media->detect();
        if (!$detect['available']) {
            throw new ApiError(422, 'ffmpeg_unavailable', $detect['message']);
        }

        // Generation can take minutes; keep the session free for the admin's other requests.
        // The CSRF check consumed the admin token, so mint the next one first: the response header hands it to the client.
        if (session_status() === PHP_SESSION_ACTIVE) {
            if (function_exists('get_admin_token') && !get_session('ss_admin_token')) {
                get_admin_token();
            }
            session_write_close();
        }
        @set_time_limit(600);
        $failed = [];
        foreach ($features as $feature) {
            if ($this->media->generate($board['bo_table'], (int) $post['wr_id'], $source['path'], $feature, (float) $post['wr_2']) !== null) {
                $failed[] = $feature;
            }
        }
        return ['item' => $this->row($board, $post), 'failed' => $failed];
    }

    public function delete(array $input): array
    {
        [$board, $post] = $this->post($input);
        $feature = $input['feature'] ?? null;
        if ($feature === 'all') {
            $this->media->remove($board['bo_table'], (int) $post['wr_id']);
        } else {
            $this->media->remove($board['bo_table'], (int) $post['wr_id'], $this->features($input, $board, false)[0]);
        }
        return ['item' => $this->row($board, $post)];
    }

    private function row(array $board, array $post): array
    {
        $postId = (int) $post['wr_id'];
        $source = $this->source($board, $post);
        $enabled = $this->media->boardFeatures($board);
        $files = $this->media->files($board['bo_table'], $postId);
        $errors = $this->media->errors($board['bo_table'], $postId);
        $features = [];
        foreach (VideoMedia::FEATURES as $feature) {
            [$status, $message] = match (true) {
                $source['path'] === null => ['unsupported', $source['message']],
                !in_array($feature, $enabled, true) => ['disabled', '게시판 설정에서 꺼져 있어요.'],
                $files[$feature] !== null => ['ready', null],
                isset($errors[$feature]) => ['error', $errors[$feature]],
                default => ['none', null],
            };
            $features[$feature] = ['status' => $status, 'url' => $files[$feature], 'message' => $message];
        }
        $features['thumbnails']['image'] = $files['thumbnails'] === null ? null : preg_replace('/thumbnails\.vtt\?/', 'thumbnails.jpg?', $files['thumbnails']);
        $duration = (float) $post['wr_2'];

        return [
            'boardId' => $board['bo_table'],
            'boardSubject' => $board['bo_subject'],
            'postId' => $postId,
            'title' => (string) $post['wr_subject'],
            'secret' => str_contains((string) $post['wr_option'], 'secret'),
            'source' => $source['type'],
            'duration' => $duration > 0 ? $duration : null,
            'createdAt' => (string) $post['wr_datetime'],
            'postUrl' => $this->local(function_exists('get_pretty_url') ? get_pretty_url($board['bo_table'], $postId) : G5_BBS_URL . '/board.php?bo_table=' . rawurlencode($board['bo_table']) . '&wr_id=' . $postId),
            'features' => $features,
        ];
    }

    /** The post's local input video, or why there is none. Mirrors solad_video_source_type() in the skin. */
    private function source(array $board, array $post): array
    {
        global $g5;
        $url = trim((string) $post['wr_1']);
        $type = trim((string) $post['wr_3']);
        if (!in_array($type, self::SOURCES, true)) {
            $type = $url === '' ? 'file' : (preg_match('/\.m3u8$/i', (string) parse_url($url, PHP_URL_PATH)) ? 'hls_url' : 'url');
        }
        if ($type === 'url' || $type === 'hls_url') {
            return ['type' => $type, 'path' => null, 'message' => VideoMedia::UNSUPPORTED];
        }

        $candidate = null;
        if ($type === 'hls_zip') {
            $candidate = $this->media->pathFromUrl($url);
        } else {
            $boTable = sql_real_escape_string($board['bo_table']);
            $postId = (int) $post['wr_id'];
            $result = sql_query("SELECT bf_file, bf_source FROM {$g5['board_file_table']} WHERE bo_table = '$boTable' AND wr_id = $postId AND bf_file <> '' ORDER BY bf_no");
            while ($file = sql_fetch_array($result)) {
                if (preg_match(self::VIDEO_EXTENSIONS, $file['bf_source'] !== '' ? $file['bf_source'] : $file['bf_file'])) {
                    $candidate = $this->media->attachmentPath($board['bo_table'], $file['bf_file']);
                    break;
                }
            }
        }
        $path = $candidate === null ? null : $this->media->inputPath($board['bo_table'], $candidate);

        return ['type' => $type, 'path' => $path, 'message' => $path === null ? '이 글에서 영상 파일을 찾지 못했어요.' : null];
    }

    private function post(array $input): array
    {
        global $g5;
        $boardId = $this->boardInput($input['boardId'] ?? null, false);
        $board = $this->boards()[$boardId] ?? throw new ApiError(404, 'board_not_found', '게시판을 찾을 수 없습니다.');
        $postId = $input['postId'] ?? null;
        if (!(is_int($postId) && $postId >= 1) && !(is_string($postId) && preg_match('/^[1-9][0-9]{0,9}$/D', $postId))) {
            Value::fail('postId');
        }
        $table = $g5['write_prefix'] . $board['bo_table'];
        $post = sql_fetch("SELECT wr_id, wr_subject, wr_option, wr_datetime, wr_1, wr_2, wr_3 FROM `$table` WHERE wr_id = " . (int) $postId . ' AND wr_is_comment = 0');
        if (empty($post['wr_id'])) {
            throw new ApiError(404, 'video_not_found', '영상 게시물을 찾을 수 없습니다.');
        }
        return [$board, $post];
    }

    /** Requested features: one name, or 'all' meaning every feature the board switched on. */
    private function features(array $input, array $board, bool $all): array
    {
        $feature = $input['feature'] ?? null;
        if ($all && $feature === 'all') {
            $features = $this->media->boardFeatures($board);
            if (!$features) {
                throw new ApiError(422, 'feature_disabled', '게시판 설정에서 켜진 기능이 없어요.');
            }
            return $features;
        }
        if (!is_string($feature) || !in_array($feature, VideoMedia::FEATURES, true)) {
            Value::fail('feature');
        }
        if ($all && !in_array($feature, $this->media->boardFeatures($board), true)) {
            throw new ApiError(422, 'feature_disabled', '게시판 설정에서 꺼져 있어요.');
        }
        return [$feature];
    }

    private function boardInput(mixed $value, bool $empty): string
    {
        if (!is_string($value) || !preg_match($empty ? '/^[a-zA-Z0-9_]{0,20}$/D' : '/^[a-zA-Z0-9_]{1,20}$/D', $value)) {
            Value::fail('boardId');
        }
        return $value;
    }

    /** solad_video boards keyed by bo_table, with their extra fields. */
    private function boards(): array
    {
        global $g5;
        if ($this->boards !== null) {
            return $this->boards;
        }
        $skin = sql_real_escape_string(self::SKIN);
        $result = sql_query("SELECT bo_table FROM {$g5['board_table']} WHERE bo_skin = '$skin' OR bo_mobile_skin = '$skin' ORDER BY bo_order, bo_table");
        $this->boards = [];
        while ($row = sql_fetch_array($result)) {
            $this->boards[$row['bo_table']] = get_board_db($row['bo_table'], true);
        }
        return $this->boards;
    }

    /** A same-site URL as a root-relative path, like solad_local_url() in the skin. */
    private function local(string $url): string
    {
        $site = rtrim(G5_URL, '/');
        if ($url !== $site && !str_starts_with($url, $site . '/')) {
            return $url;
        }
        return rtrim((string) parse_url($site, PHP_URL_PATH), '/') . '/' . ltrim(substr($url, strlen($site)), '/');
    }
}
