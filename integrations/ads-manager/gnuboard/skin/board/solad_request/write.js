// 솔애드 광고 요청 글쓰기: 소재 파일·주소 전환과 미리보기, 희망 기간 맞추기, 보내기 전 검사.
(function () {
  var script = document.currentScript;
  var maxBytes = Number(script.getAttribute('data-max-bytes')) || 0;
  var maxLabel = script.getAttribute('data-max-label') || '';
  var $ = function (id) {
    return document.getElementById(id);
  };
  var fileInput = $('bf_file_1');
  var urlInput = $('wr_7');
  var fileDelete = $('bf_file_del0');
  var preview = $('sr_preview');
  var info = $('sr_preview_info');
  var start = $('wr_2');
  var end = $('wr_3');
  var periodInfo = $('sr_period_info');
  var impressions = $('wr_5');
  var existingUrl = preview.getAttribute('data-existing') || '';
  var existingKind = preview.getAttribute('data-existing-kind') || '';
  var urlPattern = /^(https?:\/\/[^\s"'<>]+|\/[^\s"'<>]*)$/i;
  var httpPattern = /^https?:\/\/[^\s"'<>]+$/i;
  var datePattern = /^\d{4}-\d{2}-\d{2}$/;
  var mediaPattern = /\.(mp4|m4v|webm|jpe?g|png|gif|webp)$/i;
  var objectUrl = '';

  function mode() {
    var checked = document.querySelector('input[name="sr_mode"]:checked');

    return checked ? checked.value : 'url';
  }

  function kindOf(name, type) {
    if (/^video\//.test(type || '')) return 'video';

    if (/^image\//.test(type || '')) return 'image';

    var path = String(name || '');

    try {
      path = new URL(path, location.href).pathname;
    } catch (error) {}

    if (/\.(mp4|m4v|webm)$/i.test(path)) return 'video';

    if (/\.(jpe?g|png|gif|webp)$/i.test(path)) return 'image';

    return '';
  }

  function formatBytes(bytes) {
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + 'MB';

    return Math.max(1, Math.round(bytes / 1024)) + 'KB';
  }

  function formatTime(seconds) {
    seconds = Math.round(seconds);
    var m = Math.floor(seconds / 60);
    var s = seconds % 60;

    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function clearPreview() {
    if (objectUrl) URL.revokeObjectURL(objectUrl);

    objectUrl = '';
    preview.innerHTML = '';
    preview.hidden = true;
    info.textContent = '';
  }

  function showPreview(src, kind, size) {
    clearPreview();

    if (!src) return;

    if (!kind) {
      info.textContent =
        '영상(MP4·WebM)이나 이미지(JPG·PNG·GIF·WebP) 주소인지 확인해 주세요. 미리보기를 보여 줄 수 없어요.';
      return;
    }

    var element = document.createElement(kind === 'video' ? 'video' : 'img');
    var sizeText = size ? ' · ' + formatBytes(size) : '';

    if (kind === 'video') {
      element.controls = true;
      element.muted = true;
      element.playsInline = true;
      element.preload = 'metadata';
      element.addEventListener('loadedmetadata', function () {
        info.textContent =
          '영상 ' + formatTime(element.duration) + ' · ' + element.videoWidth + '×' + element.videoHeight + sizeText;
      });
    } else {
      element.alt = '소재 미리보기';
      element.addEventListener('load', function () {
        info.textContent = '이미지 ' + element.naturalWidth + '×' + element.naturalHeight + sizeText;
      });
    }

    element.addEventListener('error', function () {
      info.textContent = '소재를 불러오지 못했어요. 주소나 파일을 확인해 주세요.';
    });
    element.src = src;
    preview.appendChild(element);
    preview.hidden = false;
  }

  function refresh() {
    var current = mode();
    var panes = document.querySelectorAll('[data-sr-pane]');

    for (var i = 0; i < panes.length; i++) {
      panes[i].hidden = panes[i].getAttribute('data-sr-pane') !== current;
    }

    if (current === 'url') {
      var value = urlInput.value.trim();

      showPreview(urlPattern.test(value) ? value : '', kindOf(value));
      return;
    }

    var file = fileInput && fileInput.files && fileInput.files[0];

    if (file) {
      if (maxBytes && file.size > maxBytes) {
        alert('소재 파일은 ' + maxLabel + ' 이하만 올릴 수 있어요.');
        fileInput.value = '';
        refresh();
        return;
      }

      var blobUrl = URL.createObjectURL(file);

      showPreview(blobUrl, kindOf(file.name, file.type), file.size);
      objectUrl = blobUrl;
      return;
    }

    showPreview(existingUrl && !(fileDelete && fileDelete.checked) ? existingUrl : '', existingKind);
  }

  function days() {
    if (!datePattern.test(start.value) || !datePattern.test(end.value)) return 0;

    return Math.round((Date.parse(end.value) - Date.parse(start.value)) / 86400000) + 1;
  }

  function syncPeriod() {
    end.min = start.value || '';

    if (start.value && end.value && end.value < start.value) end.value = start.value;

    var count = days();

    periodInfo.textContent = count > 0 ? count + '일 동안' : '';
  }

  function fail(element, message) {
    alert(message);

    if (element && element.focus) element.focus();

    return false;
  }

  // fwrite_submit()이 부른다. 서버(write_update.head.skin.php)도 같은 규칙으로 다시 검사한다.
  window.sr_request_ready = function (f) {
    if (f.notice && f.notice.checked) return true;

    var value = function (name) {
      return f[name] ? String(f[name].value).trim() : '';
    };
    var count = value('wr_5').replace(/,/g, '');

    if (!value('wr_1')) return fail(f.wr_1, '광고주(업체명)를 적어 주세요.');

    if (value('wr_6') && !httpPattern.test(value('wr_6')))
      return fail(f.wr_6, '클릭 URL은 http:// 나 https:// 로 시작하는 주소로 넣어 주세요.');

    if (mode() === 'url') {
      if (!urlPattern.test(urlInput.value.trim()))
        return fail(urlInput, '소재 주소를 http(s):// 주소나 /로 시작하는 경로로 넣어 주세요.');

      if (fileInput) fileInput.value = '';
    } else {
      var file = fileInput.files && fileInput.files[0];

      if (file && !mediaPattern.test(file.name))
        return fail(fileInput, '소재 칸에는 MP4·WebM 영상이나 JPG·PNG·GIF·WebP 이미지만 올릴 수 있어요.');

      if (!file && !(existingUrl && !(fileDelete && fileDelete.checked)))
        return fail(fileInput, '광고 소재 파일을 올려 주세요.');

      urlInput.value = '';
    }

    if (!datePattern.test(start.value) || !datePattern.test(end.value))
      return fail(start, '희망 시작일과 종료일을 골라 주세요.');

    if (end.value < start.value) return fail(end, '희망 종료일은 시작일과 같거나 뒤여야 해요.');

    if (!f.querySelector('input[name="wr_4"]:checked')) return fail(null, '희망 위치를 골라 주세요.');

    if (!/^[1-9][0-9]{0,9}$/.test(count)) return fail(impressions, '희망 노출 수를 숫자로 적어 주세요.');

    if (!value('wr_8')) return fail(f.wr_8, '연락받을 전화번호나 이메일을 적어 주세요.');

    impressions.value = count;
    return true;
  };

  var radios = document.querySelectorAll('input[name="sr_mode"]');

  for (var i = 0; i < radios.length; i++) radios[i].addEventListener('change', refresh);

  if (fileInput) fileInput.addEventListener('change', refresh);

  if (fileDelete) fileDelete.addEventListener('change', refresh);

  urlInput.addEventListener('change', refresh);
  start.addEventListener('change', syncPeriod);
  end.addEventListener('change', syncPeriod);
  impressions.addEventListener('blur', function () {
    var digits = impressions.value.replace(/[^0-9]/g, '');

    impressions.value = digits ? Number(digits).toLocaleString('en-US') : '';
  });

  syncPeriod();
  refresh();
})();
