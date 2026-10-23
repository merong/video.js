<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가
include_once($board_skin_path.'/request.lib.php');

add_stylesheet('<link rel="stylesheet" href="'.$board_skin_url.'/style.css">', 0);

$sr_settings = solad_request_settings($board);
$sr_stages = solad_request_stages();
$sr_category_ok = $board['bo_use_category'] && array_map('trim', explode('|', $board['bo_category_list'])) === array_keys($sr_stages);

// 상태별 개수. 분류가 곧 상태라 한 번에 센다.
$sr_counts = array();
$sr_total = 0;
$sr_result = sql_query(" select ca_name, count(*) as cnt from {$write_table} where wr_is_comment = 0 group by ca_name ");
while ($sr_row = sql_fetch_array($sr_result)) {
    $sr_counts[$sr_row['ca_name']] = (int) $sr_row['cnt'];
    $sr_total += (int) $sr_row['cnt'];
}
$sr_mine = $is_member && $sfl === 'mb_id,1' && $stx === $member['mb_id'];
$sr_mine_count = 0;
if ($is_member) {
    $sr_row = sql_fetch(" select count(*) as cnt from {$write_table} where wr_is_comment = 0 and mb_id = '{$member['mb_id']}' ");
    $sr_mine_count = (int) $sr_row['cnt'];
}

$sr_search_fields = array(
    'wr_subject||wr_1,1' => '광고 이름·광고주',
    'wr_content' => '요청 내용',
    'mb_id,1' => '회원 아이디',
);
?>

