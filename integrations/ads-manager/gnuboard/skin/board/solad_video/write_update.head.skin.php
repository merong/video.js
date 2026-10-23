<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가
include_once($board_skin_path.'/solad.lib.php');

// 글 여분필드: wr_1 = 영상 주소, wr_2 = 재생 시간(초), wr_3 = 등록 형식. 댓글은 건드리지 않는다.
$sv_source = isset($_POST['sv_source']) ? (string) $_POST['sv_source'] : '';
if (!preg_match('/^('.SOLAD_VIDEO_SOURCES.')$/', $sv_source)) {
    $sv_source = $wr_1 === '' ? 'file' : (solad_video_is_hls($wr_1) ? 'hls_url' : 'url');
}
$wr_3 = $sv_source;
$wr_2 = is_numeric($wr_2) && $wr_2 > 0 && $wr_2 < 864000 ? (string) (int) round($wr_2) : '';

$sv_upload_name = '';
if (!empty($_FILES['bf_file']['name'][0]) && is_uploaded_file($_FILES['bf_file']['tmp_name'][0])) {
    $sv_upload_name = $_FILES['bf_file']['name'][0];
    // 게시판 용량을 넘는 파일은 그누보드가 말없이 건너뛰므로 먼저 알린다.
    if (!$is_admin && $board['bo_upload_size'] > 0 && $_FILES['bf_file']['size'][0] > $board['bo_upload_size']) {
        alert('영상 파일은 '.get_filesize($board['bo_upload_size']).' 이하만 올릴 수 있어요.');
    }
}
$sv_old = $w == 'u' ? sql_fetch(" select wr_1, wr_3 from {$write_table} where wr_id = '{$wr_id}' ") : array();
$sv_hls_new = false;

if ($sv_source === 'url' || $sv_source === 'hls_url') {
    $wr_1 = substr(trim($wr_1), 0, 1000);
    if ($wr_1 !== '' && !solad_video_is_url($wr_1)) {
        alert('영상 주소는 http(s):// 주소나 /로 시작하는 경로로 넣어 주세요.');
    }
    if ($wr_1 !== '' && $sv_source === 'hls_url' && !solad_video_is_hls($wr_1)) {
        alert('HLS 주소는 .m3u8 재생 목록 주소여야 해요.');
    }
    if ($wr_1 !== '' && $sv_source === 'url' && solad_video_is_hls($wr_1)) {
        alert('.m3u8 주소는 등록 형식을 "HLS 주소"로 골라 주세요.');
    }
    $sv_has_video = $wr_1 !== '';
} elseif ($sv_source === 'hls_zip') {
    if ($sv_upload_name !== '') {
        if (!preg_match('/\.zip$/i', $sv_upload_name)) {
            alert('HLS 묶음은 재생 목록(.m3u8)과 조각 파일을 담은 zip 파일로 올려 주세요.');
        }
        $sv_scan = solad_hls_zip_scan($_FILES['bf_file']['tmp_name'][0]);
        if (!is_array($sv_scan)) {
            alert($sv_scan);
        }
        $sv_hls_new = true;
        $wr_1 = '';
    } elseif (isset($sv_old['wr_3']) && $sv_old['wr_3'] === 'hls_zip' && $sv_old['wr_1'] !== '') {
        // 새 묶음을 올리지 않으면 이미 풀어 둔 재생 목록을 그대로 쓴다.
        $wr_1 = sql_real_escape_string($sv_old['wr_1']);
    } else {
        $wr_1 = '';
    }
    $sv_has_video = $sv_hls_new || $wr_1 !== '';
} else {
    $wr_1 = '';
    $sv_has_video = false;
    if ($sv_upload_name !== '') {
        if (!preg_match('/\.('.SOLAD_VIDEO_EXTENSIONS.')$/i', $sv_upload_name)) {
            alert('영상 파일은 MP4·WebM만 올릴 수 있어요.');
        }
        $sv_has_video = true;
    } elseif ($w == 'u' && empty($_POST['bf_file_del'][0])) {
        $sv_row = sql_fetch(" select bf_source from {$g5['board_file_table']} where bo_table = '{$bo_table}' and wr_id = '{$wr_id}' and bf_no = 0 ");
        $sv_has_video = !empty($sv_row['bf_source']) && preg_match('/\.('.SOLAD_VIDEO_EXTENSIONS.')$/i', $sv_row['bf_source']);
    }
}

// 공지는 영상 없이 올릴 수 있다.
if (!$sv_has_video && empty($notice)) {
    alert('영상 파일이나 영상 주소를 넣어 주세요.');
}
