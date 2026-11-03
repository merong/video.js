<?php
// 솔애드 그누보드 설치 화면(/ads/setup.php). 그누보드 최고관리자만 연다.
// 설정이 없으면 그누보드 DB 접속 정보로 data/solad/config.php를 쓰고 솔애드 표를 만든다.
// 설정이 있으면 새 버전을 올린 뒤의 표 갱신(멱등)만 한다. 설정 파일을 고치거나 지우지는 않는다.
// PHP 버전 안내를 보여 주려고 이 파일은 버전 확인까지 PHP 7 문법만 쓴다.

ini_set('display_errors', '0');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');

// 배포본은 이 파일을 src/와 같은 ads 폴더에 두고, 저장소는 public/ 안에 둔다.
$soladManagerRoot = is_dir(__DIR__.'/src') ? __DIR__ : dirname(__DIR__);
$soladGnuRoot = dirname($soladManagerRoot);

function solad_setup_h($value)
{
    return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function solad_setup_page($title, $body)
{
    echo '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">';
    echo '<meta name="robots" content="noindex"><title>'.solad_setup_h($title).' · 솔애드 설치</title><style>';
    echo 'body{margin:0;background:#f4f5f7;color:#1f2329;font:14px/1.6 -apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic",sans-serif}';
    echo 'main{max-width:760px;margin:40px auto;padding:0 16px}h1{font-size:22px;margin:0 0 4px}h2{font-size:16px;margin:28px 0 10px}';
    echo '.lead{color:#5c6470;margin:0 0 20px}.card{background:#fff;border:1px solid #e3e6ea;border-radius:10px;padding:20px;margin:0 0 16px}';
    echo 'table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:8px 6px;border-top:1px solid #eef0f2;vertical-align:top}th{width:34%;font-weight:600;color:#3b424c}';
    echo 'tr:first-child th,tr:first-child td{border-top:0}code{background:#f1f3f5;border-radius:4px;padding:1px 5px;font-size:13px;word-break:break-all}';
    echo '.ok{color:#137333;font-weight:600}.no{color:#c5221f;font-weight:600}.opt{color:#8a5a00;font-weight:600}';
    echo '.msg{border-radius:10px;padding:14px 16px;margin:0 0 16px}.msg.good{background:#e6f4ea;color:#0d5626}.msg.bad{background:#fce8e6;color:#8c1d18}';
    echo 'button,.btn{display:inline-block;background:#2563eb;color:#fff;border:0;border-radius:8px;padding:10px 18px;font-size:15px;font-weight:600;cursor:pointer;text-decoration:none}';
    echo 'button[disabled]{background:#9aa4b2;cursor:not-allowed}.btn.sub,button.sub{background:#fff;color:#2563eb;border:1px solid #c9d4e6}ol li,ul li{margin:4px 0}';
    echo '.actions{display:flex;flex-wrap:wrap;gap:10px;margin:0}.actions form{margin:0}.btn.big{font-size:17px;padding:14px 22px}.btn.off{background:#e5e8ec;color:#7a828d;cursor:default}';
    echo '.choice{display:flex;gap:10px;align-items:flex-start;margin:12px 0}.choice input{margin-top:4px;width:18px;height:18px}.choice small{display:block;color:#5c6470}';
    echo '</style></head><body><main>'.$body.'</main></body></html>';
    exit;
}

if (PHP_VERSION_ID < 80200) {
    solad_setup_page('PHP 버전', '<h1>PHP 8.2 이상이 필요해요</h1><div class="card"><p>지금 PHP는 <code>'.solad_setup_h(PHP_VERSION).'</code>이에요. 호스팅 관리 화면에서 PHP 버전을 8.2 이상으로 바꾼 뒤 이 화면을 다시 열어 주세요.</p></div>');
}

if (!is_file($soladGnuRoot.'/common.php')) {
    solad_setup_page('그누보드', '<h1>그누보드를 찾지 못했어요</h1><div class="card"><p><code>'.solad_setup_h(basename($soladManagerRoot)).'</code> 폴더는 그누보드 루트(<code>common.php</code>가 있는 곳) 바로 아래에 올려야 해요.</p></div>');
}

// bootstrap.php와 같은 방식으로 그누보드를 읽는다. common.php가 요청 변수를 extract·이스케이프하므로 비워 두었다가 되돌린다.
$soladOriginalGet = $_GET;
$soladOriginalPost = $_POST;
$soladOriginalRequest = $_REQUEST;
$_GET = $_POST = $_REQUEST = array();
$soladPreviousDirectory = getcwd();
chdir($soladGnuRoot);
try {
    require_once $soladGnuRoot.'/common.php';
} finally {
    chdir($soladPreviousDirectory);
    $_GET = $soladOriginalGet;
    $_POST = $soladOriginalPost;
    $_REQUEST = $soladOriginalRequest;
}

require_once $soladManagerRoot.'/src/load.php';

// 이 아래는 PHP 8.2 이상이다.
$soladSelf = solad_setup_h(basename(__FILE__));

if (empty($member['mb_id']) || $is_admin !== 'super' || !function_exists('verify_mb_key') || !verify_mb_key($member)) {
    $soladLogin = G5_BBS_URL.'/login.php?url='.urlencode((string) ($_SERVER['REQUEST_URI'] ?? ''));
    solad_setup_page('로그인', '<h1>솔애드 설치</h1><div class="card"><p>설치는 그누보드 <strong>최고관리자</strong>만 할 수 있어요. 최고관리자로 로그인한 뒤 다시 열어 주세요.</p><p><a class="btn" href="'.solad_setup_h($soladLogin).'">로그인</a></p></div>');
}

$soladConfigPath = \AdsManager\Config::defaultPath();
$soladInstalled = is_file($soladConfigPath);
$soladDirectory = basename($soladManagerRoot);
$soladBase = rtrim((string) parse_url(G5_URL, PHP_URL_PATH), '/').'/'.$soladDirectory;
// 업로드 폴더는 그누보드처럼 data 아래(data/media)에 둔다. 설치한 뒤에는 설정에 적힌 폴더를 점검한다.
$soladMediaPath = G5_DATA_PATH.'/media';
$soladMediaUrl = rtrim((string) parse_url(G5_DATA_URL, PHP_URL_PATH), '/').'/media';
if ($soladInstalled) {
    try {
        $soladMediaPath = (string) \AdsManager\Config::load($soladConfigPath)['uploadRoot'];
    } catch (\Throwable) {
    }
}
$soladMenu = defined('SOLAD_ADMIN_MENU') ? (string) SOLAD_ADMIN_MENU : '300950';

function solad_setup_bytes(string $value): int
{
    $value = trim($value);
    $number = (int) $value;
    return match (strtolower(substr($value, -1))) {
        'g' => $number * 1024 * 1024 * 1024,
        'm' => $number * 1024 * 1024,
        'k' => $number * 1024,
        default => $number,
    };
}

// 업로드 한도는 PHP 설정보다 크게 잡지 않는다. 0이나 -1(제한 없음)은 기본값 100MB를 쓴다.
function solad_setup_upload_bytes(): int
{
    $limit = 100 * 1024 * 1024;
    foreach (array('upload_max_filesize', 'post_max_size') as $key) {
        $bytes = solad_setup_bytes((string) ini_get($key));
        if ($bytes > 0) {
            $limit = min($limit, $bytes);
        }
    }
    return max(1, $limit);
}

// 그누보드 DB 접속 정보(data/dbconfig.php)로 PDO DSN을 만든다. host:port와 localhost 소켓을 그누보드(mysqli)와 같게 맞춘다.
function solad_setup_dsn(): string
{
    $host = (string) G5_MYSQL_HOST;
    $parts = array('dbname='.G5_MYSQL_DB, 'charset=utf8mb4');
    if (preg_match('/^(.+):(\d+)$/D', $host, $match)) {
        array_unshift($parts, 'host='.$match[1], 'port='.$match[2]);
    } elseif (preg_match('/^(?:localhost)?:(\/.+)$/D', $host, $match)) {
        array_unshift($parts, 'unix_socket='.$match[1]);
    } elseif ($host === 'localhost' && (string) ini_get('mysqli.default_socket') !== '') {
        array_unshift($parts, 'unix_socket='.ini_get('mysqli.default_socket'));
    } else {
        array_unshift($parts, 'host='.$host);
    }
    return 'mysql:'.implode(';', $parts);
}

function solad_setup_config(string $base, string $mediaPath, string $mediaUrl, string $gnuRoot, string $menu, string $siteId): array
{
    return \AdsManager\Config::validate(array(
        'host' => 'gnuboard',
        'siteId' => $siteId,
        'timeZone' => date_default_timezone_get(),
        'dsn' => solad_setup_dsn(),
        'dbUser' => G5_MYSQL_USER,
        'dbPassword' => G5_MYSQL_PASSWORD,
        'tablePrefix' => (defined('G5_TABLE_PREFIX') ? G5_TABLE_PREFIX : 'g5_').'solad_',
        'uploadRoot' => (string) realpath($mediaPath),
        'uploadUrl' => $mediaUrl,
        'uploadBytes' => solad_setup_upload_bytes(),
        'apiUrl' => $base.'/api/index.php',
        'playerModuleUrl' => $base.'/assets/ads.js',
        'gnuboardRoot' => (string) realpath($gnuRoot),
        'gnuboardMenu' => $menu,
    ));
}

// data/media를 만들고 솔애드가 만든 파일 이름(32자리 16진수.확장자)만 내보내게 막는다.
// 그누보드 data/.htaccess가 svg를 막으므로 로고 svg는 여기서 다시 열고, 스크립트 없이 그림으로만 보이게 한다.
function solad_setup_media_folder(string $path): void
{
    if (!is_dir($path) && !@mkdir($path, G5_DIR_PERMISSION, true)) {
        throw new \RuntimeException('data/media 폴더를 만들지 못했어요. data 폴더 권한(예: 707)을 확인해 주세요.');
    }
    @chmod($path, G5_DIR_PERMISSION);
    $htaccess = $path.'/.htaccess';
    if (is_file($htaccess)) {
        return;
    }
    $rules = <<<'EOD'
# 솔애드 업로드 폴더. 솔애드가 만든 광고 영상·이미지·로고만 내보낸다.
<FilesMatch ".">
Order allow,deny
Deny from all
</FilesMatch>
<FilesMatch "^[a-f0-9]{32}\.(mp4|webm|jpg|png|webp|gif|svg)$">
Order allow,deny
Allow from all
</FilesMatch>
<IfModule mod_headers.c>
Header set X-Content-Type-Options "nosniff"
<FilesMatch "\.svg$">
Header set Content-Security-Policy "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox"
</FilesMatch>
</IfModule>

EOD;
    if (@file_put_contents($htaccess, $rules) === false) {
        throw new \RuntimeException('data/media/.htaccess를 만들지 못했어요. data 폴더 권한을 확인해 주세요.');
    }
    @chmod($htaccess, G5_FILE_PERMISSION);
}

// 지난 설치에서 표가 남아 있으면 그 site_id를 이어 쓴다. migrate()는 다른 site_id를 거부한다.
function solad_setup_site_id(array $config): string
{
    try {
        $database = new \AdsManager\Database($config + array('siteId' => 'gnuboard'));
        return $database->meta('site_id') ?? 'gnuboard';
    } catch (\Throwable) {
        return 'gnuboard';
    }
}

function solad_setup_migrate(array $config): \AdsManager\Database
{
    $database = new \AdsManager\Database($config);
    $database->migrate($config['siteId']);
    $database->migrateLms();
    return $database;
}

// 설치 화면이 만드는 게시판. 처음 그누보드를 설치한 사이트도 [설치하기] 한 번으로 재생과 광고 요청까지 볼 수 있게 한다.
// skin은 솔애드 테마용, light는 그 밖의 밝은 테마(그누보드 기본 테마 등)용 스킨이다.
const SOLAD_SETUP_BOARDS = array(
    'video' => array('subject' => '동영상', 'skin' => 'solad_video', 'light' => 'solad_video_light'),
    'adreq' => array('subject' => '광고 요청', 'skin' => 'solad_request', 'light' => 'solad_request_light'),
);
const SOLAD_SETUP_EXAMPLE_AD = '솔애드 예제 광고';
// skin/board/solad_request/request.lib.php의 SOLAD_REQUEST_STAGES와 같아야 목록의 설정 점검이 경고 없이 나온다.
const SOLAD_SETUP_REQUEST_STAGES = '접수|검토|보완 요청|집행 예정|집행|종료|반려';

// 새로 만들 게시판의 스킨. 사이트 테마가 solad가 아니면 light 스킨을 올렸을 때 그쪽을 쓴다.
function solad_setup_board_skin(string $table): string
{
    global $config;
    $board = SOLAD_SETUP_BOARDS[$table];
    return ($config['cf_theme'] ?? '') !== 'solad' && is_dir(G5_SKIN_PATH.'/board/'.$board['light']) ? $board['light'] : $board['skin'];
}

// 솔애드 스킨(솔애드 테마용·밝은 테마용 모두)인지.
function solad_setup_is_skin(string $table, ?string $skin): bool
{
    return in_array($skin, array(SOLAD_SETUP_BOARDS[$table]['skin'], SOLAD_SETUP_BOARDS[$table]['light']), true);
}

// 그누보드 표 쓰기는 adm/board_form_update.php처럼 그누보드 DB 연결로 한다. 실패하면 SQL 대신 오류 번호만 알린다.
function solad_setup_sql(string $sql)
{
    global $g5;
    $result = sql_query($sql, false);
    if ($result === false) {
        throw new \RuntimeException('그누보드 DB에 쓰지 못했어요(오류 '.(int) mysqli_errno($g5['connect_db']).').');
    }
    return $result;
}

// 그 그누보드 버전에 없는 열은 빼고, 기본값 없는 NOT NULL 열은 빈 값으로 채워 strict 모드에서도 넣을 수 있게 한다.
function solad_setup_insert(string $table, array $values): int
{
    global $g5;
    $columns = array();
    $result = solad_setup_sql('SHOW COLUMNS FROM `'.$table.'`');
    while ($column = sql_fetch_array($result)) {
        $columns[$column['Field']] = $column;
    }
    $values = array_intersect_key($values, $columns);
    foreach ($columns as $name => $column) {
        if (isset($values[$name]) || $column['Null'] === 'YES' || $column['Default'] !== null || str_contains((string) $column['Extra'], 'auto_increment')) {
            continue;
        }
        $type = strtolower((string) $column['Type']);
        $values[$name] = match (true) {
            (bool) preg_match('/int|decimal|float|double/', $type) => 0,
            str_starts_with($type, 'datetime'), str_starts_with($type, 'timestamp') => G5_TIME_YMDHIS,
            str_starts_with($type, 'date') => G5_TIME_YMD,
            str_starts_with($type, 'time') => '00:00:00',
            default => '',
        };
    }
    $set = array();
    foreach ($values as $name => $value) {
        $set[] = '`'.$name.'` = \''.sql_real_escape_string((string) $value).'\'';
    }
    solad_setup_sql('INSERT INTO `'.$table.'` SET '.implode(', ', $set));
    return (int) sql_insert_id($g5['connect_db']);
}

// 게시판 업로드 용량: PHP upload_max_filesize·post_max_size 중 작은 값. 둘 다 제한이 없으면 100MB.
function solad_setup_board_upload_bytes(): int
{
    $limits = array();
    foreach (array('upload_max_filesize', 'post_max_size') as $key) {
        $bytes = solad_setup_bytes((string) ini_get($key));
        if ($bytes > 0) {
            $limits[] = $bytes;
        }
    }
    return min($limits ? min($limits) : 100 * 1024 * 1024, 2147483647);
}

// 새 그누보드에는 community 그룹이 있다. 없으면 solad, 그다음 첫 그룹을 쓰고, 그룹이 하나도 없을 때만 solad를 만든다.
function solad_setup_group(): string
{
    global $g5;
    foreach (array('community', 'solad') as $id) {
        if (sql_fetch("SELECT gr_id FROM {$g5['group_table']} WHERE gr_id = '{$id}'")) {
            return $id;
        }
    }
    $first = sql_fetch("SELECT gr_id FROM {$g5['group_table']} ORDER BY gr_order, gr_id LIMIT 1");
    if (!empty($first['gr_id'])) {
        return (string) $first['gr_id'];
    }
    solad_setup_insert($g5['group_table'], array('gr_id' => 'solad', 'gr_subject' => '솔애드', 'gr_device' => 'both', 'gr_admin' => '', 'gr_use_access' => 0, 'gr_order' => 0));
    return 'solad';
}

// adm/board_form.php의 새 게시판 기본값에 솔애드 스킨이 요구하는 값만 바꾼다.
function solad_setup_board_values(string $table, string $group, string $base): array
{
    global $config;
    $board = SOLAD_SETUP_BOARDS[$table];
    $skin = solad_setup_board_skin($table);
    $values = array(
        'bo_table' => $table, 'gr_id' => $group, 'bo_subject' => $board['subject'], 'bo_mobile_subject' => '', 'bo_device' => 'both', 'bo_admin' => '',
        'bo_list_level' => 1, 'bo_read_level' => 1, 'bo_write_level' => 1, 'bo_reply_level' => 1, 'bo_comment_level' => 1, 'bo_html_level' => 1,
        'bo_link_level' => 1, 'bo_upload_level' => 1, 'bo_download_level' => 1, 'bo_count_modify' => 1, 'bo_count_delete' => 1,
        'bo_read_point' => $config['cf_read_point'], 'bo_write_point' => $config['cf_write_point'], 'bo_comment_point' => $config['cf_comment_point'], 'bo_download_point' => $config['cf_download_point'],
        'bo_use_category' => 0, 'bo_category_list' => '', 'bo_use_secret' => 0, 'bo_use_dhtml_editor' => 0, 'bo_select_editor' => '', 'bo_use_search' => 1,
        'bo_table_width' => 100, 'bo_subject_len' => 60, 'bo_mobile_subject_len' => 30, 'bo_page_rows' => $config['cf_page_rows'], 'bo_mobile_page_rows' => $config['cf_page_rows'],
        'bo_new' => 24, 'bo_hot' => 100, 'bo_image_width' => 600, 'bo_skin' => $skin, 'bo_mobile_skin' => $skin,
        'bo_include_head' => '_head.php', 'bo_include_tail' => '_tail.php', 'bo_gallery_cols' => 4, 'bo_gallery_width' => 202, 'bo_gallery_height' => 150,
        'bo_mobile_gallery_width' => 125, 'bo_mobile_gallery_height' => 100, 'bo_upload_count' => 2, 'bo_upload_size' => solad_setup_board_upload_bytes(),
        'bo_reply_order' => 1, 'bo_order' => 0, 'bo_count_write' => 0, 'bo_count_comment' => 0,
    );
    if ($table === 'video') {
        $values = array('bo_write_level' => 10, 'bo_reply_level' => 10, 'bo_comment_level' => 2) + $values;
    } else {
        // 분류가 곧 처리 상태이고, 요청서에 연락처가 들어가므로 항상 비밀글이다. 보완 요청 뒤에도 고칠 수 있게 원글 수정 제한은 없앤다.
        $values = array('bo_write_level' => 2, 'bo_comment_level' => 2, 'bo_use_category' => 1, 'bo_category_list' => SOLAD_SETUP_REQUEST_STAGES, 'bo_use_secret' => 2, 'bo_count_modify' => 0) + $values;
    }
    // 스킨은 ads가 아닌 관리자 폴더를 여분필드 "솔애드 주소"로 찾는다.
    if (basename($base) !== 'ads') {
        $values = array('bo_1_subj' => '솔애드 주소', 'bo_1' => rtrim(G5_URL, '/').'/'.basename($base)) + $values;
    }
    return $values;
}

// get_pretty_url()은 get_board_names()의 요청 단위 캐시를 써서 같은 요청에서 만든 게시판을 모른다. 짧은 주소 설정만 직접 따른다.
function solad_setup_board_link(string $table, int $id = 0): string
{
    global $config;
    if (!empty($config['cf_bbs_rewrite'])) {
        return rtrim(G5_URL, '/').'/'.$table.($id ? '/'.$id : '');
    }
    return G5_BBS_URL.'/board.php?bo_table='.$table.($id ? '&wr_id='.$id : '');
}

// 메뉴에 넣는 주소는 짧은 주소 설정을 바꿔도 열리는 board.php 형식으로 둔다.
function solad_setup_menu_link(string $table): string
{
    return G5_BBS_URL.'/board.php?bo_table='.$table;
}

// 이 게시판을 가리키는 메뉴가 있는지. board.php?bo_table= 형식과 짧은 주소(/표, /표/) 형식을 다 본다.
function solad_setup_has_menu(string $table): bool
{
    global $g5;
    $short = rtrim(G5_URL, '/').'/'.$table;
    $path = (string) parse_url($short, PHP_URL_PATH);
    $links = array_map('sql_real_escape_string', array_unique(array($short, $short.'/', $path, $path.'/')));
    $row = sql_fetch("SELECT me_id FROM {$g5['menu_table']} WHERE me_link LIKE '%bo_table={$table}' OR me_link LIKE '%bo_table={$table}&%' OR me_link IN ('".implode("','", $links)."') LIMIT 1");
    return !empty($row);
}

// 게시판 두 개와 메뉴를 만든다. 같은 표 이름의 게시판이 있으면 고치지 않고 알린다. 여러 번 눌러도 같은 결과다.
function solad_setup_boards(string $base): array
{
    global $g5;
    $results = array();
    $group = null;
    foreach (SOLAD_SETUP_BOARDS as $table => $board) {
        $existing = sql_fetch("SELECT bo_skin, bo_mobile_skin FROM {$g5['board_table']} WHERE bo_table = '{$table}'");
        if (!empty($existing)) {
            $results[] = array($board['subject'].' ('.$table.')', solad_setup_is_skin($table, $existing['bo_skin']) ? 'ok' : 'opt', '이미 있어요(스킨: '.$existing['bo_skin'].'). 고치지 않았어요.');
        } else {
            $group ??= solad_setup_group();
            solad_setup_insert($g5['board_table'], solad_setup_board_values($table, $group, $base));
            // adm/board_form_update.php와 같이 sql_write.sql로 글 표를 만든다. 표만 남아 있던 경우는 그대로 쓴다.
            $write = $g5['write_prefix'].$table;
            if (!sql_fetch("SHOW TABLES LIKE '{$write}'")) {
                $sql = implode("\n", get_db_create_replace(file(G5_ADMIN_PATH.'/sql_write.sql')));
                solad_setup_sql(preg_replace(array('/__TABLE_NAME__/', '/;/'), array($write, ''), $sql));
            }
            $path = G5_DATA_PATH.'/file/'.$table;
            @mkdir($path, G5_DIR_PERMISSION);
            @chmod($path, G5_DIR_PERMISSION);
            if (!is_file($path.'/index.php') && @file_put_contents($path.'/index.php', '') !== false) {
                @chmod($path.'/index.php', G5_FILE_PERMISSION);
            }
            $skin = solad_setup_board_skin($table);
            $results[] = array($board['subject'].' ('.$table.')', 'ok', '만들었어요(스킨: '.$skin.', 그룹: '.$group.').');
            $existing = array('bo_skin' => $skin);
        }
        if (!solad_setup_is_skin($table, $existing['bo_skin'])) {
            continue;
        }
        if (solad_setup_has_menu($table)) {
            continue;
        }
        // adm/menu_list_update.php처럼 1단계 메뉴 코드는 base36으로 36씩 늘린다.
        $row = sql_fetch("SELECT MAX(SUBSTRING(me_code, 1, 2)) AS code, MAX(me_order) AS menu_order FROM {$g5['menu_table']} WHERE LENGTH(me_code) = 2");
        $code = base_convert((string) ((int) base_convert((string) ($row['code'] ?? '0'), 36, 10) + 36), 10, 36);
        solad_setup_insert($g5['menu_table'], array('me_code' => $code, 'me_name' => $board['subject'], 'me_link' => solad_setup_menu_link($table), 'me_target' => 'self', 'me_order' => (int) ($row['menu_order'] ?? 0) + 1, 'me_use' => 1, 'me_mobile_use' => 1));
        $results[] = array('메뉴', 'ok', $board['subject'].' 메뉴를 넣었어요(PC·모바일).');
    }
    return $results;
}

function solad_setup_example_url(string $base): string
{
    return $base.'/demo-media/content.mp4';
}

// 예제 글의 wr_id. 없거나 동영상 게시판이 없으면 0.
function solad_setup_example_post(string $base): int
{
    global $g5;
    $write = $g5['write_prefix'].'video';
    if (!sql_fetch("SHOW TABLES LIKE '{$write}'")) {
        return 0;
    }
    $row = sql_fetch("SELECT wr_id FROM `{$write}` WHERE wr_is_comment = 0 AND wr_1 = '".sql_real_escape_string(solad_setup_example_url($base))."' ORDER BY wr_id LIMIT 1");
    return (int) ($row['wr_id'] ?? 0);
}

// 예제 영상 글 1개, 예제 하우스 광고 1개와 동영상 게시판 프리롤 편성. 광고·편성은 관리자 API와 같은 Creatives·Schedules로 만든다.
function solad_setup_example(array $config, string $base): array
{
    global $g5, $member;
    $board = sql_fetch("SELECT bo_skin FROM {$g5['board_table']} WHERE bo_table = 'video'");
    if (empty($board) || !solad_setup_is_skin('video', $board['bo_skin'])) {
        return array(array('예제', 'no', empty($board) ? '동영상 게시판(video)이 없어요. [게시판 만들기]를 먼저 눌러 주세요.' : '동영상 게시판(video)의 스킨이 solad_video·solad_video_light가 아니라 예제를 넣지 않았어요.'));
    }
    $results = array();

    if (solad_setup_example_post($base)) {
        $results[] = array('예제 글', 'ok', '이미 있어요.');
    } else {
        $write = $g5['write_prefix'].'video';
        $row = sql_fetch("SELECT MIN(wr_num) AS num FROM `{$write}`");
        // bbs/write_update.php와 같은 값. wr_1 = 영상 주소, wr_2 = 재생 시간(초, demo-media/content.mp4), wr_3 = 등록 형식.
        $id = solad_setup_insert($write, array(
            'wr_num' => isset($row['num']) ? (int) $row['num'] - 1 : -1, 'wr_reply' => '', 'wr_comment' => 0, 'ca_name' => '', 'wr_option' => '',
            'wr_subject' => '솔애드 예제 영상', 'wr_content' => "솔애드 설치 예제 글이에요. 재생하면 예제 프리롤 광고가 먼저 나와요.\n필요 없으면 이 글을 지우고, 솔애드 관리자에서 예제 광고와 편성을 바꾸거나 지워 주세요.",
            'wr_link1' => '', 'wr_link2' => '', 'wr_link1_hit' => 0, 'wr_link2_hit' => 0, 'wr_hit' => 0, 'wr_good' => 0, 'wr_nogood' => 0,
            'mb_id' => $member['mb_id'], 'wr_password' => '', 'wr_name' => $member['mb_nick'] ?: $member['mb_id'], 'wr_email' => $member['mb_email'], 'wr_homepage' => $member['mb_homepage'],
            'wr_datetime' => G5_TIME_YMDHIS, 'wr_last' => G5_TIME_YMDHIS, 'wr_ip' => (string) ($_SERVER['REMOTE_ADDR'] ?? ''),
            'wr_1' => solad_setup_example_url($base), 'wr_2' => '36', 'wr_3' => 'url',
        ));
        solad_setup_sql("UPDATE `{$write}` SET wr_parent = '{$id}' WHERE wr_id = '{$id}'");
        solad_setup_sql("INSERT INTO {$g5['board_new_table']} (bo_table, wr_id, wr_parent, bn_datetime, mb_id) VALUES ('video', '{$id}', '{$id}', '".G5_TIME_YMDHIS."', '".sql_real_escape_string($member['mb_id'])."')");
        solad_setup_sql("UPDATE {$g5['board_table']} SET bo_count_write = bo_count_write + 1 WHERE bo_table = 'video'");
        if (function_exists('delete_cache_latest')) {
            delete_cache_latest('video');
        }
        $results[] = array('예제 글', 'ok', '"솔애드 예제 영상" 글을 넣었어요.');
    }

    $database = new \AdsManager\Database($config);
    $creatives = new \AdsManager\Creatives($database, $config);
    $schedules = new \AdsManager\Schedules($database, $config, new \AdsManager\GnuBoard($database, $config), $creatives);
    $url = $base.'/demo-media/ad.mp4';
    $creative = null;
    foreach ($creatives->list()['items'] as $item) {
        if ($item['url'] === $url && !$item['archived']) {
            $creative = $item;
            break;
        }
    }
    if ($creative) {
        $results[] = array('예제 광고', 'ok', '이미 있어요.');
    } else {
        $creative = $creatives->save(array('name' => SOLAD_SETUP_EXAMPLE_AD, 'url' => $url, 'mime' => 'video/mp4', 'alt' => ''))['creative'];
        $results[] = array('예제 광고', 'ok', '하우스 광고 "'.SOLAD_SETUP_EXAMPLE_AD.'"를 넣었어요.');
    }

    // 운영자가 이미 정한 동영상 게시판 편성은 덮어쓰지 않는다.
    $target = array('type' => 'board', 'id' => 'video');
    $draft = $schedules->draft($target);
    if ($draft['draft']['revision'] !== 0 || $draft['publishedVersion'] !== null) {
        $results[] = array('예제 편성', 'ok', '동영상 게시판 편성이 이미 있어서 그대로 두었어요.');
    } else {
        $ad = array('itemId' => 'item-'.\AdsManager\Value::uuid(), 'creativeId' => $creative['creativeId'], 'creativeVersion' => $creative['version'], 'clickUrl' => null, 'skipAfterSeconds' => null);
        $saved = $schedules->save(array('target' => $target, 'mode' => 'replace', 'revision' => 0, 'breaks' => array(array('breakId' => 'break-'.\AdsManager\Value::uuid(), 'position' => 'pre', 'ads' => array($ad)))));
        $schedules->publish(array('target' => $target, 'revision' => $saved['draft']['revision']));
        $results[] = array('예제 편성', 'ok', '동영상 게시판에 프리롤로 게시했어요.');
    }
    return $results;
}

// 설치 뒤 화면의 게시판 상태. [이름, 상태, 설명].
function solad_setup_board_status(): array
{
    global $g5;
    $rows = array();
    foreach (SOLAD_SETUP_BOARDS as $table => $board) {
        $row = sql_fetch("SELECT bo_skin, bo_mobile_skin FROM {$g5['board_table']} WHERE bo_table = '{$table}'");
        if (empty($row)) {
            $rows[] = array($board['subject'].' ('.$table.')', 'no', '없어요.');
        } elseif (solad_setup_is_skin($table, $row['bo_skin']) && solad_setup_is_skin($table, $row['bo_mobile_skin'])) {
            $skins = $row['bo_skin'] === $row['bo_mobile_skin'] ? $row['bo_skin'].'(PC·모바일)' : $row['bo_skin'].'(PC)·'.$row['bo_mobile_skin'].'(모바일)';
            $rows[] = array($board['subject'].' ('.$table.')', 'ok', '있어요. 스킨 '.$skins);
        } else {
            $rows[] = array($board['subject'].' ('.$table.')', 'opt', '있어요. 스킨이 '.$row['bo_skin'].'/'.$row['bo_mobile_skin'].'라 '.$board['skin'].'·'.$board['light'].'와 달라요.');
        }
    }
    return $rows;
}

// 화면에 보여 줄 환경 점검. [이름, 상태(ok|no|opt), 설명]. no가 하나라도 있으면 설치 버튼을 막는다.
function solad_setup_checks(bool $installed, string $configPath, string $mediaPath, string $directory): array
{
    $checks = array();
    $checks[] = array('PHP 8.2 이상', 'ok', PHP_VERSION);
    foreach (array('pdo_mysql' => 'PDO MySQL', 'fileinfo' => 'fileinfo', 'mbstring' => 'mbstring', 'json' => 'JSON') as $extension => $label) {
        $checks[] = extension_loaded($extension) ? array($label, 'ok', '사용할 수 있어요.') : array($label, 'no', 'PHP 확장 '.$extension.'을 켜 주세요.');
    }
    $checks[] = $directory === 'ads'
        ? array('관리자 폴더', 'ok', '그누보드 루트의 ads 폴더예요.')
        : array('관리자 폴더', 'opt', '폴더 이름이 '.$directory.'이에요. 게시판 여분필드 "솔애드 주소"와 extend/solad.config.php의 SOLAD_URL을 이 주소로 맞춰 주세요.');
    $checks[] = function_exists('solad_media')
        ? array('extend 파일', 'ok', 'extend/solad.extend.php를 읽었어요.')
        : array('extend 파일', 'no', 'extend/solad.extend.php를 올려 주세요. 관리자 메뉴와 영상 추가 기능이 이 파일을 써요.');
    foreach (array('video' => '동영상 갤러리 스킨', 'adreq' => '광고 요청 스킨') as $table => $label) {
        $skin = SOLAD_SETUP_BOARDS[$table]['skin'];
        $light = SOLAD_SETUP_BOARDS[$table]['light'];
        $checks[] = is_dir(G5_SKIN_PATH.'/board/'.$skin)
            ? array($label, 'ok', 'skin/board/'.$skin)
            : array($label, 'no', 'skin/board/'.$skin.' 폴더를 올려 주세요.');
        $checks[] = is_dir(G5_SKIN_PATH.'/board/'.$light)
            ? array($label.'(밝은 테마)', 'ok', 'skin/board/'.$light)
            : array($label.'(밝은 테마)', 'opt', 'skin/board/'.$light.' 폴더가 없어요. 솔애드 테마가 아니어도 '.$skin.'를 써요.');
    }
    if (!$installed) {
        $dataDirectory = dirname($configPath);
        $writable = is_dir($dataDirectory) ? is_writable($dataDirectory) : is_writable(dirname($dataDirectory));
        $checks[] = $writable
            ? array('설정 저장 위치', 'ok', 'data/solad/config.php에 저장해요.')
            : array('설정 저장 위치', 'no', 'PHP가 data 폴더에 쓸 수 없어요. data 폴더 권한(예: 707)을 확인해 주세요.');
    }
    $folder = str_starts_with($mediaPath, G5_PATH.'/') ? substr($mediaPath, strlen(G5_PATH) + 1) : $mediaPath;
    if (!$installed && !is_dir($mediaPath)) {
        $checks[] = is_writable(dirname($mediaPath))
            ? array('업로드 폴더', 'ok', $folder.' 폴더를 설치할 때 만들어요.')
            : array('업로드 폴더', 'no', 'PHP가 '.dirname($folder).' 폴더에 쓸 수 없어요. 폴더 권한(예: 707)을 확인해 주세요.');
    } else {
        $checks[] = is_dir($mediaPath) && is_writable($mediaPath) && !is_link($mediaPath)
            ? array('업로드 폴더', 'ok', $folder)
            : array('업로드 폴더', 'no', $folder.' 폴더가 없거나 PHP가 쓸 수 없어요. 폴더를 만들고 권한을 707로 바꿔 주세요.');
    }
    if (function_exists('solad_media') && ($media = solad_media())) {
        $detect = $media->detect();
        $checks[] = !empty($detect['available'])
            ? array('ffmpeg(선택)', 'ok', '커버 이미지·진행바 미리보기·하이라이트를 만들 수 있어요.')
            : array('ffmpeg(선택)', 'opt', '없어도 설치·재생·광고는 동작해요. 커버 이미지 같은 추가 기능만 꺼져요.');
    }
    return $checks;
}

// 게시판·예제 만들기는 설치와 따로 실패할 수 있다. 실패해도 설치는 그대로 두고 그 항목만 알린다.
function solad_setup_try(string $label, callable $work): array
{
    try {
        return $work();
    } catch (\Throwable $error) {
        $message = $error instanceof \PDOException ? 'DB 오류(SQLSTATE '.$error->getCode().')예요.' : $error->getMessage();
        return array(array($label, 'no', $message.' 원인을 고친 뒤 아래 버튼으로 다시 만들 수 있어요.'));
    }
}

$soladMessage = '';
$soladMessageGood = false;
$soladResults = array();
$soladToken = get_session('ss_solad_setup_token');
if (!$soladToken) {
    $soladToken = bin2hex(random_bytes(16));
    set_session('ss_solad_setup_token', $soladToken);
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    $soladPosted = $_POST['token'] ?? null;
    if (!is_string($soladPosted) || !hash_equals($soladToken, $soladPosted)) {
        $soladMessage = '화면이 오래되었어요. 새로고침한 뒤 다시 눌러 주세요.';
    } elseif (($_POST['action'] ?? '') === 'install' && !$soladInstalled) {
        $soladChecks = solad_setup_checks(false, $soladConfigPath, $soladMediaPath, $soladDirectory);
        if (in_array('no', array_column($soladChecks, 1), true)) {
            $soladMessage = '환경 점검에서 빨간 항목을 먼저 고쳐 주세요.';
        } else {
            $soladWritten = false;
            try {
                solad_setup_media_folder($soladMediaPath);
                $soladConfig = solad_setup_config($soladBase, $soladMediaPath, $soladMediaUrl, $soladGnuRoot, $soladMenu, 'gnuboard');
                $soladConfig['siteId'] = solad_setup_site_id($soladConfig);
                if (!is_dir(dirname($soladConfigPath)) && !mkdir(dirname($soladConfigPath), 0755, true)) {
                    throw new \RuntimeException('data/solad 폴더를 만들지 못했어요.');
                }
                $handle = @fopen($soladConfigPath, 'x');
                if (!$handle) {
                    throw new \RuntimeException('설정 파일을 만들지 못했어요. data/solad 폴더 권한을 확인해 주세요.');
                }
                $soladWritten = true;
                chmod($soladConfigPath, 0600);
                fwrite($handle, "<?php\n// 솔애드 설정. ".$soladSelf."가 그누보드 DB 접속 정보로 만들었어요.\nreturn ".var_export($soladConfig, true).";\n");
                fclose($handle);
                solad_setup_migrate($soladConfig);
                $soladInstalled = true;
                $soladMessageGood = true;
                $soladMessage = '설치했어요. 아래 [동영상 게시판 열기]로 예제 글을 재생해 보세요.';
                if (!empty($_POST['boards'])) {
                    $soladResults = solad_setup_try('게시판 만들기', static fn () => solad_setup_boards($soladBase));
                }
                if (!empty($_POST['example'])) {
                    $soladResults = array_merge($soladResults, solad_setup_try('예제 넣기', static fn () => solad_setup_example($soladConfig, $soladBase)));
                }
            } catch (\Throwable $error) {
                // 접속 정보가 담긴 PDO 메시지는 보여 주지 않는다. 다시 시도할 수 있게 방금 만든 설정은 지운다.
                if ($soladWritten && is_file($soladConfigPath)) {
                    @unlink($soladConfigPath);
                }
                $soladMessage = $error instanceof \PDOException
                    ? 'DB에 연결하거나 표를 만들지 못했어요(SQLSTATE '.solad_setup_h((string) $error->getCode()).'). DB 계정에 CREATE 권한이 있는지 확인해 주세요.'
                    : solad_setup_h($error->getMessage());
            }
        }
    } elseif (($_POST['action'] ?? '') === 'boards' && $soladInstalled) {
        $soladResults = solad_setup_try('게시판 만들기', static fn () => solad_setup_boards($soladBase));
    } elseif (($_POST['action'] ?? '') === 'example' && $soladInstalled) {
        $soladResults = solad_setup_try('예제 넣기', static fn () => solad_setup_example(\AdsManager\Config::load($soladConfigPath), $soladBase));
    } elseif (($_POST['action'] ?? '') === 'migrate' && $soladInstalled) {
        try {
            solad_setup_migrate(\AdsManager\Config::load($soladConfigPath));
            $soladMessageGood = true;
            $soladMessage = 'DB 표를 최신 버전으로 맞췄어요. 기존 광고·통계는 그대로예요.';
        } catch (\Throwable $error) {
            $soladMessage = $error instanceof \PDOException
                ? 'DB 표를 갱신하지 못했어요(SQLSTATE '.solad_setup_h((string) $error->getCode()).').'
                : solad_setup_h($error->getMessage());
        }
    }
}

$soladChecks = solad_setup_checks($soladInstalled, $soladConfigPath, $soladMediaPath, $soladDirectory);
$soladBlocked = in_array('no', array_column($soladChecks, 1), true);
$soladLabels = array('ok' => '확인', 'no' => '필요', 'opt' => '참고');

$html = '<h1>솔애드 설치</h1><p class="lead">그누보드 '.solad_setup_h(G5_GNUBOARD_VER).' · '.solad_setup_h(G5_URL).'</p>';
if ($soladMessage !== '') {
    $html .= '<div class="msg '.($soladMessageGood ? 'good' : 'bad').'">'.$soladMessage.'</div>';
}

$html .= '<div class="card"><h2 style="margin-top:0">환경 점검</h2><table>';
foreach ($soladChecks as $check) {
    $html .= '<tr><th>'.solad_setup_h($check[0]).'</th><td><span class="'.$check[1].'">'.$soladLabels[$check[1]].'</span> '.solad_setup_h($check[2]).'</td></tr>';
}
$html .= '</table></div>';

if ($soladResults) {
    $html .= '<div class="card"><h2 style="margin-top:0">게시판·예제</h2><table>';
    foreach ($soladResults as $result) {
        $html .= '<tr><th>'.solad_setup_h($result[0]).'</th><td><span class="'.$result[1].'">'.$soladLabels[$result[1]].'</span> '.solad_setup_h($result[2]).'</td></tr>';
    }
    $html .= '</table></div>';
}
$soladHidden = '<input type="hidden" name="token" value="'.solad_setup_h($soladToken).'">';

if (!$soladInstalled) {
    $prefix = (defined('G5_TABLE_PREFIX') ? G5_TABLE_PREFIX : 'g5_').'solad_';
    $html .= '<div class="card"><h2 style="margin-top:0">설치할 내용</h2><table>';
    $html .= '<tr><th>DB</th><td>그누보드와 같은 DB(<code>'.solad_setup_h(G5_MYSQL_DB).'</code>)에 <code>'.solad_setup_h($prefix).'</code>로 시작하는 표를 만들어요. 그누보드 표는 바꾸지 않아요.</td></tr>';
    $html .= '<tr><th>설정 파일</th><td><code>data/solad/config.php</code></td></tr>';
    $html .= '<tr><th>관리자 주소</th><td><code>'.solad_setup_h($soladBase.'/').'</code></td></tr>';
    $html .= '<tr><th>업로드 한도</th><td>'.solad_setup_h(number_format(solad_setup_upload_bytes() / 1024 / 1024, 1)).'MB (PHP upload_max_filesize·post_max_size 중 작은 값, 최대 100MB)</td></tr>';
    $html .= '<tr><th>관리자 메뉴 코드</th><td><code>'.solad_setup_h($soladMenu).'</code> (관리권한설정에서 이 메뉴에 권한을 줘요)</td></tr>';
    $html .= '</table><form method="post" style="margin-top:16px">'.$soladHidden.'<input type="hidden" name="action" value="install">';
    $html .= '<label class="choice"><input type="checkbox" name="boards" value="1" checked><span>게시판 만들기: 동영상(<code>video</code>)·광고 요청(<code>adreq</code>), 메뉴에 추가<small>스킨(<code>'.solad_setup_h(solad_setup_board_skin('video')).'</code>·<code>'.solad_setup_h(solad_setup_board_skin('adreq')).'</code>), 업로드 용량('.solad_setup_h(get_filesize(solad_setup_board_upload_bytes())).'), 광고 요청의 분류·비밀글까지 맞춰 만들어요. 같은 이름의 게시판이 있으면 고치지 않아요.</small></span></label>';
    $html .= '<label class="choice"><input type="checkbox" name="example" value="1" checked><span>예제 넣기: 예제 영상 글 1개와 예제 하우스 광고(프리롤)<small>설치가 잘 됐는지 바로 볼 수 있어요. 나중에 글은 게시판에서, 광고와 편성은 솔애드 관리자에서 지울 수 있어요.</small></span></label>';
    $html .= '<button type="submit" class="btn big"'.($soladBlocked ? ' disabled' : '').'>설치하기</button></form></div>';
} else {
    $soladPost = solad_setup_example_post($soladBase);
    $soladStatus = solad_setup_board_status();
    $soladHasVideo = $soladStatus[0][1] !== 'no';
    $html .= '<div class="card"><h2 style="margin-top:0">바로 가기</h2><p class="actions">';
    $html .= $soladHasVideo ? '<a class="btn big" href="'.solad_setup_h(solad_setup_board_link('video')).'">동영상 게시판 열기</a>' : '<span class="btn big off">동영상 게시판 없음</span>';
    $html .= $soladPost ? '<a class="btn big sub" href="'.solad_setup_h(solad_setup_board_link('video', $soladPost)).'">예제 글 보기</a>' : '';
    $html .= '<a class="btn big sub" href="'.solad_setup_h($soladBase.'/').'">솔애드 관리자 열기</a></p></div>';

    $html .= '<div class="card"><h2 style="margin-top:0">게시판</h2><table>';
    foreach ($soladStatus as $row) {
        $html .= '<tr><th>'.solad_setup_h($row[0]).'</th><td><span class="'.$row[1].'">'.solad_setup_h(array('ok' => '확인', 'no' => '없음', 'opt' => '참고')[$row[1]]).'</span> '.solad_setup_h($row[2]).'</td></tr>';
    }
    $html .= '<tr><th>예제 글</th><td>'.($soladPost ? '<span class="ok">확인</span> 있어요.' : '<span class="opt">참고</span> 없어요.').'</td></tr>';
    $html .= '</table><p>게시판이나 예제가 없으면 아래 버튼으로 만들어요. 여러 번 눌러도 겹쳐 만들지 않고, 이미 있는 게시판은 고치지 않아요.</p><div class="actions">';
    $html .= '<form method="post">'.$soladHidden.'<input type="hidden" name="action" value="boards"><button type="submit" class="sub">게시판 만들기</button></form>';
    $html .= '<form method="post">'.$soladHidden.'<input type="hidden" name="action" value="example"><button type="submit" class="sub">예제 넣기</button></form></div></div>';

    $html .= '<div class="card"><h2 style="margin-top:0">운영자 권한</h2><p>최고관리자가 아닌 운영자에게는 <a href="'.solad_setup_h(G5_ADMIN_URL.'/auth_list.php').'">관리권한설정</a>에서 "솔애드 광고 관리"(<code>'.solad_setup_h($soladMenu).'</code>)에 읽기·쓰기 권한을 주세요.</p></div>';
    $html .= '<div class="card"><h2 style="margin-top:0">업데이트한 뒤</h2><p>새 버전 파일을 올렸다면 아래 버튼을 한 번 눌러 DB 표를 맞춰 주세요. 여러 번 눌러도 괜찮고, 광고·통계·설정은 그대로예요.</p>';
    $html .= '<form method="post">'.$soladHidden.'<input type="hidden" name="action" value="migrate"><button type="submit" class="sub">DB 갱신</button></form></div>';
}

solad_setup_page($soladInstalled ? '설치 완료' : '환경 점검', $html);
