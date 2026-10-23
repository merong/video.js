<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가
include_once($board_skin_path.'/request.lib.php');

// 댓글이 곧 처리 기록이다. 관리자가 상태를 바꾼 기록은 댓글 wr_1에 그 상태가 남아 있다.
$sr_stage_now = solad_request_is_stage($view['ca_name']) ? $view['ca_name'] : '접수';
?>

<script>
var char_min = parseInt(<?php echo $comment_min; ?>);
var char_max = parseInt(<?php echo $comment_max; ?>);
</script>

<!-- 처리 기록 { -->
<section id="bo_vc" class="sr-card sr-log" aria-labelledby="sr_log_title">
    <h3 class="sr-card-title" id="sr_log_title">처리 기록 <span class="sr-muted"><?php echo number_format($view['wr_comment'] + 1); ?></span></h3>

    <ol class="sr-log-list">
        <li class="sr-log-item">
            <span class="sr-log-dot is-draft" aria-hidden="true"></span>
            <div class="sr-log-body">
                <p class="sr-log-head">
                    <strong><?php echo get_text($view['wr_name']); ?></strong>
                    <?php echo solad_request_stage_badge('접수'); ?>
                    <time class="sr-muted" datetime="<?php echo date('Y-m-d\TH:i:s+09:00', strtotime($view['wr_datetime'])); ?>"><?php echo date('Y.m.d H:i', strtotime($view['wr_datetime'])); ?></time>
                </p>
                <p class="sr-log-text">광고 요청을 보냈어요.</p>
            </div>
        </li>
        <?php
        $sr_cmt_count = count($list);
        for ($i = 0; $i < $sr_cmt_count; $i++) {
            $comment_id = $list[$i]['wr_id'];
            $sr_cmt_stage = solad_request_is_stage($list[$i]['wr_1']) ? $list[$i]['wr_1'] : '';
            $sr_cmt_admin = $list[$i]['mb_id'] && is_admin($list[$i]['mb_id']);
            $sr_stage_map = solad_request_stages();
            $c_edit_href = $comment_common_url.'&amp;c_id='.$comment_id.'&amp;w=cu#bo_vc_w';
            $sr_cmt_depth = strlen($list[$i]['wr_comment_reply']);
        ?>
        <li class="sr-log-item<?php echo $sr_cmt_depth ? ' is-reply' : ''; ?>" id="c_<?php echo $comment_id; ?>">
            <span class="sr-log-dot is-<?php echo $sr_cmt_stage !== '' ? $sr_stage_map[$sr_cmt_stage] : 'note'; ?>" aria-hidden="true"></span>
            <div class="sr-log-body">
                <p class="sr-log-head">
                    <strong><?php echo $list[$i]['name']; ?></strong>
                    <?php if ($sr_cmt_admin) { ?><span class="sr-role">관리자</span><?php } ?>
                    <?php if ($sr_cmt_stage !== '') { ?><span class="sr-log-change">상태 <i class="fa fa-long-arrow-right" aria-hidden="true"></i><span class="sound_only">를</span> <?php echo solad_request_stage_badge($sr_cmt_stage); ?></span><?php } ?>
                    <?php if ($is_ip_view) { ?><span class="sr-muted">(<?php echo $list[$i]['ip']; ?>)</span><?php } ?>
                    <time class="sr-muted" datetime="<?php echo date('Y-m-d\TH:i:s+09:00', strtotime($list[$i]['datetime'])); ?>"><?php echo date('Y.m.d H:i', strtotime($list[$i]['datetime'])); ?></time>
                </p>
                <div class="sr-log-text"><?php echo $list[$i]['content']; ?></div>
                <?php if ($list[$i]['is_edit'] || $list[$i]['is_del']) { ?>
                <p class="sr-log-actions">
                    <?php if ($list[$i]['is_edit']) { ?><a href="<?php echo $c_edit_href; ?>" onclick="comment_box('<?php echo $comment_id; ?>', 'cu'); return false;">고치기</a><?php } ?>
                    <?php if ($list[$i]['is_del']) { ?><a href="<?php echo $list[$i]['del_link']; ?>" onclick="return comment_delete();">지우기</a><?php } ?>
                </p>
                <?php } ?>
                <span id="edit_<?php echo $comment_id; ?>" class="bo_vc_w"></span>
                <span id="reply_<?php echo $comment_id; ?>" class="bo_vc_w"></span>
                <input type="hidden" value="<?php echo strstr($list[$i]['wr_option'], 'secret'); ?>" id="secret_comment_<?php echo $comment_id; ?>">
                <textarea id="save_comment_<?php echo $comment_id; ?>" style="display:none"><?php echo get_text($list[$i]['content1'], 0); ?></textarea>
            </div>
        </li>
        <?php } ?>
    </ol>

    <?php if ($is_comment_write) {
        if ($w == '') $w = 'c';
    ?>
    <aside id="bo_vc_w" class="bo_vc_w sr-log-form">
        <h4 class="sound_only">처리 기록 남기기</h4>
        <form name="fviewcomment" id="fviewcomment" action="<?php echo $comment_action_url; ?>" onsubmit="return fviewcomment_submit(this);" method="post" autocomplete="off">
        <input type="hidden" name="w" value="<?php echo $w; ?>" id="w">
        <input type="hidden" name="bo_table" value="<?php echo $bo_table; ?>">
        <input type="hidden" name="wr_id" value="<?php echo $wr_id; ?>">
        <input type="hidden" name="comment_id" value="<?php echo $c_id; ?>" id="comment_id">
        <input type="hidden" name="sca" value="<?php echo $sca; ?>">
        <input type="hidden" name="sfl" value="<?php echo $sfl; ?>">
        <input type="hidden" name="stx" value="<?php echo $stx; ?>">
        <input type="hidden" name="spt" value="<?php echo $spt; ?>">
        <input type="hidden" name="page" value="<?php echo $page; ?>">
        <input type="hidden" name="is_good" value="">
        <input type="checkbox" name="wr_secret" value="secret" id="wr_secret" hidden>

        <?php if ($is_admin) { ?>
        <div class="sr-log-stage">
            <label for="sr_stage">상태</label>
            <select name="sr_stage" id="sr_stage">
                <option value="">그대로 두기 (<?php echo $sr_stage_now; ?>)</option>
                <?php foreach (solad_request_stages() as $sr_option => $sr_status) { if ($sr_option === $sr_stage_now) continue; ?>
                <option value="<?php echo $sr_option; ?>"><?php echo $sr_option; ?>(으)로 바꾸기</option>
                <?php } ?>
            </select>
            <span class="sr-help" id="sr_stage_help">보완 요청·반려는 이유를 꼭 적어 주세요.</span>
        </div>
        <?php } ?>

        <label for="wr_content" class="sound_only">처리 내용</label>
        <textarea id="wr_content" name="wr_content" maxlength="10000" required class="required" placeholder="<?php echo $is_admin ? '회원에게 남길 처리 내용을 적어 주세요.' : '보완한 내용이나 궁금한 점을 남겨 주세요.'; ?>"
        <?php if ($comment_min || $comment_max) { ?>onkeyup="check_byte('wr_content', 'char_count');"<?php } ?>><?php echo get_text($c_wr_content); ?></textarea>
        <?php if ($comment_min || $comment_max) { ?><p class="sr-help"><span id="char_count"></span>글자</p><script>check_byte('wr_content', 'char_count');</script><?php } ?>

        <div class="sr-log-submit">
            <?php if ($is_guest) { ?>
            <div class="sr-log-guest">
                <label for="wr_name" class="sound_only">이름<strong> 필수</strong></label>
                <input type="text" name="wr_name" value="<?php echo get_cookie('ck_sns_name'); ?>" id="wr_name" required class="frm_input required" size="20" placeholder="이름">
                <label for="wr_password" class="sound_only">비밀번호<strong> 필수</strong></label>
                <input type="password" name="wr_password" id="wr_password" required class="frm_input required" size="20" placeholder="비밀번호">
                <?php echo $captcha_html; ?>
            </div>
            <?php } ?>
            <button type="submit" id="btn_submit" class="sr-btn-primary btn"><?php echo $is_admin ? '처리하기' : '기록 남기기'; ?></button>
        </div>
        </form>
    </aside>
    <?php } ?>
</section>
<!-- } 처리 기록 -->

