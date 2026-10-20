#!/usr/bin/env python3
"""Create only explicitly owned, static UX inputs; no server/DB/browser work."""
import json
from pathlib import Path

QA = Path(__file__).resolve().parent
ROOT = QA.parents[2]
PUBLIC = ROOT / 'integrations/ads-manager/public/demo-media'


def create(path, data):
    # Preserve unexpected pre-existing files, including symlinks.
    with path.open('x', encoding='utf-8') as file:
        file.write(data)


def creative(item, kind, skip, duration=None, cta=False):
    result = {
        'itemId': item,
        'adId': item + '-creative',
        'creativeId': item + '-creative',
        'creativeVersion': 1,
        'kind': kind,
        'url': '/demo-media/content.mp4' if kind == 'video' else '/demo-media/ad.png',
        'mime': 'video/mp4' if kind == 'video' else 'image/png',
        'alt': 'QA 실제 36초 영상' if kind == 'video' else 'QA 기존 PNG 광고',
        'clickUrl': '/demo-media/ux-review-valid-20261018.html#advertiser-target' if cta else None,
        'skipAfterSeconds': skip,
    }
    if duration is not None:
        result['displaySeconds'] = duration
    return result


template = (QA / 'fixture.template.html').read_text()
for variant, image_skip, video_id in [
    ('requested', 0, 'ux-review-20261018'),
    ('valid', 1, 'ux-review-valid-20261018'),
]:
    schedule = {
        'schemaVersion': 1,
        'siteId': 'ux-review-local',
        'videoId': video_id,
        'boardId': None,
        'categoryId': None,
        'scheduleId': f'ux-review-{variant}-20261018',
        'scheduleVersion': 1,
        'breaks': [
            {'breakId': 'ux-pre', 'position': 'pre', 'ads': [
                creative('ux-pre-video', 'video', 3, cta=True),
                creative('ux-pre-image', 'image', image_skip, 8),
            ]},
            {'breakId': 'ux-mid-10', 'position': 'mid', 'atSeconds': 10, 'ads': [
                creative('ux-mid-image', 'image', None, 3),
            ]},
            {'breakId': 'ux-post', 'position': 'post', 'ads': [
                creative('ux-post-image', 'image', image_skip, 3),
            ]},
        ],
    }
    raw = json.dumps(schedule, ensure_ascii=False, indent=2) + '\n'
    stem = f'ux-review-{variant}-20261018'
    create(QA / f'{stem}.json', raw)
    # The existing router permits .js but not .json. This is raw JSON data,
    # intentionally never imported/executed as JavaScript.
    create(PUBLIC / f'{stem}.json.js', raw)
    if variant == 'requested':
        label = 'NEGATIVE · 원 요청 skip0 · 입력 거부 검증'
        expectation = '예상: C0가 image/post skip0을 거부하고 광고 없이 본편을 계속 허용합니다. 이 입력으로 0초 스킵 UI 성공을 판정하지 않습니다.'
    else:
        label = 'VALID · 별도 승인 image/post skip1'
        expectation = '예상: 프리롤 영상은 실제 진행 3초 후 현재 광고만 스킵, 다음 이미지는 1초부터 스킵. 미드롤은 스킵 없음, 포스트롤은 1초 후 스킵.'
    html = (template.replace('__VARIANT_LABEL__', label)
            .replace('__EXPECTATION__', expectation)
            .replace('__VARIANT__', variant)
            .replace('__VIDEO_ID__', video_id))
    create(QA / f'{stem}.html', html)
    create(PUBLIC / f'{stem}.html', html)

print('Created requested/valid HTML + raw JSON in QA and approved public ux-review-* paths.')
