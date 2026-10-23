<?php
if (!defined('_INDEX_')) define('_INDEX_', true);
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가

include_once(G5_THEME_PATH.'/lib/theme.lib.php');
include_once(G5_LIB_PATH.'/thumbnail.lib.php');

add_stylesheet('<link rel="stylesheet" href="'.solad_theme_asset('css/main.css').'">', 21);
add_javascript('<script src="'.solad_theme_asset('js/main.js').'" defer></script>', 21);

$sl_hero = solad_theme_hero();
$sl_demo = solad_theme_demo_video(SOLAD_THEME_VIDEO_BOARD, SOLAD_THEME_DEMO_WR_ID);
$sl_videos = solad_theme_latest_videos(SOLAD_THEME_VIDEO_BOARD, 8);
$sl_previews = $sl_videos ? solad_video_previews(SOLAD_THEME_VIDEO_BOARD, $sl_videos) : array();
$sl_video_count = solad_theme_count_videos(SOLAD_THEME_VIDEO_BOARD);
$sl_gallery_url = get_pretty_url(SOLAD_THEME_VIDEO_BOARD);
$sl_request_url = get_pretty_url(SOLAD_THEME_REQUEST_BOARD);
$sl_player_base = solad_theme_player_base(SOLAD_THEME_VIDEO_BOARD);
$sl_admin_url = solad_theme_admin_entry();

$g5['title'] = '솔애드 동영상 플레이어';

$sl_ticker = array('MP4 업로드', '영상 주소', 'HLS 주소', 'HLS 묶음(zip)', '프리롤 광고', '미드롤 광고', '건너뛰기 버튼', '로고 네 모서리', '테마 6종', '앞/뒤 이동 버튼', '자막', '단축키', '광고 통계');

include_once(G5_THEME_PATH.'/head.php');
?>
<script>document.documentElement.classList.add("sl-js");</script>

