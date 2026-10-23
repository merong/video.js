<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가
include_once($board_skin_path.'/request.lib.php');

// 처리 기록(댓글)의 여분필드는 스킨만 쓴다. wr_1 = 관리자가 바꾼 상태.
$sr_stage = '';
if ($w == 'c' && $is_admin && isset($_POST['sr_stage'])) {
    $sr_posted = trim(stripslashes($_POST['sr_stage']));
    if ($sr_posted !== '' && !solad_request_is_stage($sr_posted)) {
        alert('상태를 올바르게 골라 주세요.');
    }
    $sr_stage = $sr_posted;
}
if (($sr_stage === '보완 요청' || $sr_stage === '반려') && trim(strip_tags(stripslashes($wr_content))) === '') {
    alert($sr_stage.' 이유를 적어 주세요.');
}

// 기록을 고칠 때는 처음 남긴 상태를 그대로 둔다.
$wr_1 = $sr_stage;
if ($w == 'cu') {
    $sr_row = sql_fetch(" select wr_1 from {$write_table} where wr_id = '".(int) $comment_id."' and wr_is_comment = 1 ");
    $wr_1 = isset($sr_row['wr_1']) && solad_request_is_stage($sr_row['wr_1']) ? $sr_row['wr_1'] : '';
}
$wr_2 = $wr_3 = $wr_4 = $wr_5 = $wr_6 = $wr_7 = $wr_8 = $wr_9 = $wr_10 = '';
