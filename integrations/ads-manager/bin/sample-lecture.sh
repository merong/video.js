#!/usr/bin/env bash
# Build the sample lecture media from the tracked slides (ads-lms-spec 4): `public/demo-media/lecture/lecture.mp4`
# (8 slides x 10 s, 1280x720 H.264, silent) and `slides.pdf`. Needs `rsvg-convert` and `ffmpeg` with libx264; this
# ffmpeg has no SVG decoder, so the slides become PNG first.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
slides="$root/public/examples/lecture"
out="$root/public/demo-media/lecture"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

for tool in rsvg-convert ffmpeg; do
  command -v "$tool" >/dev/null || { echo "$tool 이 필요해요." >&2; exit 1; }
done

mkdir -p "$out"

: > "$work/list.txt"
for svg in "$slides"/slide-0[1-8].svg; do
  png="$work/$(basename "$svg" .svg).png"
  rsvg-convert -w 1280 -h 720 -b white "$svg" -o "$png"
  printf "file '%s'\nduration 10\n" "$png" >> "$work/list.txt"
done
# The concat demuxer drops the last duration unless the last file is listed once more.
printf "file '%s'\n" "$png" >> "$work/list.txt"

ffmpeg -hide_banner -loglevel error -y -f concat -safe 0 -i "$work/list.txt" \
  -vf "fps=25,format=yuv420p" -c:v libx264 -preset veryfast -crf 23 -g 50 -an -movflags +faststart \
  -t 80 "$out/lecture.mp4"

rsvg-convert -f pdf -w 1280 -h 720 "$slides"/slide-0[1-8].svg -o "$out/slides.pdf"

echo "만들었어요: $out/lecture.mp4, $out/slides.pdf"
