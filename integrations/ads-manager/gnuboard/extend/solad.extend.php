<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가

// 솔애드 광고 관리: 관리자 > 게시판관리에 관리 창을 여는 링크 하나만 더한다. 코어 파일은 고치지 않는다.
// 메뉴 코드는 솔애드 설정의 gnuboardMenu와 같아야 관리권한설정에서 권한을 줄 수 있다.
if (!defined('SOLAD_ADMIN_MENU')) {
    define('SOLAD_ADMIN_MENU', '300950');
}
if (!defined('SOLAD_URL')) {
    define('SOLAD_URL', G5_URL.'/ads');
}

add_replace('admin_menu', function ($menu) {
    if (isset($menu['menu300']) && is_array($menu['menu300'])) {
        $menu['menu300'][] = array(SOLAD_ADMIN_MENU, '솔애드 광고 관리', SOLAD_URL.'/', 'solad');
    }
    return $menu;
}, G5_HOOK_DEFAULT_PRIORITY, 1);

// 관리 화면은 그누보드 관리자 레이아웃 밖의 별도 창에서 연다.
add_event('tail_sub', function () {
    if (!defined('G5_IS_ADMIN')) {
        return;
    }
    $menu = json_encode(SOLAD_ADMIN_MENU);
    echo <<<HTML
<script>
document.addEventListener("click", function (event) {
    var link = event.target.closest && event.target.closest('[data-menu="' + {$menu} + '"] a');
    if (!link) return;
    event.preventDefault();
    var popup = window.open(link.href, "solad_admin", "width=1320,height=880,scrollbars=yes,resizable=yes");
    if (popup) popup.focus(); else location.href = link.href;
});
</script>
HTML;
});
