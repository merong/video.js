<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가
include_once($board_skin_path.'/request.lib.php');

add_stylesheet('<link rel="stylesheet" href="'.$board_skin_url.'/style.css">', 0);

$sr_settings = solad_request_settings($board);
$sr_stage = solad_request_is_stage($view['ca_name']) ? $view['ca_name'] : '접수';
$sr_locked = solad_request_is_locked($sr_stage);
$sr_is_owner = $is_member && $view['mb_id'] !== '' && $view['mb_id'] === $member['mb_id'];
$sr_can_change = $is_admin || !$sr_locked;
// 그누보드는 댓글 수가 "원글 수정·삭제 불가" 설정에 닿으면 회원의 수정·삭제를 막는다.
$sr_can_edit = $sr_can_change && ($is_admin || !$board['bo_count_modify'] || $view['wr_comment'] < $board['bo_count_modify']);
$sr_can_delete = $sr_can_change && ($is_admin || $view['wr_comment'] < $board['bo_count_delete']);
$sr_is_notice = in_array((string) $view['wr_id'], array_map('trim', explode(',', $board['bo_notice'])), true);

// 소재: 소재 주소가 1번 칸 파일보다 먼저다.
$sr_media_file = solad_request_media_file($view['file']);
$sr_media_from_file = !solad_request_is_media_url($view['wr_7']) && $sr_media_file;
$sr_media_url = $sr_media_from_file ? $sr_media_file['url'] : (solad_request_is_media_url($view['wr_7']) ? $view['wr_7'] : '');
$sr_media_kind = $sr_media_from_file ? $sr_media_file['kind'] : solad_request_media_kind($sr_media_url);

$sr_boards = $view['wr_9'] !== '' ? solad_request_boards($bo_table) : array();
$sr_target = $view['wr_9'] !== '' ? (isset($sr_boards[$view['wr_9']]) ? $sr_boards[$view['wr_9']].' ('.$view['wr_9'].')' : $view['wr_9']) : '상관없음';

// 처리 단계: 보완 요청은 검토에서, 반려는 그 자리에서 갈라진다.
$sr_track = array('접수', '검토', '집행 예정', '집행', '종료');
$sr_track_at = array('접수' => 0, '검토' => 1, '보완 요청' => 1, '집행 예정' => 2, '집행' => 3, '종료' => 4, '반려' => 1);
$sr_now = $sr_track_at[$sr_stage];

// 지금 상태에서 자주 하는 처리. 상태 고르기에서는 어떤 상태든 고를 수 있다.
$sr_actions = array(
    '접수' => array(array('검토', '검토 시작'), array('반려', '반려')),
    '검토' => array(array('집행 예정', '승인(집행 예정)'), array('보완 요청', '보완 요청'), array('반려', '반려')),
    '보완 요청' => array(array('검토', '다시 검토'), array('반려', '반려')),
    '집행 예정' => array(array('집행', '집행 시작'), array('반려', '집행 취소(반려)')),
    '집행' => array(array('종료', '종료')),
    '종료' => array(),
    '반려' => array(array('검토', '다시 검토')),
);

$sr_rows = array(
    array('광고 이름', get_text($view['wr_subject'])),
    array('광고주', $view['wr_1'] !== '' ? get_text($view['wr_1']) : '—'),
    array('클릭 URL', solad_request_is_http_url($view['wr_6']) ? '<a href="'.solad_request_attr($view['wr_6']).'" target="_blank" rel="noopener nofollow">'.solad_request_attr($view['wr_6']).'</a>' : '없음'),
    array('희망 기간', solad_request_period($view['wr_2'], $view['wr_3'], true) ?: '—'),
    array('희망 위치', $view['wr_4'] !== '' ? get_text($view['wr_4']) : '—'),
    array('희망 노출 수', solad_request_number($view['wr_5']) !== '' ? solad_request_number($view['wr_5']).'회' : '—'),
    array('희망 게시판', get_text($sr_target)),
    array('연락처', $view['wr_8'] !== '' ? get_text($view['wr_8']) : '—'),
);

$sr_attachments = array();
for ($i = 1; $i < count($view['file']); $i++) {
    if (!empty($view['file'][$i]['source'])) {
        $sr_attachments[] = $view['file'][$i];
    }
}
?>

