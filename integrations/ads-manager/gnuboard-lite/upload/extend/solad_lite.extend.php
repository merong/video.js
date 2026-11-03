<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가

// 솔애드 라이트: 게시판 글의 동영상을 Video.js 플레이어로 바꾸고, 프리롤 광고 1개를 넣는다. 코어 파일은 고치지 않는다.
// - 관리자 > 게시판관리에 "솔애드 라이트 광고" 메뉴를 더한다(메뉴 코드 SOLAD_LITE_MENU, 관리권한설정에서 권한을 줄 수 있다).
// - 모든 사용자 페이지 끝(tail_sub)에 플레이어 스크립트를 넣는다. 스크립트는 바꿀 동영상이 있을 때만 Video.js를 읽는다.

if (!defined('SOLAD_LITE_MENU')) {
    define('SOLAD_LITE_MENU', '300960');
}
// 첨부 동영상 플레이어를 넣을 본문 영역. 기본 스킨과 대부분의 스킨은 #bo_v_con이다.
if (!defined('SOLAD_LITE_CONTENT_SELECTOR')) {
    define('SOLAD_LITE_CONTENT_SELECTOR', '#bo_v_con');
}

include_once G5_PLUGIN_PATH.'/solad_lite/solad_lite.lib.php';

add_replace('admin_menu', function ($menu) {
    if (isset($menu['menu300']) && is_array($menu['menu300'])) {
        $menu['menu300'][] = array(SOLAD_LITE_MENU, '솔애드 라이트 광고', G5_ADMIN_URL.'/solad_lite_form.php', 'solad_lite');
    }
    return $menu;
}, G5_HOOK_DEFAULT_PRIORITY, 1);

add_event('tail_sub', 'solad_lite_print_player', G5_HOOK_DEFAULT_PRIORITY);

function solad_lite_print_player()
{
    global $bo_table, $wr_id, $board;

    if (defined('G5_IS_ADMIN')) {
        return;
    }

    $sl_config = solad_lite_config();
    $page = array(
        'auto' => false,
        'selector' => SOLAD_LITE_CONTENT_SELECTOR,
        'videos' => array(),
        'schedule' => solad_lite_schedule_url($sl_config),
        'videoId' => SOLAD_LITE_VIDEO_ID,
    );

    // 글 보기 화면(bbs/board.php?bo_table=..&wr_id=..)이고 적용 게시판이면 첨부 동영상과 본문의 <video>를 바꾼다.
    // 읽기 권한이 없으면 그누보드가 이 화면을 그리기 전에 멈추므로 여기까지 오지 않는다.
    $is_view = basename($_SERVER['SCRIPT_NAME']) === 'board.php' && !empty($bo_table) && (int) $wr_id > 0;
    $skin = isset($board['bo_skin']) ? (string) $board['bo_skin'] : '';
    if ($is_view && strpos($skin, 'solad_video') === false && solad_lite_board_enabled($sl_config, $bo_table)) {
        $page['auto'] = true;
        $page['videos'] = solad_lite_post_videos($bo_table, $wr_id);
    }

    $base = solad_lite_plugin_url();
    $version = SOLAD_LITE_VERSION;
    $json = json_encode($page, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP);
    echo <<<HTML
<link rel="stylesheet" href="{$base}/solad-lite.css?v={$version}">
<script type="application/json" id="solad-lite-config">{$json}</script>
<script type="module" src="{$base}/solad-lite.js?v={$version}"></script>

HTML;
}
