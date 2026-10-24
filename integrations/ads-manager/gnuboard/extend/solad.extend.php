<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가

// 솔애드 광고 관리: 관리자 > 게시판관리에 관리 창을 여는 링크 하나만 더한다. 코어 파일은 고치지 않는다.
// 메뉴 코드는 솔애드 설정의 gnuboardMenu와 같아야 관리권한설정에서 권한을 줄 수 있다.
if (!defined('SOLAD_ADMIN_MENU')) {
    define('SOLAD_ADMIN_MENU', '300950');
}
if (!defined('SOLAD_URL')) {
    define('SOLAD_URL', G5_URL.'/ads');
}

// 솔애드 영상 추가 기능(ffmpeg). 운영자는 이 파일보다 먼저 읽히는 extend/solad.config.php에서 정할 수 있다.
// - SOLAD_MANAGER_PATH: src/VideoMedia.php가 있는 솔애드 관리자 폴더. 기본값은 이 파일이 저장소 안에 있을 때의 위치다.
// - SOLAD_FFMPEG_PATH, SOLAD_FFPROBE_PATH: 비우면 PATH와 /usr/bin, /usr/local/bin, /opt/homebrew/bin에서 찾는다.
if (!defined('SOLAD_MANAGER_PATH')) {
    define('SOLAD_MANAGER_PATH', dirname(__DIR__, 2));
}
if (!defined('SOLAD_FFMPEG_PATH')) {
    define('SOLAD_FFMPEG_PATH', '');
}
if (!defined('SOLAD_FFPROBE_PATH')) {
    define('SOLAD_FFPROBE_PATH', '');
}

add_replace('admin_menu', function ($menu) {
    if (isset($menu['menu300']) && is_array($menu['menu300'])) {
        $menu['menu300'][] = array(SOLAD_ADMIN_MENU, '솔애드 광고 관리', SOLAD_URL.'/', 'solad');
    }
    return $menu;
}, G5_HOOK_DEFAULT_PRIORITY, 1);

// 관리 화면은 그누보드 관리자 레이아웃 밖의 별도 창에서 연다.
add_event('tail_sub', function () {
    if (!defined('G5_IS_ADMIN')) {
        return;
    }
    $menu = json_encode(SOLAD_ADMIN_MENU);
    echo <<<HTML
<script>
document.addEventListener("click", function (event) {
    var link = event.target.closest && event.target.closest('[data-menu="' + {$menu} + '"] a');
    if (!link) return;
    event.preventDefault();
    var popup = window.open(link.href, "solad_admin", "width=1320,height=880,scrollbars=yes,resizable=yes");
    if (popup) popup.focus(); else location.href = link.href;
});
</script>
HTML;
});

// 솔애드 영상 추가 기능 객체(\AdsManager\VideoMedia). 관리자 폴더를 못 찾거나 PHP 8.1 미만이면 null이고, 스킨은 지금 동작 그대로 둔다.
function solad_media()
{
    static $media = false;

    if ($media === false) {
        $media = null;
        $file = rtrim((string) SOLAD_MANAGER_PATH, '/').'/src/VideoMedia.php';
        if (version_compare(PHP_VERSION, '8.1.0', '>=') && (class_exists('\AdsManager\VideoMedia', false) || @is_file($file))) {
            if (!class_exists('\AdsManager\VideoMedia', false)) {
                require_once $file;
            }
            $media = \AdsManager\VideoMedia::gnuboard();
        }
    }
    return $media;
}

// PC나 모바일 스킨이 솔애드 동영상 갤러리인 게시판.
function solad_media_is_video_board($board)
{
    foreach (array('bo_skin', 'bo_mobile_skin') as $key) {
        if (isset($board[$key]) && preg_replace('#^theme/#', '', (string) $board[$key]) === 'solad_video') {
            return true;
        }
    }
    return false;
}

// 기능 켜기를 저장할 여분필드 번호와 그 칸에 이미 제목이 있는지. 제목이 같은 칸, 없으면 제목·값이 빈 첫 칸, 그것도 없으면 0.
function solad_media_slot($board)
{
    $empty = 0;
    for ($i = 1; $i <= 10; $i++) {
        $subject = isset($board['bo_'.$i.'_subj']) ? trim($board['bo_'.$i.'_subj']) : '';
        if ($subject === \AdsManager\VideoMedia::OPTION_SUBJECT) {
            return array($i, true);
        }
        if (!$empty && $subject === '' && (!isset($board['bo_'.$i]) || trim($board['bo_'.$i]) === '')) {
            $empty = $i;
        }
    }
    return array($empty, false);
}

