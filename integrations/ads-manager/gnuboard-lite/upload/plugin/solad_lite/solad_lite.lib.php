<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가

// 솔애드 라이트: 설정(한 줄짜리 테이블), 광고 파일, 플레이어가 읽는 광고 편성(schedule.json)을 다룬다.
// 광고는 프리롤 1개, 5초 뒤 건너뛰기로 고정이다.

define('SOLAD_LITE_VERSION', '1.0.0');
define('SOLAD_LITE_SKIP_SECONDS', 5);
// 모든 플레이어가 같은 광고 편성을 쓰므로 영상 ID도 하나다. ads.js는 편성의 videoId와 이 값이 같아야 광고를 튼다.
define('SOLAD_LITE_VIDEO_ID', 'solad-lite');

$g5['solad_lite_table'] = G5_TABLE_PREFIX.'solad_lite';

function solad_lite_data_path()
{
    return G5_DATA_PATH.'/solad_lite';
}

// 광고 영상과 편성 파일의 주소. 플레이어는 같은 사이트의 절대 경로(/data/...)를 받으므로 도메인을 뺀다.
function solad_lite_data_url()
{
    $path = parse_url(G5_DATA_URL, PHP_URL_PATH);
    return rtrim($path ? $path : '/'.G5_DATA_DIR, '/').'/solad_lite';
}

function solad_lite_plugin_url()
{
    $path = parse_url(G5_PLUGIN_URL, PHP_URL_PATH);
    return rtrim($path ? $path : '/'.G5_PLUGIN_DIR, '/').'/solad_lite';
}

function solad_lite_defaults()
{
    return array(
        'sl_player' => 1,
        'sl_boards' => '',
        'sl_ad_use' => 0,
        'sl_ad_file' => '',
        'sl_ad_mime' => '',
        'sl_ad_name' => '',
        'sl_ad_size' => 0,
        'sl_ad_link' => '',
        'sl_ad_alt' => '',
        'sl_version' => 0,
        'sl_updated' => '',
    );
}

