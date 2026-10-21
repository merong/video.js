"""Write the eight sample lecture slides (ads-lms-spec 4) as 1280x720 SVG.

Usage (repo root): python3 workspaces/ads-lms-20261022/design/make-slides.py integrations/ads-manager/public/examples/lecture

Text stays text (no web font, no outlines) so <img> and rsvg-convert draw it with a system Korean font.
No external references, scripts or foreignObject. The big chapter number and the time range let a viewer check
that the video, the slide panel and the chapter list agree.
"""

import sys
from html import escape
from pathlib import Path

# design/tokens.json light values, raw because an image cannot read CSS variables.
BG = "#F4F4F4"  # bg
INK = "#18181A"  # ink, dark
SUB = "#5F5F66"  # sub
LINE = "#D4D4D8"  # line-strong
ACCENT = "#CDF352"  # accent
FONT = "'Apple SD Gothic Neo', 'Noto Sans KR', 'Noto Sans CJK KR', 'Malgun Gothic', sans-serif"

COURSE = "솔애드 플레이어로 강의 올리기"
SLIDES = [
    ("들어가며", ["강의 프리셋으로 강의실을 만들어요", "본 만큼 진도가 쌓여요", "자료와 스크립트가 영상을 따라가요"]),
    ("강의 프리셋 고르기", ["관리자 플레이어 메뉴에서 ‘강의’", "강의 기능 사용을 켜요", "설치 코드에 data-lecture를 더해요"]),
    ("진도와 완료 기준", ["실제로 본 구간만 진도에 들어가요", "완료 기준(기본 90%)을 넘으면 완료", "광고 시간은 진도에 넣지 않아요"]),
    ("앞으로 건너뛰기 제한", ["‘본 곳까지만’을 고를 수 있어요", "보지 않은 구간으로는 못 가요", "뒤로는 자유, 완료하면 풀려요"]),
    ("목차와 슬라이드", ["목차에서 장을 눌러 이동해요", "슬라이드가 장면을 따라 바뀌어요", "‘영상 따라가기’로 돌아와요"]),
    ("스크립트 찾기", ["지금 문장이 강조돼요", "낱말을 검색해 장면으로 가요", "스크롤하면 자동 스크롤이 꺼져요"]),
    ("메모와 북마크", ["지금 시각에 메모를 남겨요", "북마크 버튼이나 b 키", "메모와 북마크는 시간순으로 모여요"]),
    ("정리", ["프리셋 하나로 진도와 자료까지", "서버 저장은 로그인이나 학습자 토큰", "관리자 ‘학습 진도’에서 확인해요"]),
]
SECONDS = 10


def clock(seconds):
    return f"{seconds // 60}:{seconds % 60:02d}"


def line(text, x, y):
    return (
        f'  <circle cx="{x - 24}" cy="{y - 11}" r="6" fill="{INK}" />\n'
        f'  <text x="{x}" y="{y}" font-size="34">{escape(text)}</text>'
    )


def slide(index, title, bullets):
    number = index + 1
    total = len(SLIDES)
    start = index * SECONDS
    label = f"{number}장 {title}"
    bars = []
    for i in range(total):
        fill = INK if i == index else (SUB if i < index else LINE)
        bars.append(f'<rect x="{80 + i * 141}" y="664" width="128" height="8" rx="4" fill="{fill}" />')
    body = "\n".join(line(text, 584, 356 + i * 76) for i, text in enumerate(bullets))
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" width="1280" height="720" role="img" aria-labelledby="t">
  <!-- Sample lecture slide {number}/{total} (ads-lms-spec 4), made by workspaces/ads-lms-20261022/design/make-slides.py.
       Colors are design/tokens.json light values: bg, ink, sub, line-strong, accent. -->
  <title id="t">{escape(label)}</title>
  <rect width="1280" height="720" fill="{BG}" />
  <g font-family="{FONT}" fill="{INK}">
  <text x="80" y="76" font-size="22" fill="{SUB}">{escape(COURSE)}</text>
  <text x="1200" y="76" font-size="22" fill="{SUB}" text-anchor="end">샘플 강의</text>
  <rect x="80" y="120" width="408" height="480" rx="32" fill="{INK}" />
  <text x="124" y="190" font-size="36" font-weight="700" fill="{ACCENT}">{number}장</text>
  <text x="284" y="500" font-size="300" font-weight="800" fill="{ACCENT}" text-anchor="middle">{number:02d}</text>
  <text x="124" y="564" font-size="26" fill="{BG}">{clock(start)} – {clock(start + SECONDS)}</text>
  <text x="544" y="236" font-size="64" font-weight="700">{escape(title)}</text>
  <rect x="544" y="264" width="96" height="8" rx="4" fill="{INK}" />
{body}
  <text x="80" y="640" font-size="22" fill="{SUB}">{number} / {total}</text>
  </g>
  {" ".join(bars)}
</svg>
"""


if __name__ == "__main__":
    out = Path(sys.argv[1])
    for index, (title, bullets) in enumerate(SLIDES):
        (out / f"slide-{index + 1:02d}.svg").write_text(slide(index, title, bullets), encoding="utf-8")
