<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가

// 솔애드 테마 내용 페이지. 제목을 화면에 보이고, 본문은 관리자 내용 관리의 HTML을 그대로 둔다.
add_stylesheet('<link rel="stylesheet" href="'.$content_skin_url.'/style.css?v='.filemtime($content_skin_path.'/style.css').'">', 0);
?>

<article class="sl-doc ctt_<?php echo $co_id; ?>">
    <header class="sl-doc-head">
        <h1 class="sl-doc-title"><?php echo $g5['title']; ?></h1>
    </header>

    <div class="sl-doc-body">
        <?php echo $str; ?>
    </div>
</article>
