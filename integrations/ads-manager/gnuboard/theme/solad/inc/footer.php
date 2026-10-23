<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가

// 테마 바닥글. tail.php와 로그인 계열 회원 화면(tail.sub.php)이 같이 쓴다.
?>
<footer class="sl-ft">
    <div class="sl-ft-inner">
        <div class="sl-ft-about">
            <a class="sl-brand sl-brand--footer" href="<?php echo G5_URL; ?>/">
                <span class="sl-brand-mark" aria-hidden="true">
                    <svg viewBox="0 0 32 32" width="28" height="28"><rect width="32" height="32" rx="9" fill="currentColor"/><path d="M12.5 10.2v11.6c0 .8.9 1.3 1.6.9l9.3-5.8c.6-.4.6-1.3 0-1.7l-9.3-5.8c-.7-.4-1.6.1-1.6.8Z" fill="#0e0e10"/></svg>
                </span>
                <span class="sl-brand-name"><?php echo SOLAD_THEME_BRAND; ?></span>
            </a>
            <p>광고를 붙일 수 있는 솔애드 플레이어와 그누보드5로 꾸린 동영상 예제 사이트예요. 영상과 광고는 모두 관리자 화면에서 바꿀 수 있어요.</p>
        </div>
        <nav class="sl-ft-links" aria-label="바닥글 메뉴">
            <div>
                <h2>둘러보기</h2>
                <a href="<?php echo get_pretty_url(SOLAD_THEME_VIDEO_BOARD); ?>">동영상 갤러리</a>
                <a href="<?php echo get_pretty_url(SOLAD_THEME_REQUEST_BOARD); ?>">광고요청 예제</a>
                <a href="<?php echo G5_BBS_URL; ?>/new.php">새 글</a>
            </div>
            <div>
                <h2>안내</h2>
                <a href="<?php echo get_pretty_url('content', 'company'); ?>">회사소개</a>
                <a href="<?php echo get_pretty_url('content', 'privacy'); ?>">개인정보처리방침</a>
                <a href="<?php echo get_pretty_url('content', 'provision'); ?>">서비스이용약관</a>
            </div>
        </nav>
    </div>
    <div class="sl-ft-copy">
        <span>&copy; <?php echo date('Y'); ?> <?php echo SOLAD_THEME_BRAND; ?>. 예제 사이트의 영상은 각 원작자의 라이선스를 따릅니다.</span>
        <button type="button" class="sl-top" data-sl-top>
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            맨 위로
        </button>
    </div>
</footer>
