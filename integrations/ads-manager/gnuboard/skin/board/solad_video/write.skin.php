<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가
include_once($board_skin_path.'/solad.lib.php');

add_stylesheet('<link rel="stylesheet" href="'.$board_skin_url.'/style.css">', 0);

// 첨부 1번 칸은 영상 파일이나 HLS 묶음(zip), 2번 칸은 썸네일, 나머지는 일반 첨부다.
$sv_video_slot = $is_file && $file_count >= 1;
$sv_thumb_slot = $is_file && $file_count >= 2;
$sv_settings = solad_video_settings($board);
// 그누보드는 바이트 수로 알려 주므로 100M처럼 읽기 쉬운 단위로 바꾼다.
$upload_max_filesize = get_filesize($board['bo_upload_size']);
$sv_sources = array(
    'file' => array('영상 파일', 'MP4·WebM 올리기'),
    'hls_zip' => array('HLS 묶음', 'm3u8+조각 zip 올리기'),
    'hls_url' => array('HLS 주소', '외부 .m3u8 주소'),
    'url' => array('영상 주소', '외부 MP4·WebM 주소'),
);
if (!$sv_video_slot) {
    unset($sv_sources['file'], $sv_sources['hls_zip']);
}
$sv_source = $w == 'u' ? solad_video_source_type($write) : ($sv_video_slot ? 'file' : 'hls_url');
if (!isset($sv_sources[$sv_source])) {
    $sv_source = 'hls_url';
}
$sv_url = ($sv_source === 'url' || $sv_source === 'hls_url') && $w == 'u' ? trim($write['wr_1']) : '';
$sv_hls_current = $sv_source === 'hls_zip' && $w == 'u' ? trim($write['wr_1']) : '';
$sv_existing = ($w == 'u' && $sv_video_slot && !empty($file[0]['file'])) ? $file[0] : null;
$sv_existing_video = $sv_existing && preg_match('/\.('.SOLAD_VIDEO_EXTENSIONS.')$/i', $sv_existing['source']) ? solad_video_file_url($sv_existing) : '';
$sv_existing_thumb = ($w == 'u' && $sv_thumb_slot && !empty($file[1]['file'])) ? $file[1] : null;
?>

