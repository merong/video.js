<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가

/*
 * 솔애드 동영상 갤러리 스킨 공용 함수.
 *
 * 게시판 설정(관리자 > 게시판관리 > 게시판 수정)에서 읽는 값
 * - 여분필드 제목 "솔애드 주소": 솔애드 관리자를 올린 경로. 비우면 사이트 주소 + /ads.
 * - 플레이어 모양과 옵션은 솔애드 관리자 > 플레이어의 사이트 플레이어 설정을 따른다.
 * - 갤러리 썸네일 폭·높이, 갤러리 이미지 수, 파일 업로드 개수·용량은 그누보드 기본 항목을 그대로 쓴다.
 *
 * 글 여분필드: wr_1 = 영상 주소, wr_2 = 재생 시간(초), wr_3 = 등록 형식.
 * 등록 형식
 * - file: 첨부 1번 칸의 MP4·WebM 파일
 * - hls_zip: 첨부 1번 칸에 올린 HLS 묶음(zip). 저장할 때 data/file/<게시판>/hls/<글번호>/ 아래에 풀고 wr_1에 재생 목록 경로를 넣는다.
 * - hls_url: 외부 HLS 재생 목록(.m3u8) 주소
 * - url: 외부 MP4·WebM 주소
 */

if (!function_exists('solad_video_option')) {

define('SOLAD_VIDEO_EXTENSIONS', 'mp4|m4v|webm');
define('SOLAD_IMAGE_EXTENSIONS', 'jpg|jpeg|png|gif|webp');
define('SOLAD_VIDEO_SOURCES', 'file|hls_zip|hls_url|url');
define('SOLAD_HLS_EXTENSIONS', 'm3u8|ts|m4s|mp4|m4a|aac|vtt|key');
define('SOLAD_HLS_MAX_FILES', 5000);

function solad_attr($value)
{
    return htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8');
}

// 여분필드 제목으로 값을 찾는다. 칸 번호는 사이트마다 다를 수 있다.
function solad_video_option($board, $subject)
{
    for ($i = 1; $i <= 10; $i++) {
        if (isset($board['bo_'.$i.'_subj']) && trim($board['bo_'.$i.'_subj']) === $subject) {
            return trim((string) $board['bo_'.$i]);
        }
    }
    return '';
}

// 플레이어가 받는 주소: http(s):// 주소나 /로 시작하는 경로.
function solad_video_is_url($value)
{
    return is_string($value) && preg_match('#^(https?://[^\s"\'<>]+|/[^\s"\'<>]*)$#i', $value);
}

function solad_video_is_hls($url)
{
    $path = parse_url((string) $url, PHP_URL_PATH);
    return is_string($path) && preg_match('/\.m3u8$/i', $path);
}

function solad_video_settings($board)
{
    $base = rtrim(solad_video_option($board, '솔애드 주소'), '/');

    return array(
        'base' => $base !== '' && solad_video_is_url($base) ? $base : G5_URL.'/ads',
        'base_valid' => $base === '' || solad_video_is_url($base),
    );
}

function solad_video_file_url($file)
{
    if (!empty($file['bf_fileurl'])) {
        return $file['bf_fileurl'];
    }
    return $file['path'].'/'.$file['file'];
}

// get_file() 결과에서 확장자가 맞는 첫 첨부를 고른다. 첨부 칸 순서에 기대지 않는다.
function solad_video_pick_file($files, $extensions)
{
    if (!is_array($files)) {
        return null;
    }
    foreach ($files as $key => $file) {
        if ($key === 'count' || !is_array($file) || empty($file['file'])) {
            continue;
        }
        if (preg_match('/\.('.$extensions.')$/i', $file['source'] ? $file['source'] : $file['file'])) {
            return $file + array('no' => $key);
        }
    }
    return null;
}

// 등록 형식을 저장하기 전에 올린 글은 주소로 형식을 짐작한다.
function solad_video_source_type($write)
{
    $type = isset($write['wr_3']) ? trim($write['wr_3']) : '';
    if (preg_match('/^('.SOLAD_VIDEO_SOURCES.')$/', $type)) {
        return $type;
    }
    $url = isset($write['wr_1']) ? trim($write['wr_1']) : '';
    if ($url === '') {
        return 'file';
    }
    return solad_video_is_hls($url) ? 'hls_url' : 'url';
}

function solad_video_source($write, $files)
{
    if (solad_video_source_type($write) !== 'file') {
        $url = isset($write['wr_1']) ? trim($write['wr_1']) : '';
        return solad_video_is_url($url) ? $url : '';
    }
    $file = solad_video_pick_file($files, SOLAD_VIDEO_EXTENSIONS);
    return $file ? solad_video_file_url($file) : '';
}

// HLS는 미디어 재생 목록과 마스터 재생 목록을 모두 재생하는 hls.js 엔진으로 연다.
function solad_video_engine($src)
{
    return solad_video_is_hls($src) ? 'hlsjs' : '';
}

function solad_video_duration($seconds)
{
    $seconds = (int) round((float) $seconds);
    if ($seconds <= 0) {
        return '';
    }
    $h = (int) floor($seconds / 3600);
    $m = (int) floor(($seconds % 3600) / 60);
    $s = $seconds % 60;
    return $h ? sprintf('%d:%02d:%02d', $h, $m, $s) : sprintf('%d:%02d', $m, $s);
}

// 조회수처럼 큰 수를 1.2천, 3.4만처럼 줄인다. 소수점 아래는 버린다.
function solad_video_count($number)
{
    $number = max(0, (int) $number);
    if ($number < 1000) {
        return (string) $number;
    }
    if ($number < 10000) {
        $value = floor($number / 100) / 10;
        $unit = '천';
    } elseif ($number < 100000) {
        $value = floor($number / 1000) / 10;
        $unit = '만';
    } elseif ($number < 100000000) {
        $value = floor($number / 10000);
        $unit = '만';
    } else {
        $value = floor($number / 10000000) / 10;
        $unit = '억';
    }
    return rtrim(rtrim(number_format($value, 1, '.', ','), '0'), '.').$unit;
}

function solad_video_ago($datetime)
{
    $diff = G5_SERVER_TIME - strtotime($datetime);
    if ($diff < 60) {
        return '방금 전';
    }
    $units = array(31536000 => '년', 2592000 => '개월', 604800 => '주', 86400 => '일', 3600 => '시간', 60 => '분');
    foreach ($units as $seconds => $label) {
        if ($diff >= $seconds) {
            return floor($diff / $seconds).$label.' 전';
        }
    }
    return '';
}

// 그누보드 게시판:글번호:main 형식. 솔애드 지면 편성의 게시판·분류·영상 대상과 맞물린다.
function solad_video_id($bo_table, $wr_id)
{
    return $bo_table.':'.(int) $wr_id.':main';
}

// 보기 화면의 다음 영상: 목록에서 이 글 다음(더 오래된) 글부터, 끝나면 최신 글로 돌아간다. 비밀글은 뺀다.
function solad_video_next_list($bo_table, $write_table, $view, $limit)
{
    $current = (int) $view['wr_num'];
    $result = sql_query(" select wr_id, wr_num, wr_subject, wr_name, mb_id, wr_hit, wr_datetime, wr_option, wr_1, wr_2, wr_3, ca_name
                            from {$write_table}
                           where wr_is_comment = 0 and wr_id <> '".(int) $view['wr_id']."' and wr_option not like '%secret%'
                           order by (wr_num < {$current}), wr_num, wr_reply
                           limit ".(int) $limit);
    $rows = array();
    while ($row = sql_fetch_array($result)) {
        $row['href'] = get_pretty_url($bo_table, $row['wr_id']);
        $rows[] = $row;
    }
    return $rows;
}

// 프로필 사진이 있으면 사진, 없으면 이름 첫 글자. 색은 이름으로 정해서 같은 사람은 늘 같은 색이다.
function solad_video_avatar($mb_id, $name)
{
    if ($mb_id) {
        $file = G5_DATA_PATH.'/member_image/'.substr($mb_id, 0, 2).'/'.get_mb_icon_name($mb_id).'.gif';
        if (is_file($file)) {
            return '<img src="'.solad_attr(str_replace(G5_DATA_PATH, G5_DATA_URL, $file)).'" alt="">';
        }
    }
    $name = trim(strip_tags((string) $name));
    $letter = $name === '' ? '?' : mb_substr($name, 0, 1, 'UTF-8');
    return '<span class="sv-avatar-letter" style="--sv-hue:'.(crc32($name) % 360).'">'.solad_attr($letter).'</span>';
}

// 목록 카드에 마우스를 올렸을 때 재생할 MP4·WebM 주소. 쪽마다 첨부를 한 번에 읽는다. HLS는 미리보기를 하지 않는다.
function solad_video_previews($bo_table, $list)
{
    global $g5;

    $previews = array();
    $ids = array();
    foreach ($list as $row) {
        if (!empty($row['is_notice']) || strstr($row['wr_option'], 'secret')) {
            continue;
        }
        $type = solad_video_source_type($row);
        if ($type === 'url' && solad_video_is_url(trim($row['wr_1']))) {
            $previews[$row['wr_id']] = trim($row['wr_1']);
        } elseif ($type === 'file') {
            $ids[] = (int) $row['wr_id'];
        }
    }
    if (!$ids) {
        return $previews;
    }

    $result = sql_query(" select wr_id, bf_file, bf_source, bf_fileurl from {$g5['board_file_table']}
                           where bo_table = '{$bo_table}' and wr_id in (".implode(',', $ids).") and bf_file <> ''
                           order by wr_id, bf_no ");
    while ($file = sql_fetch_array($result)) {
        if (isset($previews[$file['wr_id']]) || !preg_match('/\.('.SOLAD_VIDEO_EXTENSIONS.')$/i', $file['bf_source'] ? $file['bf_source'] : $file['bf_file'])) {
            continue;
        }
        $previews[$file['wr_id']] = $file['bf_fileurl'] ? $file['bf_fileurl'] : G5_DATA_URL.'/file/'.$bo_table.'/'.$file['bf_file'];
    }
    return $previews;
}

// 본문 앞부분을 한 줄 소개로 쓴다. 결과는 HTML에 바로 넣을 수 있게 이스케이프돼 있다.
function solad_video_excerpt($content, $length)
{
    $text = html_entity_decode(strip_tags(str_replace(array('<br>', '<br/>', '<br />', '</p>'), ' ', (string) $content)), ENT_QUOTES, 'UTF-8');
    return solad_attr(cut_str(trim(preg_replace('/\s+/u', ' ', $text)), $length));
}

/*
 * HLS 묶음(zip)
 * 재생 목록과 조각 파일만 받는다. 폴더를 벗어나는 경로, 다른 형식의 파일, 풀면 지나치게 커지는 묶음은 거절한다.
 * 폴더와 __MACOSX, 점으로 시작하는 숨김 파일은 건너뛴다.
 */

function solad_hls_root($bo_table, $wr_id)
{
    return G5_DATA_PATH.'/file/'.$bo_table.'/hls/'.(int) $wr_id;
}

function solad_hls_url($bo_table, $wr_id, $token, $playlist)
{
    $data_path = rtrim((string) parse_url(G5_DATA_URL, PHP_URL_PATH), '/');
    return $data_path.'/file/'.$bo_table.'/hls/'.(int) $wr_id.'/'.$token.'/'.implode('/', array_map('rawurlencode', explode('/', $playlist)));
}

// 성공하면 array('entries' => [...], 'playlist' => 재생 목록 경로), 실패하면 사람이 읽을 오류 문장을 돌려준다.
function solad_hls_zip_scan($zip_path)
{
    if (!class_exists('ZipArchive')) {
        return '이 서버는 zip 파일을 풀 수 없어요(ZipArchive 없음). 다른 등록 형식을 골라 주세요.';
    }
    $zip = new ZipArchive();
    if ($zip->open($zip_path) !== true) {
        return 'zip 파일을 열 수 없어요.';
    }

    $limit = filesize($zip_path) * 3 + 50 * 1024 * 1024;
    $total = 0;
    $entries = array();
    $playlists = array();
    $error = '';
    for ($i = 0; $i < $zip->numFiles && $error === ''; $i++) {
        $stat = $zip->statIndex($i);
        $name = str_replace('\\', '/', $stat['name']);
        if (substr($name, -1) === '/' || preg_match('#(^|/)(__MACOSX/|\.)#', $name)) {
            continue;
        }
        if (preg_match('#(^/|(^|/)\.\.(/|$)|//|[\x00-\x1f\x7f])#', $name) || substr_count($name, '/') > 4 || strlen($name) > 200) {
            $error = 'zip 안의 경로를 쓸 수 없어요: '.$name;
        } elseif (!preg_match('/\.('.SOLAD_HLS_EXTENSIONS.')$/i', $name)) {
            $error = 'HLS 묶음에는 m3u8, ts, m4s, mp4, m4a, aac, vtt, key 파일만 넣을 수 있어요: '.$name;
        } elseif (count($entries) >= SOLAD_HLS_MAX_FILES) {
            $error = 'HLS 묶음의 파일이 너무 많아요. '.number_format(SOLAD_HLS_MAX_FILES).'개까지 올릴 수 있어요.';
        } elseif (($total += $stat['size']) > $limit) {
            $error = '압축을 풀면 너무 커지는 zip 파일이에요.';
        } else {
            $entries[] = array('name' => $name, 'size' => (int) $stat['size']);
            if (preg_match('/\.m3u8$/i', $name)) {
                $playlists[] = $name;
            }
        }
    }
    if ($error === '' && !$playlists) {
        $error = 'zip 안에 .m3u8 재생 목록이 없어요.';
    }
    if ($error !== '') {
        $zip->close();
        return $error;
    }

    // 가장 얕은 위치의 재생 목록 가운데 마스터 재생 목록을 먼저 고른다.
    usort($playlists, function ($a, $b) {
        $depth = substr_count($a, '/') - substr_count($b, '/');
        return $depth ? $depth : strcmp($a, $b);
    });
    $playlist = $playlists[0];
    foreach ($playlists as $name) {
        if (substr_count($name, '/') !== substr_count($playlists[0], '/')) {
            break;
        }
        if (strpos((string) $zip->getFromName($name), '#EXT-X-STREAM-INF') !== false) {
            $playlist = $name;
            break;
        }
    }
    $head = (string) $zip->getFromName($playlist, 16);
    $zip->close();
    if (strpos(ltrim($head, "\xEF\xBB\xBF"), '#EXTM3U') !== 0) {
        return $playlist.' 파일이 HLS 재생 목록 형식이 아니에요.';
    }

    return array('entries' => $entries, 'playlist' => $playlist);
}

function solad_hls_zip_extract($zip_path, $scan, $dir)
{
    $zip = new ZipArchive();
    if ($zip->open($zip_path) !== true) {
        return false;
    }
    foreach ($scan['entries'] as $entry) {
        $target = $dir.'/'.$entry['name'];
        if (!is_dir(dirname($target)) && !@mkdir(dirname($target), G5_DIR_PERMISSION, true)) {
            $zip->close();
            return false;
        }
        $in = $zip->getStream($entry['name']);
        $out = $in ? fopen($target, 'wb') : false;
        if (!$out) {
            $zip->close();
            return false;
        }
        // 목록에 적힌 크기보다 더 풀리지 않게 자른다.
        stream_copy_to_stream($in, $out, $entry['size']);
        fclose($in);
        fclose($out);
        @chmod($target, G5_FILE_PERMISSION);
    }
    $zip->close();
    return true;
}

// 재생 목록의 #EXTINF 길이를 더한다. 마스터 재생 목록이면 첫 화질의 재생 목록을 읽는다.
function solad_hls_duration($dir, $playlist, $depth = 0)
{
    $text = (string) @file_get_contents($dir.'/'.$playlist, false, null, 0, 4 * 1024 * 1024);
    if ($depth === 0 && preg_match('/#EXT-X-STREAM-INF[^\n]*\n\s*([^\s#][^\r\n]*)/', $text, $match)) {
        $variant = trim($match[1]);
        $path = (strpos($playlist, '/') !== false ? dirname($playlist).'/' : '').$variant;
        if (!preg_match('#^[a-z]+:|^/|(^|/)\.\.(/|$)#i', $variant) && is_file($dir.'/'.$path)) {
            return solad_hls_duration($dir, $path, 1);
        }
        return 0;
    }
    preg_match_all('/#EXTINF:\s*([0-9.]+)/', $text, $matches);
    return (int) round(array_sum(array_map('floatval', $matches[1])));
}

// 글의 HLS 폴더를 지운다. $keep 토큰 폴더는 남긴다.
function solad_hls_remove($bo_table, $wr_id, $keep = '')
{
    $root = solad_hls_root($bo_table, $wr_id);
    if (!is_dir($root)) {
        return;
    }
    foreach (scandir($root) as $token) {
        if ($token === '.' || $token === '..' || $token === $keep) {
            continue;
        }
        $path = $root.'/'.$token;
        if (is_dir($path)) {
            $items = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($path, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
            foreach ($items as $item) {
                $item->isDir() ? @rmdir($item->getPathname()) : @unlink($item->getPathname());
            }
            @rmdir($path);
        } else {
            @unlink($path);
        }
    }
    if ($keep === '') {
        @rmdir($root);
    }
}

function solad_hls_after_delete($write, $board)
{
    solad_hls_remove($board['bo_table'], $write['wr_id']);
}

// 권한이 없어 남은 글도 있으므로 표에서 사라진 글만 고른다.
function solad_hls_after_delete_all($ids, $board)
{
    global $g5;

    foreach ((array) $ids as $id) {
        $row = sql_fetch(" select wr_id from {$g5['write_prefix']}{$board['bo_table']} where wr_id = '".(int) $id."' ");
        if (empty($row['wr_id'])) {
            solad_hls_remove($board['bo_table'], $id);
        }
    }
}

}
