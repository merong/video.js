#!/usr/bin/env bash
# 그누보드5용 솔애드 배포 zip을 만든다(sir.kr 컨텐츠몰 판매본).
#
#   integrations/ads-manager/bin/package-gnuboard.sh [버전] [--keep-demo-media]
#
# 결과: integrations/ads-manager/dist/solad-gnuboard-<버전>.zip
#   upload/  그누보드 루트에 그대로 올리는 파일(ads, extend, skin, mobile/skin, theme)
#   docs/    설치 가이드·사용 도움말(HTML)
#   README.txt
# 미리 빌드된 public/assets(관리자 화면, ads.js, Video.js CDN 파일)를 그대로 담는다. 빌드는 README의 명령으로 먼저 한다.
# 샘플 영상은 ffmpeg가 있으면 720p로 다시 인코딩해 zip을 줄인다. --keep-demo-media는 원본을 그대로 담는다.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="1.0.0"
KEEP_DEMO_MEDIA=0
for arg in "$@"; do
  case "$arg" in
    --keep-demo-media) KEEP_DEMO_MEDIA=1 ;;
    -h|--help) sed -n '2,12p' "$0"; exit 0 ;;
    *) VERSION="$arg" ;;
  esac
done
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "버전은 1.0.0 형식이어야 해요: $VERSION" >&2; exit 1; }

for required in public/assets/admin-app/admin-app.js public/assets/ads.js public/assets/videojs public/player/loader.js; do
  [[ -e "$ROOT/$required" ]] || { echo "빌드 결과가 없어요: $required (README의 자산 빌드 명령을 먼저 실행해 주세요)" >&2; exit 1; }
done

NAME="solad-gnuboard-$VERSION"
DIST="$ROOT/dist"
STAGE="$DIST/$NAME"
rm -rf "$STAGE" "$DIST/$NAME.zip"
mkdir -p "$STAGE/upload" "$STAGE/docs"
UPLOAD="$STAGE/upload"

# 1. 관리자 폴더(<그누보드>/ads). 그누보드처럼 주소가 곧 파일 경로가 되도록 public/ 안의 파일을 ads/ 바로 아래에 두고
#    (ads/setup.php, ads/index.php, ads/api, ads/assets, ads/player), 내부 폴더를 그 옆에 둔다.
#    업로드 폴더는 그누보드처럼 data/media를 쓰며, 설치 화면이 폴더와 .htaccess를 만든다.
#    개발용 라우터, 테스트, UI 소스, 로컬 설정과 QA 산출물은 뺀다.
rsync -a \
  --exclude='.DS_Store' \
  --exclude='/router.php' \
  --exclude='/media/' \
  --exclude='/demo-media/ux-review-*' \
  --exclude='/demo-media/grok-20261018/*.mp4' \
  "$ROOT/public/" "$UPLOAD/ads/"
for internal in src hosts admin database; do
  rsync -a --exclude='.DS_Store' "$ROOT/$internal" "$UPLOAD/ads/"
done
mkdir -p "$UPLOAD/ads/bin"
cp "$ROOT/bin/install.php" "$UPLOAD/ads/bin/"
cp "$ROOT/config.example.php" "$UPLOAD/ads/"
# 보안용 .htaccess(Apache). 설치와 동작은 이 파일 없이도 된다.
for internal in src hosts admin database bin; do
  cp "$ROOT/gnuboard/package/deny.htaccess" "$UPLOAD/ads/$internal/.htaccess"
done