// 관리자 > 게시판 수정: 코어 파일을 고치지 않고 "게시판 기능 설정" 뒤에 구획을 넣는다.
// adm_board_form_before는 화면 출력 전에 불리므로 여기서 출력을 잡아 두고, tail_sub에서 구획을 끼워 내보낸다.
// html_end()가 가장 안쪽 출력 버퍼를 닫으므로 그 전에(tail_sub) 이 버퍼를 먼저 닫는다.
add_event('adm_board_form_before', function ($board, $w) {
    if ($w !== 'u' || !solad_media_is_video_board($board)) {
        return;
    }
    $GLOBALS['solad_media_form'] = array('board' => $board, 'level' => ob_get_level() + 1);
    ob_start();
    add_event('tail_sub', 'solad_media_form_flush', 1);
}, G5_HOOK_DEFAULT_PRIORITY, 2);

function solad_media_form_flush()
{
    $state = isset($GLOBALS['solad_media_form']) ? $GLOBALS['solad_media_form'] : null;
    if (!$state || ob_get_level() !== $state['level']) {
        return;
    }
    unset($GLOBALS['solad_media_form']);

    $html = ob_get_clean();
    $section = solad_media_form_section($state['board']);
    $at = strpos($html, '<section id="anc_bo_design">');
    if ($at === false) {
        $at = strpos($html, '<div class="btn_fixed_top">');
    }
    if ($at !== false) {
        $html = substr($html, 0, $at).$section."\n\n".substr($html, $at);
        $extra = '<li><a href="#anc_bo_extra">여분필드</a></li>';
        $html = str_replace($extra, $extra."\n    ".'<li><a href="#anc_bo_solad_media">솔애드 영상</a></li>', $html);
    }
    echo $html;
}

function solad_media_form_section($board)
{
    global $pg_anchor;

    $media = solad_media();
    $detect = $media ? $media->detect(!empty($_GET['solad_media_refresh'])) : null;
    $available = $detect && !empty($detect['available']);
    $enabled = $media ? $media->boardFeatures($board) : array();
    $guide = SOLAD_URL.'/#/uploaded-videos';
    $refresh = G5_ADMIN_URL.'/board_form.php?w=u&amp;bo_table='.urlencode($board['bo_table']).'&amp;solad_media_refresh=1#anc_bo_solad_media';
    $features = array(
        'cover' => array('커버 이미지 생성', '영상의 한 장면을 목록 썸네일과 플레이어 포스터로 써요. 글에 이미지 첨부가 있으면 첨부가 먼저예요.'),
        'thumbnails' => array('진행바 미리보기 썸네일', '진행 막대에 마우스를 올리면 그 시점의 장면을 보여 줘요.'),
        'highlight' => array('하이라이트 미리보기', '목록에서 카드에 마우스를 올리면 원본 대신 소리 없는 짧은 클립을 재생해요.'),
    );

    if (!$media) {
        $status = version_compare(PHP_VERSION, '8.1.0', '>=')
            ? '솔애드 관리자 폴더에서 src/VideoMedia.php를 찾지 못했어요. extend/solad.config.php에 <code>define(\'SOLAD_MANAGER_PATH\', \'/솔애드/관리자/경로\');</code>를 넣어 주세요.'
            : 'PHP 8.1 이상에서 쓸 수 있어요. 지금 PHP는 '.PHP_VERSION.'이에요.';
    } elseif ($available) {
        $status = '<strong>사용할 수 있어요.</strong>';
        foreach (array('ffmpeg', 'ffprobe') as $tool) {
            $status .= '<br>'.$tool.' '.get_text($detect[$tool]['version']).' <span class="sound_only">경로</span>('.get_text($detect[$tool]['path']).')';
        }
    } else {
        $status = '<strong>'.get_text($detect['message']).'</strong><br>';
        $status .= $detect['reason'] === 'proc_open'
            ? 'PHP 설정(php.ini)의 disable_functions에서 proc_open을 빼 주세요.'
            : '서버에 ffmpeg를 설치해 주세요(예: <code>apt install ffmpeg</code>). 다른 경로에 있으면 extend/solad.config.php에 <code>define(\'SOLAD_FFMPEG_PATH\', \'/경로/ffmpeg\');</code>를 넣어 주세요.';
    }

    $slot_note = '';
    if ($media) {
        list($slot, $found) = solad_media_slot($board);
        if ($found) {
            $slot_note = '여분필드 '.$slot.'("'.\AdsManager\VideoMedia::OPTION_SUBJECT.'")에 저장해요.';
        } elseif ($slot) {
            $slot_note = '켜고 저장하면 빈 여분필드 '.$slot.'에 제목 "'.\AdsManager\VideoMedia::OPTION_SUBJECT.'"으로 저장해요.';
        } else {
            $slot_note = '여분필드에 빈 칸이 없어 저장할 수 없어요. 여분필드 한 칸을 비워 주세요.';
        }
    }

    ob_start();
    ?>
<section id="anc_bo_solad_media">
    <h2 class="h2_frm">솔애드 영상 추가 기능</h2>
    <?php echo $pg_anchor; ?>

    <div class="local_desc02 local_desc">
        <p>업로드한 영상으로 커버 이미지, 진행바 미리보기 썸네일, 하이라이트 클립을 만들어 이 게시판에서 씁니다. 켠 기능이고 만든 파일이 있을 때만 쓰고, 나머지는 지금처럼 동작해요.</p>
    </div>

    <div class="tbl_frm01 tbl_wrap">
        <table>
        <caption>솔애드 영상 추가 기능</caption>
        <colgroup>
            <col class="grid_4">
            <col>
        </colgroup>
        <tbody>
        <tr>
            <th scope="row">ffmpeg</th>
            <td>
                <?php echo $status; ?>
                <?php if ($media) { ?><br><a href="<?php echo $refresh; ?>">다시 확인</a><?php } ?>
            </td>
        </tr>
        <?php foreach ($features as $key => $feature) { ?>
        <tr>
            <th scope="row"><label for="solad_media_<?php echo $key; ?>"><?php echo $feature[0]; ?></label></th>
            <td>
                <span class="frm_info"><?php echo $feature[1]; ?> 생성은 <a href="<?php echo $guide; ?>" target="_blank" rel="noopener">솔애드 관리자 &gt; 업로드 동영상</a>에서 해요.</span>
                <input type="checkbox" name="solad_media_features[]" value="<?php echo $key; ?>" id="solad_media_<?php echo $key; ?>"<?php echo in_array($key, $enabled, true) ? ' checked' : ''; ?><?php echo $available ? '' : ' disabled'; ?>>
                <label for="solad_media_<?php echo $key; ?>">사용</label>
            </td>
        </tr>
        <?php } ?>
        <tr>
            <th scope="row">저장 위치</th>
            <td>
                <?php echo $available ? $slot_note : 'ffmpeg를 쓸 수 없어 바꿀 수 없어요. 저장한 값은 그대로 둬요.'; ?>
                <?php if ($available) { ?><input type="hidden" name="solad_media_form" value="1"><?php } ?>
            </td>
        </tr>
        </tbody>
        </table>
    </div>
</section>
    <?php
    return ob_get_clean();
}

