<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가

$theme_config = array(
    'set_default_skin' => false,
    'preview_board_skin' => 'basic',
    'preview_mobile_board_skin' => 'basic',
);

// 관리자 테마 화면은 이 파일을 여러 번 읽으므로 상수와 훅은 한 번만 만든다.
if (defined('SOLAD_THEME_BRAND')) {
    return;
}

// 솔애드 테마는 화면 폭에 맞춰 바뀌는 한 벌의 화면만 쓴다. 휴대폰에서도 같은 머리글·바닥글과 게시판 스킨이 나온다.
if (!defined('G5_THEME_DEVICE')) define('G5_THEME_DEVICE', 'pc');
if (!defined('G5_COMMUNITY_USE')) define('G5_COMMUNITY_USE', true);

// 머리글·바닥글에 나오는 사이트 이름
define('SOLAD_THEME_BRAND', '솔애드 비디오');
// 메인 페이지 영상: 동영상 게시판과 플레이어 데모로 열 글 번호. 글이 없거나 0이면 최근 영상을 연다.
define('SOLAD_THEME_VIDEO_BOARD', 'video');
define('SOLAD_THEME_DEMO_WR_ID', 14);
// 광고 요청 게시판
define('SOLAD_THEME_REQUEST_BOARD', 'ad_request');

// G5_THEME_DEVICE가 pc면 그누보드가 viewport를 넣지 않는다. 관리자 화면은 건드리지 않는다.
add_replace('html_process_add_meta', function ($meta) {
    if (defined('G5_IS_ADMIN')) {
        return $meta;
    }
    return $meta.'<meta name="viewport" content="width=device-width,initial-scale=1">'.PHP_EOL.'<meta name="theme-color" content="#0e0e10">';
}, 10, 1);

// 데모 관리자 로그인: 로그인 화면 아래 버튼과, 그 버튼이 bbs/login.php로 보낸 POST 처리.
// 솔애드 상수(extend/solad.extend.php)는 확장 파일을 읽은 뒤에 생기므로 common_header에서 처리한다.
include_once(G5_THEME_PATH.'/lib/theme.lib.php');
add_event('member_login_tail', 'solad_theme_demo_login_form', 10, 4);
add_event('common_header', 'solad_theme_demo_login_handle', 10, 0);
