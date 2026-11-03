#!/usr/bin/env bash
# 그누보드5용 솔애드 라이트 배포 zip을 만든다(sir.kr 컨텐츠몰 판매본, 플레이어 + 프리롤 광고 1개).
#
#   integrations/ads-manager/bin/package-gnuboard-lite.sh [버전]
#
# 결과: integrations/ads-manager/dist/solad-lite-gnuboard-<버전>.zip
#   upload/  그누보드 루트에 그대로 올리는 파일(extend, plugin/solad_lite, adm)
#   docs/    설치 가이드·게시판 연동 가이드(HTML)
#   README.txt
# 미리 빌드된 public/assets(ads.js, Video.js CDN 파일)에서 기본 스킨에 필요한 파일만 담는다. 빌드는 README의 명령으로 먼저 한다.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="${1:-1.0.0}"
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "버전은 1.0.0 형식이어야 해요: $VERSION" >&2; exit 1; }

for required in public/assets/ads.js public/assets/videojs/video.js public/assets/videojs/video.css; do
  [[ -e "$ROOT/$required" ]] || { echo "빌드 결과가 없어요: $required (README의 자산 빌드 명령을 먼저 실행해 주세요)" >&2; exit 1; }
done

NAME="solad-lite-gnuboard-$VERSION"
DIST="$ROOT/dist"
STAGE="$DIST/$NAME"
LITE="$ROOT/gnuboard-lite"
rm -rf "$STAGE" "$DIST/$NAME.zip"
mkdir -p "$STAGE"
UPLOAD="$STAGE/upload"
PLUGIN="$UPLOAD/plugin/solad_lite"

# 1. extend, adm, plugin 소스.
rsync -a --exclude='.DS_Store' "$LITE/upload/" "$UPLOAD/"
sed -i '' "s/define('SOLAD_LITE_VERSION', '[0-9.]*')/define('SOLAD_LITE_VERSION', '$VERSION')/" "$PLUGIN/solad_lite.lib.php"

# 2. 플레이어 자산: ads.js와 Video.js 기본 스킨(video.js, video.css)이 읽는 파일만.
mkdir -p "$PLUGIN/vendor/videojs"
cp "$ROOT/public/assets/ads.js" "$PLUGIN/vendor/"
VIDEOJS="$ROOT/public/assets/videojs"
node "$ROOT/bin/module-files.mjs" "$VIDEOJS" video.js video.css | while IFS= read -r file; do
  mkdir -p "$PLUGIN/vendor/videojs/$(dirname "$file")"
  cp "$VIDEOJS/$file" "$PLUGIN/vendor/videojs/$file"
done

# 3. 예제 영상(본편 10초, 광고 12초). ffmpeg가 있으면 720p로 줄인다.
mkdir -p "$PLUGIN/sample"
GROK="$ROOT/public/demo-media/grok-20261018"
for pair in "content-scene-01.mp4:sample-movie.mp4" "ad-earbuds-12s.mp4:sample-ad.mp4"; do
  source="$GROK/${pair%%:*}"
  target="$PLUGIN/sample/${pair##*:}"
  if command -v ffmpeg >/dev/null; then
    ffmpeg -loglevel error -y -i "$source" -vf "scale=-2:720" -c:v libx264 -preset slow -crf 27 \
      -c:a aac -b:a 96k -movflags +faststart "$target"
  else
    cp "$source" "$target"
  fi
done

# 4. 문서.
mkdir -p "$STAGE/docs"
rsync -a --exclude='.DS_Store' "$LITE/docs/" "$STAGE/docs/"
cp "$ROOT/gnuboard/package/docs/docs.css" "$STAGE/docs/"
cp "$ROOT/../../LICENSE" "$STAGE/docs/LICENSE-videojs.txt"
sed "s/{{VERSION}}/$VERSION/g" "$LITE/README.txt" > "$STAGE/README.txt"
sed -i '' "s/{{VERSION}}/$VERSION/g" "$STAGE"/docs/*.html

# 5. 문법 확인 후 압축.
if command -v php >/dev/null; then
  while IFS= read -r -d '' file; do
    php -l "$file" >/dev/null || { echo "PHP 문법 오류: $file" >&2; exit 1; }
  done < <(find "$UPLOAD" -name '*.php' -print0)
fi
(cd "$DIST" && zip -qrX "$NAME.zip" "$NAME")
echo "$DIST/$NAME.zip ($(du -h "$DIST/$NAME.zip" | cut -f1))"
