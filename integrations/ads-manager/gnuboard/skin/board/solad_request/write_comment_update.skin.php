<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가

// 관리자가 상태를 골라 처리 기록을 남기면 요청의 분류(= 처리 상태)를 바꾼다.
// 그누보드처럼 딸린 댓글의 분류도 함께 바꿔야 분류 검색이 맞는다.
if ($w == 'c' && $is_admin && !empty($sr_stage)) {
    sql_query(" update {$write_table} set ca_name = '".sql_real_escape_string($sr_stage)."' where wr_parent = '".(int) $wr['wr_id']."' ");
    delete_cache_latest($bo_table);
}