<section class="sl-hero" aria-labelledby="sl-hero-title" data-sl-hero>
    <div class="sl-hero-bg" aria-hidden="true">
        <?php if ($sl_hero['poster']) { ?><div class="sl-hero-ambient" style="background-image:url('<?php echo $sl_hero['poster']; ?>')" data-sl-ambient></div><?php } ?>
        <div class="sl-hero-glow"></div>
        <div class="sl-hero-grain"></div>
    </div>

    <div class="sl-hero-inner">
        <div class="sl-hero-copy">
            <p class="sl-eyebrow sl-hero-step" style="--step:0"><span class="sl-dot" aria-hidden="true"></span>솔애드 동영상 플레이어</p>
            <h1 class="sl-hero-title" id="sl-hero-title">
                <span class="sl-hero-line sl-hero-step" style="--step:1">그누보드 영상 게시판에</span>
                <span class="sl-hero-line sl-hero-step sl-hero-accent" style="--step:2">광고까지 붙는 플레이어</span>
            </h1>
            <p class="sl-hero-lead sl-hero-step" style="--step:3">그누보드 동영상 게시판에 바로 붙여 쓰는 솔애드 플레이어예요. 관리자 화면에서 정한 광고·로고·테마가 게시판 영상에 그대로 적용되고, 지금 보이는 소개 영상도 이 플레이어로 재생돼요.</p>
            <div class="sl-hero-actions sl-hero-step" style="--step:4">
                <a class="sl-btn sl-btn--accent sl-btn--lg" href="<?php echo $sl_gallery_url; ?>">
                    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M8 5.6v12.8c0 .8.9 1.3 1.6.8l10-6.4c.6-.4.6-1.3 0-1.7l-10-6.4C8.9 4.3 8 4.8 8 5.6Z" fill="currentColor"/></svg>
                    동영상 갤러리
                </a>
                <?php if ($sl_admin_url) { ?><a class="sl-btn sl-btn--ghost sl-btn--lg" href="<?php echo $sl_admin_url; ?>" data-sl-admin-popup>솔애드 관리자</a><?php } ?>
                <a class="sl-btn sl-btn--glass sl-btn--lg" href="<?php echo $sl_request_url; ?>">광고 요청하기</a>
            </div>
            <a class="sl-hero-link sl-hero-step" style="--step:5" href="#sl-demo">광고가 붙는 실제 게시판 영상 보기 <span aria-hidden="true">↓</span></a>
        </div>

        <div class="sl-hero-stage">
            <div class="sl-hero-frame">
                <?php if ($sl_hero['src']) { ?>
                <div id="sl-hero-player"
                     data-solad-player
                     data-solad-manual
                     data-video-id="solad-hero"
                     data-src="<?php echo solad_attr($sl_hero['src']); ?>"
                     data-title="솔애드 플레이어 소개"
                     data-muted="true"
                     data-loop="true"
                     data-preload="metadata"
                     <?php if ($sl_hero['poster']) { ?>data-poster="<?php echo solad_attr($sl_hero['poster']); ?>" style="background-image:url('<?php echo $sl_hero['poster']; ?>')"<?php } ?>></div>
                <?php } elseif ($sl_hero['poster']) { ?>
                <img class="sl-hero-poster" src="<?php echo $sl_hero['poster']; ?>" alt="">
                <?php } ?>
            </div>
            <span class="sl-hero-chip sl-hero-chip--ad" aria-hidden="true"><b>광고</b> 5초 후 건너뛰기</span>
            <span class="sl-hero-chip sl-hero-chip--hls" aria-hidden="true"><i></i>MP4 · HLS 재생</span>
            <span class="sl-hero-chip sl-hero-chip--logo" aria-hidden="true"><i></i>로고 네 모서리</span>
        </div>
    </div>

    <div class="sl-hero-foot">
        <a class="sl-scroll-cue" href="#sl-features"><span class="sound_only">기능 소개로 내려가기</span><span class="sl-scroll-cue-bar" aria-hidden="true"></span></a>
    </div>

    <?php if ($sl_hero['src']) { ?>
    <script>
    // 솔애드를 불러오지 못하면 브라우저 기본 플레이어로 소개 영상을 보여 준다.
    function sl_hero_fallback() {
        var node = document.getElementById("sl-hero-player");
        if (!node || node.classList.contains("is-fallback") || node.querySelector("video-player, video")) return;
        var video = document.createElement("video");
        video.controls = true;
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        video.preload = "metadata";
        video.autoplay = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        video.src = node.getAttribute("data-src");
        if (node.getAttribute("data-poster")) video.poster = node.getAttribute("data-poster");
        node.classList.add("is-fallback");
        node.appendChild(video);
    }
    </script>
    <script type="module">
    // 소개 영상은 광고 없이 재생한다. 빈 편성을 미리보기로 넘겨 광고 API를 부르지 않고 이벤트도 보내지 않는다.
    // 움직임 줄이기를 켠 사람에게는 자동 재생하지 않고 포스터와 재생 버튼만 보여 준다.
    const node = document.getElementById("sl-hero-player");
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) node.dataset.autoplay = "true";
    try {
        const { mount } = await import(<?php echo json_encode($sl_player_base.'/player/loader.js', JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT); ?>);
        const handle = await mount(node, { preview: { schedule: { videoId: "solad-hero", breaks: [] } } });
        node.dispatchEvent(new CustomEvent("sl-hero-ready", { bubbles: true, detail: handle }));
    } catch (error) {
        sl_hero_fallback();
    }
    </script>
    <?php } ?>
</section>

<div class="sl-ticker" aria-label="지원하는 기능">
    <div class="sl-ticker-track">
        <?php for ($sl_pass = 0; $sl_pass < 2; $sl_pass++) { ?>
        <ul class="sl-ticker-list"<?php echo $sl_pass ? ' aria-hidden="true"' : ''; ?>>
            <?php foreach ($sl_ticker as $sl_item) { ?><li><?php echo $sl_item; ?></li><?php } ?>
        </ul>
        <?php } ?>
    </div>
</div>

