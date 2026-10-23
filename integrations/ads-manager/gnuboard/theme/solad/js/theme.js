// 솔애드 테마 공통: 모바일 메뉴, 스크롤 머리글, 맨 위로 버튼
(function () {
  var header = document.querySelector('[data-sl-header]');
  var menuButton = document.querySelector('[data-sl-menu]');
  var drawer = document.getElementById('sl-drawer');
  var topButton = document.querySelector('[data-sl-top]');
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function setMenu(open) {
    if (!menuButton || !drawer) return;

    menuButton.setAttribute('aria-expanded', open ? 'true' : 'false');
    menuButton.querySelector('.sound_only').textContent = open ? '메뉴 닫기' : '메뉴 열기';
    drawer.hidden = !open;

    if (header) header.classList.toggle('is-open', open);
  }

  if (menuButton && drawer) {
    menuButton.addEventListener('click', function () {
      setMenu(menuButton.getAttribute('aria-expanded') !== 'true');
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !drawer.hidden) {
        setMenu(false);
        menuButton.focus();
      }
    });
    document.addEventListener('click', function (event) {
      if (!drawer.hidden && header && !header.contains(event.target)) setMenu(false);
    });
  }

  // 메인 화면의 투명 머리글은 영상 위를 지나면 배경을 깐다.
  if (header && header.classList.contains('sl-hd--overlay')) {
    var update = function () {
      header.classList.toggle('is-solid', window.scrollY > 24);
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
  }

  // 메인 "솔애드 관리자"는 그누보드 관리자 메뉴와 같은 이름의 새 창으로 연다. 창이 막히면 지금 창에서 연다.
  document.addEventListener('click', function (event) {
    var link = event.target.closest && event.target.closest('[data-sl-admin-popup]');

    if (
      !link ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;

    event.preventDefault();
    var popup = window.open(link.href, 'solad_admin', 'width=1320,height=880,scrollbars=yes,resizable=yes');

    if (popup) popup.focus();
    else location.href = link.href;
  });

  if (topButton) {
    topButton.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
      var main = document.getElementById('sl-main');

      if (main) main.focus({ preventScroll: true });
    });
  }
})();