// 테이블이 없으면 만들고 기본값 한 줄을 넣는다. 관리자 설정 화면을 처음 열 때 부른다.
function solad_lite_install()
{
    global $g5;

    $table = $g5['solad_lite_table'];
    if (!sql_query(" DESCRIBE `{$table}` ", false)) {
        sql_query(" CREATE TABLE IF NOT EXISTS `{$table}` (
            `sl_id` TINYINT NOT NULL DEFAULT '1',
            `sl_player` TINYINT NOT NULL DEFAULT '1',
            `sl_boards` TEXT NOT NULL,
            `sl_ad_use` TINYINT NOT NULL DEFAULT '0',
            `sl_ad_file` VARCHAR(255) NOT NULL DEFAULT '',
            `sl_ad_mime` VARCHAR(20) NOT NULL DEFAULT '',
            `sl_ad_name` VARCHAR(255) NOT NULL DEFAULT '',
            `sl_ad_size` INT NOT NULL DEFAULT '0',
            `sl_ad_link` VARCHAR(255) NOT NULL DEFAULT '',
            `sl_ad_alt` VARCHAR(255) NOT NULL DEFAULT '',
            `sl_version` INT NOT NULL DEFAULT '0',
            `sl_updated` DATETIME NULL DEFAULT NULL,
            PRIMARY KEY (`sl_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 ", true);
    }
    $row = sql_fetch(" SELECT sl_id FROM `{$table}` WHERE sl_id = 1 ", false);
    if (!$row) {
        sql_query(" INSERT INTO `{$table}` SET sl_id = 1, sl_boards = '', sl_updated = '".G5_TIME_YMDHIS."' ", true);
    }
}

// 저장된 설정. 테이블이 아직 없으면(설정 화면을 열기 전) 기본값으로 플레이어만 켜진다.
function solad_lite_config($refresh = false)
{
    global $g5;
    static $config = null;

    if ($config === null || $refresh) {
        $row = sql_fetch(" SELECT * FROM `{$g5['solad_lite_table']}` WHERE sl_id = 1 ", false);
        $config = array_merge(solad_lite_defaults(), is_array($row) ? $row : array());
    }
    return $config;
}

// 적용할 게시판 목록. 비어 있으면 모든 게시판이다.
function solad_lite_board_list($config)
{
    $boards = array();
    foreach (explode(',', (string) $config['sl_boards']) as $bo_table) {
        $bo_table = preg_replace('/[^a-z0-9_]/i', '', trim($bo_table));
        if ($bo_table !== '') {
            $boards[] = $bo_table;
        }
    }
    return $boards;
}

function solad_lite_board_enabled($config, $bo_table)
{
    if (!$config['sl_player']) {
        return false;
    }
    $boards = solad_lite_board_list($config);
    return !$boards || in_array($bo_table, $boards, true);
}

function solad_lite_ad_ready($config)
{
    return $config['sl_ad_use'] && $config['sl_ad_file'] !== '' && is_file(solad_lite_data_path().'/'.$config['sl_ad_file']);
}

// 플레이어가 읽는 광고 편성 주소. 광고가 꺼져 있으면 null이고, 플레이어는 광고 없이 본편만 튼다.
function solad_lite_schedule_url($config)
{
    if (!solad_lite_ad_ready($config) || !is_file(solad_lite_data_path().'/schedule.json')) {
        return null;
    }
    return solad_lite_data_url().'/schedule.json?v='.(int) $config['sl_version'];
}

// 동영상으로 재생할 첨부 파일인지. 확장자만 본다(업로드할 때 그누보드가 이미 파일을 검사한다).
function solad_lite_is_video_name($name)
{
    return (bool) preg_match('/\.(mp4|webm)$/i', (string) $name);
}

// 글에 첨부된 mp4·webm 파일. 다운로드 포인트를 쓰지 않고 data/file의 주소로 바로 재생한다.
function solad_lite_post_videos($bo_table, $wr_id)
{
    global $g5;

    $videos = array();
    $bo_table = preg_replace('/[^a-z0-9_]/i', '', $bo_table);
    $wr_id = (int) $wr_id;
    if ($bo_table === '' || $wr_id < 1) {
        return $videos;
    }
    $result = sql_query(" SELECT bf_no, bf_source, bf_file FROM {$g5['board_file_table']}
        WHERE bo_table = '{$bo_table}' AND wr_id = '{$wr_id}' AND bf_file <> '' ORDER BY bf_no ", false);
    if (!$result) {
        return $videos;
    }
    $base = parse_url(G5_DATA_URL, PHP_URL_PATH);
    $base = rtrim($base ? $base : '/'.G5_DATA_DIR, '/');
    while ($row = sql_fetch_array($result)) {
        if (!solad_lite_is_video_name($row['bf_source']) || !solad_lite_is_video_name($row['bf_file'])) {
            continue;
        }
        $videos[] = array(
            'src' => $base.'/file/'.$bo_table.'/'.rawurlencode($row['bf_file']),
            'title' => get_text($row['bf_source']),
        );
    }
    return $videos;
}

// ads.js가 읽는 광고 편성(contract/playback-v1.json의 schedule)을 data/solad_lite/schedule.json으로 쓴다.
// 광고가 꺼져 있으면 파일을 지운다.
function solad_lite_write_schedule($config)
{
    $file = solad_lite_data_path().'/schedule.json';
    if (!solad_lite_ad_ready($config)) {
        if (is_file($file)) {
            @unlink($file);
        }
        return true;
    }

    $version = max(1, (int) $config['sl_version']);
    $schedule = array(
        'schemaVersion' => 1,
        'siteId' => 'solad-lite',
        'videoId' => SOLAD_LITE_VIDEO_ID,
        'boardId' => null,
        'categoryId' => null,
        'scheduleId' => 'solad-lite',
        'scheduleVersion' => $version,
        'breaks' => array(array(
            'breakId' => 'pre',
            'position' => 'pre',
            'ads' => array(array(
                'itemId' => 'ad-'.$version,
                'adId' => 'ad',
                'creativeId' => 'ad',
                'creativeVersion' => $version,
                'kind' => 'video',
                'mime' => $config['sl_ad_mime'],
                'url' => solad_lite_data_url().'/'.$config['sl_ad_file'],
                'alt' => (string) $config['sl_ad_alt'],
                'clickUrl' => $config['sl_ad_link'] !== '' ? $config['sl_ad_link'] : null,
                'skipAfterSeconds' => SOLAD_LITE_SKIP_SECONDS,
            )),
        )),
    );
    $json = json_encode($schedule, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    return $json !== false && @file_put_contents($file, $json, LOCK_EX) !== false;
}

// 다른 스킨이나 페이지에 플레이어를 직접 넣을 때 쓰는 자리 표시. solad-lite.js가 이 div를 플레이어로 바꾼다.
//   echo solad_lite_player('/data/file/free/movie.mp4', array('poster' => '/data/file/free/cover.jpg'));
function solad_lite_player($src, $options = array())
{
    $attrs = ' data-solad-lite data-src="'.htmlspecialchars((string) $src, ENT_QUOTES).'"';
    foreach (array('poster', 'title') as $key) {
        if (!empty($options[$key])) {
            $attrs .= ' data-'.$key.'="'.htmlspecialchars((string) $options[$key], ENT_QUOTES).'"';
        }
    }
    if (isset($options['ads']) && !$options['ads']) {
        $attrs .= ' data-ads="off"';
    }
    return '<div class="solad-lite"'.$attrs.'></div>';
}
