<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가
include_once($board_skin_path.'/solad.lib.php');

// HLS 묶음: 저장한 zip을 글 폴더에 풀어 wr_1에 재생 목록 경로를 넣고, zip 첨부는 지운다.
if ($wr_3 === 'hls_zip' && !empty($sv_hls_new)) {
    $sv_zip = sql_fetch(" select bf_file from {$g5['board_file_table']} where bo_table = '{$bo_table}' and wr_id = '{$wr_id}' and bf_no = 0 ");
    $sv_zip_path = empty($sv_zip['bf_file']) ? '' : G5_DATA_PATH.'/file/'.$bo_table.'/'.$sv_zip['bf_file'];
    $sv_scan = $sv_zip_path !== '' && is_file($sv_zip_path) ? solad_hls_zip_scan($sv_zip_path) : 'zip 파일을 저장하지 못했어요.';
    $sv_token = substr(md5(uniqid((string) mt_rand(), true)), 0, 12);
    $sv_dir = solad_hls_root($bo_table, $wr_id).'/'.$sv_token;

    if (is_array($sv_scan) && solad_hls_zip_extract($sv_zip_path, $sv_scan, $sv_dir)) {
        $sv_url = solad_hls_url($bo_table, $wr_id, $sv_token, $sv_scan['playlist']);
        $sv_seconds = solad_hls_duration($sv_dir, $sv_scan['playlist']);
        solad_hls_remove($bo_table, $wr_id, $sv_token);

        @unlink($sv_zip_path);
        sql_query(" delete from {$g5['board_file_table']} where bo_table = '{$bo_table}' and wr_id = '{$wr_id}' and bf_no = 0 ");
        $sv_count = sql_fetch(" select count(*) as cnt from {$g5['board_file_table']} where bo_table = '{$bo_table}' and wr_id = '{$wr_id}' ");
        sql_query(" update {$write_table}
                       set wr_1 = '".sql_real_escape_string($sv_url)."',
                           wr_2 = '".($sv_seconds > 0 ? $sv_seconds : sql_real_escape_string($wr_2))."',
                           wr_file = '".(int) $sv_count['cnt']."'
                     where wr_id = '{$wr_id}' ");
    } else {
        solad_hls_remove($bo_table, $wr_id);
        $file_upload_msg .= 'HLS 묶음을 풀지 못했어요. '.(is_array($sv_scan) ? '서버의 data 폴더 쓰기 권한을 확인해 주세요.' : $sv_scan).'\\n';
    }
} elseif ($wr_3 !== 'hls_zip') {
    solad_hls_remove($bo_table, $wr_id);
}