<section class="sl-section sl-features" id="sl-features" aria-labelledby="sl-features-title">
    <div class="sl-wrap">
        <header class="sl-section-head" data-reveal>
            <p class="sl-eyebrow">기능</p>
            <h2 class="sl-section-title" id="sl-features-title">게시판 영상에 필요한 것을<br>플레이어 하나에 담았어요</h2>
            <p class="sl-section-lead">사이트 플레이어 설정 하나로 모든 영상이 같은 모양, 같은 광고 규칙으로 재생돼요.</p>
        </header>

        <ul class="sl-feature-grid">
            <li class="sl-feature" data-reveal style="--i:0">
                <div class="sl-mini sl-mini--ad" aria-hidden="true">
                    <span class="sl-mini-badge">광고</span>
                    <span class="sl-mini-skip"><span class="sl-mini-count"></span><span class="sl-mini-skip-label">건너뛰기 ›</span></span>
                    <span class="sl-mini-bar"><span class="sl-mini-bar-fill sl-mini-bar-fill--ad"></span></span>
                </div>
                <h3>프리롤·미드롤 광고</h3>
                <p>본편 앞과 중간에 광고를 넣고, 정한 초가 지나면 건너뛰기 버튼을 보여 줘요.</p>
            </li>
            <li class="sl-feature" data-reveal style="--i:1">
                <div class="sl-mini sl-mini--logo" aria-hidden="true">
                    <span class="sl-mini-logo"></span>
                    <span class="sl-mini-corner sl-mini-corner--tl"></span><span class="sl-mini-corner sl-mini-corner--tr"></span>
                    <span class="sl-mini-corner sl-mini-corner--bl"></span><span class="sl-mini-corner sl-mini-corner--br"></span>
                </div>
                <h3>로고 네 모서리</h3>
                <p>사이트 로고를 네 모서리 중 한 곳에 띄워요. 광고 중이나 컨트롤과 함께 숨길 수도 있어요.</p>
            </li>
            <li class="sl-feature" data-reveal style="--i:2">
                <div class="sl-mini sl-mini--theme" aria-hidden="true">
                    <span class="sl-mini-play"></span>
                    <span class="sl-mini-controls"><span class="sl-mini-bar"><span class="sl-mini-bar-fill"></span></span><span class="sl-mini-pill"></span></span>
                </div>
                <h3>테마 6종</h3>
                <p>기본, 플랫, 둥근 테두리, 강조색, 다크, 따뜻한 색 중에서 고르고 색과 모서리를 다듬어요.</p>
            </li>
            <li class="sl-feature" data-reveal style="--i:3">
                <div class="sl-mini sl-mini--seek" aria-hidden="true">
                    <span class="sl-mini-seek sl-mini-seek--back">10</span>
                    <span class="sl-mini-play"></span>
                    <span class="sl-mini-seek sl-mini-seek--fwd">10</span>
                </div>
                <h3>앞/뒤 이동 버튼</h3>
                <p>5·10·15·30초씩 건너뛰는 버튼을 켤 수 있고, 화면을 두 번 탭해도 앞뒤로 움직여요.</p>
            </li>
            <li class="sl-feature" data-reveal style="--i:4">
                <div class="sl-mini sl-mini--sources" aria-hidden="true">
                    <span class="sl-mini-chip">MP4</span><span class="sl-mini-chip">주소</span><span class="sl-mini-chip">HLS</span><span class="sl-mini-chip">zip</span>
                </div>
                <h3>네 가지 등록 방식</h3>
                <p>MP4 파일, 영상 주소, HLS 주소, HLS 묶음(zip)으로 올려요. 재생 시간은 자동으로 채워져요.</p>
            </li>
            <li class="sl-feature" data-reveal style="--i:5">
                <div class="sl-mini sl-mini--stats" aria-hidden="true">
                    <span style="--h:46%"></span><span style="--h:72%"></span><span style="--h:58%"></span><span style="--h:88%"></span><span style="--h:64%"></span>
                </div>
                <h3>광고 통계</h3>
                <p>광고가 몇 번 시작되고 끝까지 재생됐는지, 건너뛰기와 클릭은 몇 번인지 관리자 화면에서 봐요.</p>
            </li>
        </ul>
    </div>
</section>

