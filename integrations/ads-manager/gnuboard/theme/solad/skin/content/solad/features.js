// 특징 페이지 부가 기능의 정지 그림(img.sl-feat-motion) 위에 같은 이름의 mp4 모션을 겹쳐 재생한다.
// 동작 줄이기 설정, IntersectionObserver가 없는 브라우저, 영상을 못 불러온 경우에는 정지 그림을 그대로 둔다.
// 화면 밖에서는 멈추고, 5초 넘게 반복하는 모션이라 일시정지 버튼을 둔다.
(function () {
  var reduce = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  if (!('IntersectionObserver' in window) || (reduce && reduce.matches)) return;

  var icons = {
    pause:
      '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor"/></svg>',
    play: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>',
  };
  var motions = [];

  document.querySelectorAll('img.sl-feat-motion').forEach(function (img) {
    var box = img.parentElement;
    var heading = box.closest('.sl-feat-card') && box.closest('.sl-feat-card').querySelector('h3');
    var name = heading ? heading.textContent.trim() + ' ' : '';
    var video = document.createElement('video');
    var button = document.createElement('button');
    var motion = { video: video, paused: false, visible: false, loaded: false };

    // 그림은 그대로 두고(대체 글은 그림의 alt) 영상은 화면 읽기에서 뺀다.
    video.className = 'sl-feat-motion-video';
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = 'none';
    video.poster = img.currentSrc || img.src;
    video.setAttribute('aria-hidden', 'true');
    video.setAttribute('tabindex', '-1');

    button.type = 'button';
    button.className = 'sl-feat-motion-toggle';
    button.hidden = true;

    motion.sync = function () {
      button.innerHTML = motion.paused ? icons.play : icons.pause;
      button.setAttribute('aria-label', name + (motion.paused ? '모션 재생' : '모션 일시정지'));
      button.title = motion.paused ? '모션 재생' : '모션 일시정지';

      if (motion.visible && !motion.paused) {
        video.play().catch(function () {});
      } else {
        video.pause();
      }
    };

    video.addEventListener('playing', function () {
      box.classList.add('is-playing');
      button.hidden = false;
    });
    video.addEventListener('error', function () {
      box.classList.remove('is-playing');
      video.remove();
      button.remove();
      motion.dead = true;
    });
    button.addEventListener('click', function () {
      motion.paused = !motion.paused;
      motion.sync();
    });

    box.classList.add('has-motion');
    box.appendChild(video);
    box.appendChild(button);
    motion.box = box;
    motion.src = img.getAttribute('src').replace(/\.jpg(\?.*)?$/i, '.mp4$1');
    motions.push(motion);
  });

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        var motion = motions.filter(function (item) {
          return item.box === entry.target;
        })[0];
        if (!motion || motion.dead) return;

        motion.visible = entry.isIntersecting;

        if (motion.visible && !motion.loaded) {
          motion.loaded = true;
          motion.video.src = motion.src;
        }

        motion.sync();
      });
    },
    { threshold: 0.25 }
  );

  motions.forEach(function (motion) {
    observer.observe(motion.box);
  });

  // 보는 도중 동작 줄이기를 켜면 모두 멈춘다.
  if (reduce && reduce.addEventListener) {
    reduce.addEventListener('change', function (event) {
      if (!event.matches) return;

      motions.forEach(function (motion) {
        motion.paused = true;
        motion.sync();
      });
    });
  }
})();
