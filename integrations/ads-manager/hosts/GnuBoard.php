<?php
declare(strict_types=1);

namespace AdsManager;

final class GnuBoard extends Host
{
    private function permission(string $mode): bool
    {
        global $member, $is_admin, $g5;
        if (empty($member['mb_id']) || !function_exists('verify_mb_key') || !verify_mb_key($member)) {
            return false;
        }
        if ($is_admin === 'super') {
            return true;
        }

        $id = sql_real_escape_string($member['mb_id']);
        $menu = sql_real_escape_string($this->config['gnuboardMenu']);
        $row = sql_fetch("SELECT au_auth FROM {$g5['auth_table']} WHERE mb_id = '$id' AND au_menu = '$menu'");
        return str_contains($row['au_auth'] ?? '', $mode);
    }

    private function adminLibrary(): void
    {
        // admin.lib.php has top-level redirects/mail. Check identity and session first.
        if (!$this->permission('r')) {
            throw new ApiError(403, 'forbidden', '광고 관리자 권한이 필요합니다.');
        }
        if (!function_exists('auth_check_menu')) {
            require dirname(__DIR__) . '/hosts/gnuboard-admin.php';
        }
    }

    public function authenticated(): bool
    {
        return $this->permission('r');
    }

    public function learnerId(): ?string
    {
        global $member;
        // The same session-key check as permission(): a copied session cookie is not a learner.
        if (empty($member['mb_id']) || !function_exists('verify_mb_key') || !verify_mb_key($member)) {
            return null;
        }
        return (string) $member['mb_id'];
    }

    public function displayName(): string
    {
        global $member;
        $nick = trim((string) ($member['mb_nick'] ?? ''));
        return $nick !== '' ? $nick : (string) $member['mb_id'];
    }

    public function requireAdmin(bool $write = false): void
    {
        global $auth;
        $this->adminLibrary();
        if (auth_check_menu($auth, $this->config['gnuboardMenu'], $write ? 'w' : 'r', true)) {
            throw new ApiError(403, 'forbidden', '광고 관리자 권한이 필요합니다.');
        }
    }

    public function csrfToken(): string
    {
        if (!$this->authenticated()) {
            return '';
        }
        $this->adminLibrary();
        return get_session('ss_admin_token') ?: get_admin_token();
    }

    public function verifyCsrf(mixed $token): void
    {
        $this->adminLibrary();
        $expected = get_session('ss_admin_token');
        if (!is_string($token) || !$expected || !hash_equals($expected, $token)) {
            throw new ApiError(403, 'csrf', '화면을 새로고침한 뒤 다시 시도해 주세요.');
        }
        $_REQUEST['token'] = $token;
        check_admin_token();
    }

    public function lectures(): bool
    {
        return false;
    }

    public function singlePlayerPreset(): bool
    {
        return true;
    }

    public function capabilities(): array
    {
        return ['host' => 'gnuboard', 'manualTargets' => false, 'uploads' => true, 'loginUrl' => Value::url(G5_BBS_URL . '/login.php', 'loginUrl'), 'siteUrl' => Value::url(G5_URL, 'siteUrl'), 'adminUrl' => Value::url(G5_ADMIN_URL, 'adminUrl')];
    }

    public function canWrite(): bool
    {
        return $this->permission('w');
    }

    public function adRequests(): bool
    {
        return true;
    }

