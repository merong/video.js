<?php
$sub_menu = '300960';
require_once './_common.php';

if (defined('SOLAD_LITE_MENU')) {
    $sub_menu = SOLAD_LITE_MENU;
}
if (!function_exists('solad_lite_config')) {
    alert('extend/solad_lite.extend.php 파일이 없습니다. 솔애드 라이트 설치 가이드를 확인해 주세요.');
}

auth_check_menu($auth, $sub_menu, 'r');

solad_lite_install();
$sl_config = solad_lite_config(true);
$selected = solad_lite_board_list($sl_config);
$ad_ready = solad_lite_ad_ready($sl_config);
$ad_url = $ad_ready ? solad_lite_data_url().'/'.$sl_config['sl_ad_file'] : '';
$upload_max = ini_get('upload_max_filesize');
$post_max = ini_get('post_max_size');

$boards = array();
$result = sql_query(" SELECT bo_table, bo_subject, gr_id FROM {$g5['board_table']} ORDER BY gr_id, bo_order, bo_table ");
while ($row = sql_fetch_array($result)) {
    $boards[] = $row;
}

$g5['title'] = '솔애드 라이트 광고';
require_once G5_ADMIN_PATH.'/admin.head.php';
?>

<form name="fsoladlite" action="./solad_lite_form_update.php" onsubmit="return fsoladlite_check(this);" method="post" enctype="multipart/form-data">
    <input type="hidden" name="token" value="">

    <div class="local_desc01 local_desc">
        <p>게시판 글에 첨부한 동영상(mp4·webm)을 Video.js 플레이어로 재생하고, 재생 전에 광고 영상 1개를 보여 줍니다.</p>
        <p>광고는 <strong>프리롤(본편 앞) 1개</strong>이고, 시작하고 <strong><?php echo SOLAD_LITE_SKIP_SECONDS; ?>초</strong>가 지나면 [건너뛰기]를 누를 수 있습니다.</p>
    </div>

    <section id="anc_solad_lite_player">
        <h2 class="h2_frm">플레이어</h2>
        <div class="tbl_frm01 tbl_wrap">
            <table>
                <caption>플레이어 설정</caption>
                <colgroup>
                    <col class="grid_4">
                    <col>
                </colgroup>
                <tbody>
                    <tr>
                        <th scope="row"><label for="sl_player">플레이어 사용</label></th>
                        <td>
                            <?php echo help('켜면 글 보기 화면에서 첨부한 mp4·webm 파일을 본문 위에 플레이어로 보여 줍니다. 본문에 들어간 &lt;video&gt;도 플레이어로 바꿉니다.'); ?>
                            <input type="checkbox" name="sl_player" value="1" id="sl_player" <?php echo $sl_config['sl_player'] ? 'checked' : ''; ?>>
                            <label for="sl_player">게시판 글의 동영상을 플레이어로 재생</label>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">적용 게시판</th>
                        <td>
                            <?php echo help('선택한 게시판이 없으면 모든 게시판에 적용합니다.'); ?>
                            <div class="solad-lite-boards">
                                <?php foreach ($boards as $board_row) { ?>
                                <label>
                                    <input type="checkbox" name="sl_boards[]" value="<?php echo get_text($board_row['bo_table']); ?>" <?php echo in_array($board_row['bo_table'], $selected, true) ? 'checked' : ''; ?>>
                                    <?php echo get_text($board_row['bo_subject']); ?> <span class="solad-lite-muted">(<?php echo get_text($board_row['bo_table']); ?>)</span>
                                </label>
                                <?php } ?>
                                <?php if (!$boards) { ?><span class="solad-lite-muted">만든 게시판이 없습니다.</span><?php } ?>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </section>

    <section id="anc_solad_lite_ad">
        <h2 class="h2_frm">광고</h2>
        <div class="tbl_frm01 tbl_wrap">
            <table>
                <caption>광고 설정</caption>
                <colgroup>
                    <col class="grid_4">
                    <col>
                </colgroup>
                <tbody>
                    <tr>
                        <th scope="row"><label for="sl_ad_use">광고 사용</label></th>
                        <td>
                            <input type="checkbox" name="sl_ad_use" value="1" id="sl_ad_use" <?php echo $sl_config['sl_ad_use'] ? 'checked' : ''; ?>>
                            <label for="sl_ad_use">동영상 재생 전에 광고를 보여 줍니다</label>
                            <p class="solad-lite-status <?php echo $ad_ready ? 'is-on' : ''; ?>">
                                <?php
                                if ($ad_ready) {
                                    echo '지금 광고가 나가고 있습니다.';
                                } elseif ($sl_config['sl_ad_file'] === '') {
                                    echo '광고 영상이 없어 광고가 나가지 않습니다.';
                                } else {
                                    echo '광고 사용이 꺼져 있어 광고가 나가지 않습니다.';
                                }
                                ?>
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">광고 위치</th>
                        <td>프리롤(본편 앞) 1개 · <?php echo SOLAD_LITE_SKIP_SECONDS; ?>초 뒤 건너뛰기 <span class="solad-lite-muted">(고정)</span></td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="sl_ad_file">광고 영상</label></th>
                        <td>
                            <?php echo help('mp4 또는 webm 파일만 올릴 수 있습니다. 새 파일을 올리면 이전 광고 영상은 지워집니다. 서버 업로드 한도: 파일 '.$upload_max.', 요청 '.$post_max); ?>
                            <?php if ($sl_config['sl_ad_file'] !== '') { ?>
                            <div class="solad-lite-current">
                                <?php if ($ad_url) { ?>
                                <video src="<?php echo htmlspecialchars($ad_url, ENT_QUOTES); ?>" controls preload="metadata" playsinline></video>
                                <?php } ?>
                                <p>
                                    <?php echo get_text($sl_config['sl_ad_name']); ?>
                                    <span class="solad-lite-muted">(<?php echo get_text($sl_config['sl_ad_mime']); ?>, <?php echo number_format(max(0, (int) $sl_config['sl_ad_size'] / 1048576), 1); ?>MB)</span>
                                    <label class="solad-lite-delete"><input type="checkbox" name="sl_ad_delete" value="1"> 광고 영상 삭제</label>
                                </p>
                            </div>
                            <?php } ?>
                            <input type="file" name="sl_ad_file" id="sl_ad_file" accept=".mp4,.webm,video/mp4,video/webm" class="frm_input">
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="sl_ad_link">광고 링크</label></th>
                        <td>
                            <?php echo help('광고를 누르면 새 창으로 열 주소입니다. 비우면 링크 없이 광고만 보여 줍니다.'); ?>
                            <input type="url" name="sl_ad_link" value="<?php echo get_text($sl_config['sl_ad_link']); ?>" id="sl_ad_link" class="frm_input" size="70" maxlength="255" placeholder="https://">
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="sl_ad_alt">광고 설명</label></th>
                        <td>
                            <?php echo help('화면 읽기 프로그램이 읽는 광고 설명입니다. 예: 솔애드 봄 할인 광고'); ?>
                            <input type="text" name="sl_ad_alt" value="<?php echo get_text($sl_config['sl_ad_alt']); ?>" id="sl_ad_alt" class="frm_input" size="70" maxlength="100">
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </section>

    <div class="btn_fixed_top">
        <input type="submit" value="확인" class="btn_submit btn" accesskey="s">
    </div>
