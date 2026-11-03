<?php
// 솔애드 라이트 예제: 게시판이 아닌 페이지에 플레이어를 넣는 세 가지 방법. 최고관리자만 볼 수 있다.
//   https://내사이트/plugin/solad_lite/example.php
include_once '../../common.php';

if ($is_admin !== 'super') {
    alert('최고관리자만 볼 수 있는 예제입니다.', G5_URL);
}

$sample = solad_lite_plugin_url().'/sample';
$sl_config = solad_lite_config();
$g5['title'] = '솔애드 라이트 예제';
include_once G5_PATH.'/head.sub.php';
?>
<style>
.solad-lite-example { max-width: 860px; margin: 0 auto; padding: 32px 16px 80px; font-size: 15px; line-height: 1.7; color: #222; }
.solad-lite-example h1 { font-size: 26px; margin: 0 0 8px; }
.solad-lite-example h2 { font-size: 19px; margin: 40px 0 8px; padding-top: 16px; border-top: 1px solid #e5e5e5; }
.solad-lite-example pre { overflow-x: auto; padding: 12px 14px; background: #f4f5f7; border-radius: 6px; font-size: 13px; line-height: 1.6; }
.solad-lite-example .note { padding: 10px 14px; background: #fff6e0; border-radius: 6px; }
</style>

<div class="solad-lite-example">
    <h1>솔애드 라이트 예제</h1>
    <p>
        광고 상태:
        <?php echo solad_lite_ad_ready($sl_config) ? '<strong>켜짐</strong> (재생하면 광고가 먼저 나옵니다)' : '<strong>꺼짐</strong> (관리자 &gt; 게시판관리 &gt; 솔애드 라이트 광고에서 광고 영상을 올리고 켜 주세요)'; ?>
    </p>
    <p class="note">광고를 시험하려면 <code>plugin/solad_lite/sample/sample-ad.mp4</code>를 내려받아 광고 영상으로 올려 보세요.</p>

    <h2>1. PHP 함수로 넣기</h2>
    <p>스킨이나 PHP 페이지에서 <code>solad_lite_player()</code>를 부르면 플레이어 자리가 출력됩니다.</p>
    <?php echo solad_lite_player($sample.'/sample-movie.mp4', array('title' => '예제 영상')); ?>
<pre>&lt;?php echo solad_lite_player('/data/file/free/movie.mp4', array('poster' =&gt; '/data/file/free/cover.jpg')); ?&gt;</pre>

    <h2>2. HTML로 넣기</h2>
    <p>그누보드 페이지라면 어디든 <code>data-solad-lite</code> 자리를 두면 플레이어로 바뀝니다. 광고 없이 쓰려면 <code>data-ads="off"</code>를 붙입니다.</p>
    <div data-solad-lite data-src="<?php echo $sample; ?>/sample-movie.mp4" data-ads="off"></div>
<pre>&lt;div data-solad-lite data-src="/data/file/free/movie.mp4" data-poster="/data/file/free/cover.jpg"&gt;&lt;/div&gt;
&lt;div data-solad-lite data-src="/data/file/free/movie.mp4" data-ads="off"&gt;&lt;/div&gt;</pre>

    <h2>3. 자바스크립트로 넣기</h2>
    <p>나중에 그려지는 내용(AJAX로 불러온 글 등)에는 <code>SoladLite.mount()</code>나 <code>SoladLite.scan()</code>을 부릅니다.</p>
    <div id="solad-lite-js-example"></div>
<pre>&lt;div id="my-player"&gt;&lt;/div&gt;
&lt;script&gt;
window.addEventListener('load', function () {
  SoladLite.mount(document.getElementById('my-player'), { src: '/data/file/free/movie.mp4' });
});
// 새로 넣은 [data-solad-lite]를 플레이어로 바꿀 때
// SoladLite.scan();
&lt;/script&gt;</pre>
</div>

<script>
window.addEventListener('load', function () {
    SoladLite.mount(document.getElementById('solad-lite-js-example'), {
        src: <?php echo json_encode($sample.'/sample-movie.mp4'); ?>,
        title: '자바스크립트로 넣은 플레이어'
    });
});
</script>
<?php
include_once G5_PATH.'/tail.sub.php';
