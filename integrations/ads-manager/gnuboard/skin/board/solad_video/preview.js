// 목록 카드와 보기 화면 "다음 영상"의 썸네일에 마우스를 올리면 data-preview 영상을 소리 없이 미리 재생한다.
// 터치 기기와 동작 줄이기 설정에서는 하지 않는다. 목록과 보기가 한 화면에 같이 나와도 썸네일마다 한 번만 건다.
(function () {
  if (
    !window.matchMedia ||
    !matchMedia('(hover: hover) and (pointer: fine)').matches ||
    matchMedia('(prefers-reduced-motion: reduce)').matches
  )
    return;

  document.querySelectorAll('#sv_list [data-preview], .sv-next [data-preview]').forEach(function (thumb) {
    if (thumb.hasAttribute('data-preview-bound')) return;

    thumb.setAttribute('data-preview-bound', '');
    // 다음 영상은 썸네일이 작아 줄 전체에 올렸을 때 재생한다.
    var host = thumb.closest('.sv-next-item') || thumb;
    var timer = 0;

    host.addEventListener('mouseenter', function () {
      timer = setTimeout(function () {
        var video = document.createElement('video');

        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        video.className = 'sv-thumb-preview-video';
        video.src = thumb.getAttribute('data-preview');
        video.addEventListener('playing', function () {
          thumb.classList.add('is-previewing');
        });
        thumb.appendChild(video);
        video.play().catch(function () {});
      }, 450);
    });
    host.addEventListener('mouseleave', function () {
      clearTimeout(timer);
      thumb.classList.remove('is-previewing');
      thumb.querySelectorAll('video').forEach(function (video) {
        video.removeAttribute('src');
        video.load();
        video.remove();
      });
    });
  });
})();