<section class="sl-section sl-demo" id="sl-demo" aria-labelledby="sl-demo-title">
    <div class="sl-wrap sl-demo-grid">
        <div class="sl-demo-copy" data-reveal>
            <p class="sl-eyebrow">직접 보기</p>
            <h2 class="sl-section-title" id="sl-demo-title">진짜 플레이어로<br>눌러 보세요</h2>
            <p class="sl-section-lead">동영상 갤러리에 올라간 영상을 솔애드 플레이어로 열었어요. 관리자 화면의 플레이어 설정과 광고 편성이 게시판과 똑같이 적용돼요.</p>
            <ul class="sl-checks">
                <li>광고 편성이 있으면 본편보다 광고가 먼저 나와요.</li>
                <li>설정 버튼에서 재생 속도와 자막을 바꿔요.</li>
                <li>스페이스나 K로 재생과 멈춤, ←·→로 이동, F로 전체 화면을 써요.</li>
                <li>휴대폰에서는 화면 왼쪽·오른쪽을 두 번 탭해 이동해요.</li>
            </ul>
        </div>
        <div class="sl-demo-stage" data-reveal style="--i:1">
            <?php if ($sl_demo) { ?>
            <div class="sl-demo-frame">
                <div id="sl-demo-player"
                     data-solad-player
                     data-video-id="<?php echo solad_attr(solad_video_id(SOLAD_THEME_VIDEO_BOARD, $sl_demo['row']['wr_id'])); ?>"
                     data-src="<?php echo solad_attr($sl_demo['src']); ?>"
                     data-title="<?php echo get_text($sl_demo['row']['wr_subject']); ?>"
                     <?php if ($sl_demo['engine']) { ?>data-engine="<?php echo $sl_demo['engine']; ?>"<?php } ?>
                     <?php if ($sl_demo['poster']) { ?>data-poster="<?php echo solad_attr($sl_demo['poster']); ?>"<?php } ?>></div>
            </div>
            <div class="sl-demo-meta">
                <div>
                    <strong><?php echo cut_str(get_text($sl_demo['row']['wr_subject']), 60); ?></strong>
                    <span><?php echo $sl_demo['row']['ca_name'] ? get_text($sl_demo['row']['ca_name']).' · ' : ''; ?><?php echo solad_video_duration($sl_demo['row']['wr_2']); ?></span>
                </div>
                <a href="<?php echo $sl_demo['href']; ?>">게시판에서 보기 <span aria-hidden="true">→</span></a>
            </div>
            <script>
            // 솔애드를 불러오지 못하면 브라우저 기본 플레이어로 본편만 보여 준다.
            function sl_demo_fallback() {
                var node = document.getElementById("sl-demo-player");
                if (!node || node.classList.contains("is-fallback") || node.querySelector("video-player, video")) return;
                var video = document.createElement("video");
                video.controls = true;
                video.playsInline = true;
                video.preload = "metadata";
                video.src = node.getAttribute("data-src");
                if (node.getAttribute("data-poster")) video.poster = node.getAttribute("data-poster");
                node.classList.add("is-fallback");
                node.appendChild(video);
            }
            document.getElementById("sl-demo-player").addEventListener("solad-error", sl_demo_fallback);
            </script>
            <script type="module" src="<?php echo solad_attr($sl_player_base); ?>/player/loader.js" onerror="sl_demo_fallback()"></script>
            <?php } else { ?>
            <div class="sl-demo-frame sl-demo-empty">
                <p>아직 올라온 영상이 없어요. 동영상 갤러리에 첫 영상을 올려 보세요.</p>
            </div>
            <?php } ?>
        </div>
    </div>
</section>

