<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가

if (!function_exists('solad_theme_asset')) {

// 테마 파일 주소. 파일을 고치면 주소가 바뀌어 브라우저가 새로 받는다.
function solad_theme_asset($path)
{
    $file = G5_THEME_PATH.'/'.$path;
    return G5_THEME_URL.'/'.$path.(is_file($file) ? '?v='.filemtime($file) : '');
}

// 테마 글꼴, CSS, 머리글 스크립트. g5-skins.css는 그누보드 기본 스킨(게시판·회원)의 밝은 색을 어두운 바탕에 맞춘다.
function solad_theme_add_assets()
{
    add_stylesheet('<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>', 0);
    add_stylesheet('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700;800&family=Noto+Sans+KR:wght@400;500;700;800;900&display=swap">', 0);
    add_stylesheet('<link rel="stylesheet" href="'.solad_theme_asset('css/theme.css').'">', 20);
    add_stylesheet('<link rel="stylesheet" href="'.solad_theme_asset('css/g5-skins.css').'">', 21);
    add_javascript('<script src="'.solad_theme_asset('js/theme.js').'" defer></script>', 20);
}

// 테마 head.php를 거치지 않고 head.sub.php만 쓰는 회원 화면(로그인, 회원 비밀번호 확인, 비밀글 비밀번호)인지.
// 같은 주소라도 alert()·confirm()이 띄운 안내 화면은 팝업과 같게 둔다.
function solad_theme_is_member_frame()
{
    $script = isset($_SERVER['SCRIPT_NAME']) ? $_SERVER['SCRIPT_NAME'] : '';
    if (basename(dirname($script)) !== G5_BBS_DIR || !in_array(basename($script), array('login.php', 'member_confirm.php', 'password.php'), true)) {
        return false;
    }

    foreach (get_included_files() as $file) {
        if (basename(dirname($file)) === G5_BBS_DIR && in_array(basename($file), array('alert.php', 'alert_close.php', 'confirm.php'), true)) {
            return false;
        }
    }
    return true;
}

// 히어로 영상: media/hero-promo.mp4가 있으면 그것을, 없으면 임시 영상을 쓴다. 포스터는 쓰지 않는다. 주소는 루트 상대 경로.
function solad_theme_hero()
{
    solad_theme_video_lib(null);
    foreach (array('hero-promo.mp4', 'hero-placeholder.mp4') as $name) {
        if (is_file(G5_THEME_PATH.'/media/'.$name)) {
            return array('src' => solad_theme_local_url(solad_theme_asset('media/'.$name)));
        }
    }
    return array('src' => '');
}

// 서브 히어로 영상. 테마 media/hero-placeholder.mp4가 없으면 빈 주소를 돌려준다.
function solad_theme_subhero()
{
    solad_theme_video_lib(null);
    if (!is_file(G5_THEME_PATH.'/media/hero-placeholder.mp4')) {
        return array('src' => '');
    }
    return array('src' => solad_theme_local_url(solad_theme_asset('media/hero-placeholder.mp4')));
}

// 동영상 게시판 스킨의 solad_local_url(). 스킨이 없으면 주소를 그대로 둔다.
function solad_theme_local_url($url)
{
    return function_exists('solad_local_url') ? solad_local_url($url) : $url;
}

// 동영상 게시판 스킨의 공용 함수(재생 주소, 재생 시간, 미리보기 등)를 같이 쓴다.
// 밝은 스킨(solad_video_light)의 solad.lib.php는 solad_video 것을 불러오므로 어느 스킨이든 같은 함수다.
function solad_theme_video_lib($board)
{
    if (function_exists('solad_video_source')) {
        return true;
    }
    $lib = G5_SKIN_PATH.'/board/'.($board && $board['bo_skin'] ? $board['bo_skin'] : 'solad_video').'/solad.lib.php';
    if (!is_file($lib)) {
        $lib = G5_SKIN_PATH.'/board/solad_video/solad.lib.php';
    }
    if (!is_file($lib)) {
        return false;
    }
    include_once($lib);
    return true;
}

// 솔애드 플레이어 loader.js 주소. 동영상 게시판 설정을 따른다.
function solad_theme_player_loader($bo_table)
{
    $board = get_board_db($bo_table, true);
    if ($board && solad_theme_video_lib($board)) {
        $settings = solad_video_settings($board);
        return $settings['loader'];
    }
    return solad_theme_local_url(G5_URL.'/ads').'/player/loader.js';
}

// 최근 영상. 비밀글과 답글은 뺀다.
function solad_theme_latest_videos($bo_table, $limit)
{
    $board = get_board_db($bo_table, true);
    if (!$board || !solad_theme_video_lib($board)) {
        return array();
    }

    $write_table = G5_TABLE_PREFIX.'write_'.$bo_table;
    $result = sql_query(" select * from {$write_table}
                           where wr_is_comment = 0 and wr_reply = '' and wr_option not like '%secret%'
                           order by wr_num, wr_reply
                           limit ".(int) $limit, false);
    $rows = array();
    while ($result && $row = sql_fetch_array($result)) {
        // 게시판 목록과 같은 규칙: 만든 커버가 있으면 먼저, 없으면 첨부·본문 이미지.
        $thumb = solad_video_thumb($bo_table, $row, 640, 360);
        $row['href'] = get_pretty_url($bo_table, $row['wr_id']);
        $row['thumb'] = !empty($thumb['src']) ? $thumb['src'] : '';
        $row['highlight'] = solad_video_highlight($bo_table, $row);
        $row['duration'] = solad_video_duration($row['wr_2']);
        $rows[] = $row;
    }
    return $rows;
}

// 플레이어 데모로 열 글. 정한 글이 없거나 영상이 없으면 최근 영상 중 첫 글.
function solad_theme_demo_video($bo_table, $wr_id)
{
    $board = get_board_db($bo_table, true);
    if (!$board || !solad_theme_video_lib($board)) {
        return null;
    }

    $write_table = G5_TABLE_PREFIX.'write_'.$bo_table;
    $candidates = array();
    if ((int) $wr_id > 0) {
        $row = sql_fetch(" select * from {$write_table} where wr_id = '".(int) $wr_id."' and wr_is_comment = 0 and wr_option not like '%secret%' ", false);
        if ($row) {
            $candidates[] = $row;
        }
    }
    $result = sql_query(" select * from {$write_table} where wr_is_comment = 0 and wr_option not like '%secret%' order by wr_num, wr_reply limit 10 ", false);
    while ($result && $row = sql_fetch_array($result)) {
        $candidates[] = $row;
    }

    foreach ($candidates as $row) {
        $files = get_file($bo_table, $row['wr_id']);
        $src = solad_video_source($row, $files);
        if (!$src) {
            continue;
        }
        // 포스터는 보기 화면과 같이 만든 커버를 먼저 쓴다.
        $media = solad_video_media_files($bo_table, $row['wr_id']);
        $poster = isset($media['cover']) ? null : solad_video_pick_file($files, SOLAD_IMAGE_EXTENSIONS);
        return array(
            'board' => $board,
            'row' => $row,
            'src' => $src,
            'engine' => solad_video_engine($src),
            'poster' => isset($media['cover']) ? $media['cover'] : ($poster ? solad_video_file_url($poster) : ''),
            'href' => get_pretty_url($bo_table, $row['wr_id']),
            'settings' => solad_video_settings($board),
        );
    }
    return null;
}

// 지금 보고 있는 게시판이나 내용 페이지(content.php?co_id=)의 메뉴에 표시를 단다.
function solad_theme_menu_current($link, $bo_table, $co_id = '')
{
    $query = parse_url($link, PHP_URL_QUERY);
    parse_str((string) $query, $params);
    if (isset($params['co_id'])) {
        return $co_id !== '' && $params['co_id'] === $co_id;
    }
    if (!$bo_table) {
        return false;
    }
    if (isset($params['bo_table'])) {
        return $params['bo_table'] === $bo_table;
    }
    return (bool) preg_match('#/'.preg_quote($bo_table, '#').'(/|$)#', (string) parse_url($link, PHP_URL_PATH));
}

function solad_theme_count_videos($bo_table)
{
    $board = get_board_db($bo_table, true);
    return $board ? (int) $board['bo_count_write'] : 0;
}

// 데모 스위치. 그누보드 데모 모드(사이트 루트의 DEMO 파일)가 켜져 있고 data/solad-demo.php가 array('admin_id' => '<아이디>')를 돌려주면 켜진다.
// 둘 중 하나라도 없거나 모양이 다르면 꺼진다(null). 데모 모드에서는 그누보드 check_demo()가 최고관리자가 아닌 관리자의 adm/ 저장도 막는다.
function solad_theme_demo_config()
{
    static $demo = false;
    if ($demo !== false) {
        return $demo;
    }

    $demo = null;
    $file = G5_DATA_PATH.'/solad-demo.php';
    if (defined('SOLAD_URL') && is_file(G5_PATH.'/DEMO') && is_file($file)) {
        $value = include $file;
        if (is_array($value) && isset($value['admin_id']) && is_string($value['admin_id']) && preg_match('/^[0-9a-z_]+$/i', $value['admin_id'])) {
            $demo = array('admin_id' => $value['admin_id']);
        }
    }
    return $demo;
}

// 회원에게 솔애드 관리 화면 읽기 권한(r)이 있는지. 최고관리자이거나 솔애드 메뉴 권한에 r이 있어야 한다.
function solad_theme_has_solad_auth($mb_id, $is_super = false)
{
    global $g5;

    if ($is_super) {
        return true;
    }
    if (!$mb_id || !defined('SOLAD_ADMIN_MENU')) {
        return false;
    }
    $row = sql_fetch(" SELECT au_auth FROM {$g5['auth_table']} WHERE mb_id = '".sql_real_escape_string($mb_id)."' AND au_menu = '".sql_real_escape_string(SOLAD_ADMIN_MENU)."' ");
    return isset($row['au_auth']) && strpos($row['au_auth'], 'r') !== false;
}

// 지금 회원이 솔애드 관리자인지. hosts/GnuBoard.php permission('r')과 같은 규칙이다.
// verify_mb_key는 틀리면 회원 쿠키를 새로 만들므로 권한이 있는 회원에게만 부른다.
function solad_theme_is_solad_admin()
{
    global $member, $is_admin;
    static $result = null;
    if ($result !== null) {
        return $result;
    }

    $result = !empty($member['mb_id'])
        && solad_theme_has_solad_auth($member['mb_id'], $is_admin === 'super')
        && verify_mb_key($member);
    return $result;
}

// 머리글 "관리자"와 메인 "솔애드 관리자" 버튼이 갈 주소. 버튼을 감출 때는 ''.
// 솔애드 관리자는 관리 화면으로 바로 가고, 데모가 켜져 있으면 비회원은 로그인 화면(데모 관리자 로그인)으로 간다.
// 이미 로그인한 일반 회원은 로그인 화면이 곧바로 관리 화면으로 돌려보내 막히므로 감춘다.
function solad_theme_admin_entry()
{
    global $is_member;

    if (!defined('SOLAD_URL')) {
        return '';
    }
    if (solad_theme_is_solad_admin()) {
        return SOLAD_URL.'/';
    }
    if (!$is_member && solad_theme_demo_config()) {
        return G5_BBS_URL.'/login.php?url='.urlencode(SOLAD_URL.'/');
    }
    return '';
}

// 데모 로그인 폼 토큰. 세션에 묶이고, 로그인에 성공하면 지운다.
function solad_theme_demo_token()
{
    $token = get_session('ss_solad_demo_token');
    if (!$token) {
        $token = get_random_token_string(16);
        set_session('ss_solad_demo_token', $token);
    }
    return $token;
}

// 로그인 화면은 테마 회원 스킨(skin/member/basic/login.skin.php)으로 그린다(common_header 이벤트).
// 그 폴더에는 로그인 스킨만 있으므로 사이트 설정의 회원 스킨은 바꾸지 않고, 로그인 화면에서만 경로를 바꾼다.
function solad_theme_login_skin()
{
    global $member_skin_path, $member_skin_url;

    $script = isset($_SERVER['SCRIPT_NAME']) ? $_SERVER['SCRIPT_NAME'] : '';
    $path = G5_THEME_PATH.'/'.G5_SKIN_DIR.'/member/basic';
    if (basename(dirname($script)) !== G5_BBS_DIR || basename($script) !== 'login.php' || !is_file($path.'/login.skin.php')) {
        return;
    }
    $member_skin_path = $path;
    $member_skin_url = G5_THEME_URL.'/'.G5_SKIN_DIR.'/member/basic';
}

// 지금 회원이 데모 관리자인지. 데모가 꺼져 있으면 언제나 false.
function solad_theme_is_demo_member()
{
    global $member;

    $demo = solad_theme_demo_config();
    return $demo && !empty($member['mb_id']) && strtolower($member['mb_id']) === strtolower($demo['admin_id']);
}

// 데모 로그인 뒤 돌아갈 곳. 같은 사이트의 솔애드 관리 화면 주소만 받고, 아니면 관리 화면 첫 화면으로 간다(오픈 리다이렉트 방지).
// 루트 상대 경로로 돌려주므로 사이트를 다른 호스트 이름으로 열어도 그 호스트의 세션으로 돌아간다.
function solad_theme_demo_return_url($url)
{
    solad_theme_video_lib(null);
    $home = solad_theme_local_url(SOLAD_URL.'/');
    $url = solad_theme_local_url(trim(urldecode((string) $url)));
    if ($url === '' || $url[0] !== '/' || strpos($url, '//') === 0 || strpos($url, '\\') !== false || strpos($url, '..') !== false || preg_match('/[\x00-\x1f]/', $url)) {
        return $home;
    }
    return strpos(rtrim((string) parse_url($url, PHP_URL_PATH), '/').'/', $home) === 0 ? $url : $home;
}

// 데모 로그인 처리 (common_header 이벤트). 로그인 화면의 데모 카드가 bbs/login.php로 보낸 POST에 solad_demo_login이 있을 때만 움직인다.
// 세션은 bbs/login_check.php와 같게 세운다. 비밀번호는 보지 않고, 포인트와 자동 로그인 쿠키는 만들지 않는다.
function solad_theme_demo_login_handle()
{
    global $g5, $config, $is_member;

    $script = isset($_SERVER['SCRIPT_NAME']) ? $_SERVER['SCRIPT_NAME'] : '';
    if (!isset($_POST['solad_demo_login']) || basename(dirname($script)) !== G5_BBS_DIR || basename($script) !== 'login.php') {
        return;
    }

    $fail = '데모 관리자로 로그인할 수 없어요. 사이트 관리자에게 문의해 주세요.';
    $demo = solad_theme_demo_config();
    if (!$demo || $_SERVER['REQUEST_METHOD'] !== 'POST') {
        alert('데모 관리자 로그인을 쓸 수 없어요. 아이디로 로그인해 주세요.', G5_BBS_URL.'/login.php');
    }
    $link = solad_theme_demo_return_url(isset($_POST['url']) ? $_POST['url'] : '');

    // 이미 데모 관리자면 세션을 새로 만들지 않는다. 다른 계정으로 로그인한 사람은 그 계정을 말없이 끊지 않고 로그아웃을 먼저 하게 한다.
    if ($is_member) {
        if (solad_theme_is_demo_member()) {
            goto_url($link);
        }
        alert('이미 다른 계정으로 로그인되어 있어요. 로그아웃한 뒤 데모 관리자로 들어가 주세요.', G5_URL);
    }

    $saved = get_session('ss_solad_demo_token');
    $posted = isset($_POST['solad_demo_token']) ? (string) $_POST['solad_demo_token'] : '';
    if (!$saved || !$posted || !hash_equals($saved, $posted)) {
        alert('로그인 화면을 새로 고친 뒤 다시 눌러 주세요.');
    }

    $mb = get_member($demo['admin_id']);
    if (empty($mb['mb_id'])
        || strtolower($mb['mb_id']) === strtolower($config['cf_admin'])
        || (int) $mb['mb_level'] >= 10
        || $mb['mb_intercept_date']
        || $mb['mb_leave_date']
        || (is_use_email_certify() && !preg_match('/[1-9]/', $mb['mb_email_certify']))
        || !solad_theme_has_solad_auth($mb['mb_id'])) {
        alert($fail);
    }

    run_event('login_session_before', $mb, false);

    if (!(defined('SKIP_SESSION_REGENERATE_ID') && SKIP_SESSION_REGENERATE_ID)) {
        session_regenerate_id(false);
        if (function_exists('session_start_samesite')) {
            session_start_samesite();
        }
    }
    set_session('ss_solad_demo_token', '');
    set_session('ss_mb_id', $mb['mb_id']);
    generate_mb_key($mb);
    if (function_exists('update_auth_session_token')) {
        update_auth_session_token($mb['mb_datetime']);
    }
    set_cookie('ck_mb_id', '', 0);
    set_cookie('ck_auto', '', 0);

    // 최근 로그인 시각과 IP. 오늘 로그인으로 적혀 있으므로 common.php도 첫 로그인 포인트를 주지 않는다.
    sql_query(" update {$g5['member_table']} set mb_today_login = '".G5_TIME_YMDHIS."', mb_login_ip = '".sql_real_escape_string($_SERVER['REMOTE_ADDR'])."' where mb_id = '".sql_real_escape_string($mb['mb_id'])."' ");

    run_event('member_login_check', $mb, $link, false);
    goto_url($link);
}

// 데모 관리자의 그누보드 쓰기 요청인지. 로그아웃과 로그인(데모 로그인 포함)은 통과시킨다.
function solad_theme_demo_is_write_request()
{
    $method = isset($_SERVER['REQUEST_METHOD']) ? strtoupper($_SERVER['REQUEST_METHOD']) : 'GET';
    $script = isset($_SERVER['SCRIPT_NAME']) ? $_SERVER['SCRIPT_NAME'] : '';
    $name = basename($script);
    if (basename(dirname($script)) === G5_BBS_DIR && in_array($name, array('login.php', 'login_check.php', 'logout.php'), true)) {
        return false;
    }
    if ($method !== 'GET' && $method !== 'HEAD') {
        return true;
    }
    // GET으로 처리하는 쓰기: 글·댓글·쪽지·스크랩 삭제, 추천·비추천, 탈퇴, 관리자 일괄 처리
    return preg_match('/(update|delete|insert|cancel|upgrade|restore|optimize|backup|install|leave)/i', $name)
        || preg_match('/(^|_)(send|copy|move|reset|del)(_|\.php$)/i', $name)
        || (basename(dirname($script)) === G5_BBS_DIR && $name === 'good.php');
}

// 데모 관리자는 읽기 전용이다(common_header 이벤트). 글쓰기·댓글·회원정보·쪽지·스크랩·추천과 adm/ POST 같은 그누보드 쓰기를 막는다.
// 솔애드 관리 API(/ads)도 그누보드 common.php를 읽지만, 그쪽은 메뉴 권한(w)으로 직접 막으므로 건드리지 않는다.
function solad_theme_demo_guard()
{
    if (!solad_theme_is_demo_member() || class_exists('AdsManager\Config', false) || !solad_theme_demo_is_write_request()) {
        return;
    }

    $msg = '데모 관리자 계정은 읽기 전용입니다. 저장·삭제는 실행되지 않았어요.';
    $accept = isset($_SERVER['HTTP_ACCEPT']) ? $_SERVER['HTTP_ACCEPT'] : '';
    $type = isset($_SERVER['CONTENT_TYPE']) ? $_SERVER['CONTENT_TYPE'] : '';
    $xhr = isset($_SERVER['HTTP_X_REQUESTED_WITH']) && strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest';
    if ($xhr || stripos($accept, 'application/json') !== false || stripos($type, 'application/json') !== false) {
        header('HTTP/1.1 403 Forbidden');
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(array('error' => 'demo_readonly', 'message' => $msg), JSON_UNESCAPED_UNICODE);
        exit;
    }
    alert($msg);
}

}
