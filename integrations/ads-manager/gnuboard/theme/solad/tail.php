<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가
?>
<?php if (!defined('_INDEX_')) { ?>
</div>
<?php } ?>
</main>

<?php include G5_THEME_PATH.'/inc/footer.php'; ?>

<?php
if ($config['cf_analytics']) {
    echo $config['cf_analytics'];
}

include_once(G5_PATH.'/tail.sub.php');