<section class="sl-section sl-latest" aria-labelledby="sl-latest-title">
    <div class="sl-wrap">
        <header class="sl-section-head sl-section-head--row" data-reveal>
            <div>
                <p class="sl-eyebrow">동영상 갤러리</p>
                <h2 class="sl-section-title" id="sl-latest-title">최근 올라온 영상</h2>
            </div>
            <a class="sl-more" href="<?php echo $sl_gallery_url; ?>">영상 <?php echo number_format($sl_video_count); ?>개 모두 보기 <span aria-hidden="true">→</span></a>
        </header>

        <?php if ($sl_videos) { ?>
        <ul class="sl-cards">
            <?php foreach ($sl_videos as $sl_i => $sl_video) { ?>
            <li class="sl-card" data-reveal style="--i:<?php echo $sl_i % 4; ?>">
                <a class="sl-card-link" href="<?php echo $sl_video['href']; ?>">
                    <span class="sl-card-thumb"<?php echo isset($sl_previews[$sl_video['wr_id']]) ? ' data-preview="'.solad_attr($sl_previews[$sl_video['wr_id']]).'"' : ''; ?>>
                        <?php if ($sl_video['thumb']) { ?><img src="<?php echo $sl_video['thumb']; ?>" alt="" loading="lazy"><?php } else { ?><span class="sl-card-empty" aria-hidden="true"></span><?php } ?>
                        <?php if ($sl_video['ca_name']) { ?><span class="sl-card-cate"><?php echo get_text($sl_video['ca_name']); ?></span><?php } ?>
                        <?php if ($sl_video['duration']) { ?><span class="sl-card-time"><span class="sound_only">재생 시간 </span><?php echo $sl_video['duration']; ?></span><?php } ?>
                        <span class="sl-card-play" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M8 5.6v12.8c0 .8.9 1.3 1.6.8l10-6.4c.6-.4.6-1.3 0-1.7l-10-6.4C8.9 4.3 8 4.8 8 5.6Z" fill="currentColor"/></svg></span>
                    </span>
                    <span class="sl-card-title"><?php echo cut_str(get_text($sl_video['wr_subject']), 60); ?></span>
                    <span class="sl-card-meta">조회수 <?php echo solad_video_count($sl_video['wr_hit']); ?>회 · <?php echo solad_video_ago($sl_video['wr_datetime']); ?></span>
                </a>
            </li>
            <?php } ?>
        </ul>
        <?php } else { ?>
        <p class="sl-empty">아직 올라온 영상이 없어요.</p>
        <?php } ?>
    </div>
</section>

<section class="sl-section sl-steps" aria-labelledby="sl-steps-title">
    <div class="sl-wrap">
        <header class="sl-section-head" data-reveal>
            <p class="sl-eyebrow">사용 방법</p>
            <h2 class="sl-section-title" id="sl-steps-title">올리고, 정하면, 바로 재생돼요</h2>
        </header>
        <ol class="sl-step-list" data-reveal>
            <li style="--i:0">
                <span class="sl-step-num">01</span>
                <h3>영상 올리기</h3>
                <p>동영상 갤러리에서 MP4 파일이나 영상 주소, HLS 주소나 묶음을 넣어요.</p>
            </li>
            <li style="--i:1">
                <span class="sl-step-num">02</span>
                <h3>광고와 플레이어 정하기</h3>
                <p>관리자 화면에서 광고 소재와 지면 편성, 플레이어 테마와 로고를 정해요.</p>
            </li>
            <li style="--i:2">
                <span class="sl-step-num">03</span>
                <h3>게시판에서 재생</h3>
                <p>게시판 보기 화면과 이 메인 페이지가 같은 플레이어로 영상과 광고를 재생해요.</p>
            </li>
        </ol>
    </div>
</section>

<section class="sl-cta" aria-labelledby="sl-cta-title">
    <div class="sl-wrap sl-cta-inner" data-reveal>
        <div>
            <span class="sl-eyebrow">광고요청 예제</span>
            <h2 id="sl-cta-title">이 사이트에 광고를 싣고 싶나요?</h2>
            <p>광고 요청 게시판을 예제로 꾸며 두었어요. 광고 소재와 원하는 기간을 남기면 관리자가 확인하고 편성하는 흐름을 그대로 따라가 볼 수 있어요.</p>
        </div>
        <div class="sl-cta-actions">
            <a class="sl-btn sl-btn--accent sl-btn--lg" href="<?php echo $sl_request_url; ?>">광고요청 예제 보기</a>
            <a class="sl-btn sl-btn--glass sl-btn--lg" href="<?php echo G5_BBS_URL; ?>/write.php?bo_table=<?php echo SOLAD_THEME_VIDEO_BOARD; ?>">영상 올리기</a>
        </div>
    </div>
</section>

<?php
include_once(G5_THEME_PATH.'/tail.php');
