<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가
include_once(G5_LIB_PATH.'/thumbnail.lib.php');
include_once($board_skin_path.'/solad.lib.php');

add_stylesheet('<link rel="stylesheet" href="'.$board_skin_url.'/style.css">', 0);

$sv_settings = solad_video_settings($board);
$sv_src = solad_video_source($view, $view['file']);
$sv_engine = solad_video_engine($sv_src);
$sv_video_file = solad_video_pick_file($view['file'], SOLAD_VIDEO_EXTENSIONS);
$sv_poster_file = solad_video_pick_file($view['file'], SOLAD_IMAGE_EXTENSIONS);
$sv_poster = $sv_poster_file ? solad_video_file_url($sv_poster_file) : '';
$sv_duration = solad_video_duration($view['wr_2']);
$sv_next = solad_video_next_list($bo_table, $write_table, $view, 8);

// 영상과 썸네일로 쓴 첨부는 첨부파일 목록에서 뺀다.
$sv_used = array();
if ($sv_video_file && $sv_src === solad_video_file_url($sv_video_file)) {
    $sv_used[] = $sv_video_file['no'];
}
if ($sv_poster_file) {
    $sv_used[] = $sv_poster_file['no'];
}
$sv_images = array();
$sv_downloads = array();
for ($i = 0; $i < count($view['file']); $i++) {
    if (empty($view['file'][$i]['source']) || in_array($i, $sv_used, true)) {
        continue;
    }
    if ($view['file'][$i]['view']) {
        $sv_images[] = $view['file'][$i];
    } else {
        $sv_downloads[] = $view['file'][$i];
    }
}
$sv_links = isset($view['link']) ? array_filter($view['link']) : array();
$sv_more = $update_href || $delete_href || $reply_href || $copy_href || $move_href || $scrap_href || $write_href;
?>

