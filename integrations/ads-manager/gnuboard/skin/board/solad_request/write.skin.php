<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가
include_once($board_skin_path.'/request.lib.php');

add_stylesheet('<link rel="stylesheet" href="'.$board_skin_url.'/style.css">', 0);

$sr_stage = ($w == 'u' && solad_request_is_stage($write['ca_name'])) ? $write['ca_name'] : '접수';

// 집행 예정부터는 회원이 요청을 고칠 수 없다. 저장 단계(write_update.head.skin.php)에서도 막는다.
if ($w == 'u' && !$is_admin && solad_request_is_locked($sr_stage)) {
?>
<section id="sr_write" class="sr">
    <div class="sr-card sr-locked">
        <?php echo solad_request_stage_badge($sr_stage); ?>
        <h2>이 요청은 이제 고칠 수 없어요</h2>
        <p><?php echo $sr_stage; ?> 상태부터는 요청서를 고치거나 지울 수 없어요. 바꿀 내용은 요청의 처리 기록에 남겨 주세요.</p>
        <a href="<?php echo get_pretty_url($bo_table, $wr_id); ?>" class="sr-btn-primary btn">요청으로 돌아가기</a>
    </div>
</section>
<?php
    return;
}

$sr_value = function ($n) use ($w, $write) {
    return $w == 'u' ? solad_request_attr($write['wr_'.$n]) : '';
};
$sr_position = $w == 'u' ? $write['wr_4'] : '프리롤';
$sr_target = $w == 'u' ? $write['wr_9'] : '';
$sr_boards = solad_request_boards($bo_table);
$sr_media_slot = $is_file && $file_count >= 1;
$sr_media_url = $w == 'u' ? trim($write['wr_7']) : '';
$sr_existing = ($w == 'u' && $sr_media_slot && !empty($file[0]['file'])) ? $file[0] : null;
$sr_existing_url = $sr_existing ? (!empty($sr_existing['bf_fileurl']) ? $sr_existing['bf_fileurl'] : $sr_existing['path'].'/'.$sr_existing['file']) : '';
$sr_existing_kind = $sr_existing ? solad_request_media_kind($sr_existing['source']) : '';
$sr_mode = ($sr_media_url !== '' || !$sr_media_slot) ? 'url' : 'file';
$upload_max_filesize = get_filesize($board['bo_upload_size']);
?>