    public function adRequestList(array $query): array
    {
        $boards = $this->requestBoards();
        $empty = ['boards' => [], 'stages' => AdRequests::stages(), 'counts' => AdRequests::counts([]), 'items' => [], 'page' => $query['page'], 'perPage' => AdRequests::PER_PAGE, 'total' => 0];
        if ($boards === []) {
            return $empty;
        }

        $where = '';
        if ($query['query'] !== '') {
            $like = sql_real_escape_string(addcslashes($query['query'], '%_\\'));
            $where = " AND (wr_subject LIKE '%$like%' OR wr_1 LIKE '%$like%')";
        }
        $counts = [];
        $result = sql_query('SELECT ca_name, COUNT(*) AS posts FROM (' . $this->requestUnion($boards, $where) . ') t GROUP BY ca_name');
        while ($row = sql_fetch_array($result)) {
            $counts[(string) $row['ca_name']] = ($counts[(string) $row['ca_name']] ?? 0) + (int) $row['posts'];
        }
        $counts = AdRequests::counts($counts);

        $status = $query['status'];
        if ($status === '접수') {
            $stages = implode(', ', array_map(static fn (string $stage): string => "'" . sql_real_escape_string($stage) . "'", array_keys(AdRequests::STAGES)));
            $where .= " AND (ca_name = '접수' OR ca_name NOT IN ($stages))";
        } elseif ($status !== null) {
            $where .= " AND ca_name = '" . sql_real_escape_string($status) . "'";
        }
        $offset = ($query['page'] - 1) * AdRequests::PER_PAGE;
        $result = sql_query('SELECT * FROM (' . $this->requestUnion($boards, $where) . ') t ORDER BY wr_datetime DESC, bo_table DESC, wr_id DESC LIMIT ' . $offset . ', ' . AdRequests::PER_PAGE);
        $items = [];
        while ($row = sql_fetch_array($result)) {
            $items[] = AdRequests::item($row, $this->postUrl($row['bo_table'], (int) $row['wr_id']), (int) $row['media_files'] > 0, $this->config['timeZone']);
        }

        return [...$empty, 'boards' => array_values(array_map(static fn (array $board): array => ['boardId' => $board['bo_table'], 'name' => $board['bo_subject']], $boards)), 'counts' => $counts, 'items' => $items, 'total' => $status === null ? $counts['all'] : $counts[$status]];
    }

    public function adRequestDetail(string $boardId, int $postId, bool $masked): array
    {
        global $g5;
        $board = $this->requestBoards()[$boardId] ?? throw new ApiError(404, 'board_not_found', '광고 요청 게시판을 찾을 수 없습니다.');
        $table = $g5['write_prefix'] . $boardId;
        $post = sql_fetch("SELECT * FROM `$table` WHERE wr_id = $postId AND wr_is_comment = 0");
        if (!$post) {
            throw new ApiError(404, 'ad_request_not_found', '광고 요청을 찾을 수 없습니다.');
        }

        $files = [];
        $result = sql_query("SELECT * FROM {$g5['board_file_table']} WHERE bo_table = '$boardId' AND wr_id = $postId AND bf_file <> '' ORDER BY bf_no");
        while ($row = sql_fetch_array($result)) {
            $url = !empty($row['bf_fileurl']) ? $row['bf_fileurl'] : G5_DATA_URL . '/file/' . $boardId . '/' . $row['bf_file'];
            $files[] = ['name' => (string) $row['bf_source'], 'size' => (int) $row['bf_filesize'], 'url' => $this->localUrl($url), 'media' => (int) $row['bf_no'] === 0];
        }
        $comments = [];
        $result = sql_query("SELECT wr_id, wr_name, wr_content, wr_option, wr_datetime, wr_1 FROM `$table` WHERE wr_parent = $postId AND wr_is_comment = 1 ORDER BY wr_comment, wr_comment_reply");
        while ($row = sql_fetch_array($result)) {
            $comments[] = $row;
        }
        $target = null;
        if (preg_match('/^[a-zA-Z0-9_]{1,20}$/D', (string) $post['wr_9'])) {
            $row = sql_fetch("SELECT bo_table, bo_subject FROM {$g5['board_table']} WHERE bo_table = '{$post['wr_9']}'");
            $target = $row ? ['boardId' => $row['bo_table'], 'name' => $row['bo_subject']] : null;
        }

        return ['request' => AdRequests::detail($board, [...$post, 'bo_table' => $boardId], $files, $comments, $target, $this->postUrl($boardId, $postId), $masked, $this->config['timeZone']), 'masked' => $masked];
    }

    /** Boards drawn by the ad request skin (dark or light, plain or theme), keyed by bo_table. */
    private function requestBoards(): array
    {
        global $g5;
        $boards = [];
        $result = sql_query("SELECT bo_table, bo_subject FROM {$g5['board_table']} WHERE bo_skin IN ('solad_request', 'theme/solad_request', 'solad_request_light', 'theme/solad_request_light') ORDER BY bo_table");
        while ($row = sql_fetch_array($result)) {
            if (preg_match('/^[a-zA-Z0-9_]{1,20}$/D', $row['bo_table'])) {
                $boards[$row['bo_table']] = $row;
            }
        }
        return $boards;
    }