<!-- 솔애드 동영상 보기 { -->
<article id="sv_view" class="sv sv-watch" style="width:<?php echo $width; ?>">
<div class="sv-watch-grid">

    <div class="sv-watch-main">
        <div class="sv-stage">
            <?php if ($sv_src) { ?>
            <div id="sv_player"
                 data-solad-player
                 data-video-id="<?php echo solad_attr(solad_video_id($bo_table, $view['wr_id'])); ?>"
                 data-src="<?php echo solad_attr($sv_src); ?>"
                 data-title="<?php echo get_text($view['wr_subject']); ?>"
                 <?php if ($sv_engine) { ?>data-engine="<?php echo $sv_engine; ?>"<?php } ?>
                 <?php if ($sv_poster) { ?>data-poster="<?php echo solad_attr($sv_poster); ?>"<?php } ?>></div>
            <script>
            // 솔애드를 불러오지 못하면 브라우저 기본 플레이어로 본편만 보여 준다. HLS는 Safari처럼 HLS를 바로 재생하는 브라우저에서만 나온다.
            function sv_player_fallback() {
                var node = document.getElementById("sv_player");
                if (!node || node.classList.contains("is-fallback") || node.querySelector("video-player, video")) return;
                var video = document.createElement("video");
                video.controls = true;
                video.playsInline = true;
                video.preload = "metadata";
                video.src = node.getAttribute("data-src");
                if (node.getAttribute("data-poster")) video.poster = node.getAttribute("data-poster");
                node.classList.add("is-fallback");
                node.appendChild(video);
            }
            document.getElementById("sv_player").addEventListener("solad-error", sv_player_fallback);
            </script>
            <script type="module" src="<?php echo solad_attr($sv_settings['base']); ?>/player/loader.js" onerror="sv_player_fallback()"></script>
            <?php } else { ?>
            <div class="sv-stage-empty">
                <?php if ($sv_poster) { ?><img src="<?php echo solad_attr($sv_poster); ?>" alt=""><?php } ?>
                <p>이 글에는 영상이 없어요.</p>
            </div>
            <?php } ?>
        </div>

        <h2 class="sv-watch-title"><?php echo cut_str(get_text($view['wr_subject']), 90); ?></h2>

        <div class="sv-watch-bar">
            <div class="sv-author">
                <span class="sv-avatar"><?php echo solad_video_avatar($view['mb_id'], $view['wr_name']); ?></span>
                <span class="sv-author-text">
                    <strong><span class="sound_only">작성자 </span><?php echo $view['name']; ?></strong>
                    <?php if ($is_ip_view) { ?><span class="sv-author-sub"><?php echo $ip; ?></span><?php } ?>
                </span>
            </div>

            <div class="sv-pills">
                <?php if ($good_href || $nogood_href || $board['bo_use_good'] || $board['bo_use_nogood']) { ?>
                <span class="sv-pill-group">
                    <?php if ($good_href) { ?>
                    <a href="<?php echo $good_href.'&amp;'.$qstr; ?>" id="good_button" class="sv-pill" title="추천"><i class="fa fa-thumbs-o-up" aria-hidden="true"></i> <strong><?php echo number_format($view['wr_good']); ?></strong><span class="sound_only">추천</span></a>
                    <?php } elseif ($board['bo_use_good']) { ?>
                    <span class="sv-pill" title="추천"><i class="fa fa-thumbs-o-up" aria-hidden="true"></i> <strong><?php echo number_format($view['wr_good']); ?></strong><span class="sound_only">추천</span></span>
                    <?php } ?>
                    <?php if ($nogood_href) { ?>
                    <a href="<?php echo $nogood_href.'&amp;'.$qstr; ?>" id="nogood_button" class="sv-pill" title="비추천"><i class="fa fa-thumbs-o-down" aria-hidden="true"></i> <strong><?php echo number_format($view['wr_nogood']); ?></strong><span class="sound_only">비추천</span></a>
                    <?php } elseif ($board['bo_use_nogood']) { ?>
                    <span class="sv-pill" title="비추천"><i class="fa fa-thumbs-o-down" aria-hidden="true"></i> <strong><?php echo number_format($view['wr_nogood']); ?></strong><span class="sound_only">비추천</span></span>
                    <?php } ?>
                </span>
                <?php } ?>
                <button type="button" class="sv-pill" id="sv_share"><i class="fa fa-share" aria-hidden="true"></i> 링크 복사</button>
                <a href="<?php echo $list_href; ?>" class="sv-pill"><i class="fa fa-th-large" aria-hidden="true"></i> 목록</a>
                <?php if ($sv_more) { ?>
                <details class="sv-more">
                    <summary class="sv-pill" title="더보기"><i class="fa fa-ellipsis-h" aria-hidden="true"></i><span class="sound_only">더보기</span></summary>
                    <ul class="sv-menu">
                        <?php if ($update_href) { ?><li><a href="<?php echo $update_href; ?>"><i class="fa fa-pencil" aria-hidden="true"></i> 수정</a></li><?php } ?>
                        <?php if ($delete_href) { ?><li><a href="<?php echo $delete_href; ?>" onclick="del(this.href); return false;"><i class="fa fa-trash-o" aria-hidden="true"></i> 삭제</a></li><?php } ?>
                        <?php if ($reply_href) { ?><li><a href="<?php echo $reply_href; ?>"><i class="fa fa-reply" aria-hidden="true"></i> 답변</a></li><?php } ?>
                        <?php if ($copy_href) { ?><li><a href="<?php echo $copy_href; ?>" onclick="board_move(this.href); return false;"><i class="fa fa-files-o" aria-hidden="true"></i> 복사</a></li><?php } ?>
                        <?php if ($move_href) { ?><li><a href="<?php echo $move_href; ?>" onclick="board_move(this.href); return false;"><i class="fa fa-arrows" aria-hidden="true"></i> 이동</a></li><?php } ?>
                        <?php if ($scrap_href) { ?><li><a href="<?php echo $scrap_href; ?>" target="_blank" onclick="win_scrap(this.href); return false;"><i class="fa fa-bookmark-o" aria-hidden="true"></i> 스크랩</a></li><?php } ?>
                        <?php if ($write_href) { ?><li><a href="<?php echo $write_href; ?>"><i class="fa fa-video-camera" aria-hidden="true"></i> 영상 올리기</a></li><?php } ?>
                    </ul>
                </details>
                <?php } ?>
            </div>
            <p class="sv-toast" id="sv_toast" role="status"></p>
        </div>

        <section class="sv-desc">
            <h3 class="sound_only">영상 설명</h3>
            <p class="sv-desc-meta">
                <strong>조회수 <?php echo number_format($view['wr_hit']); ?>회</strong>
                <strong><span class="sound_only">올린 날 </span><?php echo date('Y. n. j.', strtotime($view['wr_datetime'])); ?></strong>
                <?php if ($sv_duration) { ?><span>재생 시간 <?php echo $sv_duration; ?></span><?php } ?>
                <?php if ($category_name) { ?><a href="<?php echo get_pretty_url($bo_table, '', 'sca='.urlencode($view['ca_name'])); ?>" class="sv-tag">#<?php echo $view['ca_name']; ?></a><?php } ?>
            </p>
            <div id="bo_v_con" class="sv-content"><?php echo get_view_thumbnail($view['content']); ?></div>

            <?php if ($sv_images) { ?>
            <div class="sv-images">
                <?php foreach ($sv_images as $sv_file) { echo get_file_thumbnail($sv_file); } ?>
            </div>
            <?php } ?>

            <?php if ($is_signature) { ?><p class="sv-signature"><?php echo $signature; ?></p><?php } ?>

            <?php if ($sv_downloads) { ?>
            <div class="sv-files">
                <h4>첨부파일</h4>
                <ul>
                    <?php foreach ($sv_downloads as $sv_file) { ?>
                    <li>
                        <a href="<?php echo $sv_file['href']; ?>" class="view_file_download"><i class="fa fa-download" aria-hidden="true"></i> <strong><?php echo $sv_file['source']; ?></strong> <?php echo $sv_file['content']; ?> (<?php echo $sv_file['size']; ?>)</a>
                        <span class="sv-meta"><span><?php echo $sv_file['download']; ?>회 내려받음</span><span><?php echo $sv_file['datetime']; ?></span></span>
                    </li>
                    <?php } ?>
                </ul>
            </div>
            <?php } ?>

            <?php if ($sv_links) { ?>
            <div class="sv-files">
                <h4>관련 링크</h4>
                <ul>
                    <?php foreach ($sv_links as $i => $sv_link) { ?>
                    <li>
                        <a href="<?php echo $view['link_href'][$i]; ?>" target="_blank" rel="noopener"><i class="fa fa-link" aria-hidden="true"></i> <strong><?php echo cut_str($sv_link, 70); ?></strong></a>
                        <span class="sv-meta"><span><?php echo $view['link_hit'][$i]; ?>회 연결</span></span>
                    </li>
                    <?php } ?>
                </ul>
            </div>
            <?php } ?>
        </section>
    </div>

    <aside class="sv-watch-side" aria-labelledby="sv_next_title">
        <h3 id="sv_next_title" class="sv-side-title">다음 영상</h3>
        <?php if ($sv_next) { ?>
        <ol class="sv-next">
            <?php foreach ($sv_next as $sv_item) {
                $sv_thumb = get_list_thumbnail($bo_table, $sv_item['wr_id'], 320, 180, false, true);
                $sv_item_duration = solad_video_duration($sv_item['wr_2']);
            ?>
            <li>
                <a href="<?php echo $sv_item['href']; ?>" class="sv-next-item">
                    <span class="sv-next-thumb">
                        <?php if (!empty($sv_thumb['src'])) { ?><img src="<?php echo $sv_thumb['src']; ?>" alt="" loading="lazy"><?php } ?>
                        <?php if ($sv_item_duration) { ?><span class="sv-duration"><?php echo $sv_item_duration; ?></span><?php } ?>
                    </span>
                    <span class="sv-next-text">
                        <strong><?php echo get_text(cut_str($sv_item['wr_subject'], 60)); ?></strong>
                        <span class="sv-name"><?php echo get_text($sv_item['wr_name']); ?></span>
                        <span class="sv-meta"><span>조회수 <?php echo solad_video_count($sv_item['wr_hit']); ?>회</span><span><?php echo solad_video_ago($sv_item['wr_datetime']); ?></span></span>
                    </span>
                </a>
            </li>
            <?php } ?>
        </ol>
        <?php } else { ?>
        <p class="sv-side-empty">다른 영상이 아직 없어요.</p>
        <?php } ?>
        <a href="<?php echo $list_href; ?>" class="sv-side-all">모든 영상 보기</a>
    </aside>

    <div class="sv-watch-comments">
        <?php include_once(G5_BBS_PATH.'/view_comment.php'); ?>
    </div>

</div>
</article>

<script>
<?php if ($board['bo_download_point'] < 0) { ?>
$(function() {
    $("a.view_file_download").click(function() {
        if (!g5_is_member) {
            alert("내려받을 권한이 없어요.\n회원이라면 로그인한 뒤 다시 시도해 주세요.");
            return false;
        }
        if (!confirm("내려받으면 포인트 <?php echo number_format(-$board['bo_download_point']); ?>점이 차감돼요.\n같은 글은 한 번만 차감돼요. 내려받을까요?")) return false;
        $(this).attr("href", $(this).attr("href") + "&js=on");
        return true;
    });
});
<?php } ?>

function board_move(href) {
    window.open(href, "boardmove", "left=50, top=50, width=500, height=550, scrollbars=1");
}

(function () {
    var toast = document.getElementById("sv_toast");
    var timer = 0;
    function say(text) {
        clearTimeout(timer);
        toast.textContent = text;
        toast.classList.add("is-shown");
        timer = setTimeout(function () { toast.classList.remove("is-shown"); }, 2500);
    }
    window.sv_say = say;

    document.getElementById("sv_share").addEventListener("click", function () {
        var href = <?php echo json_encode(str_replace("&amp;", "&", get_pretty_url($bo_table, $view["wr_id"]))); ?>;
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(href).then(function () { say("링크를 복사했어요."); }, function () { say(href); });
            return;
        }
        var input = document.createElement("input");
        input.value = href;
        document.body.appendChild(input);
        input.select();
        say(document.execCommand("copy") ? "링크를 복사했어요." : href);
        input.remove();
    });

    // 더보기 메뉴는 바깥을 누르거나 Esc를 누르면 닫는다.
    var more = document.querySelector("#sv_view .sv-more");
    if (more) {
        document.addEventListener("click", function (event) {
            if (more.open && !more.contains(event.target)) more.open = false;
        });
        more.addEventListener("keydown", function (event) {
            if (event.key === "Escape" && more.open) {
                more.open = false;
                more.querySelector("summary").focus();
            }
        });
    }
})();

$(function() {
    $("#good_button, #nogood_button").click(function() {
        var $button = $(this);
        var nogood = this.id == "nogood_button";
        $.post(this.href, { js: "on" }, function(data) {
            if (data.error) {
                alert(data.error);
                return;
            }
            if (data.count) {
                $button.find("strong").text(number_format(String(data.count)));
                $button.addClass("is-on");
                sv_say(nogood ? "비추천했어요." : "추천했어요.");
            }
        }, "json");
        return false;
    });
});
</script>
<!-- } 솔애드 동영상 보기 -->