</form>

<style>
.solad-lite-boards { display: flex; flex-wrap: wrap; gap: 6px 18px; }
.solad-lite-muted { color: #888; }
.solad-lite-status { margin: 8px 0 0; color: #a15c00; }
.solad-lite-status.is-on { color: #17803d; }
.solad-lite-current { margin: 0 0 10px; }
.solad-lite-current video { display: block; width: 360px; max-width: 100%; background: #000; border-radius: 6px; }
.solad-lite-current p { margin: 6px 0 0; }
.solad-lite-delete { margin-left: 10px; color: #c00; }
</style>

<script>
function fsoladlite_check(f) {
    var file = f.sl_ad_file.files && f.sl_ad_file.files[0];
    if (file && !/\.(mp4|webm)$/i.test(file.name)) {
        alert("광고 영상은 mp4 또는 webm 파일만 올릴 수 있습니다.");
        f.sl_ad_file.focus();
        return false;
    }
    if (f.sl_ad_link.value && !/^https?:\/\//i.test(f.sl_ad_link.value)) {
        alert("광고 링크는 http:// 또는 https:// 로 시작해야 합니다.");
        f.sl_ad_link.focus();
        return false;
    }
    return true;
}
</script>

<?php
require_once G5_ADMIN_PATH.'/admin.tail.php';
