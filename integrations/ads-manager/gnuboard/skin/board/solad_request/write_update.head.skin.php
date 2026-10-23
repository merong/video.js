<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가
include_once($board_skin_path.'/request.lib.php');

// 처리 상태(분류)는 회원이 고르지 않는다. 새 요청은 접수, 고칠 때는 지금 상태를 그대로 둔다.
$sr_before = ($w == 'u' && !empty($wr['wr_id'])) ? $wr['ca_name'] : '';
if ($w == 'u' && !$is_admin && solad_request_is_locked($sr_before)) {
    alert($sr_before.' 상태의 요청은 고칠 수 없어요. 바꿀 내용은 처리 기록에 남겨 주세요.');
}
if ($board['bo_use_category']) {
    $ca_name = $w == 'u' && solad_request_is_stage($sr_before) ? $sr_before : '접수';
}

// 관리자 공지(안내 글)는 요청서 항목 없이 올린다.
if ($is_admin && !empty($notice)) {
    $wr_1 = $wr_2 = $wr_3 = $wr_4 = $wr_5 = $wr_6 = $wr_7 = $wr_8 = $wr_9 = $wr_10 = '';
    return;
}

// $wr_1~$wr_10은 그누보드가 이미 SQL용으로 이스케이프한 값이다. 검사는 원래 값으로 한다.
$sr = array();
for ($i = 1; $i <= 9; $i++) {
    $sr[$i] = trim(stripslashes(${'wr_'.$i}));
}

if ($sr[1] === '' || mb_strlen($sr[1], 'UTF-8') > 100) {
    alert('광고주(업체명)를 100자 안으로 적어 주세요.');
}
if (!solad_request_is_date($sr[2]) || !solad_request_is_date($sr[3])) {
    alert('희망 시작일과 종료일을 골라 주세요.');
}
if ($sr[3] < $sr[2]) {
    alert('희망 종료일은 시작일과 같거나 뒤여야 해요.');
}
if (!in_array($sr[4], solad_request_positions(), true)) {
    alert('희망 위치를 골라 주세요.');
}
$sr[5] = str_replace(',', '', $sr[5]);
if (!preg_match('/^[1-9][0-9]{0,9}$/', $sr[5])) {
    alert('희망 노출 수를 숫자로 적어 주세요.');
}
if ($sr[6] !== '' && (!solad_request_is_http_url($sr[6]) || strlen($sr[6]) > 1000)) {
    alert('클릭 URL은 http:// 나 https:// 로 시작하는 주소로 넣어 주세요.');
}
if ($sr[7] !== '' && (!solad_request_is_media_url($sr[7]) || strlen($sr[7]) > 1000)) {
    alert('소재 주소는 http(s):// 주소나 /로 시작하는 경로로 넣어 주세요.');
}
if ($sr[8] === '' || mb_strlen($sr[8], 'UTF-8') > 60) {
    alert('연락받을 전화번호나 이메일을 60자 안으로 적어 주세요.');
}
if ($sr[9] !== '') {
    $sr_board = preg_match('/^[a-z0-9_]{1,20}$/i', $sr[9]) ? sql_fetch(" select bo_table from {$g5['board_table']} where bo_table = '{$sr[9]}' ") : null;
    if (empty($sr_board['bo_table'])) {
        alert('희망 게시판을 목록에서 골라 주세요.');
    }
}

// 소재는 주소나 첨부 1번 칸 중 하나가 있어야 한다.
$sr_has_media = $sr[7] !== '';
if (!$sr_has_media && !empty($_FILES['bf_file']['name'][0])) {
    if (!preg_match('/\.('.SOLAD_REQUEST_MEDIA_EXTENSIONS.')$/i', $_FILES['bf_file']['name'][0])) {
        alert('소재 칸에는 MP4·WebM 영상이나 JPG·PNG·GIF·WebP 이미지만 올릴 수 있어요.');
    }
    $sr_has_media = true;
}
if (!$sr_has_media && $w == 'u' && empty($_POST['bf_file_del'][0])) {
    $sr_row = sql_fetch(" select bf_source from {$g5['board_file_table']} where bo_table = '{$bo_table}' and wr_id = '{$wr_id}' and bf_no = 0 ");
    $sr_has_media = !empty($sr_row['bf_source']);
}
if (!$sr_has_media) {
    alert('광고 소재 파일을 올리거나 소재 주소를 넣어 주세요.');
}

$wr_1 = addslashes(strip_tags($sr[1]));
$wr_2 = $sr[2];
$wr_3 = $sr[3];
$wr_4 = $sr[4];
$wr_5 = $sr[5];
$wr_6 = addslashes($sr[6]);
$wr_7 = addslashes($sr[7]);
$wr_8 = addslashes(strip_tags($sr[8]));
$wr_9 = $sr[9];
$wr_10 = '';