<?php if ($is_comment_write) { ?>
<script>
var save_before = "";

function fviewcomment_submit(f) {
    var pattern = /(^\s*)|(\s*$)/g;
    var stage = f.sr_stage ? f.sr_stage.value : "";
    var content = "";

    f.is_good.value = 0;
    $.ajax({
        url: g5_bbs_url + "/ajax.filter.php",
        type: "POST",
        data: { subject: "", content: f.wr_content.value },
        dataType: "json",
        async: false,
        cache: false,
        success: function(data) { content = data.content; }
    });
    if (content) {
        alert("내용에 금지단어('" + content + "')가 있어요.");
        f.wr_content.focus();
        return false;
    }

    f.wr_content.value = f.wr_content.value.replace(pattern, "");
    if ((stage == "보완 요청" || stage == "반려") && !f.wr_content.value) {
        alert(stage + " 이유를 적어 주세요. 회원이 처리 기록에서 확인해요.");
        f.wr_content.focus();
        return false;
    }
    if (char_min > 0 || char_max > 0) {
        check_byte("wr_content", "char_count");
        var cnt = parseInt(document.getElementById("char_count").innerHTML);
        if (char_min > 0 && char_min > cnt) {
            alert("처리 내용은 " + char_min + "글자 이상 써 주세요.");
            return false;
        }
        if (char_max > 0 && char_max < cnt) {
            alert("처리 내용은 " + char_max + "글자 이하로 써 주세요.");
            return false;
        }
    } else if (!f.wr_content.value) {
        alert("처리 내용을 적어 주세요.");
        f.wr_content.focus();
        return false;
    }

    if (typeof f.wr_name != "undefined") {
        f.wr_name.value = f.wr_name.value.replace(pattern, "");
        if (!f.wr_name.value) {
            alert("이름을 적어 주세요.");
            f.wr_name.focus();
            return false;
        }
    }
    if (typeof f.wr_password != "undefined") {
        f.wr_password.value = f.wr_password.value.replace(pattern, "");
        if (!f.wr_password.value) {
            alert("비밀번호를 적어 주세요.");
            f.wr_password.focus();
            return false;
        }
    }
    if (stage && !confirm("상태를 '" + stage + "'(으)로 바꾸고 기록을 남길까요?")) return false;

    <?php if ($is_guest) echo chk_captcha_js(); ?>

    set_comment_token(f);
    document.getElementById("btn_submit").disabled = "disabled";
    return true;
}

// 그누보드 댓글 수정 흐름을 그대로 쓴다. 고치는 동안에는 상태를 바꾸지 않는다.
function comment_box(comment_id, work) {
    var el_id = comment_id ? (work == "c" ? "reply_" : "edit_") + comment_id : "bo_vc_w";
    var respond = document.getElementById("fviewcomment");
    var stage = document.getElementById("sr_stage");

    if (save_before == el_id) return;
    if (save_before) document.getElementById(save_before).style.display = "none";

    document.getElementById(el_id).style.display = "";
    document.getElementById(el_id).appendChild(respond);
    document.getElementById("wr_content").value = "";
    if (work == "cu") {
        document.getElementById("wr_content").value = document.getElementById("save_comment_" + comment_id).value;
        if (typeof char_count != "undefined") check_byte("wr_content", "char_count");
        document.getElementById("wr_secret").checked = !!document.getElementById("secret_comment_" + comment_id).value;
    }
    if (stage) {
        stage.value = "";
        stage.disabled = work == "cu";
    }
    document.getElementById("comment_id").value = comment_id;
    document.getElementById("w").value = work;
    if (save_before) $("#captcha_reload").trigger("click");
    save_before = el_id;
}

function comment_delete() {
    return confirm("이 기록을 지울까요?\n\n상태는 바뀌지 않아요.");
}

comment_box("", "c");
</script>
<?php } ?>
