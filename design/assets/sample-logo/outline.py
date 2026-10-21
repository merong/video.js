"""Build the sample logo SVGs with every letter as an outline path (no font needed at view time).

Usage: python3 outline.py <font.otf> <wordmark.svg> <emblem.svg>
The font is Noto Sans CJK KR Bold (SIL OFL 1.1); only its Latin glyphs are used.
"""

import sys

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

# design/tokens.json light values, raw because an image cannot read CSS variables.
ON_DARK = "#F4F4F5"  # on-dark
DARK = "#18181A"  # dark
ACCENT = "#CDF352"  # accent


def run(font, text, size, x, baseline, tracking=0.0):
    """Return (path d, width) for text set at size px, left edge x, on baseline."""
    glyphs = font.getGlyphSet()
    cmap = font.getBestCmap()
    scale = size / font["head"].unitsPerEm
    pen = SVGPathPen(glyphs, ntos=lambda v: f"{v:.1f}".rstrip("0").rstrip("."))
    cursor = 0.0
    for i, ch in enumerate(text):
        name = cmap[ord(ch)]
        glyphs[name].draw(TransformPen(pen, (scale, 0, 0, -scale, x + cursor, baseline)))
        cursor += glyphs[name].width * scale
        if i < len(text) - 1:
            cursor += tracking * size
    return pen.getCommands(), cursor


def centered(font, text, size, cx, baseline, tracking=0.0):
    _, width = run(font, text, size, 0, baseline, tracking)
    return run(font, text, size, cx - width / 2, baseline, tracking)[0]


def wordmark(font):
    name, name_w = run(font, "DEMO STORE", 52, 128, 70, 0.02)
    tag, tag_w = run(font, "SAMPLE LOGO", 21, 130, 104, 0.2)
    width = round(128 + max(name_w, tag_w) + 12)
    mark = centered(font, "D", 54, 56, 79)
    return f"""<!--
  Sample player logo (ads-a2e-spec 5.5): a made-up store, not a real brand. "SAMPLE LOGO" marks it as test art.
  Built by design/assets/sample-logo/outline.py; letters are outline paths, so no font is needed.
  Colors are design/tokens.json light values, raw because an image cannot read CSS variables:
  on-dark (letters), dark (outline that keeps the letters visible on light scenes), accent (round mark).
-->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} 120" width="{width}" height="120" role="img" aria-label="DEMO STORE 샘플 로고">
  <g stroke="{DARK}" stroke-opacity="0.85" stroke-width="8" stroke-linejoin="round" paint-order="stroke">
    <circle cx="56" cy="60" r="44" fill="{ACCENT}" />
    <path fill="{ON_DARK}" d="{name}" />
    <path fill="{ON_DARK}" d="{tag}" />
  </g>
  <path fill="{DARK}" d="{mark}" />
</svg>
"""


def emblem(font):
    mono = centered(font, "DS", 168, 256, 290, 0.01)
    tag = centered(font, "SAMPLE", 40, 256, 366, 0.2)
    return f"""<!--
  Source for public/examples/sample-logo.png (ads-a2e-spec 5.5): a square emblem for a made-up store.
  The outer ring is half transparent so the PNG shows whether alpha survives. Built by outline.py.
  Colors are design/tokens.json light values: accent (disc), dark (letters, half-clear ring), on-dark (thin ring).
-->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <circle cx="256" cy="256" r="248" fill="{DARK}" fill-opacity="0.45" />
  <circle cx="256" cy="256" r="222" fill="none" stroke="{ON_DARK}" stroke-opacity="0.6" stroke-width="8" />
  <circle cx="256" cy="256" r="200" fill="{ACCENT}" />
  <path fill="{DARK}" d="{mono}" />
  <path fill="{DARK}" fill-opacity="0.7" d="{tag}" />
</svg>
"""


if __name__ == "__main__":
    font_path, wordmark_out, emblem_out = sys.argv[1:4]
    font = TTFont(font_path)
    with open(wordmark_out, "w") as f:
        f.write(wordmark(font))
    with open(emblem_out, "w") as f:
        f.write(emblem(font))
