<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가
include_once(G5_LIB_PATH.'/thumbnail.lib.php');
include_once($board_skin_path.'/solad.lib.php');

add_stylesheet('<link rel="stylesheet" href="'.$board_skin_url.'/style.css">', 0);

$sv_settings = solad_video_settings($board);
$sv_thumb_w = (int) $board[G5_IS_MOBILE ? 'bo_mobile_gallery_width' : 'bo_gallery_width'];
$sv_thumb_h = (int) $board[G5_IS_MOBILE ? 'bo_mobile_gallery_height' : 'bo_gallery_height'];
if ($sv_thumb_w <= 0 || $sv_thumb_h <= 0) {
    $sv_thumb_w = 480;
    $sv_thumb_h = 270;
}

// 정렬 칩은 분류·검색어를 유지한다.
$sv_query = array();
if ($sca !== '') {
    $sv_query[] = 'sca='.urlencode($sca);
}
if ($stx !== '') {
    $sv_query[] = 'sfl='.urlencode($sfl).'&amp;stx='.urlencode($stx).'&amp;sop='.urlencode($sop);
}
$sv_sorts = array('' => '최신순', 'wr_hit' => '조회순');
if ($is_good) {
    $sv_sorts['wr_good'] = '추천순';
}
$sv_sort = in_array($sst, array('wr_hit', 'wr_good'), true) ? $sst : '';

// 공지는 카드 위 한 줄 목록으로, 첫 쪽 최신순에서는 가장 새 영상을 크게 보여 준다.
$sv_notices = array();
$sv_items = array();
foreach ($list as $sv_row) {
    if ($sv_row['is_notice']) {
        $sv_notices[] = $sv_row;
    } else {
        $sv_items[] = $sv_row;
    }
}
$sv_hero = null;
if ($page <= 1 && $stx === '' && $sv_sort === '' && !$wr_id) {
    foreach ($sv_items as $sv_key => $sv_row) {
        if (!strstr($sv_row['wr_option'], 'secret')) {
            $sv_hero = $sv_row;
            unset($sv_items[$sv_key]);
            break;
        }
    }
}
$sv_previews = solad_video_previews($bo_table, $sv_hero ? array_merge(array($sv_hero), $sv_items) : $sv_items);
$sv_new_hours = (int) $board['bo_new'];
?>

