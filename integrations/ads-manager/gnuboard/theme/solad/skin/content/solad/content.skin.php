<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가

// 솔애드 테마 내용 페이지. 제목을 화면에 보이고, 본문은 관리자 내용 관리의 HTML을 그대로 둔다.
add_stylesheet('<link rel="stylesheet" href="'.$content_skin_url.'/style.css?v='.filemtime($content_skin_path.'/style.css').'">', 0);

// 구매 안내 아래 자주 묻는 질문. 구조화 데이터(FAQPage)와 같은 배열을 쓴다.
include_once(G5_THEME_PATH.'/lib/seo.lib.php');
$sl_faq = $co_id === 'purchase' ? solad_seo_faq() : array();
?>

<article class="sl-doc ctt_<?php echo $co_id; ?>">
    <header class="sl-doc-head">
        <h1 class="sl-doc-title"><?php echo $g5['title']; ?></h1>
    </header>

    <div class="sl-doc-body">
        <?php echo $str; ?>
    </div>

    <?php if ($sl_faq) { ?>
    <section class="sl-faq" aria-labelledby="sl-faq-title">
        <h2 class="sl-faq-title" id="sl-faq-title">자주 묻는 질문</h2>
        <?php foreach ($sl_faq as $item) { ?>
        <details class="sl-faq-item">
            <summary><?php echo solad_seo_attr($item['q']); ?></summary>
            <p><?php echo solad_seo_attr($item['a']); ?></p>
        </details>
        <?php } ?>
    </section>
    <?php } ?>
</article>