# 2. 샘플 영상(예제 페이지의 광고 편성 데모).
GROK_SOURCE="$ROOT/public/demo-media/grok-20261018"
GROK_TARGET="$UPLOAD/ads/demo-media/grok-20261018"
for video in "$GROK_SOURCE"/*.mp4; do
  if [[ "$KEEP_DEMO_MEDIA" == 0 ]] && command -v ffmpeg >/dev/null; then
    ffmpeg -loglevel error -y -i "$video" -vf "scale=-2:720" -c:v libx264 -preset slow -crf 26 \
      -c:a aac -b:a 96k -movflags +faststart "$GROK_TARGET/$(basename "$video")"
  else
    cp "$video" "$GROK_TARGET/"
  fi
done

# 3. 그누보드 확장: extend, 게시판 스킨(PC·모바일), 테마.
mkdir -p "$UPLOAD/extend" "$UPLOAD/skin/board" "$UPLOAD/mobile/skin/board" "$UPLOAD/theme"
cp "$ROOT/gnuboard/extend/solad.extend.php" "$UPLOAD/extend/"
# *_light는 솔애드 테마가 아닌 밝은 테마용이다. solad_request_light는 있을 때만 넣는다.
SKINS=(solad_video solad_request solad_video_light)
[[ -d "$ROOT/gnuboard/skin/board/solad_request_light" ]] && SKINS+=(solad_request_light)
for skin in "${SKINS[@]}"; do
  rsync -a --exclude='.DS_Store' "$ROOT/gnuboard/skin/board/$skin" "$UPLOAD/skin/board/"
  rsync -a --exclude='.DS_Store' "$ROOT/gnuboard/skin/board/$skin" "$UPLOAD/mobile/skin/board/"
done
rsync -a --exclude='.DS_Store' "$ROOT/gnuboard/theme/solad" "$UPLOAD/theme/"

# 4. 문서.
rsync -a --exclude='.DS_Store' "$ROOT/gnuboard/package/docs/" "$STAGE/docs/"
cp "$ROOT/gnuboard/package/nginx.conf.sample" "$STAGE/docs/"
cp "$ROOT/../../LICENSE" "$STAGE/docs/LICENSE-videojs.txt"
sed "s/{{VERSION}}/$VERSION/g" "$ROOT/gnuboard/package/README.txt" > "$STAGE/README.txt"
sed "s/{{VERSION}}/$VERSION/g" "$ROOT/gnuboard/package/docs/install.html" > "$STAGE/docs/install.html"

# 5. 그누보드 주소대로 열리는 파일이 제자리에 있는지 확인한다.
for required in setup.php index.php api/index.php assets/ads.js player/loader.js src/load.php; do
  [[ -e "$UPLOAD/ads/$required" ]] || { echo "배포본에 없어요: ads/$required" >&2; exit 1; }
done
for skin in "${SKINS[@]}"; do
  for dir in skin/board mobile/skin/board; do
    [[ -f "$UPLOAD/$dir/$skin/list.skin.php" ]] || { echo "배포본에 없어요: $dir/$skin/list.skin.php" >&2; exit 1; }
  done
done
# 밝은 스킨은 dirname(__DIR__)로 같은 부모 폴더의 어두운 스킨 파일을 읽는다. PC·모바일 모두 그 파일이 있어야 한다.
for dir in skin/board mobile/skin/board; do
  for light in "$UPLOAD/$dir"/*_light; do
    while IFS= read -r included; do
      [[ -f "$UPLOAD/$dir/$included" ]] || { echo "배포본에 없어요: $dir/$included ($(basename "$light")가 읽어요)" >&2; exit 1; }
    done < <(grep -ohE "dirname\(__DIR__\)\.'/[^']+'" "$light"/*.php | sed -E "s#^dirname\(__DIR__\)\.'/##; s#'\$##")
  done
done
[[ ! -e "$UPLOAD/ads/public" && ! -e "$UPLOAD/ads/.htaccess" && ! -e "$UPLOAD/ads/media" ]] || { echo "ads/public, ads/.htaccess 또는 ads/media가 남아 있어요" >&2; exit 1; }

# 6. 문법 확인 후 압축. 파일 권한은 업로드 뒤 호스팅 기본값을 따르므로 여기서 정하지 않는다.
if command -v php >/dev/null; then
  while IFS= read -r -d '' file; do
    php -l "$file" >/dev/null || { echo "PHP 문법 오류: $file" >&2; exit 1; }
  done < <(find "$UPLOAD" -name '*.php' -print0)
fi
(cd "$DIST" && zip -qrX "$NAME.zip" "$NAME")
echo "$DIST/$NAME.zip ($(du -h "$DIST/$NAME.zip" | cut -f1))"
