<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가

// 솔애드 테마 로그인 화면. bbs/login.php가 부르고, 경로는 lib/theme.lib.php의 solad_theme_login_skin()이 바꾼다.
// 쓰는 변수: $login_url(urlencode된 돌아갈 주소), $login_action_url, $url(돌아갈 주소)
// 데모가 켜져 있으면(data/solad-demo.php) 왼쪽에 원클릭 데모 관리자 로그인을 둔다. 데모 계정은 비밀번호가 없어 아이디 로그인으로는 들어갈 수 없다.
// 이 사이트는 쇼핑몰을 쓰지 않으므로 기본 스킨의 비회원 구매·주문조회는 두지 않는다.
add_stylesheet('<link rel="stylesheet" href="'.solad_theme_asset('skin/member/basic/style.css').'">', 22);

$sl_demo = solad_theme_demo_config();
if ($sl_demo) {
    $sl_demo_back = solad_theme_demo_return_url($url);
    $sl_demo_action = solad_theme_local_url(G5_BBS_URL.'/login.php');
}
?>

<div class="sl-auth<?php echo $sl_demo ? ' sl-auth--demo' : ''; ?>">
    <?php if ($sl_demo) { ?>
    <aside class="sl-auth-demo" id="sl-auth-demo" aria-labelledby="sl-auth-demo-title">
        <p class="sl-auth-kicker">데모 · 가입 없이</p>
        <h2 class="sl-auth-demo-title" id="sl-auth-demo-title">가입 없이<br><em>솔애드 관리자</em> 둘러보기</h2>
        <p class="sl-auth-demo-desc">광고가 붙는 동영상 게시판을 어떻게 관리하는지 클릭 한 번으로 확인해 보세요.</p>

        <form class="sl-auth-demo-form" method="post" action="<?php echo $sl_demo_action; ?>">
            <input type="hidden" name="solad_demo_login" value="1">
            <input type="hidden" name="solad_demo_token" value="<?php echo solad_theme_demo_token(); ?>">
            <input type="hidden" name="url" value="<?php echo htmlspecialchars($sl_demo_back, ENT_QUOTES); ?>">
            <button type="submit" class="sl-demo-card">
                <span class="sl-demo-card-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="22" height="22"><path d="M12 3 4.5 6v5.6c0 4.4 3.1 8.2 7.5 9.4 4.4-1.2 7.5-5 7.5-9.4V6L12 3Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="11.5" r="2.2" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>
                </span>
                <span class="sl-demo-card-body">
                    <span class="sl-demo-card-role">데모 관리자<span class="sl-demo-card-tag">읽기 전용</span></span>
                    <span class="sl-demo-card-id"><?php echo get_text($sl_demo['admin_id']); ?></span>
                    <span class="sl-demo-card-desc">광고 소재 · 지면 편성 · 플레이어 설정 · 통계</span>
                </span>
                <span class="sl-demo-card-go">관리 화면<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
            </button>
        </form>

        <p class="sl-auth-demo-note">
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 11v5m0-8.5v.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            데모 관리자는 읽기 전용이라 저장·삭제는 실행되지 않아요.
        </p>
    </aside>
    <?php } ?>

    <section class="sl-auth-main" aria-labelledby="sl-auth-title">
        <?php if ($sl_demo) { ?>
        <a class="sl-auth-jump" href="#sl-auth-demo">가입 없이 보려면 <b>데모 관리자 로그인</b><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 5v14m-6-6 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></a>
        <?php } ?>

        <h1 class="sl-auth-title" id="sl-auth-title"><?php echo $g5['title']; ?></h1>
        <p class="sl-auth-sub"><?php echo SOLAD_THEME_BRAND; ?> 계정으로 로그인하세요.</p>

        <form class="sl-auth-form" name="flogin" action="<?php echo $login_action_url; ?>" onsubmit="return flogin_submit(this);" method="post">
            <input type="hidden" name="url" value="<?php echo $login_url; ?>">
            <fieldset>
                <legend class="sound_only">회원로그인</legend>
                <label class="sl-auth-label" for="login_id">아이디<strong class="sound_only"> 필수</strong></label>
                <input class="sl-auth-input required" type="text" name="mb_id" id="login_id" required maxlength="20" autocomplete="username" placeholder="아이디">
                <label class="sl-auth-label" for="login_pw">비밀번호<strong class="sound_only"> 필수</strong></label>
                <input class="sl-auth-input required" type="password" name="mb_password" id="login_pw" required maxlength="20" autocomplete="current-password" placeholder="비밀번호">

                <div class="sl-auth-opts">
                    <label class="sl-auth-check" for="login_auto_login"><input type="checkbox" name="auto_login" id="login_auto_login">자동로그인</label>
                    <a href="<?php echo G5_BBS_URL; ?>/password_lost.php">아이디/비밀번호 찾기</a>
                </div>
                <button type="submit" class="sl-btn sl-btn--accent sl-btn--lg sl-auth-submit">로그인</button>
            </fieldset>
        </form>

        <?php @include_once(get_social_skin_path().'/social_login.skin.php'); // 소셜로그인 사용시 소셜로그인 버튼 ?>

        <p class="sl-auth-alt">아직 회원이 아니신가요?<a href="<?php echo G5_BBS_URL; ?>/register.php">회원가입</a></p>
    </section>
</div>

<script>
jQuery(function($){
    $("#login_auto_login").click(function(){
        if (this.checked) {
            this.checked = confirm("자동로그인을 사용하시면 다음부터 회원아이디와 비밀번호를 입력하실 필요가 없습니다.\n\n공공장소에서는 개인정보가 유출될 수 있으니 사용을 자제하여 주십시오.\n\n자동로그인을 사용하시겠습니까?");
        }
    });
});

function flogin_submit(f)
{
    if( $( document.body ).triggerHandler( 'login_sumit', [f, 'flogin'] ) !== false ){
        return true;
    }
    return false;
}
</script>