// 게시판 수정 저장 뒤 기능 켜기를 여분필드에 쓴다. ffmpeg를 못 찾아 체크를 끈 화면에서 저장하면 값을 건드리지 않는다.
// 그누보드 데모 모드(check_demo)와 테마의 데모 관리자 가드가 이 저장보다 먼저 막는다.
add_event('admin_board_form_update', function ($bo_table, $w) {
    global $g5;

    if ($w !== 'u' || empty($_POST['solad_media_form']) || !($media = solad_media())) {
        return;
    }
    $detect = $media->detect();
    $board = get_board_db($bo_table, false);
    if (empty($detect['available']) || empty($board['bo_table']) || !solad_media_is_video_board($board)) {
        return;
    }

    $picked = isset($_POST['solad_media_features']) && is_array($_POST['solad_media_features']) ? $_POST['solad_media_features'] : array();
    $value = implode(',', array_values(array_intersect(\AdsManager\VideoMedia::FEATURES, $picked)));
    list($slot, $found) = solad_media_slot($board);
    if (!$slot) {
        if ($value === '') {
            return;
        }
        alert('다른 설정은 저장했지만, 여분필드에 빈 칸이 없어 솔애드 영상 추가 기능은 저장하지 못했어요. 여분필드 한 칸을 비운 뒤 다시 저장해 주세요.', G5_ADMIN_URL.'/board_form.php?w=u&bo_table='.urlencode($bo_table));
    }
    if (!$found && $value === '') {
        return;
    }

    sql_query(" update {$g5['board_table']}
                   set bo_{$slot}_subj = '".sql_real_escape_string(\AdsManager\VideoMedia::OPTION_SUBJECT)."',
                       bo_{$slot} = '".sql_real_escape_string($value)."'
                 where bo_table = '".sql_real_escape_string($board['bo_table'])."' ");
}, G5_HOOK_DEFAULT_PRIORITY, 2);
