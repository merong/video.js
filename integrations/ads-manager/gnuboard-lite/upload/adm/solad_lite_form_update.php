<?php
$sub_menu = '300960';
require_once './_common.php';

if (defined('SOLAD_LITE_MENU')) {
    $sub_menu = SOLAD_LITE_MENU;
}
if (!function_exists('solad_lite_config')) {
    alert('extend/solad_lite.extend.php 파일이 없습니다. 솔애드 라이트 설치 가이드를 확인해 주세요.');
}

check_demo();
auth_check_menu($auth, $sub_menu, 'w');

// post_max_size를 넘으면 PHP가 $_POST·$_FILES를 비워 토큰 오류로만 보인다. 원인을 알려 준다.
if (empty($_POST) && isset($_SERVER['CONTENT_LENGTH']) && (int) $_SERVER['CONTENT_LENGTH'] > 0) {
    alert('올린 파일이 서버 요청 한도(post_max_size '.ini_get('post_max_size').')보다 큽니다. 파일을 줄이거나 PHP 설정을 늘려 주세요.', './solad_lite_form.php');
}

check_admin_token();

solad_lite_install();
$sl_config = solad_lite_config(true);
$dir = solad_lite_data_path();
$back = './solad_lite_form.php';

if (!is_dir($dir)) {
    @mkdir($dir, G5_DIR_PERMISSION);
    @chmod($dir, G5_DIR_PERMISSION);
}
if (!is_dir($dir) || !is_writable($dir)) {
    alert(G5_DATA_DIR.'/solad_lite 폴더를 만들거나 쓸 수 없습니다. '.G5_DATA_DIR.' 폴더 권한(707)을 확인해 주세요.', $back);
}

// 플레이어
$player = !empty($_POST['sl_player']) ? 1 : 0;
$boards = array();
if (isset($_POST['sl_boards']) && is_array($_POST['sl_boards'])) {
    foreach ($_POST['sl_boards'] as $bo_table) {
        $bo_table = preg_replace('/[^a-z0-9_]/i', '', (string) $bo_table);
        if ($bo_table !== '' && sql_fetch(" SELECT bo_table FROM {$g5['board_table']} WHERE bo_table = '{$bo_table}' ")) {
            $boards[] = $bo_table;
        }
    }
}

// 광고 링크·설명
$link = isset($_POST['sl_ad_link']) ? trim((string) $_POST['sl_ad_link']) : '';
if ($link !== '' && (!preg_match('#^https?://#i', $link) || !filter_var($link, FILTER_VALIDATE_URL) || strlen($link) > 255)) {
    alert('광고 링크는 http:// 또는 https:// 로 시작하는 올바른 주소여야 합니다.', $back);
}
$alt = isset($_POST['sl_ad_alt']) ? trim(strip_tags((string) $_POST['sl_ad_alt'])) : '';
$alt = mb_substr(preg_replace('/[\x00-\x1F\x7F]/u', '', $alt), 0, 100);

// 광고 영상
$ad = array(
    'file' => $sl_config['sl_ad_file'],
    'mime' => $sl_config['sl_ad_mime'],
    'name' => $sl_config['sl_ad_name'],
    'size' => (int) $sl_config['sl_ad_size'],
);
$old_file = $ad['file'];

if (!empty($_POST['sl_ad_delete'])) {
    $ad = array('file' => '', 'mime' => '', 'name' => '', 'size' => 0);
}

$upload = isset($_FILES['sl_ad_file']) ? $_FILES['sl_ad_file'] : null;
if ($upload && $upload['error'] !== UPLOAD_ERR_NO_FILE) {
    if ($upload['error'] === UPLOAD_ERR_INI_SIZE || $upload['error'] === UPLOAD_ERR_FORM_SIZE) {
        alert('광고 영상이 서버 업로드 한도('.ini_get('upload_max_filesize').')보다 큽니다.', $back);
    }
    if ($upload['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($upload['tmp_name'])) {
        alert('광고 영상을 올리지 못했습니다. 다시 시도해 주세요.', $back);
    }
    $mime = solad_lite_video_type($upload['name'], $upload['tmp_name']);
    if (!$mime) {
        alert('광고 영상은 mp4 또는 webm 파일만 올릴 수 있습니다.', $back);
    }
    $ext = $mime === 'video/webm' ? 'webm' : 'mp4';
    $name = 'ad_'.date('YmdHis', G5_SERVER_TIME).'_'.bin2hex(random_bytes(4)).'.'.$ext;
    if (!move_uploaded_file($upload['tmp_name'], $dir.'/'.$name)) {
        alert('광고 영상을 저장하지 못했습니다. '.G5_DATA_DIR.'/solad_lite 폴더 권한을 확인해 주세요.', $back);
    }
    @chmod($dir.'/'.$name, G5_FILE_PERMISSION);
    $ad = array(
        'file' => $name,
        'mime' => $mime,
        'name' => mb_substr(strip_tags(basename((string) $upload['name'])), 0, 200),
        'size' => (int) $upload['size'],
    );
}

$ad_use = !empty($_POST['sl_ad_use']) ? 1 : 0;
if ($ad_use && $ad['file'] === '') {
    alert('광고를 켜려면 광고 영상을 올려 주세요.', $back);
}

sql_query(" UPDATE `{$g5['solad_lite_table']}` SET
    sl_player = '{$player}',
    sl_boards = '".sql_real_escape_string(implode(',', $boards))."',
    sl_ad_use = '{$ad_use}',
    sl_ad_file = '".sql_real_escape_string($ad['file'])."',
    sl_ad_mime = '".sql_real_escape_string($ad['mime'])."',
    sl_ad_name = '".sql_real_escape_string($ad['name'])."',
    sl_ad_size = '".(int) $ad['size']."',
    sl_ad_link = '".sql_real_escape_string($link)."',
    sl_ad_alt = '".sql_real_escape_string($alt)."',
    sl_version = sl_version + 1,
    sl_updated = '".G5_TIME_YMDHIS."'
    WHERE sl_id = 1 ");

// 바뀐 광고 영상이면 이전 파일을 지운다.
if ($old_file !== '' && $old_file !== $ad['file'] && preg_match('/^ad_[0-9a-z_]+\.(mp4|webm)$/', $old_file)) {
    @unlink($dir.'/'.$old_file);
}

if (!solad_lite_write_schedule(solad_lite_config(true))) {
    alert('설정은 저장했지만 광고 편성 파일('.G5_DATA_DIR.'/solad_lite/schedule.json)을 쓰지 못했습니다. 폴더 권한을 확인해 주세요.', $back);
}

goto_url($back);

// 올린 파일이 mp4·webm인지 확장자와 파일 앞부분으로 확인한다. fileinfo 확장이 없는 호스팅에서도 동작한다.
function solad_lite_video_type($name, $path)
{
    if (!preg_match('/\.(mp4|webm)$/i', (string) $name, $match)) {
        return null;
    }
    $head = (string) @file_get_contents($path, false, null, 0, 64);
    if (strtolower($match[1]) === 'mp4') {
        return substr($head, 4, 4) === 'ftyp' ? 'video/mp4' : null;
    }
    return substr($head, 0, 4) === "\x1A\x45\xDF\xA3" && strpos($head, 'webm') !== false ? 'video/webm' : null;
}
