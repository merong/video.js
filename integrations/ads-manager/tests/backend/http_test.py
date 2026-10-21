"""Real ephemeral PHP/SQLite HTTP tests; never uses the coordinator's ports or DB."""

import base64
import hashlib
import hmac
import http.client
import http.cookiejar
import json
import os
import re
from pathlib import Path
import shutil
import socket
import sqlite3
import subprocess
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid


MANAGER = Path(__file__).resolve().parents[2]
# A1 additions are counted separately so the v1 baseline stays comparable.
checks = {"v1": 0, "a1": 0, "presets": 0, "session": 0, "videoId": 0, "lms": 0}


def check(condition, message, group="v1"):
    checks[group] += 1
    if not condition:
        raise AssertionError(message)


with tempfile.TemporaryDirectory(prefix="ads-http-") as temporary:
    root = Path(temporary).resolve()
    config = root / "config.php"
    password = "HTTP-test-" + uuid.uuid4().hex
    install = subprocess.run(
        ["php", str(MANAGER / "bin/install.php"), f"--config={config}",
         f"--sqlite={root / 'ads.sqlite'}", f"--uploads={root / 'uploads'}",
         "--admin=tester", "--password-stdin"],
        input=password, text=True, capture_output=True,
    )
    check(install.returncode == 0, "isolated CLI installation succeeds")
    # Exercise static routing with private fixtures, preserving coordinator-owned demos.
    runtime = root / "runtime"
    for directory in ("src", "hosts", "admin"):
        shutil.copytree(MANAGER / directory, runtime / directory)
    public = runtime / "public"
    (public / "api").mkdir(parents=True)
    for relative in ("index.php", "router.php", "api/index.php"):
        shutil.copyfile(MANAGER / "public" / relative, public / relative)
    (public / "demo-media").mkdir()
    # These headers support MIME detection; byte transport, not decoding, is under test.
    video = b"\x00\x00\x00\x20ftypisom\x00\x00\x02\x00isomiso2avc1mp41" + bytes(range(256)) * 600
    (public / "demo-media" / "range.mp4").write_bytes(video)
    (public / "demo-media" / "range.webm").write_bytes(bytes(reversed(range(256))) * 600)
    (public / "demo-media" / "empty.mp4").write_bytes(b"")
    with socket.socket() as reserve:
        reserve.bind(("127.0.0.1", 0))
        port = reserve.getsockname()[1]
    log = (root / "server.log").open("w+")
    process = subprocess.Popen(
        ["php", "-d", "upload_max_filesize=1M", "-d", "post_max_size=2M",
         "-S", f"127.0.0.1:{port}", "-t", str(public), str(public / "router.php")],
        env={**os.environ, "ADS_CONFIG": str(config)}, stdout=log, stderr=log,
    )
    base = f"http://127.0.0.1:{port}"
    cookies = http.cookiejar.CookieJar()
    client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookies))
    csrf = ""

    def call(action, data=None, headers=None, multipart=None):
        global csrf
        actual_headers = dict(headers or {})
        body = multipart
        if data is not None:
            body = json.dumps(data).encode()
            actual_headers["Content-Type"] = "application/json"
        if body is not None:
            actual_headers.setdefault("X-CSRF-Token", csrf)
        request = urllib.request.Request(base + "/api/index.php?action=" + action, data=body, headers=actual_headers)
        try:
            response = client.open(request, timeout=5)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            payload = response.read()
            next_csrf = response.headers.get("X-CSRF-Token")
            if next_csrf:
                csrf = next_csrf
            return response.status, json.loads(payload), response.headers

    def cookieless(action, data=None):
        # A visitor's first request: no cookie jar, so any Set-Cookie would start a new session.
        body = None if data is None else json.dumps(data).encode()
        request = urllib.request.Request(base + "/api/index.php?action=" + action, data=body, headers={"Content-Type": "application/json"} if body else {})
        try:
            response = urllib.request.urlopen(request, timeout=5)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            response.read()
            return response.status, response.headers

    def conditional(action, if_none_match=None):
        # Raw client: urllib turns 304 into an error and could hide an unexpected body.
        connection = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
        connection.request("GET", "/api/index.php?action=" + action, headers={} if if_none_match is None else {"If-None-Match": if_none_match})
        response = connection.getresponse()
        body = response.read()
        connection.close()
        return response.status, body, response.headers

    def body_etag(body):
        # Contract 3.1: sha256 of the data JSON bytes, which the envelope embeds verbatim.
        prefix = b'{"ok":true,"data":'
        check(body.startswith(prefix) and body.endswith(b"}"), "public preset body is the plain envelope", "presets")
        return '"' + hashlib.sha256(body[len(prefix):-1]).hexdigest()[:32] + '"'

    def no_store(headers):
        # PHP's session cache limiter extends the API's no-store header; the directive is what matters.
        return "no-store" in [part.strip() for part in headers.get("Cache-Control", "").split(",")]

    def upload(contents, filename):
        boundary = "ads" + uuid.uuid4().hex
        body = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"name\"\r\n\r\n이미지 '원문'\r\n"
                f"--{boundary}\r\nContent-Disposition: form-data; name=\"alt\"\r\n\r\n광고\r\n"
                f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{filename}\"\r\n"
                "Content-Type: application/octet-stream\r\n\r\n").encode() + contents + f"\r\n--{boundary}--\r\n".encode()
        return call("creative-upload", multipart=body, headers={"Content-Type": "multipart/form-data; boundary=" + boundary})

    def media_request(path, headers=None, method="GET"):
        request = urllib.request.Request(base + path, headers=headers or {}, method=method)
        try:
            response = client.open(request, timeout=5)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            return response.status, response.read(), response.headers

    def check_ranges(path, contents, mime):
        size = len(contents)
        status, body, headers = media_request(path)
        check(status == 200 and body == contents, path + " full media 200 byte accuracy")
        check(headers.get("Content-Length") == str(size) and headers.get("Accept-Ranges") == "bytes", path + " range capability and size")
        check(headers.get("Content-Type") == mime and headers.get("Content-Range") is None, path + " full response MIME and headers")
        modified = headers["Last-Modified"]
        cases = [
            ("bytes=10-29", 10, 29),
            ("bytes=65530-65560", 65530, 65560),
            ("bytes=50-", 50, size - 1),
            ("bytes=-13", size - 13, size - 1),
            (f"bytes={size - 3}-{size + 100}", size - 3, size - 1),
            ("bytes=-" + "9" * 40, 0, size - 1),
        ]
        for value, start, end in cases:
            status, body, headers = media_request(path, {"Range": value})
            check(status == 206 and body == contents[start:end + 1], path + " requested slice " + value)
            check(headers.get("Content-Range") == f"bytes {start}-{end}/{size}" and headers.get("Content-Length") == str(end - start + 1), path + " exact partial response headers")
        for value in (f"bytes={size}-", "bytes=5-4", "bytes=-0", "bytes=-", "bytes=0-1,4-5", "bytes=" + "9" * 40 + "-", "bytes=" + "9" * 600 + "-"):
            status, body, headers = media_request(path, {"Range": value})
            check(status == 416 and body == b"" and headers.get("Content-Range") == f"bytes */{size}" and headers.get("Content-Length") == "0", path + " invalid/unsatisfiable range")
        status, body, headers = media_request(path, {"Range": "bytes=0-9"}, method="HEAD")
        check(status == 200 and body == b"" and headers.get("Content-Length") == str(size) and headers.get("Content-Range") is None, path + " HEAD ignores Range and sends no body")
        status, body, _ = media_request(path, {"Range": "bytes=0-9", "If-Range": '"stale-validator"'})
        check(status == 200 and body == contents, path + " stale If-Range receives whole representation")
        status, body, _ = media_request(path, {"Range": "bytes=0-9", "If-Range": modified})
        check(status == 206 and body == contents[:10], path + " matching If-Range permits slice")
        status, body, _ = media_request(path, {"Range": "unknown=0-9"})
        check(status == 200 and body == contents, path + " unknown range unit ignored")

    try:
        for _ in range(100):
            if process.poll() is not None:
                raise RuntimeError("Ephemeral PHP server could not start; inspect local socket permissions.")
            try:
                status, bootstrap, _ = call("bootstrap")
                break
            except urllib.error.URLError:
                time.sleep(0.05)
        else:
            raise RuntimeError("Ephemeral PHP server did not become ready.")

        check(status == 200 and bootstrap["data"]["authenticated"] is False, "anonymous bootstrap")
        check("site" not in bootstrap["data"], "anonymous bootstrap cannot expose protected data")
        check("user" not in bootstrap["data"], "anonymous bootstrap omits user", "a1")
        capabilities = bootstrap["data"]["capabilities"]
        check("siteUrl" in capabilities and capabilities["siteUrl"] is None and "adminUrl" in capabilities and capabilities["adminUrl"] is None, "standalone bootstrap has null host links", "a1")
        csrf = bootstrap["data"]["csrfToken"]
        session_before = [(c.name, c.value) for c in cookies]
        check(call("creatives")[0] == 401, "anonymous list blocked")
        preset_input = {"name": "HTTP 비공개 이름", "playerType": "videojs", "theme": {"borderRadius": 12}}
        check(call("player-presets")[0] == 401, "anonymous preset list blocked", "presets")
        status, denied, _ = call("player-preset-save", {"preset": preset_input, "revision": 0})
        check(status == 401 and denied["error"]["code"] == "login_required", "anonymous preset write blocked", "presets")
        status, public_preset, headers = call("player-preset")
        check(status == 200 and public_preset["data"]["id"] == "default" and "name" not in public_preset["data"], "anonymous public preset renders built-in default", "presets")
        check(headers.get("Cache-Control") == "no-cache" and re.fullmatch(r'"[0-9a-f]{32}"', headers.get("ETag") or "") and headers.get("X-CSRF-Token") is None, "public preset is no-cache with a strong ETag and without admin CSRF", "presets")
        status, body, headers = conditional("player-preset")
        default_etag = headers.get("ETag")
        check(status == 200 and default_etag == body_etag(body), "ETag is the sha256 of the data JSON bytes", "presets")
        status, body, headers = conditional("player-preset", default_etag)
        check(status == 304 and body == b"" and headers.get("ETag") == default_etag and headers.get("Cache-Control") == "no-cache", "matching If-None-Match is 304 with no body", "presets")
        check(headers.get("Content-Type") is None and headers.get("Set-Cookie") is None and headers.get("X-CSRF-Token") is None, "304 carries no content type, cookie or CSRF", "presets")
        for label, value in (("weak", "W/" + default_etag), ("list", '"0123", ' + default_etag), ("weak list", '"0123",W/' + default_etag), ("wildcard", "*")):
            status, body, _ = conditional("player-preset", value)
            check(status == 304 and body == b"", label + " If-None-Match is 304", "presets")
        for label, value in (("other tag", '"0123"'), ("unquoted", default_etag.strip('"')), ("empty", "")):
            status, body, headers = conditional("player-preset", value)
            check(status == 200 and headers.get("ETag") == default_etag and body_etag(body) == default_etag, label + " If-None-Match gets the full response", "presets")
        status, body, headers = conditional("player-preset&id=accent")
        check(status == 200 and headers.get("ETag") not in (None, default_etag) and headers.get("ETag") == body_etag(body), "a different preset ID has a different ETag", "presets")
        check(conditional("player-preset&id=accent", default_etag)[0] == 200, "another preset's ETag does not revalidate", "presets")
        status, body, headers = conditional("player-presets")
        check(status == 401 and "ETag" not in headers, "admin preset list has no ETag", "presets")
        status, body, headers = conditional("schedule&videoId=http-etag", '"0123"')
        check(status == 200 and "ETag" not in headers and headers.get("Cache-Control") == "no-store", "schedule keeps plain no-store without an ETag", "presets")
        status, body, headers = conditional("bootstrap", "*")
        check(status == 200 and "ETag" not in headers and no_store(headers), "bootstrap ignores If-None-Match and stays no-store", "presets")
        check(call("login", {"username": "tester", "password": password}, {"X-CSRF-Token": "bad"})[0] == 403, "login CSRF blocked")
        status, logged_in, headers = call("login", {"username": "tester", "password": password})
        check(status == 200 and logged_in["data"]["authenticated"], "real HTTP password login")
        check(session_before != [(c.name, c.value) for c in cookies], "session ID rotates on login")
        check(bool(headers.get("X-CSRF-Token")), "authenticated response refreshes CSRF header")
        check(any(c.has_nonstandard_attr("HttpOnly") for c in cookies), "session cookie is HTTP-only")
        check(call("bootstrap")[1]["data"]["limits"]["uploadBytes"] == 1048576, "advertised limit honors PHP effective limit")
        status, denied, _ = call("player-preset-save", {"preset": preset_input, "revision": 0}, {"X-CSRF-Token": "bad"})
        check(status == 403 and denied["error"]["code"] == "csrf", "preset write without valid CSRF blocked", "presets")
        status, saved, _ = call("player-preset-save", {"preset": preset_input, "revision": 0})
        check(status == 200 and saved["data"]["revision"] == 1, "authenticated preset save persists", "presets")
        preset_id = saved["data"]["preset"]["id"]
        status, conflict, _ = call("player-preset-default", {"id": preset_id, "revision": 0})
        check(status == 409 and conflict["error"]["code"] == "revision_conflict" and "data" not in conflict, "stale preset revision conflicts without a list", "presets")
        status, invalid, _ = call("player-preset-save", {"preset": {**preset_input, "theme": {"borderRadius": 40}}, "revision": 1})
        check(status == 422 and list(invalid["error"]["fields"]) == ["theme.borderRadius"], "preset validation returns field path", "presets")
        status, invalid, _ = call("player-preset-save", {"preset": {**preset_input, "skin": ["x"]}, "revision": 1})
        check(status == 422 and list(invalid["error"]["fields"]) == ["skin"], "removed skin key is 422 rather than 500 even as an array", "presets")
        status, invalid, _ = call("player-preset-save", {"preset": {**preset_input, "playback": {"autoplay": True, "muted": False}}, "revision": 1})
        check(status == 422 and invalid["error"]["fields"] == {"playback.muted": "자동재생을 켜면 음소거로 시작해야 해요."}, "unmuted autoplay is rejected with its message", "presets")
        status, invalid, _ = call("player-preset-save", {"preset": {**preset_input, "logo": {"href": "https://example.com"}}, "revision": 1})
        check(status == 422 and invalid["error"]["fields"] == {"logo.alt": "링크가 있으면 대체 텍스트를 입력해 주세요."}, "logo link without alt text is rejected with its message", "presets")
        status, invalid, _ = call("player-preset-save", {"preset": {**preset_input, "id": "accent"}, "revision": 1})
        check(status == 400 and invalid["error"]["code"] == "preset_builtin", "built-in preset cannot be saved over", "presets")
        status, invalid, _ = call("player-preset-save", {"preset": {**preset_input, "ads": {"labels": {"mediaAlt": "광고 영상"}}}, "revision": 1})
        check(status == 422 and list(invalid["error"]["fields"]) == ["ads.labels.mediaAlt"], "mediaAlt label is rejected as unknown", "presets")
        status, saved, _ = call("player-preset-save", {"preset": {**preset_input, "id": preset_id, "ads": {"labels": {"timer": "{remaining}초 남음"}}}, "revision": 1})
        labels = dict.fromkeys(["advertisement", "sequence", "playPause", "mute", "volume", "advertiser", "newWindow", "skip", "skipCountdown", "timer", "loading", "paused", "blocked", "enterFullscreen", "exitFullscreen", "fullscreenError"])
        check(status == 200 and saved["data"]["preset"]["ads"]["labels"] == {**labels, "timer": "{remaining}초 남음"}, "timer label accepts remaining", "presets")
        check(list(saved["data"]["preset"]["ads"]["labels"]) == list(labels), "saved labels keep the 16-key order", "presets")
        check(conditional("player-preset", default_etag)[0] == 200, "a save changes the default ETag", "presets")
        status, public_preset, headers = call("player-preset&id=" + preset_id)
        check(status == 200 and public_preset["data"]["css"] == {"--media-border-radius": "12px"}, "public preset renders stored CSS", "presets")
        check(public_preset["data"]["attributes"] == {"lang": "ko", "timer-label": "{remaining}초 남음"}, "public preset renders timer without media-alt", "presets")
        check("name" not in public_preset["data"] and "HTTP 비공개 이름" not in json.dumps(public_preset, ensure_ascii=False), "public preset never exposes name", "presets")
        stored_etag = headers.get("ETag")
        check(headers.get("Cache-Control") == "no-cache" and stored_etag not in (None, default_etag), "stored public preset is no-cache with its own ETag", "presets")
        before_default = conditional("player-preset")[2].get("ETag")
        status, applied, _ = call("player-preset-default", {"id": preset_id, "revision": 2})
        status, body, headers = conditional("player-preset", before_default)
        check(applied["data"]["defaultPresetId"] == preset_id and status == 200 and headers.get("ETag") != before_default and json.loads(body)["data"]["id"] == preset_id, "a site default change changes the default ETag", "presets")
        check(conditional("player-preset&id=" + preset_id, stored_etag)[0] == 200, "the revision bump also changes the stored preset ETag", "presets")
        status, missing, headers = call("player-preset&id=p-zzzzzzzzzz")
        check(status == 404 and missing["error"]["code"] == "preset_not_found" and no_store(headers) and "ETag" not in headers, "unknown public preset is 404 without an ETag", "presets")
        status, body, headers = conditional("player-preset&id=p-zzzzzzzzzz", "*")
        check(status == 404 and "ETag" not in headers, "wildcard If-None-Match does not turn a 404 into 304", "presets")
        status, malformed, headers = call("player-preset&id=P-BAD")
        check(status == 400 and malformed["error"]["code"] == "invalid_preset_id" and no_store(headers) and "ETag" not in headers, "malformed public preset ID is 400 without an ETag", "presets")
        # A2-E: the flat built-in and the translucent border colour.
        status, listed, _ = call("player-presets")
        check(status == 200 and [preset["id"] for preset in listed["data"]["presets"]][:5] == ["default", "flat", "rounded", "accent", "lms"], "built-ins are listed as default, flat, rounded, accent, lms", "presets")
        status, flat, headers = call("player-preset&id=flat")
        check(status == 200 and flat["data"]["css"] == {"--media-border-color": "#00000000", "--media-border-radius": "0px"} and headers.get("ETag"), "public flat render has no border and square corners", "presets")
        status, denied, _ = call("player-preset-save", {"preset": {**preset_input, "id": "flat"}, "revision": 3})
        check(status == 400 and denied["error"]["code"] == "preset_builtin", "flat cannot be saved over", "presets")
        status, denied, _ = call("player-preset-delete", {"id": "flat", "revision": 3})
        check(status == 400 and denied["error"]["code"] == "preset_builtin", "flat cannot be deleted", "presets")
        status, applied, _ = call("player-preset-default", {"id": "flat", "revision": 3})
        status, site, _ = call("player-preset")
        check(applied["data"]["defaultPresetId"] == "flat" and site["data"]["id"] == "flat" and site["data"]["css"]["--media-border-color"] == "#00000000", "flat applied to the site is the public default", "presets")
        status, saved, _ = call("player-preset-save", {"preset": {**preset_input, "id": preset_id, "theme": {"borderColor": "#00000026"}}, "revision": 4})
        status, public_preset, _ = call("player-preset&id=" + preset_id)
        check(saved["data"]["preset"]["theme"]["borderColor"] == "#00000026" and public_preset["data"]["css"]["--media-border-color"] == "#00000026", "8-digit border color is saved and rendered as-is", "presets")
        for label, theme, field in (("7-digit", {"borderColor": "#0000002"}, "theme.borderColor"), ("9-digit", {"borderColor": "#000000260"}, "theme.borderColor"), ("accent 8-digit", {"accentColor": "#2563eb80"}, "theme.accentColor")):
            status, invalid, _ = call("player-preset-save", {"preset": {**preset_input, "theme": theme}, "revision": 5})
            check(status == 422 and list(invalid["error"]["fields"]) == [field], label + " color is 422", "presets")
        check(call("bootstrap")[1]["data"]["user"] == {"displayName": "tester"}, "standalone bootstrap user is the login ID", "a1")
        check(call("creative-save", {"name": "invalid"})[0] == 422, "invalid write is field validation error")
        check(call("creative-save", {"name": "x", "url": "javascript:alert(1)", "mime": "image/png", "alt": ""})[0] == 422, "unsafe creative URL blocked")
        check(call("creative-save", {"name": "x"}, {"Origin": "https://cross-site.example"})[0] == 403, "cross-origin mutation blocked")
        png = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6ZAAAAABJRU5ErkJggg==")
        status, uploaded, _ = upload(png, "../../attack.php")
        check(status == 200, "real uploaded PNG accepted regardless of attacker filename")
        creative = uploaded["data"]["creative"]
        check(creative["mime"] == "image/png" and creative["source"] == "upload", "fileinfo determines MIME")
        check(creative["name"] == "이미지 '원문'", "stored name preserves text")
        check("attack" not in creative["url"] and creative["url"].endswith(".png"), "random safe storage name")
        with client.open(base + creative["url"]) as media:
            check(media.read() == png, "uploaded bytes are retrievable through non-executable route")
            check(media.headers.get("X-Content-Type-Options") == "nosniff", "media has nosniff")
        status, uploaded_video, _ = upload(video, "range.mp4")
        check(status == 200 and uploaded_video["data"]["creative"]["mime"] == "video/mp4", "real multipart MP4 transport fixture accepted")
        check_ranges(uploaded_video["data"]["creative"]["url"], video, "video/mp4")
        check_ranges("/demo-media/range.mp4", video, "video/mp4")
        check_ranges("/demo-media/range.webm", (public / "demo-media/range.webm").read_bytes(), "video/webm")
        status, body, headers = media_request("/demo-media/empty.mp4")
        check(status == 200 and body == b"" and headers.get("Content-Length") == "0", "empty media full response")
        status, body, headers = media_request("/demo-media/empty.mp4", {"Range": "bytes=0-"})
        check(status == 416 and body == b"" and headers.get("Content-Range") == "bytes */0", "empty media has no satisfiable byte range")
        check(upload(b"<?php echo 'not media';", "fake.mp4")[0] == 422, "spoofed media extension blocked")
        check(upload(b"x" * (1048576 + 1), "large.png")[0] == 413, "oversize upload blocked")
        status, context, _ = call("video-context-save", {"videoId": "http-video", "label": "HTTP 영상", "boardId": "board-real", "categoryId": "category-real"})
        check(status == 200 and context["data"]["saved"], "trusted mapping persisted")
        status, resolved, headers = call("schedule&videoId=http-video&boardId=forged")
        check(status == 200 and resolved["data"]["schedule"]["boardId"] == "board-real", "visitor board cannot forge host context")
        check(headers.get("X-CSRF-Token") is None, "public schedule never returns admin CSRF")
        for action, data, expected in (("schedule&videoId=http-video", None, 200), ("player-preset", None, 200), ("events", {}, 403)):
            status, headers = cookieless(action, data)
            name = action.split("&")[0]
            check(status == expected and headers.get_all("Set-Cookie") is None, "cookieless public " + name + " starts no session", "session")
            cache = "no-cache" if name == "player-preset" else "no-store"
            check(headers.get("Cache-Control") == cache, "cookieless public " + name + " has only the action's " + cache, "session")
        status, echoed, headers = call("schedule&videoId=" + urllib.parse.quote("<bad>"))
        check(status == 200 and echoed["data"]["schedule"]["videoId"] == "<bad>" and headers.get("Content-Type") == "application/json; charset=utf-8" and headers.get("X-Content-Type-Options") == "nosniff", "valid video ID is echoed verbatim as JSON with nosniff", "videoId")
        for label, value in (("RLO", "\u202e영상"), ("U+3000 only", "\u3000"), ("C1", "영상\u0085")):
            status, invalid, headers = call("schedule&videoId=" + urllib.parse.quote(value))
            check(status == 422 and invalid["error"]["code"] == "validation" and list(invalid["error"]["fields"]) == ["videoId"] and value not in json.dumps(invalid, ensure_ascii=False) and no_store(headers), "public schedule rejects " + label + " video ID without echoing it", "videoId")
        status, headers = cookieless("bootstrap")
        check(status == 200 and any(cookie.startswith("ADS") for cookie in headers.get_all("Set-Cookie") or []), "cookieless admin bootstrap still starts its session", "session")
        # L-1 lecture (LMS) actions over real HTTP (.agents/plans/ads-lms-spec.md 3).
        def b64url(raw):
            return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()

        def learner_token(payload, key):
            encoded = b64url(json.dumps(payload).encode())
            return encoded + "." + b64url(hmac.new(key.encode(), encoded.encode(), hashlib.sha256).digest())

        def report(session, seq, segments, **extra):
            return call("lms-progress", {"lmsToken": session["lmsToken"], "videoId": "http-video", "seq": seq, "reason": "interval", "segments": segments, "position": 0, "duration": 100, "rate": 1, "activeSecondsDelta": 5, **extra})

        check("LMS schema version 1" in install.stdout and bootstrap["data"]["capabilities"]["lms"] == {"installed": True}, "the installer adds the LMS tables and bootstrap advertises them", "lms")
        status, headers = cookieless("lms-session", {"videoId": "http-video"})
        check(status == 200 and headers.get_all("Set-Cookie") is None and no_store(headers), "cookieless lms-session starts no session and is not stored", "lms")
        status, rotated, _ = call("lms-key-rotate", {})
        lms_key = rotated["data"]["key"]
        status, settings, _ = call("lms-settings")
        check(status == 200 and settings["data"]["keyHint"] == "…" + lms_key[-4:] and lms_key not in json.dumps(settings), "rotated key is shown once; settings carry only its hint", "lms")
        soon = int(time.time()) + 600
        status, forged, _ = call("lms-session", {"videoId": "http-video", "learnerToken": learner_token({"v": 1, "sub": "alice", "exp": soon}, "0" * 64)})
        status, expired, _ = call("lms-session", {"videoId": "http-video", "learnerToken": learner_token({"v": 1, "sub": "alice", "exp": int(time.time()) - 5}, lms_key)})
        check(forged["data"]["storage"] == "local" and forged["data"]["learnerError"] == "invalid" and expired["data"]["learnerError"] == "expired" and "lmsToken" not in expired["data"], "forged and expired learner tokens fall back to browser storage", "lms")
        status, alice, _ = call("lms-session", {"videoId": "http-video", "learnerToken": learner_token({"v": 1, "sub": "alice", "exp": soon}, lms_key)})
        status, bob, _ = call("lms-session", {"videoId": "http-video", "learnerToken": learner_token({"v": 1, "sub": "bob", "exp": soon}, lms_key)})
        alice, bob = alice["data"], bob["data"]
        check(status == 200 and alice["storage"] == "server" and alice["learner"] == "external" and bob["progress"] is None, "a Python-signed learner token verifies in PHP", "lms")
        status, first, headers = report(alice, 1, [[0, 100]])
        check(status == 200 and first["data"] == {"percent": 60, "completedAt": None, "maxWatched": 60.0, "segments": [[0.0, 60.0]]} and no_store(headers), "the server trims an inflated first report to 30 s × maxRate", "lms")
        status, again, _ = report(alice, 1, [[0, 100]])
        check(again["data"] == first["data"], "a repeated seq is idempotent", "lms")
        status, bob_first, _ = report(bob, 1, [[0, 10]])
        status, alice_again, _ = call("lms-session", {"videoId": "http-video", "learnerToken": learner_token({"v": 1, "sub": "alice", "exp": soon}, lms_key)})
        check(bob_first["data"]["percent"] == 10 and alice_again["data"]["progress"]["percent"] == 60, "two learners keep separate progress", "lms")
        status, other, _ = report(alice, 2, [[0, 1]], videoId="other-video")
        check(status == 403 and other["error"]["code"] == "invalid_session", "a token for another video is refused", "lms")
        status, tampered, _ = report({"lmsToken": alice["lmsToken"][:-1] + ("1" if alice["lmsToken"].endswith("0") else "0")}, 2, [])
        check(status == 403 and tampered["error"]["code"] == "invalid_session", "a forged LMS token is refused", "lms")
        with sqlite3.connect(root / "ads.sqlite") as database:
            signing_key = database.execute("SELECT value FROM ads_meta WHERE name = 'signing_key'").fetchone()[0]
        claims = json.loads(base64.urlsafe_b64decode(alice["lmsToken"].split(".")[0] + "=="))
        stale = b64url(json.dumps({**claims, "exp": int(time.time()) - 1}).encode())
        lms_signing = hmac.new(signing_key.encode(), b"lms-session", hashlib.sha256).hexdigest()
        status, stale_body, _ = report({"lmsToken": stale + "." + hmac.new(lms_signing.encode(), stale.encode(), hashlib.sha256).hexdigest()}, 2, [])
        check(status == 403 and stale_body["error"]["code"] == "invalid_session", "an expired LMS token is refused", "lms")
        status, ad_session, _ = call("schedule&videoId=http-video")
        status, mixed, _ = report({"lmsToken": ad_session["data"]["eventToken"]}, 2, [])
        check(status == 403 and mixed["error"]["code"] == "invalid_session", "an ad event token is not an LMS token", "lms")
        status, saved_note, _ = call("lms-notes", {"lmsToken": alice["lmsToken"], "videoId": "http-video", "op": "save", "note": {"kind": "note", "time": 4, "text": "HTTP 메모"}})
        status, bob_notes, _ = call("lms-notes", {"lmsToken": bob["lmsToken"], "videoId": "http-video", "op": "list"})
        check(saved_note["data"]["notes"][0]["text"] == "HTTP 메모" and bob_notes["data"]["notes"] == [], "notes are saved per learner", "lms")
        status, listed_progress, _ = call("lms-progress-list&learner=alice")
        check(status == 200 and [row["learner"] for row in listed_progress["data"]["rows"]] == ["x:alice"] and listed_progress["data"]["pageSize"] == 50, "the administrator lists progress by learner", "lms")
        with client.open(base + "/api/index.php?action=lms-progress-csv&learner=alice", timeout=5) as response:
            csv_body = response.read()
            check(response.status == 200 and response.headers.get("Content-Type") == "text/csv; charset=utf-8" and response.headers.get("Content-Disposition") == 'attachment; filename="lms-progress.csv"' and csv_body.startswith("\ufefflearner,".encode()), "the progress CSV downloads as lms-progress.csv", "lms")
        status, preroll, _ = call("schedule&videoId=http-video&breaks=preroll")
        check(status == 200 and all(item["position"] == "pre" for item in preroll["data"]["schedule"]["breaks"]), "schedule accepts breaks=preroll", "lms")
        status, bad_breaks, _ = call("schedule&videoId=http-video&breaks=mid")
        check(status == 422 and list(bad_breaks["error"]["fields"]) == ["breaks"], "an unknown breaks filter is 422", "lms")
        with sqlite3.connect(root / "ads.sqlite") as database:
            database.execute("DELETE FROM ads_meta WHERE name = 'lms_schema_version'")
        status, unavailable, headers = call("lms-session", {"videoId": "http-video"})
        status_progress, unavailable_progress, _ = report(alice, 2, [])
        check(status == 503 and unavailable["error"]["code"] == "lms_unavailable" and status_progress == 503 and no_store(headers), "without the LMS installation the LMS actions are 503", "lms")
        check(call("schedule&videoId=http-video")[0] == 200 and call("player-preset")[0] == 200 and call("bootstrap")[1]["data"]["capabilities"]["lms"] == {"installed": False} and call("lms-settings")[1]["data"]["installed"] is False, "other actions keep working without the LMS installation", "lms")
        with sqlite3.connect(root / "ads.sqlite") as database:
            database.execute("INSERT INTO ads_meta (name, value) VALUES ('lms_schema_version', '1')")
        with sqlite3.connect(root / "ads.sqlite") as database:
            check(database.execute("SELECT COUNT(*) FROM ads_sessions").fetchone()[0] == 0, "GET schedule leaves session storage untouched")
            check(database.execute("SELECT password_hash FROM ads_admins").fetchone()[0] != password, "persistent credential is hashed")
            document = database.execute("SELECT document FROM ads_creative_versions WHERE creative_id = ?", (creative["creativeId"],)).fetchone()[0]
            check(json.loads(document)["creativeId"] == creative["creativeId"], "HTTP upload persists in actual SQLite")
        check(call("logout", {})[1]["data"]["authenticated"] is False, "logout")
        check(call("creatives")[0] == 401, "logout revokes admin access")
        check(call("lms-settings")[0] == 401 and call("lms-key-rotate", {})[0] == 401 and call("lms-progress-list")[0] == 401, "LMS administrator actions need a login", "lms")

        # A1 shell selection. The bundle is a private fake; real build output is never touched.
        def page(path, server=None):
            status, body, headers = media_request(path) if server is None else server(path)
            return status, body.decode(), headers

        def shell_config(html):
            match = re.search(r'<script id="ads-config" type="application/json">(.*?)</script>', html, re.S)
            return json.loads(match.group(1)) if match else None

        bundle = public / "assets" / "admin-app"
        status, html, headers = page("/")
        check(status == 503 and html == "관리자 화면 파일이 없습니다. ui를 빌드해 주세요.", "missing bundle returns 503 build notice", "a1")
        check(headers.get("Content-Type", "").startswith("text/plain") and "ads-admin-root" not in html, "missing bundle notice is not a styled page", "a1")
        status, html, _ = page("/?ui=v1")
        check(status == 200 and "assets/admin/admin.js" in html and "ads-admin-root" not in html, "ui=v1 keeps the v1 shell without the new bundle", "a1")
        bundle.mkdir(parents=True)
        (bundle / "admin-app.js").write_text("export function mountAdsAdmin() {}\n")
        (bundle / "admin-app.css").write_text(":root {}\n")
        os.utime(bundle / "admin-app.js", (1760000000, 1760000000))
        os.utime(bundle / "admin-app.css", (1760000123, 1760000123))
        status, html, headers = page("/")
        check(status == 200 and "<title>솔애드 관리자</title>" in html and '<div id="ads-admin-root"></div>' in html, "default entry is the React shell", "a1")
        check(shell_config(html) == {"apiUrl": "/api/index.php", "assetUrl": "/assets/admin-app/"}, "shell config carries apiUrl and assetUrl", "a1")
        check('<link rel="stylesheet" href="/assets/admin-app/admin-app.css?v=1760000123">' in html, "stylesheet uses filemtime cache busting", "a1")
        check('<script type="module" src="/assets/admin-app/admin-app.js?v=1760000000"></script>' in html, "module script uses filemtime cache busting", "a1")
        check("<noscript>" in html and not re.search(r'(?:src|href)="(?:https?:)?//', html), "shell has noscript and no external scripts or styles", "a1")
        check(headers.get("Cache-Control") == "no-cache", "shell is revalidated after builds", "a1")
        check(page("/?ui=other")[0] == 200 and "ads-admin-root" in page("/?ui=other")[1], "unknown ui value uses the default shell", "a1")
        status, html, _ = page("/index.php?ui=v1")
        check(status == 200 and "assets/admin/admin.js" in html, "ui=v1 selects the v1 shell with a bundle present", "a1")
        status, body, _ = media_request("/assets/admin-app/admin-app.js")
        check(status == 200 and body == (bundle / "admin-app.js").read_bytes(), "bundle is served as a static file", "a1")
        (bundle / "admin-app.css").unlink()
        check(page("/")[0] == 503, "partially missing bundle returns 503", "a1")
        (bundle / "admin-app.css").write_text(":root {}\n")

        # Each shell variant needs its own config, so it runs on its own ephemeral plain PHP server.
        source = config.read_text()
        check("'apiUrl' => '/api/index.php'," in source, "installer writes the default apiUrl", "a1")

        def shell_server(name, api_url, docroot, paths):
            variant = root / f"config-{name}.php"
            quoted = "'" + api_url.replace("\\", "\\\\").replace("'", "\\'") + "'"
            variant.write_text(source.replace("'apiUrl' => '/api/index.php',", f"'apiUrl' => {quoted},"))
            with socket.socket() as reserve:
                reserve.bind(("127.0.0.1", 0))
                shell_port = reserve.getsockname()[1]
            server = subprocess.Popen(
                ["php", "-S", f"127.0.0.1:{shell_port}", "-t", str(docroot)],
                env={**os.environ, "ADS_CONFIG": str(variant)}, stdout=log, stderr=log,
            )

            def shell_request(path):
                try:
                    response = urllib.request.urlopen(f"http://127.0.0.1:{shell_port}" + path, timeout=5)
                except urllib.error.HTTPError as error:
                    response = error
                with response:
                    return response.status, response.read(), response.headers

            try:
                for _ in range(100):
                    if server.poll() is not None:
                        raise RuntimeError(f"Ephemeral {name} PHP server could not start.")
                    try:
                        first = page(paths[0], shell_request)
                        break
                    except urllib.error.URLError:
                        time.sleep(0.05)
                else:
                    raise RuntimeError(f"Ephemeral {name} PHP server did not become ready.")
                return [first, *(page(path, shell_request) for path in paths[1:])]
            finally:
                server.terminate()
                try:
                    server.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    server.kill()
                    server.wait()

        # The host-site /ads/ mount uses the same public/index.php behind a path prefix.
        mount = root / "mount"
        mount.mkdir()
        (mount / "ads").symlink_to(public, target_is_directory=True)
        (status, html, _), (v1_status, v1_html, _) = shell_server("ads", "/ads/api/index.php", mount, ["/ads/", "/ads/?ui=v1"])
        check(status == 200 and shell_config(html) == {"apiUrl": "/ads/api/index.php", "assetUrl": "/ads/assets/admin-app/"}, "/ads/ mount derives prefixed asset URL", "a1")
        check('src="/ads/assets/admin-app/admin-app.js?v=1760000000"' in html, "/ads/ mount loads the prefixed bundle", "a1")
        check(v1_status == 200 and "/ads/assets/admin/admin.js" in v1_html, "/ads/?ui=v1 keeps the prefixed v1 shell", "a1")

        # Config and the shell regex both accept quotes, < and &; output escaping is the actual defense.
        hostile = "/h\"><script>x</script>&a='b/api/index.php"
        [(status, html, _)] = shell_server("hostile", hostile, public, ["/"])
        check(status == 200 and shell_config(html) == {"apiUrl": hostile, "assetUrl": hostile[:-len("api/index.php")] + "assets/admin-app/"}, "hostile apiUrl round-trips through config JSON", "a1")
        check(html.count("<script") == 2 and "<script>x" not in html and "&a='b" not in html, "hostile apiUrl never appears raw in shell HTML", "a1")
        check('src="/h&quot;&gt;&lt;script&gt;x&lt;/script&gt;&amp;a=&#039;b/assets/admin-app/admin-app.js?v=1760000000"' in html, "hostile asset URL is HTML-attribute escaped", "a1")

        # A configured endpoint outside the shell contract gets the same plain 503 as a missing bundle.
        [(status, html, headers)] = shell_server("invalid", "/endpoint.php", public, ["/"])
        check(status == 503 and html == "광고 관리자 연결 설정을 확인하세요.", "invalid apiUrl returns 503 notice", "a1")
        check(headers.get("Content-Type", "").startswith("text/plain") and headers.get("Cache-Control") == "no-store", "invalid apiUrl 503 is plain text and not stored", "a1")
        print(f"PASS {checks['v1']} real HTTP/installer/session/CSRF/upload/range/persistence assertions on an ephemeral port.")
        print(f"PASS {checks['a1']} A1 shell selection/bootstrap user assertions (counted separately).")
        print(f"PASS {checks['presets']} A1-API-4/A2-1 player preset assertions (counted separately).")
        print(f"PASS {checks['session']} A1-FIX-API cookieless public action assertions (counted separately).")
        print(f"PASS {checks['videoId']} A1-FIX-API-2 public video ID assertions (counted separately).")
        print(f"PASS {checks['lms']} L-1 lecture progress, notes and preroll assertions (counted separately).")
    finally:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
        log.close()