    /** Posts of every request board in one result; `$where` is already escaped. */
    private function requestUnion(array $boards, string $where): string
    {
        global $g5;
        $selects = [];
        foreach (array_keys($boards) as $id) {
            $table = $g5['write_prefix'] . $id;
            $selects[] = "SELECT '$id' AS bo_table, wr_id, wr_subject, ca_name, wr_1, wr_2, wr_3, wr_4, wr_5, wr_7, wr_datetime, wr_comment, wr_option, (SELECT COUNT(*) FROM {$g5['board_file_table']} f WHERE f.bo_table = '$id' AND f.wr_id = w.wr_id AND f.bf_no = 0 AND f.bf_file <> '') AS media_files FROM `$table` w WHERE wr_is_comment = 0$where";
        }
        return implode(' UNION ALL ', $selects);
    }

    private function postUrl(string $boardId, int $postId): string
    {
        // get_pretty_url() returns an HTML attribute value (&amp;); the API gives the plain address.
        return $this->localUrl(function_exists('get_pretty_url') ? html_entity_decode(get_pretty_url($boardId, $postId), ENT_QUOTES | ENT_HTML5, 'UTF-8') : G5_BBS_URL . '/board.php?bo_table=' . $boardId . '&wr_id=' . $postId);
    }

    /** A G5_URL address as a root-relative path, like the skins' solad_local_url(). */
    private function localUrl(string $url): string
    {
        $site = rtrim(G5_URL, '/');
        if ($url !== $site && !str_starts_with($url, $site . '/')) {
            return $url;
        }
        return rtrim((string) parse_url($site, PHP_URL_PATH), '/') . '/' . ltrim(substr($url, strlen($site)), '/');
    }

    private function board(string $id): array
    {
        if (!preg_match('/^[a-zA-Z0-9_]{1,20}$/D', $id)) {
            Value::fail('boardId');
        }
        $board = get_board_db($id);
        if (empty($board['bo_table'])) {
            throw new ApiError(404, 'board_not_found', '게시판을 찾을 수 없습니다.');
        }
        return $board;
    }

