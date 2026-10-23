// 메인 랜딩 페이지: 스크롤 등장, 소개 영상 쉬기, 히어로 시차, 카드 미리보기
(function () {
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canHover = window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches;

  // 화면에 들어온 구역에 .is-in을 붙인다. 기능 카드의 작은 화면도 이때 움직이기 시작한다.
  var revealed = document.querySelectorAll('[data-reveal]');

  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealed.forEach(function (node) {
      node.classList.add('is-in');
    });
  } else {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;

          entry.target.classList.add('is-in');
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.08 }
    );

    revealed.forEach(function (node) {
      observer.observe(node);
    });
  }

  var hero = document.querySelector('[data-sl-hero]');

  // 소개 영상은 히어로가 화면에서 벗어나면 쉬고, 돌아오면 이어서 재생한다. 사람이 멈춘 영상은 그대로 둔다.
  document.addEventListener('sl-hero-ready', function (event) {
    var media = event.detail && event.detail.media;
    if (!media || !('IntersectionObserver' in window)) return;

    var autoPaused = false;

    new IntersectionObserver(
      function (entries) {
        if (!entries[0].isIntersecting) {
          if (!media.paused) {
            autoPaused = true;
            media.pause();
          }
        } else if (autoPaused) {
          autoPaused = false;
          media.play().catch(function () {});
        }
      },
      { threshold: 0.2 }
    ).observe(event.target);
  });

  // 소개 영상은 음소거로 시작하고, 영상 모서리 버튼으로 소리를 켜고 끈다. 플레이어의 음소거 버튼이나 M 키로 바꿔도 따라간다.
  var sound = hero && hero.querySelector('[data-sl-hero-sound]');

  if (sound) {
    document.addEventListener('sl-hero-ready', function (event) {
      var media = event.detail && event.detail.media;
      if (!media) return;

      var sync = function () {
        sound.setAttribute('aria-pressed', String(!media.muted));
      };

      sound.addEventListener('click', function () {
        media.muted = !media.muted;

        if (!media.muted && !media.volume) media.volume = 1;
      });
      media.addEventListener('volumechange', sync);
      sync();
      sound.hidden = false;
    });
  }

  // 스크롤하면 히어로 뒤의 번진 빛이 천천히 따라 내려간다.
  var ambient = hero && hero.querySelector('[data-sl-ambient]');

  if (ambient && !reduceMotion) {
    var ticking = false;

    window.addEventListener(
      'scroll',
      function () {
        if (ticking) return;

        ticking = true;
        requestAnimationFrame(function () {
          ticking = false;
          var y = Math.min(window.scrollY, hero.offsetHeight);

          ambient.style.setProperty('--sl-parallax', (y * 0.3).toFixed(1) + 'px');
        });
      },
      { passive: true }
    );
  }

  // 마우스를 올리면 MP4 영상을 소리 없이 미리 재생한다. 게시판 목록 스킨과 같은 방식.
  if (canHover && !reduceMotion) {
    document.querySelectorAll('.sl-cards [data-preview]').forEach(function (thumb) {
      var link = thumb.closest('a');
      var timer = 0;

      link.addEventListener('mouseenter', function () {
        timer = setTimeout(function () {
          var preview = document.createElement('video');

          preview.muted = true;
          preview.loop = true;
          preview.playsInline = true;
          preview.src = thumb.getAttribute('data-preview');
          preview.addEventListener('playing', function () {
            thumb.classList.add('is-previewing');
          });
          thumb.appendChild(preview);
          preview.play().catch(function () {});
        }, 400);
      });
      link.addEventListener('mouseleave', function () {
        clearTimeout(timer);
        thumb.classList.remove('is-previewing');
        thumb.querySelectorAll('video').forEach(function (preview) {
          preview.removeAttribute('src');
          preview.load();
          preview.remove();
        });
      });
    });
  }
})();
