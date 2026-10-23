<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가

include_once(G5_THEME_PATH.'/lib/theme.lib.php');

solad_theme_add_assets();

include_once(G5_PATH.'/head.sub.php');
include_once(G5_LIB_PATH.'/latest.lib.php');
include_once(G5_LIB_PATH.'/outlogin.lib.php');
include_once(G5_LIB_PATH.'/poll.lib.php');
include_once(G5_LIB_PATH.'/visit.lib.php');
include_once(G5_LIB_PATH.'/connect.lib.php');
include_once(G5_LIB_PATH.'/popular.lib.php');

$sl_is_index = defined('_INDEX_');
// 솔애드 스킨(solad_*)은 스스로 어두운 바탕에 맞춘다. 그 밖의 그누보드 기본 스킨 화면에만 g5-skins.css 덮어쓰기를 건다.
$sl_g5_skin = !(isset($board['bo_skin']) && preg_match('#(^|/)solad_#', $board['bo_skin']));
?>

<a class="sl-skip" href="#sl-main">본문 바로가기</a>
<?php
if ($sl_is_index) {
    include G5_BBS_PATH.'/newwin.inc.php'; // 팝업레이어
}
?>

<?php include G5_THEME_PATH.'/inc/header.php'; ?>

<main id="sl-main" class="sl-main<?php echo $sl_is_index ? ' sl-main--index' : ''; ?>" tabindex="-1">
<?php if (!$sl_is_index) { ?>
<div class="sl-page<?php echo $sl_g5_skin ? ' sl-page--g5' : ''; ?>">
<?php } ?>
