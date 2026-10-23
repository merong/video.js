// 솔애드 광고 요청 목록·보기: 솔애드 관리자 창 열기, 처리 버튼으로 처리 기록 칸 채우기, 소재 영상 정보.
(function () {
  var templates = {
    검토: '요청을 확인했어요. 소재와 기간을 검토할게요.',
    '보완 요청': '아래 내용을 보완해 주세요.\n- ',
    '집행 예정': '승인했어요. 희망 기간에 맞춰 집행할게요.',
    집행: '광고 집행을 시작했어요.',
    종료: '집행을 마쳤어요. 함께해 주셔서 고마워요.',
    반려: '아래 이유로 이번 요청은 반려했어요.\n- ',
  };

  function openAdmin(event) {
    var popup = window.open(this.href, 'solad_admin', 'width=1320,height=880');
    if (!popup) return;

    event.preventDefault();
    popup.focus();
  }

  // 처리 버튼은 고르기만 한다. 실제로 상태를 바꾸는 것은 처리 기록 칸의 "처리하기"다.
  function fillStage() {
    var stage = this.getAttribute('data-sr-stage');
    var form = document.getElementById('fviewcomment');
    var select = document.getElementById('sr_stage');
    var content = document.getElementById('wr_content');
    if (!form || !content) return;

    var work = document.getElementById('w');

    if (typeof window.comment_box === 'function' && work && work.value !== 'c') {
      window.comment_box('', 'c');
    }

    if (select) select.value = stage;

    if (stage && templates[stage] && (!content.value.trim() || isTemplate(content.value))) {
      content.value = templates[stage];
    }

    content.placeholder = stage
      ? stage + '(으)로 바꾸면서 회원에게 남길 내용을 적어 주세요.'
      : '회원에게 남길 답변을 적어 주세요.';

    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    content.focus();
    content.setSelectionRange(content.value.length, content.value.length);
  }

  function isTemplate(value) {
    for (var key in templates) {
      if (templates[key] === value) return true;
    }

    return false;
  }

  function describeMedia(video) {
    var info = video.closest('dd') && video.closest('dd').querySelector('[data-sr-media-info]');
    if (!info) return;

    var show = function () {
      var seconds = Math.round(video.duration);
      if (!isFinite(seconds)) return;

      info.textContent =
        '· ' +
        Math.floor(seconds / 60) +
        ':' +
        (seconds % 60 < 10 ? '0' : '') +
        (seconds % 60) +
        ' · ' +
        video.videoWidth +
        '×' +
        video.videoHeight;
    };

    if (video.readyState >= 1) show();
    else video.addEventListener('loadedmetadata', show);
  }

  var i;
  var links = document.querySelectorAll('[data-sr-admin]');

  for (i = 0; i < links.length; i++) links[i].addEventListener('click', openAdmin);

  var buttons = document.querySelectorAll('button[data-sr-stage]');

  for (i = 0; i < buttons.length; i++) buttons[i].addEventListener('click', fillStage);

  var videos = document.querySelectorAll('video[data-sr-media]');

  for (i = 0; i < videos.length; i++) describeMedia(videos[i]);
})();