<!-- 솔애드 동영상 갤러리 목록 { -->
<div id="sv_list" class="sv sv-gallery" style="width:<?php echo $width; ?>">

    <?php if ($is_admin) { ?>
    <details class="sv-setup">
        <summary>동영상 갤러리 설정 <span class="sv-setup-hint">관리자에게만 보여요</span></summary>
        <dl>
            <dt>솔애드 주소</dt>
            <dd>
                <code><?php echo solad_attr($sv_settings['base']); ?></code>
                <span class="sv-setup-status" data-sv-check="<?php echo solad_attr($sv_settings['base']); ?>">연결 확인 중…</span>
                <?php if (!$sv_settings['base_valid']) { ?><strong class="sv-warn">주소 형식이 맞지 않아 기본 경로를 써요.</strong><?php } ?>
            </dd>
            <dt>플레이어</dt>
            <dd>솔애드 관리자의 플레이어 설정을 따라요.</dd>
            <dt>썸네일</dt>
            <dd><?php echo $sv_thumb_w; ?> × <?php echo $sv_thumb_h; ?>px, 한 줄에 최대 <?php echo (int) $bo_gallery_cols; ?>개</dd>
            <dt>파일 업로드</dt>
            <dd>
                <?php echo (int) $board['bo_upload_count']; ?>개, 한 파일 <?php echo get_filesize($board['bo_upload_size']); ?>까지
                <?php if ((int) $board['bo_upload_count'] < 2) { ?><strong class="sv-warn">영상과 썸네일을 함께 올리려면 2개 이상이 필요해요.</strong><?php } ?>
            </dd>
        </dl>
        <p class="sv-setup-help">여분필드 제목을 "솔애드 주소"로 두면 그 값을 읽어요. 썸네일 크기와 한 줄 개수는 갤러리 항목을 따라요.</p>
        <p class="sv-setup-links">
            <?php if ($admin_href) { ?><a href="<?php echo $admin_href; ?>" class="btn_b02 btn">게시판 설정</a><?php } ?>
            <a href="<?php echo solad_attr($sv_settings['base']); ?>/" target="_blank" rel="noopener" class="btn_b02 btn">솔애드 관리자 열기</a>
        </p>
    </details>
    <?php } ?>

    <header class="sv-head">
        <div class="sv-head-text">
            <p class="sv-bar-title">
                영상 <strong><?php echo number_format($total_count); ?></strong>개
                <?php if ($page > 1) { ?><span><?php echo $page; ?>쪽</span><?php } ?>
            </p>
            <h2 class="sv-head-title"><?php echo get_text($board['bo_subject']); ?></h2>
        </div>

        <div class="sv-actions">
            <?php if ($is_checkbox) { ?>
            <input type="checkbox" id="sv_selecting" class="sv-selecting">
            <label for="sv_selecting" class="btn_b02 btn"><i class="fa fa-check-square-o" aria-hidden="true"></i> 선택</label>
            <?php } ?>
            <?php if ($admin_href) { ?><a href="<?php echo $admin_href; ?>" class="btn_b02 btn" title="게시판 관리"><i class="fa fa-cog" aria-hidden="true"></i><span class="sound_only">게시판 관리</span></a><?php } ?>
            <?php if ($rss_href) { ?><a href="<?php echo $rss_href; ?>" class="btn_b02 btn" title="RSS"><i class="fa fa-rss" aria-hidden="true"></i><span class="sound_only">RSS</span></a><?php } ?>
            <?php if ($write_href) { ?><a href="<?php echo $write_href; ?>" class="btn_b02 btn"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 6h11a1 1 0 0 1 1 1v3l4-2.5v9L16 14v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zm4.5 2.5v2h-2v2h2v2h2v-2h2v-2h-2v-2z" fill="currentColor"/></svg> 영상 올리기</a><?php } ?>
        </div>
    </header>

    <div class="sv-filters">
        <?php if ($is_category) { ?>
        <nav class="sv-chips" aria-label="<?php echo solad_attr($board['bo_subject']); ?> 분류">
            <ul><?php echo $category_option; ?></ul>
        </nav>
        <?php } ?>

        <form name="fsearch" method="get" class="sv-search" role="search">
            <input type="hidden" name="bo_table" value="<?php echo $bo_table; ?>">
            <input type="hidden" name="sca" value="<?php echo solad_attr($sca); ?>">
            <input type="hidden" name="sop" value="and">
            <label for="sfl" class="sound_only">검색대상</label>
            <select name="sfl" id="sfl">
                <?php echo get_board_sfl_select_options($sfl); ?>
            </select>
            <label for="stx" class="sound_only">검색어</label>
            <input type="search" name="stx" value="<?php echo stripslashes($stx); ?>" required id="stx" maxlength="20" placeholder="영상 검색">
            <button type="submit"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M10.5 4a6.5 6.5 0 0 1 5.2 10.4l4.4 4.4-1.4 1.4-4.4-4.4A6.5 6.5 0 1 1 10.5 4zm0 2a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9z" fill="currentColor"/></svg><span class="sound_only">검색</span></button>
        </form>

        <nav class="sv-sort" aria-label="정렬">
            <?php foreach ($sv_sorts as $sv_key => $sv_label) {
                $sv_href = get_pretty_url($bo_table, '', implode('&amp;', $sv_key ? array_merge($sv_query, array('sst='.$sv_key.'&amp;sod=desc')) : $sv_query));
            ?>
            <a href="<?php echo $sv_href; ?>"<?php echo $sv_sort === $sv_key ? ' aria-current="true"' : ''; ?>><?php echo $sv_label; ?></a>
            <?php } ?>
        </nav>
    </div>

    <form name="fboardlist" id="fboardlist" action="<?php echo G5_BBS_URL; ?>/board_list_update.php" onsubmit="return fboardlist_submit(this);" method="post">
    <input type="hidden" name="bo_table" value="<?php echo $bo_table; ?>">
    <input type="hidden" name="sfl" value="<?php echo $sfl; ?>">
    <input type="hidden" name="stx" value="<?php echo $stx; ?>">
    <input type="hidden" name="spt" value="<?php echo $spt; ?>">
    <input type="hidden" name="sst" value="<?php echo $sst; ?>">
    <input type="hidden" name="sod" value="<?php echo $sod; ?>">
    <input type="hidden" name="page" value="<?php echo $page; ?>">
    <input type="hidden" name="sw" value="">

    <?php if ($is_checkbox) { ?>
    <div class="sv-manage">
        <label class="sv-check"><input type="checkbox" id="chkall" onclick="all_checked(this.checked);"> 이 쪽 전체 선택</label>
        <span class="sv-manage-buttons">
            <button type="submit" name="btn_submit" value="선택삭제" onclick="document.pressed=this.value" class="btn_b02 btn">삭제</button>
            <button type="submit" name="btn_submit" value="선택복사" onclick="document.pressed=this.value" class="btn_b02 btn">복사</button>
            <button type="submit" name="btn_submit" value="선택이동" onclick="document.pressed=this.value" class="btn_b02 btn">이동</button>
        </span>
    </div>
    <?php } ?>

    <?php if ($sv_notices) { ?>
    <ul class="sv-notices">
        <?php foreach ($sv_notices as $sv_item) { ?>
        <li>
            <?php if ($is_checkbox) { ?><label class="sv-row-check"><input type="checkbox" name="chk_wr_id[]" value="<?php echo $sv_item['wr_id']; ?>"><span class="sound_only"><?php echo $sv_item['subject']; ?> 선택</span></label><?php } ?>
            <span class="sv-badge is-notice">공지</span>
            <a href="<?php echo $sv_item['href']; ?>"><?php echo $sv_item['subject']; ?></a>
            <span class="sv-notice-date"><?php echo $sv_item['datetime2']; ?></span>
        </li>
        <?php } ?>
    </ul>
    <?php } ?>

    <?php if ($sv_hero) {
        $sv_item = $sv_hero;
        // 원본보다 큰 썸네일을 청하면 그누보드가 여백을 채워 만들므로 흔한 영상 크기에 맞춘다.
        $sv_thumb = get_list_thumbnail($board['bo_table'], $sv_item['wr_id'], 640, 360, false, true);
        $sv_duration = solad_video_duration($sv_item['wr_2']);
        $sv_excerpt = solad_video_excerpt($sv_item['wr_content'], 120);
    ?>
    <section class="sv-hero" aria-labelledby="sv_hero_title">
        <?php if ($is_checkbox) { ?><label class="sv-card-check"><input type="checkbox" name="chk_wr_id[]" value="<?php echo $sv_item['wr_id']; ?>"><span class="sound_only"><?php echo $sv_item['subject']; ?> 선택</span></label><?php } ?>
        <a href="<?php echo $sv_item['href']; ?>" class="sv-thumb" tabindex="-1" aria-hidden="true"<?php echo isset($sv_previews[$sv_item['wr_id']]) ? ' data-preview="'.solad_attr($sv_previews[$sv_item['wr_id']]).'"' : ''; ?>>
            <?php if (!empty($sv_thumb['src'])) {
                echo run_replace('thumb_image_tag', '<img src="'.$sv_thumb['src'].'" alt="'.get_text($sv_item['wr_subject']).'">', $sv_thumb);
            } else { ?><span class="sv-thumb-empty"></span><?php } ?>
            <span class="sv-play"><svg viewBox="0 0 24 24" width="30" height="30"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg></span>
            <?php if ($sv_duration) { ?><span class="sv-duration"><?php echo $sv_duration; ?></span><?php } ?>
        </a>
        <div class="sv-hero-body">
            <p class="sv-eyebrow">최신 영상<?php echo $is_category && $sv_item['ca_name'] ? ' · '.$sv_item['ca_name'] : ''; ?></p>
            <h3 id="sv_hero_title" class="sv-hero-title"><a href="<?php echo $sv_item['href']; ?>"><?php echo $sv_item['subject']; ?></a></h3>
            <div class="sv-hero-author">
                <span class="sv-avatar"><?php echo solad_video_avatar($sv_item['mb_id'], $sv_item['wr_name']); ?></span>
                <span class="sv-name"><?php echo $sv_item['name']; ?></span>
            </div>
            <div class="sv-meta">
                <span>조회수 <?php echo solad_video_count($sv_item['wr_hit']); ?>회</span>
                <span><?php echo solad_video_ago($sv_item['wr_datetime']); ?></span>
                <?php if ($sv_duration) { ?><span><span class="sound_only">재생 시간 </span><?php echo $sv_duration; ?></span><?php } ?>
            </div>
            <?php if ($sv_excerpt !== '') { ?><p class="sv-hero-excerpt"><?php echo $sv_excerpt; ?></p><?php } ?>
            <a href="<?php echo $sv_item['href']; ?>" class="sv-btn-primary btn sv-hero-cta"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg> 지금 보기</a>
        </div>
    </section>
    <?php } ?>

    <ul class="sv-grid" style="--sv-cols:<?php echo max(1, (int) $bo_gallery_cols); ?>;--sv-ratio:<?php echo $sv_thumb_w; ?> / <?php echo $sv_thumb_h; ?>">
        <?php foreach ($sv_items as $sv_item) {
            $sv_duration = solad_video_duration($sv_item['wr_2']);
            $sv_thumb = get_list_thumbnail($board['bo_table'], $sv_item['wr_id'], $sv_thumb_w, $sv_thumb_h, false, true);
            $sv_current = $wr_id && $wr_id == $sv_item['wr_id'];
            $sv_secret = strstr($sv_item['wr_option'], 'secret');
        ?>
        <li class="sv-card<?php echo $sv_current ? ' is-current' : ''; ?>">
            <?php if ($is_checkbox) { ?>
            <label class="sv-card-check"><input type="checkbox" name="chk_wr_id[]" value="<?php echo $sv_item['wr_id']; ?>"><span class="sound_only"><?php echo $sv_item['subject']; ?> 선택</span></label>
            <?php } ?>
            <a href="<?php echo $sv_item['href']; ?>" class="sv-thumb" tabindex="-1" aria-hidden="true"<?php echo isset($sv_previews[$sv_item['wr_id']]) ? ' data-preview="'.solad_attr($sv_previews[$sv_item['wr_id']]).'"' : ''; ?>>
                <?php if (!empty($sv_thumb['src'])) {
                    echo run_replace('thumb_image_tag', '<img src="'.$sv_thumb['src'].'" alt="'.get_text($sv_item['wr_subject']).'" loading="lazy">', $sv_thumb);
                } else { ?><span class="sv-thumb-empty"><?php echo $sv_secret ? '<i class="fa fa-lock"></i>' : ''; ?></span><?php } ?>
                <span class="sv-play"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg></span>
                <?php if ($is_category && $sv_item['ca_name']) { ?><span class="sv-thumb-cate"><?php echo $sv_item['ca_name']; ?></span><?php } ?>
                <?php if ($sv_current) { ?><span class="sv-now">재생 중</span><?php } elseif ($sv_duration) { ?><span class="sv-duration"><?php echo $sv_duration; ?></span><?php } ?>
            </a>
            <div class="sv-card-body">
                <span class="sv-avatar"><?php echo solad_video_avatar($sv_item['mb_id'], $sv_item['wr_name']); ?></span>
                <div class="sv-card-text">
                    <a href="<?php echo $sv_item['href']; ?>" class="sv-title">
                        <?php if ($sv_secret) { ?><i class="fa fa-lock" aria-hidden="true"></i><span class="sound_only">비밀글</span><?php } ?>
                        <?php echo $sv_item['subject']; ?>
                    </a>
                    <div class="sv-name"><span class="sound_only">작성자 </span><?php echo $sv_item['name']; ?></div>
                    <div class="sv-meta">
                        <span>조회수 <?php echo solad_video_count($sv_item['wr_hit']); ?>회</span>
                        <span><span class="sound_only">작성 </span><?php echo solad_video_ago($sv_item['wr_datetime']); ?></span>
                        <?php if ($sv_item['comment_cnt']) { ?><span>댓글 <?php echo number_format($sv_item['wr_comment']); ?></span><?php } ?>
                        <?php if ($sv_item['icon_new']) { ?><span class="sv-badge is-new">NEW<span class="sound_only"> <?php echo $sv_new_hours; ?>시간 안에 올라온 영상</span></span><?php } ?>
                    </div>
                </div>
            </div>
        </li>
        <?php } ?>
        <?php if (!$sv_items && !$sv_hero && !$sv_notices) { ?>
        <li class="sv-empty">
            <svg viewBox="0 0 24 24" width="40" height="40" aria-hidden="true"><path d="M4 6h11a1 1 0 0 1 1 1v3l4-2.5v9L16 14v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z" fill="currentColor"/></svg>
            <p><?php echo $stx !== '' ? '찾는 영상이 없어요.' : '아직 올라온 영상이 없어요.'; ?></p>
            <?php if ($write_href && $stx === '') { ?><a href="<?php echo $write_href; ?>" class="sv-btn-primary btn">첫 영상 올리기</a><?php } ?>
        </li>
        <?php } ?>
    </ul>
    </form>

    <?php echo $write_pages; ?>
</div>

<script>
// 마우스를 올리면 MP4·WebM 영상을 소리 없이 미리 재생한다. 터치 기기와 동작 줄이기 설정에서는 하지 않는다.
(function () {
    if (!window.matchMedia || !matchMedia("(hover: hover) and (pointer: fine)").matches || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    document.querySelectorAll("#sv_list [data-preview]").forEach(function (thumb) {
        var timer = 0;
        thumb.addEventListener("mouseenter", function () {
            timer = setTimeout(function () {
                var video = document.createElement("video");
                video.muted = true;
                video.loop = true;
                video.playsInline = true;
                video.className = "sv-thumb-preview-video";
                video.src = thumb.getAttribute("data-preview");
                video.addEventListener("playing", function () { thumb.classList.add("is-previewing"); });
                thumb.appendChild(video);
                video.play().catch(function () {});
            }, 450);
        });
        thumb.addEventListener("mouseleave", function () {
            clearTimeout(timer);
            thumb.classList.remove("is-previewing");
            thumb.querySelectorAll("video").forEach(function (video) {
                video.removeAttribute("src");
                video.load();
                video.remove();
            });
        });
    });
})();
</script>

<?php if ($is_checkbox) { ?>
<noscript><p>자바스크립트를 끄면 선택삭제가 확인 없이 바로 처리돼요.</p></noscript>
<script>
function all_checked(sw) {
    var f = document.fboardlist;
    for (var i = 0; i < f.length; i++) {
        if (f.elements[i].name == "chk_wr_id[]") f.elements[i].checked = sw;
    }
}

function fboardlist_submit(f) {
    var count = 0;
    for (var i = 0; i < f.length; i++) {
        if (f.elements[i].name == "chk_wr_id[]" && f.elements[i].checked) count++;
    }
    if (!count) {
        alert(document.pressed + "할 영상을 하나 이상 고르세요.");
        return false;
    }
    if (document.pressed == "선택복사" || document.pressed == "선택이동") {
        window.open("", "move", "left=50, top=50, width=500, height=550, scrollbars=1");
        f.sw.value = document.pressed == "선택복사" ? "copy" : "move";
        f.target = "move";
        f.action = g5_bbs_url + "/move.php";
        f.submit();
        return false;
    }
    if (!confirm("고른 영상을 지울까요?\n\n지운 글과 첨부 파일은 되살릴 수 없어요.\n답변글이 있는 글은 답변글도 함께 골라야 지워져요.")) return false;
    f.removeAttribute("target");
    f.action = g5_bbs_url + "/board_list_update.php";
    return true;
}
</script>
<?php } ?>

<?php if ($is_admin) { ?>
<script>
// 관리자 설정 상자: 솔애드 API가 이 사이트 경로에서 답하는지 본다.
(function () {
    var node = document.querySelector("[data-sv-check]");
    if (!node || !window.fetch) return;
    fetch(node.getAttribute("data-sv-check") + "/api/index.php?action=player-preset", { credentials: "same-origin" })
        .then(function (response) { return response.ok ? response.json() : Promise.reject(response.status); })
        .then(function (body) {
            node.textContent = body && body.ok ? "연결됨" : "응답이 이상해요";
            node.classList.add(body && body.ok ? "is-ok" : "is-bad");
        })
        .catch(function (status) {
            node.textContent = "연결 안 됨" + (typeof status === "number" ? " (HTTP " + status + ")" : "");
            node.classList.add("is-bad");
        });
})();
</script>
<?php } ?>
<!-- } 솔애드 동영상 갤러리 목록 -->
