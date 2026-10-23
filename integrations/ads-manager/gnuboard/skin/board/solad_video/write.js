// 솔애드 동영상 갤러리 글쓰기: 등록 형식 전환, 영상 미리보기, 재생 시간(wr_2), 썸네일 자동 만들기.
(function () {
  var script = document.currentScript;
  var maxBytes = Number(script.getAttribute('data-max-bytes')) || 0;
  var maxLabel = script.getAttribute('data-max-label') || '';
  var soladBase = (script.getAttribute('data-solad-base') || '').replace(/\/$/, '');
  var $ = function (id) {
    return document.getElementById(id);
  };
  var fileInput = $('bf_file_1');
  var urlInput = $('wr_1');
  var thumbInput = $('bf_file_2');
  var video = $('sv_preview');
  var previewBox = $('sv_preview_box');
  var info = $('sv_preview_info');
  var duration = $('wr_2');
  var capture = $('sv_capture');
  var thumbPreview = $('sv_thumb_preview');
  var initialMode = mode();
  var initialSrc = $('sv_initial_src').value;
  var savedDuration = duration.value;
  // 지금 보이는 미리보기: MP4·WebM은 <video>, HLS는 솔애드 플레이어의 <hlsjs-video>.
  var media = video;
  var hlsLoad = null;
  var objectUrl = '';
  var thumbUrl = '';
  // 사람이 고른 썸네일이나 이미 있는 썸네일은 자동으로 덮어쓰지 않는다.
  var thumbLocked = !!(thumbPreview && thumbPreview.querySelector('img'));
  var autoCapture = false;
  var canTransfer = typeof DataTransfer === 'function';
  var urlPattern = /^(https?:\/\/[^\s"'<>]+|\/[^\s"'<>]*)$/i;
  var accepts = { file: 'video/mp4,video/webm,.mp4,.m4v,.webm', hls_zip: '.zip,application/zip' };
  var placeholders = { hls_url: 'https://example.com/live/index.m3u8', url: 'https://example.com/video.mp4' };

  function mode() {
    var checked = document.querySelector('input[name="sv_source"]:checked');

    return checked ? checked.value : 'url';
  }

  function isHls(src) {
    try {
      return /\.m3u8$/i.test(new URL(src, location.href).pathname);
    } catch (error) {
      return false;
    }
  }

  function formatTime(seconds) {
    seconds = Math.round(seconds);
    var h = Math.floor(seconds / 3600);
    var m = Math.floor((seconds % 3600) / 60);
    var s = seconds % 60;
    var pad = function (n) {
      return (n < 10 ? '0' : '') + n;
    };

    return h ? h + ':' + pad(m) + ':' + pad(s) : m + ':' + pad(s);
  }

  function hlsElement() {
    if (!hlsLoad) {
      hlsLoad = import(soladBase + '/assets/videojs/media/hlsjs-video.js').then(function () {
        var element = document.createElement('hlsjs-video');

        element.setAttribute('controls', '');
        element.setAttribute('muted', '');
        element.setAttribute('playsinline', '');
        element.setAttribute('preload', 'metadata');
        element.hidden = true;
        listen(element);
        video.insertAdjacentElement('afterend', element);
        return element;
      });
    }

    return hlsLoad;
  }

  function stop(element) {
    if (!element || !element.getAttribute('src')) return;

    element.removeAttribute('src');

    if (typeof element.load === 'function') element.load();
  }

  function show(src) {
    var hls = isHls(src);

    if (capture) capture.hidden = true;

    stop(video);

    if (hlsLoad)
      hlsLoad.then(function (element) {
        if (!hls) {
          stop(element);
          element.hidden = true;
        }
      });

    if (!src) {
      previewBox.hidden = true;
      media = video;
      return;
    }

    previewBox.hidden = false;
    info.textContent = '영상을 읽는 중이에요…';

    if (!hls) {
      media = video;
      video.hidden = false;
      video.src = src;
      return;
    }

    video.hidden = true;
    hlsElement().then(
      function (element) {
        if (currentSource() !== src) return;

        media = element;
        element.hidden = false;
        element.setAttribute('src', src);
      },
      function () {
        info.textContent = 'HLS 미리보기를 불러오지 못했어요. 솔애드 주소 설정을 확인해 주세요. 저장은 할 수 있어요.';
      }
    );
  }

  function currentSource() {
    var current = mode();

    if (current === 'url' || current === 'hls_url') {
      return urlPattern.test(urlInput.value.trim()) ? urlInput.value.trim() : '';
    }

    if (current === 'hls_zip') {
      return initialMode === 'hls_zip' && !fileInput.files.length ? initialSrc : '';
    }

    if (objectUrl) return objectUrl;

    var del = $('bf_file_del0');

    return initialMode === 'file' && !(del && del.checked) ? initialSrc : '';
  }

  function refresh() {
    var src = currentSource();

    if (src !== shown) {
      shown = src;
      show(src);
    }

    if (!src) {
      var keep =
        mode() === initialMode && (mode() === 'hls_zip' ? !fileInput.files.length : mode() === 'file' && !objectUrl);

      duration.value = keep ? savedDuration : '';
    }
  }
  var shown = null;

  function setThumb(file, auto) {
    if (thumbUrl) URL.revokeObjectURL(thumbUrl);

    thumbUrl = URL.createObjectURL(file);
    thumbPreview.innerHTML = '';
    var img = document.createElement('img');

    img.src = thumbUrl;
    img.alt = auto ? '자동으로 만든 썸네일' : '고른 썸네일';
    thumbPreview.appendChild(img);
  }

  function captureFrame(auto) {
    var frame = media.target || media;

    if (!thumbInput || !canTransfer || !media.videoWidth) return;

    var scale = Math.min(1, 1280 / media.videoWidth);
    var canvas = document.createElement('canvas');

    canvas.width = Math.round(media.videoWidth * scale);
    canvas.height = Math.round(media.videoHeight * scale);

    try {
      canvas.getContext('2d').drawImage(frame, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        function (blob) {
          if (!blob) return;

          var file = new File([blob], 'thumbnail.jpg', { type: 'image/jpeg' });
          var transfer = new DataTransfer();

          transfer.items.add(file);
          thumbInput.files = transfer.files;
          setThumb(file, auto);
          info.textContent = auto ? '1초 지점 장면으로 썸네일을 만들었어요.' : '지금 장면으로 썸네일을 만들었어요.';
        },
        'image/jpeg',
        0.86
      );
    } catch (error) {
      // 다른 사이트 주소의 영상은 장면을 그림으로 읽을 수 없다.
      info.textContent = '이 주소의 영상은 장면을 썸네일로 만들 수 없어요. 이미지를 직접 골라 주세요.';

      if (capture) capture.hidden = true;
    }
  }

  function listen(element) {
    element.addEventListener('loadedmetadata', function () {
      if (element !== media) return;

      var known = isFinite(element.duration) && element.duration > 0;

      if (known) duration.value = String(Math.round(element.duration));

      info.textContent = [
        isHls(shown) ? 'HLS' : '',
        known ? '재생 시간 ' + formatTime(element.duration) : '',
        element.videoWidth ? element.videoWidth + '×' + element.videoHeight : '',
      ]
        .filter(Boolean)
        .join(' · ');

      if (capture) capture.hidden = !canTransfer || !element.videoWidth;

      if (autoCapture && !thumbLocked && known) {
        element.currentTime = Math.min(1, element.duration / 2);
      } else {
        autoCapture = false;
      }
    });

    element.addEventListener('seeked', function () {
      if (element !== media || !autoCapture) return;

      autoCapture = false;
      captureFrame(true);
    });

    element.addEventListener('error', function () {
      if (element !== media || !element.getAttribute('src')) return;

      info.textContent = isHls(shown)
        ? '재생 목록을 열지 못했어요. 주소와 그 서버의 CORS 허용을 확인해 주세요.'
        : '미리보기를 열지 못했어요. 주소나 파일을 확인해 주세요.';

      if (capture) capture.hidden = true;
    });
  }
  listen(video);

  document.querySelectorAll('input[name="sv_source"]').forEach(function (radio) {
    radio.addEventListener('change', function () {
      var current = mode();

      document.querySelectorAll('[data-sv-pane]').forEach(function (pane) {
        pane.hidden = pane.getAttribute('data-sv-pane').split(' ').indexOf(current) < 0;
      });
      document.querySelectorAll('[data-sv-for]').forEach(function (node) {
        node.hidden = node.getAttribute('data-sv-for') !== current;
      });

      if (fileInput && accepts[current] && fileInput.getAttribute('accept') !== accepts[current]) {
        // 형식이 바뀌면 고른 파일도 맞지 않으므로 비운다.
        fileInput.setAttribute('accept', accepts[current]);
        fileInput.value = '';

        if (objectUrl) URL.revokeObjectURL(objectUrl);

        objectUrl = '';
      }

      if (placeholders[current]) urlInput.setAttribute('placeholder', placeholders[current]);

      autoCapture = !thumbLocked;
      refresh();
    });
  });

  if (fileInput) {
    fileInput.addEventListener('change', function () {
      var file = fileInput.files[0];
      var zip = mode() === 'hls_zip';

      if (objectUrl) URL.revokeObjectURL(objectUrl);

      objectUrl = '';

      if (file && !(zip ? /\.zip$/i : /\.(mp4|m4v|webm)$/i).test(file.name)) {
        alert(zip ? 'HLS 묶음은 zip 파일로 올려 주세요.' : 'MP4·WebM 영상 파일만 올릴 수 있어요.');
        fileInput.value = '';
        file = null;
      }

      if (file && maxBytes && file.size > maxBytes) {
        alert((zip ? 'zip 파일은 ' : '영상 파일은 ') + maxLabel + ' 이하만 올릴 수 있어요.');
        fileInput.value = '';
        file = null;
      }

      if (file && !zip) {
        objectUrl = URL.createObjectURL(file);
        autoCapture = true;
      }

      refresh();

      if (file && zip) {
        previewBox.hidden = false;
        info.textContent =
          file.name + ' · ' + (file.size / 1048576).toFixed(1) + 'MB. 저장하면 서버에서 풀고 재생 시간을 계산해요.';
      }
    });
  }

  var del0 = $('bf_file_del0');

  if (del0) del0.addEventListener('change', refresh);

  urlInput.addEventListener('change', function () {
    autoCapture = !thumbLocked;
    refresh();
  });

  if (thumbInput) {
    thumbInput.addEventListener('change', function () {
      var file = thumbInput.files[0];

      thumbLocked = !!file;

      if (file) setThumb(file, false);
    });
  }

  if (capture) {
    capture.addEventListener('click', function () {
      thumbLocked = true;
      captureFrame(false);
    });
  }

  document.querySelectorAll('[data-sv-for]').forEach(function (node) {
    node.hidden = node.getAttribute('data-sv-for') !== initialMode;
  });
  refresh();

  // fwrite_submit에서 부른다. 고르지 않은 쪽 입력은 비워서 보낸다.
  window.sv_video_ready = function (form) {
    var current = mode();
    var notice = form.notice && form.notice.checked;
    var url = urlInput.value.trim();
    var has;

    if (current === 'url' || current === 'hls_url') {
      if (url && !urlPattern.test(url)) {
        alert('영상 주소는 http(s):// 주소나 /로 시작하는 경로로 넣어 주세요.');
        urlInput.focus();
        return false;
      }

      if (url && current === 'hls_url' && !isHls(url)) {
        alert('HLS 주소는 .m3u8 재생 목록 주소여야 해요.');
        urlInput.focus();
        return false;
      }

      if (url && current === 'url' && isHls(url)) {
        alert('.m3u8 주소는 등록 형식을 "HLS 주소"로 골라 주세요.');
        urlInput.focus();
        return false;
      }

      if (fileInput) fileInput.value = '';

      has = !!url;
    } else {
      urlInput.value = '';
      has = fileInput.files.length > 0 || !!currentSource();
    }

    if (!has && !notice) {
      alert(
        current === 'hls_zip'
          ? 'HLS 묶음(zip)을 골라 주세요.'
          : current === 'file'
            ? '영상 파일을 골라 주세요.'
            : '영상 주소를 넣어 주세요.'
      );
      (current === 'url' || current === 'hls_url' ? urlInput : fileInput).focus();
      return false;
    }

    return true;
  };
})();
