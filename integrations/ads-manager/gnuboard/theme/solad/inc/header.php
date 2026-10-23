<?php
if (!defined('_GNUBOARD_')) exit; // 개별 페이지 접근 불가

// 테마 머리글. head.php와 로그인 계열 회원 화면(head.sub.php)이 같이 쓴다.
$sl_is_index = defined('_INDEX_');
$sl_here = isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '';
$sl_login_url = G5_BBS_URL.'/login.php?url='.urlencode($sl_is_index ? G5_URL : G5_URL.$sl_here);
$sl_menus = get_menu_db(0, true);
$sl_board = isset($bo_table) ? $bo_table : '';
$sl_content = (isset($co_id) && basename($_SERVER['SCRIPT_NAME']) === 'content.php') ? (string) $co_id : '';
// 로그인 화면에서는 로그인 버튼과, 로그인 화면으로 가는 "관리자" 버튼을 내지 않는다.
$sl_on_login = basename(dirname($_SERVER['SCRIPT_NAME'])) === G5_BBS_DIR && basename($_SERVER['SCRIPT_NAME']) === 'login.php';
$sl_admin_url = $sl_on_login ? '' : solad_theme_admin_entry();
?>
<header class="sl-hd<?php echo $sl_is_index ? ' sl-hd--overlay' : ''; ?>" id="sl-hd" data-sl-header>
    <div class="sl-hd-inner">
        <a class="sl-brand" href="<?php echo G5_URL; ?>/" aria-label="<?php echo SOLAD_THEME_BRAND; ?> 홈">
            <span class="sl-brand-mark" aria-hidden="true">
                <svg viewBox="0 0 32 32" width="32" height="32"><rect width="32" height="32" rx="9" fill="currentColor"/><path d="M12.5 10.2v11.6c0 .8.9 1.3 1.6.9l9.3-5.8c.6-.4.6-1.3 0-1.7l-9.3-5.8c-.7-.4-1.6.1-1.6.8Z" fill="#0e0e10"/></svg>
            </span>
            <span class="sl-brand-name"><?php echo SOLAD_THEME_BRAND; ?></span>
        </a>

        <nav class="sl-nav" aria-label="주 메뉴">
            <ul class="sl-nav-list">
                <li><a href="<?php echo G5_URL; ?>/"<?php echo $sl_is_index ? ' aria-current="page"' : ''; ?>>홈</a></li>
                <?php foreach ($sl_menus as $sl_menu) { ?>
                <li><a href="<?php echo $sl_menu['me_link']; ?>" target="_<?php echo $sl_menu['me_target']; ?>"<?php echo solad_theme_menu_current($sl_menu['me_link'], $sl_board, $sl_content) ? ' aria-current="page"' : ''; ?>><?php echo $sl_menu['me_name']; ?></a></li>
                <?php } ?>
            </ul>
        </nav>

        <form class="sl-search" name="fsearchbox" method="get" action="<?php echo G5_BBS_URL; ?>/search.php" role="search">
            <input type="hidden" name="sfl" value="wr_subject||wr_content">
            <input type="hidden" name="sop" value="and">
            <label for="sl-search-input" class="sound_only">사이트 검색</label>
            <input type="search" name="stx" id="sl-search-input" maxlength="20" minlength="2" required placeholder="영상 검색">
            <button type="submit" aria-label="검색"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="m20 20-4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
        </form>

        <div class="sl-account">
            <?php if ($is_member) { ?>
            <a class="sl-btn sl-btn--ghost sl-hd-upload" href="<?php echo G5_BBS_URL; ?>/write.php?bo_table=<?php echo SOLAD_THEME_VIDEO_BOARD; ?>">영상 올리기</a>
            <?php if ($is_admin) { ?><a class="sl-account-link" href="<?php echo correct_goto_url(G5_ADMIN_URL); ?>">사이트 관리</a><?php } ?>
            <?php if ($sl_admin_url) { ?><a class="sl-account-link" href="<?php echo $sl_admin_url; ?>">관리자</a><?php } ?>
            <a class="sl-account-link" href="<?php echo G5_BBS_URL; ?>/member_confirm.php?url=<?php echo G5_BBS_URL; ?>/register_form.php">정보수정</a>
            <a class="sl-account-link" href="<?php echo G5_BBS_URL; ?>/logout.php">로그아웃</a>
            <?php } else { ?>
            <a class="sl-account-link" href="<?php echo G5_BBS_URL; ?>/register.php">회원가입</a>
            <?php if ($sl_admin_url) { ?><a class="sl-account-link" href="<?php echo $sl_admin_url; ?>">관리자</a><?php } ?>
            <?php if (!$sl_on_login) { ?><a class="sl-btn sl-btn--light" href="<?php echo $sl_login_url; ?>">로그인</a><?php } ?>
            <?php } ?>
        </div>

        <button type="button" class="sl-menu-btn" aria-expanded="false" aria-controls="sl-drawer" data-sl-menu>
            <span class="sound_only">메뉴 열기</span>
            <span class="sl-menu-icon" aria-hidden="true"><span></span><span></span><span></span></span>
        </button>
    </div>

    <div class="sl-drawer" id="sl-drawer" hidden>
        <form class="sl-drawer-search" method="get" action="<?php echo G5_BBS_URL; ?>/search.php" role="search">
            <input type="hidden" name="sfl" value="wr_subject||wr_content">
            <input type="hidden" name="sop" value="and">
            <label for="sl-drawer-search" class="sound_only">사이트 검색</label>
            <input type="search" name="stx" id="sl-drawer-search" maxlength="20" minlength="2" required placeholder="영상 검색">
            <button type="submit">검색</button>
        </form>
        <ul class="sl-drawer-list">
            <li><a href="<?php echo G5_URL; ?>/">홈</a></li>
            <?php foreach ($sl_menus as $sl_menu) { ?>
            <li><a href="<?php echo $sl_menu['me_link']; ?>" target="_<?php echo $sl_menu['me_target']; ?>"><?php echo $sl_menu['me_name']; ?></a></li>
            <?php } ?>
        </ul>
        <div class="sl-drawer-account">
            <?php if ($is_member) { ?>
            <a href="<?php echo G5_BBS_URL; ?>/write.php?bo_table=<?php echo SOLAD_THEME_VIDEO_BOARD; ?>">영상 올리기</a>
            <?php if ($is_admin) { ?><a href="<?php echo correct_goto_url(G5_ADMIN_URL); ?>">사이트 관리</a><?php } ?>
            <?php if ($sl_admin_url) { ?><a href="<?php echo $sl_admin_url; ?>">관리자</a><?php } ?>
            <a href="<?php echo G5_BBS_URL; ?>/member_confirm.php?url=<?php echo G5_BBS_URL; ?>/register_form.php">정보수정</a>
            <a href="<?php echo G5_BBS_URL; ?>/logout.php">로그아웃</a>
            <?php } else { ?>
            <?php if (!$sl_on_login) { ?><a href="<?php echo $sl_login_url; ?>">로그인</a><?php } ?>
            <a href="<?php echo G5_BBS_URL; ?>/register.php">회원가입</a>
            <?php if ($sl_admin_url) { ?><a href="<?php echo $sl_admin_url; ?>">관리자</a><?php } ?>
            <?php } ?>
        </div>
    </div>
</header>