<section id="sr_write" class="sr">
    <h2 class="sound_only"><?php echo $g5['title']; ?></h2>

    <header class="sr-hero">
        <div>
            <p class="sr-eyebrow"><?php echo get_text($board['bo_subject']); ?></p>
            <h2 class="sr-hero-title"><?php echo $w == 'u' ? '광고 요청 고치기' : '광고 요청하기'; ?></h2>
        </div>
        <?php if ($w == 'u') echo solad_request_stage_badge($sr_stage); ?>
    </header>

    <?php if ($w != 'u') { ?>
    <div class="sr-guide" role="note">
        <strong>요청을 보내면 이렇게 진행돼요</strong>
        <ol>
            <li><b>접수</b> 요청서는 관리자와 나만 볼 수 있어요.</li>
            <li><b>검토</b> 관리자가 소재와 기간을 확인해요. 보완할 내용이 있으면 <b>보완 요청</b>으로 알려 드려요.</li>
            <li><b>집행 예정</b> 승인되면 희망 기간에 맞춰 광고가 나가요. 이때부터는 요청을 고치거나 지울 수 없어요.</li>
        </ol>
        <p>처리 결과와 답변은 요청 아래 처리 기록에 남아요.</p>
    </div>
    <?php } ?>

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
    <?php if ($is_category) { ?><input type="hidden" name="ca_name" value="<?php echo $sr_stage; ?>"><?php } ?>
    <?php
    $option = '';
    $option_hidden = '';
    if ($is_notice) {
        $option .= '<label class="sr-check"><input type="checkbox" id="notice" name="notice" value="1" '.$notice_checked.'> 공지(안내 글, 요청서 항목 없이 올려요)</label>';
    }
    if ($is_html) {
        if ($is_dhtml_editor) {
            $option_hidden .= '<input type="hidden" value="html1" name="html">';
        } else {
            $option .= '<label class="sr-check"><input type="checkbox" id="html" name="html" onclick="html_auto_br(this);" value="'.$html_value.'" '.$html_checked.'> html</label>';
        }
    }
    if ($is_secret) {
        if ($is_admin || $is_secret == 1) {
            $option .= '<label class="sr-check"><input type="checkbox" id="secret" name="secret" value="secret" '.$secret_checked.'> 비밀 요청</label>';
        } else {
            $option_hidden .= '<input type="hidden" name="secret" value="secret">';
        }
    }
    if ($is_mail) {
        $option .= '<label class="sr-check"><input type="checkbox" id="mail" name="mail" value="mail" '.$recv_email_checked.'> 처리 기록을 메일로 받기</label>';
    }
    echo $option_hidden;
    ?>

    <fieldset class="sr-section">
        <legend>광고 정보</legend>
        <div class="sr-field">
            <label class="sr-label" for="wr_subject">광고 이름 <strong class="sr-req">필수</strong></label>
            <div id="autosave_wrapper">
                <input type="text" name="wr_subject" value="<?php echo $subject; ?>" id="wr_subject" required class="frm_input full_input required" maxlength="255" placeholder="예) 가을 신메뉴 홍보">
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
        <div class="sr-grid">
            <div class="sr-field">
                <label class="sr-label" for="wr_1">광고주(업체명) <strong class="sr-req">필수</strong></label>
                <input type="text" name="wr_1" id="wr_1" value="<?php echo $sr_value(1); ?>" maxlength="100" required class="frm_input full_input required" placeholder="상호나 단체 이름" data-sr-request>
            </div>
            <div class="sr-field">
                <label class="sr-label" for="wr_6">클릭 URL <span class="sr-opt">선택</span></label>
                <input type="url" name="wr_6" id="wr_6" value="<?php echo $sr_value(6); ?>" maxlength="1000" class="frm_input full_input" placeholder="https://example.com/">
                <p class="sr-help">광고를 누르면 열 페이지예요. 비우면 누를 수 없는 광고가 돼요.</p>
            </div>
        </div>
    </fieldset>

    <fieldset class="sr-section">
        <legend>소재 <strong class="sr-req">필수</strong></legend>
        <?php if ($sr_media_slot) { ?>
        <div class="sr-segment" role="radiogroup" aria-label="소재 넣는 방법">
            <label><input type="radio" name="sr_mode" value="file" <?php echo $sr_mode == 'file' ? 'checked' : ''; ?>> 파일 올리기</label>
            <label><input type="radio" name="sr_mode" value="url" <?php echo $sr_mode == 'url' ? 'checked' : ''; ?>> 주소 입력</label>
        </div>

        <div class="sr-pane" data-sr-pane="file"<?php echo $sr_mode == 'file' ? '' : ' hidden'; ?>>
            <label for="bf_file_1" class="sound_only">소재 파일</label>
            <input type="file" name="bf_file[]" id="bf_file_1" accept="video/mp4,video/webm,image/jpeg,image/png,image/gif,image/webp,.mp4,.m4v,.webm,.jpg,.jpeg,.png,.gif,.webp" class="frm_file">
            <p class="sr-help">영상은 MP4·WebM, 15~30초, 1920×1080을 권해요. 이미지는 JPG·PNG·GIF·WebP. 한 파일 <?php echo $upload_max_filesize; ?> 이하.</p>
            <?php if ($is_file_content) { ?>
            <input type="text" name="bf_content[]" value="<?php echo $w == 'u' ? $file[0]['bf_content'] : ''; ?>" class="frm_input full_input" placeholder="소재 설명">
            <?php } ?>
            <?php if ($sr_existing) { ?>
            <label class="sr-check sr-existing"><input type="checkbox" id="bf_file_del0" name="bf_file_del[0]" value="1"> 지금 소재 <?php echo $sr_existing['source'].' ('.$sr_existing['size'].')'; ?> 지우기</label>
            <?php } ?>
        </div>
        <?php } ?>

        <div class="sr-pane" data-sr-pane="url"<?php echo $sr_mode == 'url' ? '' : ' hidden'; ?>>
            <label for="wr_7" class="sound_only">소재 주소</label>
            <input type="text" inputmode="url" name="wr_7" id="wr_7" value="<?php echo solad_request_attr($sr_media_url); ?>" maxlength="1000" class="frm_input full_input" placeholder="https://example.com/ad.mp4">
            <p class="sr-help">영상이나 이미지 파일 주소. http(s)://나 /로 시작해요.</p>
        </div>

        <div class="sr-preview" id="sr_preview"<?php echo $sr_existing_url || $sr_media_url ? '' : ' hidden'; ?>
             data-existing="<?php echo solad_request_attr($sr_existing_url); ?>" data-existing-kind="<?php echo $sr_existing_kind; ?>"></div>
        <p class="sr-help" id="sr_preview_info" role="status"></p>
    </fieldset>

    <fieldset class="sr-section">
        <legend>희망 집행</legend>
        <div class="sr-grid">
            <div class="sr-field">
                <span class="sr-label" id="sr_period_label">희망 기간 <strong class="sr-req">필수</strong></span>
                <div class="sr-period" role="group" aria-labelledby="sr_period_label">
                    <label for="wr_2" class="sound_only">시작일</label>
                    <input type="date" name="wr_2" id="wr_2" value="<?php echo $sr_value(2); ?>" required class="frm_input required" data-sr-request>
                    <span aria-hidden="true">–</span>
                    <label for="wr_3" class="sound_only">종료일</label>
                    <input type="date" name="wr_3" id="wr_3" value="<?php echo $sr_value(3); ?>" required class="frm_input required" data-sr-request>
                </div>
                <p class="sr-help" id="sr_period_info"></p>
            </div>
            <div class="sr-field">
                <label class="sr-label" for="wr_5">희망 노출 수 <strong class="sr-req">필수</strong></label>
                <div class="sr-unit">
                    <input type="text" inputmode="numeric" name="wr_5" id="wr_5" value="<?php echo $w == 'u' && $write['wr_5'] !== '' ? number_format((int) $write['wr_5']) : ''; ?>" maxlength="13" required class="frm_input required" placeholder="20,000" data-sr-request>
                    <span>회</span>
                </div>
            </div>
        </div>
        <div class="sr-field">
            <span class="sr-label" id="sr_position_label">희망 위치 <strong class="sr-req">필수</strong></span>
            <div class="sr-options" role="radiogroup" aria-labelledby="sr_position_label">
                <?php foreach (array('프리롤' => '본편 앞', '미드롤' => '본편 중간', '포스트롤' => '본편이 끝난 뒤') as $sr_option => $sr_help) { ?>
                <label class="sr-option"><input type="radio" name="wr_4" value="<?php echo $sr_option; ?>" <?php echo $sr_position === $sr_option ? 'checked' : ''; ?> data-sr-request> <b><?php echo $sr_option; ?></b> <span><?php echo $sr_help; ?></span></label>
                <?php } ?>
            </div>
        </div>
        <div class="sr-field">
            <label class="sr-label" for="wr_9">희망 게시판 <span class="sr-opt">선택</span></label>
            <select name="wr_9" id="wr_9" class="sr-select">
                <option value="">상관없음</option>
                <?php foreach ($sr_boards as $sr_table => $sr_subject) { ?>
                <option value="<?php echo $sr_table; ?>"<?php echo get_selected($sr_target, $sr_table); ?>><?php echo get_text($sr_subject); ?></option>
                <?php } ?>
            </select>
            <p class="sr-help">광고를 붙이고 싶은 동영상 게시판이 있으면 골라 주세요. 최종 위치는 관리자가 정해요.</p>
        </div>
    </fieldset>

    <fieldset class="sr-section">
        <legend>연락처</legend>
        <div class="sr-field">
            <label class="sr-label" for="wr_8">담당자 연락처 <strong class="sr-req">필수</strong></label>
            <input type="text" name="wr_8" id="wr_8" value="<?php echo $sr_value(8); ?>" maxlength="60" required class="frm_input full_input required" placeholder="010-0000-0000 또는 이메일" data-sr-request>
            <p class="sr-help">처리 기록 말고 따로 연락이 필요할 때만 써요. 관리자와 나만 볼 수 있어요.</p>
        </div>
        <?php if ($is_name || $is_password || $is_email || $is_homepage) { ?>
        <div class="sr-field sr-inline">
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
    </fieldset>

    <fieldset class="sr-section">
        <legend>요청 내용</legend>
        <div class="sr-field">
            <label class="sr-label sound_only" for="wr_content">요청 내용</label>
            <div class="wr_content <?php echo $is_dhtml_editor ? $config['cf_editor'] : ''; ?>">
                <?php if ($write_min || $write_max) { ?>
                <p id="char_count_desc">최소 <strong><?php echo $write_min; ?></strong>글자, 최대 <strong><?php echo $write_max; ?></strong>글자까지 쓸 수 있어요.</p>
                <?php } ?>
                <?php echo $editor_html; ?>
                <?php if ($write_min || $write_max) { ?>
                <div id="char_count_wrap"><span id="char_count"></span>글자</div>
                <?php } ?>
            </div>
            <p class="sr-help">광고의 목적, 꼭 지켜야 할 시간대나 대상, 소재에 대한 설명을 적어 주세요.</p>
        </div>

        <?php for ($i = 1; $is_file && $i < $file_count; $i++) { ?>
        <div class="sr-field">
            <label class="sr-label" for="bf_file_<?php echo $i + 1; ?>">참고 자료 <?php echo $i; ?> <span class="sr-opt">선택</span></label>
            <input type="file" name="bf_file[]" id="bf_file_<?php echo $i + 1; ?>" title="용량 <?php echo $upload_max_filesize; ?> 이하" class="frm_file">
            <?php if ($is_file_content) { ?>
            <input type="text" name="bf_content[]" value="<?php echo $w == 'u' ? $file[$i]['bf_content'] : ''; ?>" class="frm_input full_input" placeholder="파일 설명">
            <?php } ?>
            <?php if ($w == 'u' && $file[$i]['file']) { ?>
            <label class="sr-check sr-existing"><input type="checkbox" id="bf_file_del<?php echo $i; ?>" name="bf_file_del[<?php echo $i; ?>]" value="1"> <?php echo $file[$i]['source'].' ('.$file[$i]['size'].')'; ?> 지우기</label>
            <?php } ?>
        </div>
        <?php } ?>

        <?php if ($option) { ?>
        <div class="sr-field sr-inline"><span class="sound_only">옵션</span><?php echo $option; ?></div>
        <?php } ?>
    </fieldset>

    <?php if ($is_use_captcha) { ?>
    <div class="sr-field"><?php echo $captcha_html; ?></div>
    <?php } ?>

    <div class="sr-submit">
        <a href="<?php echo $w == 'u' ? get_pretty_url($bo_table, $wr_id) : get_pretty_url($bo_table); ?>" class="btn_cancel btn">취소</a>
        <button type="submit" id="btn_submit" accesskey="s" class="sr-btn-primary btn"><?php echo $w == 'u' ? '고친 요청 저장' : '광고 요청 보내기'; ?></button>
    </div>
    </form>

    <script src="<?php echo $board_skin_url; ?>/write.js"
            data-max-bytes="<?php echo (int) $board['bo_upload_size']; ?>"
            data-max-label="<?php echo solad_request_attr($upload_max_filesize); ?>"></script>
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

        if (!sr_request_ready(f)) return false;

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
            alert("광고 이름에 금지단어('" + subject + "')가 있어요.");
            f.wr_subject.focus();
            return false;
        }
        if (content) {
            alert("요청 내용에 금지단어('" + content + "')가 있어요.");
            if (typeof(ed_wr_content) != "undefined") ed_wr_content.returnFalse();
            else f.wr_content.focus();
            return false;
        }

        if (document.getElementById("char_count") && (char_min > 0 || char_max > 0)) {
            var cnt = parseInt(check_byte("wr_content", "char_count"));
            if (char_min > 0 && char_min > cnt) {
                alert("요청 내용은 " + char_min + "글자 이상 써 주세요.");
                return false;
            }
            if (char_max > 0 && char_max < cnt) {
                alert("요청 내용은 " + char_max + "글자 이하로 써 주세요.");
                return false;
            }
        }

        <?php echo $captcha_js; ?>

        document.getElementById("btn_submit").disabled = "disabled";
        return true;
    }
    </script>
</section>