<!-- 솔애드 광고 요청 목록 { -->
<div id="sr_list" class="sr" style="width:<?php echo $width; ?>">

    <header class="sr-hero">
        <div>
            <h2 class="sr-hero-title"><?php echo get_text($board['bo_subject']); ?></h2>
            <p class="sr-hero-desc">동영상 광고를 요청하고 처리 상황을 확인해요. 요청서는 관리자와 요청한 회원만 볼 수 있어요.</p>
        </div>
        <?php if ($write_href) { ?>
        <a href="<?php echo $write_href; ?>" class="sr-btn-primary btn"><i class="fa fa-pencil" aria-hidden="true"></i> 광고 요청하기</a>
        <?php } elseif (!$is_member) { ?>
        <a href="<?php echo G5_BBS_URL; ?>/login.php?url=<?php echo urlencode(get_pretty_url($bo_table)); ?>" class="sr-btn-primary btn">로그인하고 요청하기</a>
        <?php } ?>
    </header>

    <?php if ($is_admin) { ?>
    <details class="sr-setup">
        <summary>광고 요청 게시판 설정 <span class="sr-setup-hint">관리자에게만 보여요</span></summary>
        <dl>
            <dt>비밀글</dt>
            <dd>
                <?php echo (int) $board['bo_use_secret'] === 2 ? '항상 비밀글' : ((int) $board['bo_use_secret'] === 1 ? '쓰는 사람이 고름' : '쓰지 않음'); ?>
                <?php if ((int) $board['bo_use_secret'] !== 2) { ?><strong class="sr-warn">요청서에 업체 연락처가 들어가요. "항상 비밀글"로 바꿔 주세요.</strong><?php } ?>
            </dd>
            <dt>분류(처리 상태)</dt>
            <dd>
                <?php echo $board['bo_use_category'] ? solad_request_attr($board['bo_category_list']) : '쓰지 않음'; ?>
                <?php if (!$sr_category_ok) { ?><strong class="sr-warn">분류를 쓰고 목록을 "<?php echo SOLAD_REQUEST_STAGES; ?>"로 맞춰 주세요. 분류가 곧 처리 상태예요.</strong><?php } ?>
            </dd>
            <dt>파일 업로드</dt>
            <dd>
                <?php echo (int) $board['bo_upload_count']; ?>개, 한 파일 <?php echo get_filesize($board['bo_upload_size']); ?>까지
                <?php if ((int) $board['bo_upload_count'] < 1) { ?><strong class="sr-warn">소재 파일을 받으려면 1개 이상이 필요해요. 지금은 소재 주소만 받아요.</strong><?php } ?>
            </dd>
            <dt>원글 수정 불가</dt>
            <dd>
                <?php echo (int) $board['bo_count_modify'] ? '댓글 '.(int) $board['bo_count_modify'].'개 이상' : '제한 없음'; ?>
                <?php if ((int) $board['bo_count_modify']) { ?><strong class="sr-warn">보완 요청을 받은 회원이 요청을 고칠 수 있게 0으로 바꿔 주세요. 집행 예정부터는 스킨이 막아요.</strong><?php } ?>
            </dd>
            <dt>솔애드 주소</dt>
            <dd>
                <code><?php echo solad_request_attr($sr_settings['base']); ?></code>
                <span class="sr-setup-status" data-sr-check="<?php echo solad_request_attr($sr_settings['base']); ?>">연결 확인 중…</span>
                <?php if (!$sr_settings['base_valid']) { ?><strong class="sr-warn">주소 형식이 맞지 않아 기본 경로를 써요.</strong><?php } ?>
            </dd>
        </dl>
        <p class="sr-setup-help">승인한 요청은 솔애드 관리자에서 하우스 광고로 등록하고 지면 편성에 넣어요. 여분필드 제목을 "솔애드 주소"로 두면 그 값을 읽어요.</p>
        <p class="sr-setup-links">
            <?php if ($admin_href) { ?><a href="<?php echo $admin_href; ?>" class="btn_b02 btn">게시판 설정</a><?php } ?>
            <a href="<?php echo solad_request_attr($sr_settings['base']); ?>/#/house" target="solad_admin" class="btn_b02 btn" data-sr-admin>솔애드 관리자 열기</a>
        </p>
    </details>
    <?php } ?>

    <nav class="sr-chips" aria-label="상태별 보기">
        <a href="<?php echo get_pretty_url($bo_table); ?>"<?php echo $sca === '' && !$sr_mine ? ' aria-current="page"' : ''; ?>>전체 <span><?php echo number_format($sr_total); ?></span></a>
        <?php if ($is_member && !$is_admin) { ?>
        <a href="<?php echo get_pretty_url($bo_table, '', 'sfl=mb_id%2C1&amp;stx='.urlencode($member['mb_id'])); ?>"<?php echo $sr_mine ? ' aria-current="page"' : ''; ?>>내 요청 <span><?php echo number_format($sr_mine_count); ?></span></a>
        <?php } ?>
        <?php foreach ($sr_stages as $sr_stage => $sr_status) { ?>
        <a href="<?php echo get_pretty_url($bo_table, '', 'sca='.urlencode($sr_stage)); ?>" class="is-<?php echo $sr_status; ?>"<?php echo $sca === $sr_stage ? ' aria-current="page"' : ''; ?>><i aria-hidden="true"></i><?php echo $sr_stage; ?> <span><?php echo number_format(isset($sr_counts[$sr_stage]) ? $sr_counts[$sr_stage] : 0); ?></span></a>
        <?php } ?>
    </nav>

    <form name="fboardlist" id="fboardlist" action="<?php echo G5_BBS_URL; ?>/board_list_update.php" onsubmit="return fboardlist_submit(this);" method="post">
    <input type="hidden" name="bo_table" value="<?php echo $bo_table; ?>">
    <input type="hidden" name="sfl" value="<?php echo $sfl; ?>">
    <input type="hidden" name="stx" value="<?php echo $stx; ?>">
    <input type="hidden" name="spt" value="<?php echo $spt; ?>">
    <input type="hidden" name="sca" value="<?php echo $sca; ?>">
    <input type="hidden" name="sst" value="<?php echo $sst; ?>">
    <input type="hidden" name="sod" value="<?php echo $sod; ?>">
    <input type="hidden" name="page" value="<?php echo $page; ?>">
    <input type="hidden" name="sw" value="">

    <div class="sr-card">
        <div class="sr-toolbar">
            <h3 class="sr-toolbar-title">요청 <?php echo number_format($total_count); ?>건<?php if ($page > 1) { ?> <span class="sr-muted"><?php echo $page; ?>쪽</span><?php } ?></h3>
            <?php if ($is_checkbox) { ?>
            <div class="sr-manage">
                <button type="submit" name="btn_submit" value="선택삭제" onclick="document.pressed=this.value" class="btn_b02 btn">선택삭제</button>
                <button type="submit" name="btn_submit" value="선택이동" onclick="document.pressed=this.value" class="btn_b02 btn">선택이동</button>
            </div>
            <?php } ?>
            <?php if ($rss_href || $admin_href) { ?>
            <div class="sr-icons">
                <?php if ($admin_href) { ?><a href="<?php echo $admin_href; ?>" class="btn_admin btn" title="게시판 설정"><i class="fa fa-cog fa-fw" aria-hidden="true"></i><span class="sound_only">게시판 설정</span></a><?php } ?>
                <?php if ($rss_href) { ?><a href="<?php echo $rss_href; ?>" class="btn_b01 btn" title="RSS"><i class="fa fa-rss" aria-hidden="true"></i><span class="sound_only">RSS</span></a><?php } ?>
            </div>
            <?php } ?>
        </div>

        <div class="sr-table-wrap">
        <table class="sr-table">
            <caption class="sound_only"><?php echo get_text($board['bo_subject']); ?> 목록</caption>
            <thead>
            <tr>
                <?php if ($is_checkbox) { ?>
                <th scope="col" class="sr-col-check"><label class="sound_only" for="chkall">이 쪽 전체 선택</label><input type="checkbox" id="chkall" onclick="all_checked(this.checked);"></th>
                <?php } ?>
                <th scope="col" class="sr-col-num">번호</th>
                <th scope="col">광고 이름</th>
                <th scope="col">광고주</th>
                <th scope="col">상태</th>
                <th scope="col">희망 기간</th>
                <th scope="col">희망 위치</th>
                <th scope="col" class="sr-col-num">희망 노출</th>
                <th scope="col">등록</th>
            </tr>
            </thead>
            <tbody>
            <?php
            for ($i = 0; $i < count($list); $i++) {
                $sr_item = $list[$i];
                $sr_visible = solad_request_can_see($sr_item, $member, $is_admin);
                $sr_period = solad_request_period($sr_item['wr_2'], $sr_item['wr_3']);
                $sr_impressions = solad_request_number($sr_item['wr_5']);
            ?>
            <tr class="<?php echo $sr_item['is_notice'] ? 'is-notice' : ''; ?><?php echo $wr_id && $wr_id == $sr_item['wr_id'] ? ' is-current' : ''; ?>">
                <?php if ($is_checkbox) { ?>
                <td class="sr-col-check"><label class="sound_only" for="chk_wr_id_<?php echo $i; ?>"><?php echo $sr_item['subject']; ?></label><input type="checkbox" name="chk_wr_id[]" value="<?php echo $sr_item['wr_id']; ?>" id="chk_wr_id_<?php echo $i; ?>"></td>
                <?php } ?>
                <td class="sr-col-num" data-label="번호"><?php echo $sr_item['is_notice'] ? '<strong class="sr-notice">공지</strong>' : $sr_item['num']; ?></td>
                <td class="sr-col-title" data-label="광고 이름">
                    <?php if ($sr_visible) { ?>
                    <a href="<?php echo $sr_item['href']; ?>" class="sr-title">
                        <?php if (strstr($sr_item['wr_option'], 'secret')) { ?><i class="fa fa-lock" aria-hidden="true"></i><span class="sound_only">비밀 요청</span> <?php } ?>
                        <?php echo $sr_item['subject']; ?>
                    </a>
                    <?php if ($sr_item['comment_cnt']) { ?><span class="sr-comment" title="처리 기록"><span class="sound_only">처리 기록 </span><?php echo $sr_item['wr_comment']; ?></span><?php } ?>
                    <?php if ($sr_item['icon_new']) { ?><span class="sr-new">N<span class="sound_only">새 요청</span></span><?php } ?>
                    <?php } else { ?>
                    <span class="sr-hidden"><i class="fa fa-lock" aria-hidden="true"></i> 다른 회원의 요청이에요</span>
                    <?php } ?>
                </td>
                <td data-label="광고주"><?php echo $sr_visible && !$sr_item['is_notice'] && $sr_item['wr_1'] !== '' ? get_text($sr_item['wr_1']) : '<span class="sr-muted">—</span>'; ?></td>
                <td data-label="상태"><?php echo $sr_item['is_notice'] ? '<span class="sr-muted">—</span>' : solad_request_stage_badge($sr_item['ca_name']); ?></td>
                <td data-label="희망 기간" class="sr-nowrap"><?php echo $sr_visible && $sr_period !== '' ? $sr_period : '<span class="sr-muted">—</span>'; ?></td>
                <td data-label="희망 위치"><?php echo $sr_visible && $sr_item['wr_4'] !== '' ? get_text($sr_item['wr_4']) : '<span class="sr-muted">—</span>'; ?></td>
                <td data-label="희망 노출" class="sr-col-num"><?php echo $sr_visible && $sr_impressions !== '' ? $sr_impressions : '<span class="sr-muted">—</span>'; ?></td>
                <td data-label="등록" class="sr-nowrap sr-muted"><?php echo $sr_item['datetime2']; ?></td>
            </tr>
            <?php } ?>
            <?php if (count($list) == 0) { ?>
            <tr class="sr-empty-row">
                <td colspan="<?php echo $is_checkbox ? 9 : 8; ?>">
                    <div class="sr-empty">
                        <strong><?php echo $stx !== '' ? '찾는 요청이 없어요.' : ($sca !== '' ? '이 상태의 요청이 없어요.' : '아직 광고 요청이 없어요.'); ?></strong>
                        <span><?php echo $stx !== '' || $sca !== '' ? '다른 상태를 고르거나 검색어를 바꿔 보세요.' : '광고하고 싶은 내용을 요청서로 보내 주세요.'; ?></span>
                        <?php if ($write_href && $stx === '' && $sca === '') { ?><a href="<?php echo $write_href; ?>" class="sr-btn-primary btn">첫 광고 요청하기</a><?php } ?>
                    </div>
                </td>
            </tr>
            <?php } ?>
            </tbody>
        </table>
        </div>
    </div>
    </form>

    <div class="sr-foot">
        <form name="fsearch" method="get" class="sr-search" role="search">
            <input type="hidden" name="bo_table" value="<?php echo $bo_table; ?>">
            <input type="hidden" name="sca" value="<?php echo $sca; ?>">
            <input type="hidden" name="sop" value="and">
            <label for="sfl" class="sound_only">검색 대상</label>
            <select name="sfl" id="sfl">
                <?php foreach ($sr_search_fields as $sr_field => $sr_label) { ?>
                <option value="<?php echo $sr_field; ?>"<?php echo get_selected($sfl, $sr_field); ?>><?php echo $sr_label; ?></option>
                <?php } ?>
            </select>
            <label for="stx" class="sound_only">검색어</label>
            <input type="search" name="stx" value="<?php echo stripslashes($stx); ?>" required id="stx" maxlength="20" placeholder="광고 이름, 광고주">
            <button type="submit"><i class="fa fa-search" aria-hidden="true"></i><span class="sound_only">검색</span></button>
        </form>
        <?php echo $write_pages; ?>
    </div>
</div>

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
        alert(document.pressed + "할 요청을 하나 이상 고르세요.");
        return false;
    }
    if (document.pressed == "선택이동") {
        window.open("", "move", "left=50, top=50, width=500, height=550, scrollbars=1");
        f.sw.value = "move";
        f.target = "move";
        f.action = g5_bbs_url + "/move.php";
        f.submit();
        return false;
    }
    if (!confirm("고른 요청을 지울까요?\n\n지운 요청과 처리 기록, 소재 파일은 되살릴 수 없어요.")) return false;
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
    var node = document.querySelector("[data-sr-check]");
    if (!node || !window.fetch) return;
    fetch(node.getAttribute("data-sr-check") + "/api/index.php?action=player-preset", { credentials: "same-origin" })
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
<script src="<?php echo $board_skin_url; ?>/request.js"></script>
<?php } ?>
<!-- } 솔애드 광고 요청 목록 -->