<!-- 솔애드 광고 요청 보기 { -->
<article id="sr_view" class="sr" style="width:<?php echo $width; ?>">

    <a href="<?php echo $list_href; ?>" class="sr-back"><i class="fa fa-angle-left" aria-hidden="true"></i> 광고 요청 목록</a>

    <header class="sr-view-head">
        <div class="sr-view-title-row">
            <h2 class="sr-view-title"><?php echo cut_str(get_text($view['wr_subject']), 70); ?></h2>
            <?php if (!$sr_is_notice) echo solad_request_stage_badge($sr_stage); ?>
        </div>
        <p class="sr-view-meta">
            <span>요청 <?php echo (int) $view['wr_id']; ?></span>
            <span><span class="sound_only">요청한 회원 </span><?php echo $view['name']; ?><?php if ($is_ip_view) { echo ' ('.$ip.')'; } ?></span>
            <span>등록 <?php echo date('Y.m.d H:i', strtotime($view['wr_datetime'])); ?></span>
            <?php if ($view['wr_last'] && $view['wr_last'] !== $view['wr_datetime']) { ?><span>최근 처리 <?php echo date('m.d H:i', strtotime($view['wr_last'])); ?></span><?php } ?>
        </p>
        <ul class="sr-actions">
            <?php if ($update_href && $sr_can_edit) { ?><li><a href="<?php echo $update_href; ?>" class="btn_b01 btn">요청 고치기</a></li><?php } ?>
            <?php if ($delete_href && $sr_can_delete) { ?><li><a href="<?php echo $delete_href; ?>" onclick="del(this.href); return false;" class="btn_b01 btn">지우기</a></li><?php } ?>
            <?php if ($move_href) { ?><li><a href="<?php echo $move_href; ?>" onclick="board_move(this.href); return false;" class="btn_b01 btn">이동</a></li><?php } ?>
            <?php if ($write_href) { ?><li><a href="<?php echo $write_href; ?>" class="sr-btn-primary btn">새 광고 요청</a></li><?php } ?>
        </ul>
    </header>

    <?php if (!$sr_is_notice) { ?>
    <ol class="sr-progress<?php echo $sr_stage === '반려' ? ' is-rejected' : ''; ?>" aria-label="처리 단계">
        <?php foreach ($sr_track as $sr_index => $sr_step) {
            $sr_state = $sr_index < $sr_now ? 'done' : ($sr_index === $sr_now ? 'now' : 'todo');
            if ($sr_stage === '반려' && $sr_index > $sr_now) $sr_state = 'skip';
        ?>
        <li class="is-<?php echo $sr_state; ?>"<?php echo $sr_state === 'now' ? ' aria-current="step"' : ''; ?>>
            <span class="sr-progress-dot" aria-hidden="true"></span>
            <span class="sr-progress-label"><?php echo $sr_step; ?></span>
            <?php if ($sr_state === 'now' && $sr_stage === '보완 요청') { ?><span class="sr-progress-branch is-paused">보완 요청 중</span><?php } ?>
            <?php if ($sr_state === 'now' && $sr_stage === '반려') { ?><span class="sr-progress-branch is-rejected">반려</span><?php } ?>
        </li>
        <?php } ?>
    </ol>
    <?php } ?>

    <?php if (!$is_admin && $sr_is_owner) { ?>
    <?php $sr_stage_status = solad_request_stages(); ?>
    <div class="sr-note is-<?php echo $sr_stage_status[$sr_stage]; ?>" role="note">
        <?php if ($sr_stage === '접수') { ?>요청을 받았어요. 관리자가 검토를 시작하면 처리 기록에 남겨요. 그 전까지는 요청을 고칠 수 있어요.
        <?php } elseif ($sr_stage === '검토') { ?>관리자가 요청을 검토하고 있어요. 결과는 처리 기록에서 알려 드려요.
        <?php } elseif ($sr_stage === '보완 요청') { ?>보완할 내용이 있어요. 아래 처리 기록을 확인하고 요청을 고친 뒤, 고친 내용을 처리 기록에 남겨 주세요.
        <?php } elseif ($sr_stage === '집행 예정') { ?>승인됐어요. 희망 기간에 맞춰 광고가 나가요. 이제 요청을 고치거나 지울 수 없어요. 바꿀 내용은 처리 기록에 남겨 주세요.
        <?php } elseif ($sr_stage === '집행') { ?>광고가 나가고 있어요. 바꿀 내용은 처리 기록에 남겨 주세요.
        <?php } elseif ($sr_stage === '종료') { ?>집행을 마쳤어요. 같은 광고를 다시 하려면 새로 요청해 주세요.
        <?php } else { ?>이 요청은 반려됐어요. 이유는 처리 기록에서 확인할 수 있어요.
        <?php } ?>
    </div>
    <?php } ?>

    <div class="sr-split">
        <section class="sr-card sr-sheet">
            <h3 class="sr-card-title">요청서</h3>
            <dl class="sr-kv">
                <?php foreach ($sr_rows as $sr_row) { ?>
                <dt><?php echo $sr_row[0]; ?></dt>
                <dd><?php echo $sr_row[1]; ?></dd>
                <?php } ?>
                <dt>소재</dt>
                <dd>
                    <?php if ($sr_media_url === '') { ?>
                    <span class="sr-muted">아직 소재가 없어요.</span>
                    <?php } else { ?>
                    <div class="sr-media">
                        <?php if ($sr_media_kind === 'image') { ?>
                        <img src="<?php echo solad_request_attr($sr_media_url); ?>" alt="광고 소재 이미지">
                        <?php } elseif ($sr_media_kind === 'video') { ?>
                        <video src="<?php echo solad_request_attr($sr_media_url); ?>" controls playsinline preload="metadata" data-sr-media></video>
                        <?php } ?>
                    </div>
                    <p class="sr-media-info">
                        <?php if ($sr_media_from_file) { ?>
                        <a href="<?php echo $sr_media_file['href']; ?>" class="view_file_download"><i class="fa fa-download" aria-hidden="true"></i> <?php echo $sr_media_file['source']; ?></a> <span class="sr-muted">(<?php echo $sr_media_file['size']; ?>)</span>
                        <?php } else { ?>
                        <a href="<?php echo solad_request_attr($sr_media_url); ?>" target="_blank" rel="noopener nofollow"><?php echo solad_request_attr($sr_media_url); ?></a>
                        <?php } ?>
                        <span class="sr-muted" data-sr-media-info></span>
                    </p>
                    <?php } ?>
                </dd>
            </dl>
        </section>

        <?php if ($is_admin && !$sr_is_notice) { ?>
        <aside class="sr-card sr-process" aria-labelledby="sr_process_title">
            <h3 class="sr-card-title" id="sr_process_title">처리</h3>
            <p class="sr-help">버튼을 누르면 아래 처리 기록 칸에 상태와 문구가 채워져요. 내용을 확인하고 "처리하기"를 누르면 상태가 바뀌어요.</p>
            <div class="sr-process-buttons">
                <?php foreach ($sr_actions[$sr_stage] as $sr_action) { ?>
                <button type="button" class="btn <?php echo $sr_action[0] === '반려' ? 'sr-btn-danger' : ($sr_action[0] === '집행 예정' || $sr_action[0] === '집행' ? 'sr-btn-primary' : 'btn_b02'); ?>" data-sr-stage="<?php echo $sr_action[0]; ?>"><?php echo $sr_action[1]; ?></button>
                <?php } ?>
                <button type="button" class="btn_b02 btn" data-sr-stage="">답변만 남기기</button>
            </div>
            <h4 class="sr-process-sub">솔애드 관리자</h4>
            <p class="sr-help">승인하면 소재를 하우스 광고로 등록하고 지면 편성에 넣어 주세요. 희망 위치와 기간을 그대로 쓰면 돼요.</p>
            <p class="sr-process-links">
                <a href="<?php echo solad_request_attr($sr_settings['base']); ?>/#/house" target="solad_admin" class="btn_b02 btn" data-sr-admin>하우스 광고 등록</a>
                <a href="<?php echo solad_request_attr($sr_settings['base']); ?>/#/schedule" target="solad_admin" class="btn_b02 btn" data-sr-admin>지면 편성</a>
            </p>
        </aside>
        <?php } ?>
    </div>

    <section class="sr-card">
        <h3 class="sr-card-title">요청 내용</h3>
        <div id="bo_v_con" class="sr-content"><?php echo get_view_thumbnail($view['content']); ?></div>
        <?php if ($sr_attachments) { ?>
        <h4 class="sr-sub-title">참고 자료</h4>
        <ul class="sr-files">
            <?php foreach ($sr_attachments as $sr_file) { ?>
            <li>
                <a href="<?php echo $sr_file['href']; ?>" class="view_file_download"><i class="fa fa-paperclip" aria-hidden="true"></i> <?php echo $sr_file['source']; ?></a>
                <span class="sr-muted"><?php echo $sr_file['size']; ?><?php if ($sr_file['content']) echo ' · '.$sr_file['content']; ?></span>
            </li>
            <?php } ?>
        </ul>
        <?php } ?>
    </section>

    <?php include_once(G5_BBS_PATH.'/view_comment.php'); ?>

    <?php if ($prev_href || $next_href) { ?>
    <nav class="sr-nb" aria-label="이전·다음 요청">
        <?php if ($prev_href) { ?><a href="<?php echo $prev_href; ?>"><span>이전 요청</span><?php echo $prev_wr_subject; ?></a><?php } ?>
        <?php if ($next_href) { ?><a href="<?php echo $next_href; ?>" class="is-next"><span>다음 요청</span><?php echo $next_wr_subject; ?></a><?php } ?>
    </nav>
    <?php } ?>
</article>

<script>
function board_move(href) {
    window.open(href, "boardmove", "left=50, top=50, width=500, height=550, scrollbars=1");
}
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
</script>
<script src="<?php echo $board_skin_url; ?>/request.js"></script>
<!-- } 솔애드 광고 요청 보기 -->
