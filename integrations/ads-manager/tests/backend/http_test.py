"""Real ephemeral PHP/SQLite HTTP tests; never uses the coordinator's ports or DB."""

import base64
import http.cookiejar
import json
import os
from pathlib import Path
import shutil
import socket
import sqlite3
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
import uuid


MANAGER = Path(__file__).resolve().parents[2]
checks = 0


def check(condition, message):
    global checks
    checks += 1
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
    for directory in ("src", "hosts"):
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
        csrf = bootstrap["data"]["csrfToken"]
        session_before = [(c.name, c.value) for c in cookies]
        check(call("creatives")[0] == 401, "anonymous list blocked")
        check(call("login", {"username": "tester", "password": password}, {"X-CSRF-Token": "bad"})[0] == 403, "login CSRF blocked")
        status, logged_in, headers = call("login", {"username": "tester", "password": password})
        check(status == 200 and logged_in["data"]["authenticated"], "real HTTP password login")
        check(session_before != [(c.name, c.value) for c in cookies], "session ID rotates on login")
        check(bool(headers.get("X-CSRF-Token")), "authenticated response refreshes CSRF header")
        check(any(c.has_nonstandard_attr("HttpOnly") for c in cookies), "session cookie is HTTP-only")
        check(call("bootstrap")[1]["data"]["limits"]["uploadBytes"] == 1048576, "advertised limit honors PHP effective limit")
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
        with sqlite3.connect(root / "ads.sqlite") as database:
            check(database.execute("SELECT COUNT(*) FROM ads_sessions").fetchone()[0] == 0, "GET schedule leaves session storage untouched")
            check(database.execute("SELECT password_hash FROM ads_admins").fetchone()[0] != password, "persistent credential is hashed")
            document = database.execute("SELECT document FROM ads_creative_versions WHERE creative_id = ?", (creative["creativeId"],)).fetchone()[0]
            check(json.loads(document)["creativeId"] == creative["creativeId"], "HTTP upload persists in actual SQLite")
        check(call("logout", {})[1]["data"]["authenticated"] is False, "logout")
        check(call("creatives")[0] == 401, "logout revokes admin access")
        print(f"PASS {checks} real HTTP/installer/session/CSRF/upload/range/persistence assertions on an ephemeral port.")
    finally:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
        log.close()
