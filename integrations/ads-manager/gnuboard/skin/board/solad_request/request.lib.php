<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가

/*
 * 솔애드 광고 요청 게시판 스킨 공용 함수.
 *
 * 게시판 설정(관리자 > 게시판관리 > 게시판 수정)
 * - 분류: 사용, 분류 목록은 SOLAD_REQUEST_STAGES와 같게 둔다. 분류가 곧 처리 상태다.
 * - 비밀글: "항상 비밀글"(2). 요청서에 업체 연락처가 들어간다.
 * - 파일 업로드 개수 1개 이상: 1번 칸은 광고 소재, 나머지는 참고 자료.
 * - 여분필드 제목 "솔애드 주소": 솔애드 관리자를 올린 경로. 비우면 사이트 주소 + /ads.
 *
 * 글 여분필드: wr_1 광고주, wr_2·wr_3 희망 시작일·종료일, wr_4 희망 위치, wr_5 희망 노출 수,
 * wr_6 클릭 URL, wr_7 소재 URL(파일 대신), wr_8 연락처, wr_9 희망 게시판(bo_table).
 * 댓글은 처리 기록이고, 관리자가 상태를 바꾼 댓글은 wr_1에 바꾼 상태를 남긴다.
 */

if (!function_exists('solad_request_stages')) {

define('SOLAD_REQUEST_STAGES', '접수|검토|보완 요청|집행 예정|집행|종료|반려');
define('SOLAD_REQUEST_MEDIA_EXTENSIONS', 'mp4|m4v|webm|jpg|jpeg|png|gif|webp');

// 상태 이름 => 솔애드 관리자와 같은 상태 색 이름.
function solad_request_stages()
{
    return array(
        '접수' => 'draft',
        '검토' => 'pending',
        '보완 요청' => 'paused',
        '집행 예정' => 'scheduled',
        '집행' => 'active',
        '종료' => 'done',
        '반려' => 'rejected',
    );
}

function solad_request_is_stage($value)
{
    return is_string($value) && array_key_exists($value, solad_request_stages());
}

// 집행 예정부터는 회원이 요청을 고치거나 지울 수 없다.
function solad_request_is_locked($stage)
{
    return in_array($stage, array('집행 예정', '집행', '종료', '반려'), true);
}

function solad_request_positions()
{
    return array('프리롤', '미드롤', '포스트롤');
}

function solad_request_attr($value)
{
    return htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8');
}

function solad_request_option($board, $subject)
{
    for ($i = 1; $i <= 10; $i++) {
        if (isset($board['bo_'.$i.'_subj']) && trim($board['bo_'.$i.'_subj']) === $subject) {
            return trim((string) $board['bo_'.$i]);
        }
    }
    return '';
}

function solad_request_is_http_url($value)
{
    return is_string($value) && preg_match('#^https?://[^\s"\'<>]+$#i', $value);
}

// 소재 주소는 http(s):// 주소나 /로 시작하는 경로.
function solad_request_is_media_url($value)
{
    return is_string($value) && preg_match('#^(https?://[^\s"\'<>]+|/[^\s"\'<>]*)$#i', $value);
}

function solad_request_is_date($value)
{
    if (!is_string($value) || !preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $value, $m)) {
        return false;
    }
    return checkdate((int) $m[2], (int) $m[3], (int) $m[1]);
}

// 'video', 'image' 또는 ''.
function solad_request_media_kind($name)
{
    $path = (string) parse_url((string) $name, PHP_URL_PATH);
    if (preg_match('/\.(mp4|m4v|webm)$/i', $path)) {
        return 'video';
    }
    if (preg_match('/\.(jpg|jpeg|png|gif|webp)$/i', $path)) {
        return 'image';
    }
    return '';
}

function solad_request_settings($board)
{
    $base = rtrim(solad_request_option($board, '솔애드 주소'), '/');

    return array(
        'base' => $base !== '' && solad_request_is_media_url($base) ? $base : G5_URL.'/ads',
        'base_valid' => $base === '' || solad_request_is_media_url($base),
    );
}

// 목록용 짧은 기간(10.01 – 10.15), 보기용 긴 기간(2026.10.01 – 2026.10.15).
function solad_request_period($start, $end, $long = false)
{
    if (!solad_request_is_date($start) || !solad_request_is_date($end)) {
        return '';
    }
    $format = $long ? 'Y.m.d' : 'm.d';
    $text = date($format, strtotime($start)).' – '.date($format, strtotime($end));
    if ($long) {
        $days = (int) round((strtotime($end) - strtotime($start)) / 86400) + 1;
        $text .= ' ('.$days.'일)';
    }
    return $text;
}

function solad_request_number($value)
{
    return is_numeric($value) && $value > 0 ? number_format((int) $value) : '';
}

// 비밀 요청은 관리자와 요청한 회원만 내용을 본다. 목록도 같은 규칙으로 가린다.
function solad_request_can_see($row, $member, $is_admin)
{
    if ($is_admin || !strstr($row['wr_option'], 'secret')) {
        return true;
    }
    return !empty($row['mb_id']) && !empty($member['mb_id']) && $row['mb_id'] === $member['mb_id'];
}

// get_file() 결과의 1번 칸(소재).
function solad_request_media_file($files)
{
    if (!is_array($files) || empty($files[0]['file'])) {
        return null;
    }
    $file = $files[0];
    $file['kind'] = solad_request_media_kind($file['source'] ? $file['source'] : $file['file']);
    $file['url'] = !empty($file['bf_fileurl']) ? $file['bf_fileurl'] : $file['path'].'/'.$file['file'];
    return $file;
}

// 희망 게시판 고르기: 이 게시판을 뺀 사이트 게시판.
function solad_request_boards($bo_table)
{
    global $g5;

    $boards = array();
    $result = sql_query(" select bo_table, bo_subject from {$g5['board_table']} where bo_table <> '".sql_real_escape_string($bo_table)."' order by gr_id, bo_order, bo_table ");
    while ($row = sql_fetch_array($result)) {
        $boards[$row['bo_table']] = $row['bo_subject'];
    }
    return $boards;
}

function solad_request_stage_badge($stage)
{
    $stages = solad_request_stages();
    $status = isset($stages[$stage]) ? $stages[$stage] : 'draft';
    return '<span class="sr-stage is-'.$status.'">'.solad_request_attr($stage !== '' ? $stage : '접수').'</span>';
}

}
