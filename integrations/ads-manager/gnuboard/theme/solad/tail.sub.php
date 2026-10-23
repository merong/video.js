<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가

// 코어 tail.sub.php는 관리자 화면이 아니면 이 파일을 읽고 바로 끝난다.
?>
<?php if (defined('SOLAD_THEME_MEMBER_FRAME')) { // head.sub.php가 연 로그인 계열 회원 화면의 본문 틀을 닫고 바닥글을 단다 ?>
</div>
</main>

<?php include G5_THEME_PATH.'/inc/footer.php'; ?>
<?php } ?>

<?php if ($is_admin == 'super' && isset($begin_time)) {  ?><!-- <div style='float:left; text-align:center;'>RUN TIME : <?php echo get_microtime()-$begin_time; ?><br></div> --><?php }  ?>


<?php run_event('tail_sub'); ?>

</body>
</html>
<?php echo html_end(); // HTML 마지막 처리 함수 : 반드시 넣어주시기 바랍니다.