<section id="sv_write" class="sv">
    <header class="sv-head">
        <div class="sv-head-text">
            <p class="sv-bar-title"><?php echo get_text($board['bo_subject']); ?></p>
            <h2 class="sv-head-title"><?php echo isset($title_msg) ? $title_msg : $g5['title']; ?></h2>
        </div>
    </header>

    <form name="fwrite" id="fwrite" action="<?php echo $action_url; ?>" onsubmit="return fwrite_submit(this);" method="post" enctype="multipart/form-data" autocomplete="off" style="width:<?php echo $width; ?>">
    <input type="hidden" name="uid" value="<?php echo get_uniqid(); ?>">
    <input type="hidden" name="w" value="<?php echo $w; ?>">
    <input type="hidden" name="bo_table" value="<?php echo $bo_table; ?>">
    <input type="hidden" name="wr_id" value="<?php echo $wr_id; ?>">
    <input type="hidden" name="sca" value="<?php echo $sca; ?>">
    <input type="hidden" name="sfl" value="<?php echo $sfl; ?>">
    <input type="hidden" name="stx" value="<?php echo $stx; ?>">
    <input type="hidden" name="spt" value="<?php echo $spt; ?>">
    <input type="hidden" name="sst" value="<?php echo $sst; ?>">
    <input type="hidden" name="sod" value="<?php echo $sod; ?>">
    <input type="hidden" name="page" value="<?php echo $page; ?>">
    <input type="hidden" name="wr_2" id="wr_2" value="<?php echo $w == 'u' ? solad_attr($write['wr_2']) : ''; ?>">
    <?php
    $option = '';
    $option_hidden = '';
    if ($is_notice) {
        $option .= '<label class="sv-check"><input type="checkbox" id="notice" name="notice" value="1" '.$notice_checked.'> 공지</label>';
    }
    if ($is_html) {
        if ($is_dhtml_editor) {
            $option_hidden .= '<input type="hidden" value="html1" name="html">';
        } else {
            $option .= '<label class="sv-check"><input type="checkbox" id="html" name="html" onclick="html_auto_br(this);" value="'.$html_value.'" '.$html_checked.'> html</label>';
        }
    }
    if ($is_secret) {
        if ($is_admin || $is_secret == 1) {
            $option .= '<label class="sv-check"><input type="checkbox" id="secret" name="secret" value="secret" '.$secret_checked.'> 비밀글</label>';
        } else {
            $option_hidden .= '<input type="hidden" name="secret" value="secret">';
        }
    }
    if ($is_mail) {
        $option .= '<label class="sv-check"><input type="checkbox" id="mail" name="mail" value="mail" '.$recv_email_checked.'> 답변메일받기</label>';
    }
    echo $option_hidden;
    ?>

    <div class="sv-field">
        <span class="sv-label" id="sv_video_label">영상 <strong class="sv-req">필수</strong></span>

        <div class="sv-source" role="radiogroup" aria-labelledby="sv_video_label">
            <?php foreach ($sv_sources as $sv_key => $sv_text) { ?>
            <label class="sv-source-item">
                <input type="radio" name="sv_source" value="<?php echo $sv_key; ?>" <?php echo $sv_source === $sv_key ? 'checked' : ''; ?>>
                <span class="sv-source-icon" aria-hidden="true"><?php echo $sv_key === 'file' ? '▶' : ($sv_key === 'hls_zip' ? '⧉' : ($sv_key === 'hls_url' ? '≋' : '↗')); ?></span>
                <strong><?php echo $sv_text[0]; ?></strong>
                <small><?php echo $sv_text[1]; ?></small>
            </label>
            <?php } ?>
        </div>

        <?php if ($sv_video_slot) { ?>
        <div class="sv-pane" data-sv-pane="file hls_zip"<?php echo $sv_source === 'file' || $sv_source === 'hls_zip' ? '' : ' hidden'; ?>>
            <label for="bf_file_1" class="sound_only">영상 파일이나 HLS 묶음</label>
            <input type="file" name="bf_file[]" id="bf_file_1" accept="<?php echo $sv_source === 'hls_zip' ? '.zip,application/zip' : 'video/mp4,video/webm,.mp4,.m4v,.webm'; ?>" class="frm_file">
            <p class="sv-help" data-sv-for="file">MP4·WebM 파일, <?php echo $upload_max_filesize; ?> 이하. 고르면 재생 시간과 썸네일을 자동으로 채워요.</p>
            <div class="sv-help sv-guide" data-sv-for="hls_zip">
                <p>재생 목록(.m3u8)과 조각 파일(.ts, .m4s, 초기화 .mp4)을 zip 하나로 묶어 올려 주세요. 폴더째 넣어도 되고, <?php echo $upload_max_filesize; ?> 이하여야 해요.</p>
                <p>저장하면 서버에서 묶음을 풀어요. 마스터 재생 목록이 있으면 그것을 쓰고, 재생 시간도 재생 목록에서 계산해요. 썸네일은 이미지를 직접 골라 주세요.</p>
            </div>
            <?php if ($is_file_content) { ?>
            <input type="text" name="bf_content[]" value="<?php echo $w == 'u' ? $file[0]['bf_content'] : ''; ?>" class="frm_input full_input" placeholder="파일 설명">
            <?php } ?>
            <?php if ($sv_existing_video) { ?>
            <label class="sv-check sv-existing" data-sv-for="file"><input type="checkbox" id="bf_file_del0" name="bf_file_del[0]" value="1"> 지금 파일 <?php echo $sv_existing['source'].' ('.$sv_existing['size'].')'; ?> 지우기</label>
            <?php } ?>
            <?php if ($sv_hls_current) { ?>
            <p class="sv-existing" data-sv-for="hls_zip">지금 HLS: <code><?php echo solad_attr(basename(parse_url($sv_hls_current, PHP_URL_PATH))); ?></code><?php echo $write['wr_2'] ? ' · '.solad_video_duration($write['wr_2']) : ''; ?>. 새 zip을 고르면 바꿔요.</p>
            <?php } ?>
        </div>
        <?php } ?>

        <div class="sv-pane" data-sv-pane="hls_url url"<?php echo $sv_source === 'hls_url' || $sv_source === 'url' ? '' : ' hidden'; ?>>
            <label for="wr_1" class="sound_only">영상 주소</label>
            <input type="text" inputmode="url" name="wr_1" id="wr_1" value="<?php echo solad_attr($sv_url); ?>" maxlength="1000" class="frm_input full_input" placeholder="<?php echo $sv_source === 'url' ? 'https://example.com/video.mp4' : 'https://example.com/live/index.m3u8'; ?>">
            <p class="sv-help" data-sv-for="hls_url">다른 서버의 HLS 재생 목록(.m3u8) 주소. 미디어 재생 목록과 마스터 재생 목록 모두 돼요. 그 서버가 이 사이트에서 재생하도록(CORS) 허용해야 해요.</p>
            <p class="sv-help" data-sv-for="url">MP4·WebM 파일 주소. http(s)://나 /로 시작해요.</p>
        </div>

        <div class="sv-preview" id="sv_preview_box" hidden>
            <video id="sv_preview" controls muted playsinline preload="metadata"></video>
            <p class="sv-help" id="sv_preview_info" role="status"></p>
        </div>
        <input type="hidden" id="sv_initial_src" value="<?php echo solad_attr($sv_source === 'file' ? $sv_existing_video : ($sv_source === 'hls_zip' ? $sv_hls_current : $sv_url)); ?>">
    </div>

    <?php if ($sv_thumb_slot) { ?>
    <div class="sv-field">
        <label class="sv-label" for="bf_file_2">썸네일 이미지 <span class="sv-opt">선택</span></label>
        <div class="sv-thumb-row">
            <div class="sv-thumb-preview" id="sv_thumb_preview">
                <?php if ($sv_existing_thumb) { ?><img src="<?php echo solad_attr(solad_video_file_url($sv_existing_thumb)); ?>" alt="지금 썸네일"><?php } ?>
            </div>
            <div>
                <input type="file" name="bf_file[]" id="bf_file_2" accept="image/jpeg,image/png,image/webp,image/gif" class="frm_file">
                <button type="button" class="btn_b02 btn" id="sv_capture" hidden>지금 장면을 썸네일로</button>
                <p class="sv-help">비워 두면 영상을 고를 때 1초 지점 장면으로 만들어요. HLS 묶음은 이미지를 직접 골라 주세요.</p>
                <?php if ($is_file_content) { ?>
                <input type="text" name="bf_content[]" value="<?php echo $w == 'u' ? $file[1]['bf_content'] : ''; ?>" class="frm_input full_input" placeholder="이미지 설명">
                <?php } ?>
                <?php if ($sv_existing_thumb) { ?>
                <label class="sv-check sv-existing"><input type="checkbox" id="bf_file_del1" name="bf_file_del[1]" value="1"> 지금 썸네일 <?php echo $sv_existing_thumb['source']; ?> 지우기</label>
                <?php } ?>
            </div>
        </div>
    </div>
    <?php } ?>

    <?php if ($is_category) { ?>
    <div class="sv-field">
        <label class="sv-label" for="ca_name">분류 <strong class="sv-req">필수</strong></label>
        <select name="ca_name" id="ca_name" required>
            <option value="">분류를 고르세요</option>
            <?php echo $category_option; ?>
        </select>
    </div>
    <?php } ?>

    <?php if ($is_name || $is_password || $is_email || $is_homepage) { ?>
    <div class="sv-field sv-inline">
        <?php if ($is_name) { ?>
        <label for="wr_name" class="sound_only">이름<strong>필수</strong></label>
        <input type="text" name="wr_name" value="<?php echo $name; ?>" id="wr_name" required class="frm_input required" placeholder="이름">
        <?php } ?>
        <?php if ($is_password) { ?>
        <label for="wr_password" class="sound_only">비밀번호<strong>필수</strong></label>
        <input type="password" name="wr_password" id="wr_password" <?php echo $password_required; ?> class="frm_input <?php echo $password_required; ?>" placeholder="비밀번호">
        <?php } ?>
        <?php if ($is_email) { ?>
        <label for="wr_email" class="sound_only">이메일</label>
        <input type="text" name="wr_email" value="<?php echo $email; ?>" id="wr_email" class="frm_input email" placeholder="이메일">
        <?php } ?>
        <?php if ($is_homepage) { ?>
        <label for="wr_homepage" class="sound_only">홈페이지</label>
        <input type="text" name="wr_homepage" value="<?php echo $homepage; ?>" id="wr_homepage" class="frm_input" placeholder="홈페이지">
        <?php } ?>
    </div>
    <?php } ?>

    <?php if ($option) { ?>
    <div class="sv-field sv-inline"><span class="sound_only">옵션</span><?php echo $option; ?></div>
    <?php } ?>

    <div class="sv-field">
        <label class="sv-label" for="wr_subject">제목 <strong class="sv-req">필수</strong></label>
        <div id="autosave_wrapper">
            <input type="text" name="wr_subject" value="<?php echo $subject; ?>" id="wr_subject" required class="frm_input full_input required" maxlength="255" placeholder="영상 제목">
            <?php if ($is_member) { ?>
            <script src="<?php echo G5_JS_URL; ?>/autosave.js"></script>
            <?php if ($editor_content_js) echo $editor_content_js; ?>
            <button type="button" id="btn_autosave" class="btn_frmline">임시 저장된 글 (<span id="autosave_count"><?php echo $autosave_count; ?></span>)</button>
            <div id="autosave_pop">
                <strong>임시 저장된 글 목록</strong>
                <ul></ul>
                <div><button type="button" class="autosave_close">닫기</button></div>
            </div>
            <?php } ?>
        </div>
    </div>

    <div class="sv-field">
        <label class="sv-label" for="wr_content">설명 <strong class="sv-req">필수</strong></label>
        <div class="wr_content <?php echo $is_dhtml_editor ? $config['cf_editor'] : ''; ?>">
            <?php if ($write_min || $write_max) { ?>
            <p id="char_count_desc">최소 <strong><?php echo $write_min; ?></strong>글자, 최대 <strong><?php echo $write_max; ?></strong>글자까지 쓸 수 있어요.</p>
            <?php } ?>
            <?php echo $editor_html; ?>
            <?php if ($write_min || $write_max) { ?>
            <div id="char_count_wrap"><span id="char_count"></span>글자</div>
            <?php } ?>
        </div>
    </div>

    <?php for ($i = 1; $is_link && $i <= G5_LINK_COUNT; $i++) { ?>
    <div class="sv-field">
        <label class="sv-label" for="wr_link<?php echo $i; ?>">관련 링크 <?php echo $i; ?></label>
        <input type="text" name="wr_link<?php echo $i; ?>" value="<?php if ($w == 'u') { echo $write['wr_link'.$i]; } ?>" id="wr_link<?php echo $i; ?>" class="frm_input full_input">
    </div>
    <?php } ?>

    <?php for ($i = 2; $is_file && $i < $file_count; $i++) { ?>
    <div class="sv-field">
        <label class="sv-label" for="bf_file_<?php echo $i + 1; ?>">첨부파일 <?php echo $i - 1; ?></label>
        <input type="file" name="bf_file[]" id="bf_file_<?php echo $i + 1; ?>" title="용량 <?php echo $upload_max_filesize; ?> 이하" class="frm_file">
        <?php if ($is_file_content) { ?>
        <input type="text" name="bf_content[]" value="<?php echo $w == 'u' ? $file[$i]['bf_content'] : ''; ?>" class="frm_input full_input" placeholder="파일 설명">
        <?php } ?>
        <?php if ($w == 'u' && $file[$i]['file']) { ?>
        <label class="sv-check sv-existing"><input type="checkbox" id="bf_file_del<?php echo $i; ?>" name="bf_file_del[<?php echo $i; ?>]" value="1"> <?php echo $file[$i]['source'].' ('.$file[$i]['size'].')'; ?> 지우기</label>
        <?php } ?>
    </div>
    <?php } ?>

    <?php if ($is_use_captcha) { ?>
    <div class="sv-field"><?php echo $captcha_html; ?></div>
    <?php } ?>

    <div class="sv-submit">
        <a href="<?php echo get_pretty_url($bo_table); ?>" class="btn_cancel btn">취소</a>
        <button type="submit" id="btn_submit" accesskey="s" class="btn_submit btn">올리기</button>
    </div>
    </form>

    <script src="<?php echo $board_skin_url; ?>/write.js"
            data-max-bytes="<?php echo (int) $board['bo_upload_size']; ?>"
            data-max-label="<?php echo solad_attr($upload_max_filesize); ?>"
            data-solad-base="<?php echo solad_attr($sv_settings['base']); ?>"></script>
    <script>
    <?php if ($write_min || $write_max) { ?>
    var char_min = parseInt(<?php echo $write_min; ?>);
    var char_max = parseInt(<?php echo $write_max; ?>);
    check_byte("wr_content", "char_count");
    $(function() {
        $("#wr_content").on("keyup", function() { check_byte("wr_content", "char_count"); });
    });
    <?php } ?>

    function html_auto_br(obj) {
        if (obj.checked) {
            obj.value = confirm("자동 줄바꿈을 할까요?\n\n글에서 줄을 바꾼 곳을 <br> 태그로 바꿔요.") ? "html2" : "html1";
        } else {
            obj.value = "";
        }
    }

    function fwrite_submit(f) {
        <?php echo $editor_js; ?>

        if (!sv_video_ready(f)) return false;

        var subject = "";
        var content = "";
        $.ajax({
            url: g5_bbs_url + "/ajax.filter.php",
            type: "POST",
            data: { subject: f.wr_subject.value, content: f.wr_content.value },
            dataType: "json",
            async: false,
            cache: false,
            success: function(data) {
                subject = data.subject;
                content = data.content;
            }
        });
        if (subject) {
            alert("제목에 금지단어('" + subject + "')가 있어요.");
            f.wr_subject.focus();
            return false;
        }
        if (content) {
            alert("설명에 금지단어('" + content + "')가 있어요.");
            if (typeof(ed_wr_content) != "undefined") ed_wr_content.returnFalse();
            else f.wr_content.focus();
            return false;
        }

        if (document.getElementById("char_count") && (char_min > 0 || char_max > 0)) {
            var cnt = parseInt(check_byte("wr_content", "char_count"));
            if (char_min > 0 && char_min > cnt) {
                alert("설명은 " + char_min + "글자 이상 써 주세요.");
                return false;
            }
            if (char_max > 0 && char_max < cnt) {
                alert("설명은 " + char_max + "글자 이하로 써 주세요.");
                return false;
            }
        }

        <?php echo $captcha_js; ?>

        document.getElementById("btn_submit").disabled = "disabled";
        return true;
    }
    </script>
</section>
