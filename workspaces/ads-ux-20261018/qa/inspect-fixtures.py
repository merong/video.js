#!/usr/bin/env python3
"""Read-only media/HTTP inspection; writes a secret-free report only beside this file."""
import datetime
import hashlib
import json
import subprocess
import urllib.error
import urllib.request
from pathlib import Path

QA = Path(__file__).resolve().parent
ROOT = QA.parents[2]
PUBLIC = ROOT / 'integrations/ads-manager/public'
BASE = 'http://127.0.0.1:18766'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def fetch(path, headers=None):
    request = urllib.request.Request(BASE + path, headers=headers or {})
    try:
        response = urllib.request.urlopen(request, timeout=10)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        body = response.read()
        return {
            'url': BASE + path,
            'status': response.status,
            'headers': {key: response.headers.get(key) for key in (
                'Content-Type', 'Content-Length', 'Content-Range', 'Accept-Ranges'
            ) if response.headers.get(key) is not None},
            'bytes': len(body),
            'sha256': sha(body),
        }, body


report = {
    'observedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'scope': 'file/ffprobe/read-only HTTP; no browser, server mutation, DB or collector access',
    'media': [],
    'assets': [],
    'fixtures': [],
}
for name in ('content.mp4', 'ad.mp4', 'ad.png'):
    path = PUBLIC / 'demo-media' / name
    assert path.is_file() and not path.is_symlink(), str(path)
    data = path.read_bytes()
    result = subprocess.run([
        'ffprobe', '-v', 'error', '-show_entries',
        'format=format_name,duration,size:stream=codec_name,codec_type,width,height,pix_fmt,duration,r_frame_rate',
        '-of', 'json', str(path),
    ], check=True, capture_output=True, text=True)
    http, body = fetch('/demo-media/' + name)
    assert http['status'] == 200 and body == data
    report['media'].append({
        'path': str(path.relative_to(ROOT)), 'bytes': len(data), 'sha256': sha(data),
        'ffprobe': json.loads(result.stdout), 'http': http, 'httpMatchesLocal': True,
        'used': name != 'ad.mp4',
    })

http, body = fetch('/demo-media/content.mp4', {'Range': 'bytes=0-1023'})
assert http['status'] == 206 and body == (PUBLIC / 'demo-media/content.mp4').read_bytes()[:1024]
report['contentRange'] = http

for name in ('assets/ads.js', 'assets/videojs/video.js', 'assets/videojs/video.css'):
    local = (PUBLIC / name).read_bytes()
    http, body = fetch('/' + name)
    assert http['status'] == 200 and body == local
    report['assets'].append({'path': name, 'http': http, 'httpMatchesLocal': True})

for variant in ('requested', 'valid'):
    stem = f'ux-review-{variant}-20261018'
    for extension in ('html', 'json.js'):
        http, body = fetch('/demo-media/' + stem + '.' + extension)
        local = (PUBLIC / 'demo-media' / (stem + '.' + extension)).read_bytes()
        assert http['status'] == 200 and body == local
        entry = {'variant': variant, 'http': http, 'httpMatchesLocal': True}
        if extension == 'json.js':
            assert body == (QA / (stem + '.json')).read_bytes()
            data = json.loads(body)
            assert not {'data', 'tracking', 'eventToken', 'eventsUrl', 'playbackSessionId'} & data.keys()
            entry.update({'rawJson': True, 'videoId': data['videoId'], 'trackingKeys': False})
        else:
            assert body == (QA / (stem + '.html')).read_bytes()
            assert b'__VARIANT__' not in body and b'__VIDEO_ID__' not in body
        report['fixtures'].append(entry)

report['browserStatus'] = 'NOT_RUN; root owns TaskSpace63'
destination = QA / 'media-http-evidence.json'
assert not destination.exists() and not destination.is_symlink()
destination.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'report': str(destination), 'media': len(report['media']), 'assets': len(report['assets']),
                  'fixtures': len(report['fixtures']), 'range': report['contentRange']['status'],
                  'browser': report['browserStatus']}, ensure_ascii=False))