    public function resolveVideoContext(string $videoId): array
    {
        global $member, $g5, $config;
        // The final component is a stable host-assigned video key, not its source URL.
        if (!preg_match('/^([a-zA-Z0-9_]{1,20}):([1-9][0-9]{0,9}):([a-zA-Z0-9_-]{1,80})$/D', $videoId, $parts)) {
            Value::fail('videoId', '게시판:글번호:영상키 형식이 필요합니다.');
        }
        $board = $this->board($parts[1]);
        $postId = (int) $parts[2];
        $table = $g5['write_prefix'] . $parts[1];
        $post = sql_fetch("SELECT * FROM `$table` WHERE wr_id = $postId AND wr_is_comment = 0");
        if (!$post) {
            throw new ApiError(404, 'video_not_found', '영상 게시물을 찾을 수 없습니다.');
        }
        $resolver = $this->config['gnuboardVideoKeys'] ?? null;
        $keys = $resolver === null ? ['main'] : $resolver($board, $post);
        if (!is_array($keys) || !array_is_list($keys) || !in_array($parts[3], $keys, true)) {
            throw new ApiError(404, 'video_not_found', '등록된 영상 키를 찾을 수 없습니다.');
        }
        $groupId = sql_real_escape_string($board['gr_id']);
        $group = sql_fetch("SELECT * FROM {$g5['group_table']} WHERE gr_id = '$groupId'");
        $memberId = $member['mb_id'] ?? '';
        $super = $memberId !== '' && $memberId === ($config['cf_admin'] ?? null);
        $groupAdmin = $memberId !== '' && $memberId === ($group['gr_admin'] ?? null);
        $boardAdmin = $memberId !== '' && $memberId === ($board['bo_admin'] ?? null);
        $admin = $super || $groupAdmin || $boardAdmin;
        $deny = static fn () => throw new ApiError(403, 'content_forbidden', '게시물에 접근할 수 없습니다.');

        if ((int) ($member['mb_level'] ?? 1) < (int) $board['bo_read_level']) {
            $deny();
        }
        if (!empty($group['gr_use_access']) && !$super && !$groupAdmin) {
            $escaped = sql_real_escape_string($memberId);
            if ($memberId === '' || !sql_fetch("SELECT mb_id FROM {$g5['group_member_table']} WHERE gr_id = '$groupId' AND mb_id = '$escaped'")) {
                $deny();
            }
        }
        if (!empty($config['cf_cert_use']) && !empty($board['bo_use_cert']) && !$admin) {
            if ($memberId === '' || (strlen($member['mb_dupinfo'] ?? '') === 64 && !empty($member['mb_certify'])) || ($board['bo_use_cert'] === 'cert' && empty($member['mb_certify'])) || ($board['bo_use_cert'] === 'adult' && empty($member['mb_adult']))) {
                $deny();
            }
        }
        if (str_contains($post['wr_option'], 'secret') && !$admin && !($memberId !== '' && $memberId === $post['mb_id']) && !get_session('ss_secret_' . $parts[1] . '_' . $post['wr_num'])) {
            $owner = null;
            if ($memberId !== '' && $post['wr_reply'] !== '') {
                $number = (int) $post['wr_num'];
                $owner = sql_fetch("SELECT mb_id FROM `$table` WHERE wr_num = $number AND wr_reply = '' AND wr_is_comment = 0");
            }
            if (!$owner || $owner['mb_id'] !== $memberId) {
                $deny();
            }
        }
        // Do not spend reading points in an ads API. Require the host's successful view first.
        if (!$admin && !empty($config['cf_use_point']) && (int) ($board['bo_read_point'] ?? 0) < 0 && !get_session('ss_view_' . $parts[1] . '_' . $postId)) {
            $deny();
        }
        if (($board['bo_device'] ?? 'both') !== 'both' && (($board['bo_device'] === 'mobile') !== (bool) G5_IS_MOBILE)) {
            $deny();
        }

        return ['videoId' => $videoId, 'boardId' => $parts[1], 'categoryId' => !empty($board['bo_use_category']) && $post['ca_name'] !== '' ? $post['ca_name'] : null];
    }

    public function validateTarget(array $target): void
    {
        if ($target['type'] === 'video') {
            $this->resolveVideoContext($target['id']);
        } elseif ($target['type'] === 'board') {
            $this->board($target['id']);
        } elseif ($target['type'] === 'category') {
            $board = $this->board($target['boardId']);
            if (empty($board['bo_use_category']) || !in_array($target['id'], array_map('trim', explode('|', $board['bo_category_list'])), true)) {
                Value::fail('target.id');
            }
        }
    }

    public function targets(string $type, string $query, ?string $boardId): array
    {
        global $g5;
        if ($type === 'site') {
            return [['target' => ['type' => 'site', 'id' => $this->config['siteId']], 'label' => '사이트 기본']];
        }
        if ($type === 'video') {
            // A host-specific video key cannot be inferred from HTML or a transient media URL.
            if ($query === '') {
                return [];
            }
            $context = $this->resolveVideoContext($query);
            return [['target' => ['type' => 'video', 'id' => $context['videoId']], 'label' => $context['videoId']]];
        }
        if ($type === 'category') {
            $board = $this->board($boardId ?? '');
            $categories = empty($board['bo_use_category']) ? [] : array_filter(array_map('trim', explode('|', $board['bo_category_list'])));
            return array_values(array_map(fn ($id) => ['target' => ['type' => 'category', 'id' => $id, 'boardId' => $boardId], 'label' => $id], array_filter($categories, fn ($id) => $query === '' || mb_stripos($id, $query) !== false)));
        }

        $result = sql_query("SELECT bo_table, bo_subject FROM {$g5['board_table']} ORDER BY bo_table LIMIT 1000");
        $items = [];
        while ($row = sql_fetch_array($result)) {
            if ($query === '' || mb_stripos($row['bo_table'] . ' ' . $row['bo_subject'], $query) !== false) {
                $items[] = ['target' => ['type' => 'board', 'id' => $row['bo_table']], 'label' => $row['bo_subject']];
            }
        }
        return array_slice($items, 0, 100);
    }
}
