# 샘플 로고

데모의 "로고" 묶음에서 플레이어 로고(`logo.*`)를 시험하는 그림 두 개입니다(명세 `ads-a2e-spec.md` 5.5절). 가상의 업체 "DEMO STORE"이며 실제 회사나 상표가 아닙니다. 그림 안의 "SAMPLE"로 시험용임을 알립니다.

| 파일 | 모양 | 크기 | 쓰임 |
| --- | --- | --- | --- |
| `integrations/ads-manager/public/examples/sample-logo.svg` | 가로형 글자 로고, 배경 투명 | viewBox 487×120 | 가로로 긴 로고, 확대해도 깨지지 않는 그림 |
| `integrations/ads-manager/public/examples/sample-logo.png` | 정사각형 엠블럼, 투명 PNG, 바깥 고리 반투명 | 512×512 RGBA | 비율이 다른 로고, 알파가 살아 있는지 |

## 모양

- 글자는 모두 윤곽선(path)입니다. 보는 쪽에 글꼴이 없어도 같게 보입니다. 윤곽은 Noto Sans CJK KR Bold(SIL OFL 1.1)의 라틴 글자에서 땄습니다.
- 색은 `design/tokens.json` 라이트 값을 그대로 씁니다. 그림은 CSS 변수를 읽지 못하기 때문입니다.
  - SVG: 글자 `on-dark` #F4F4F5, 글자 둘레 `dark` #18181A(불투명도 0.85, 8px, 글자 아래에 그림), 둥근 표시 `accent` #CDF352, 그 안 글자 `dark`.
  - PNG: 원판 `accent`, 글자 `dark`(작은 "SAMPLE"은 불투명도 0.7), 가는 고리 `on-dark`(0.6), 바깥 고리 `dark`(0.45, 반투명).
- 흰 글자에 어두운 둘레를 둘러 밝은 장면과 어두운 장면 모두에서 읽힙니다. 확인한 바탕: `dark` 단색, `bg` 단색, 밝은색에서 어두운색으로 가는 그러데이션, `sample-poster.svg`.
- PNG 512px은 최대 폭 240의 2배를 넘습니다. 기본 폭 80 기준으로는 6.4배입니다. 1024px, 512KB 한도(로고 올리기 한도) 안입니다.
- SVG는 기본 폭 80에서 아래 작은 글줄이 읽히지 않습니다. 폭을 바꿔 보는 시험용이라 그대로 둡니다. 160 이상에서 읽힙니다.

## 다시 만들기

저장소 루트에서 실행합니다. `fontTools`(Python)와 `resvg`가 있어야 합니다.

```sh
python3 design/assets/sample-logo/outline.py ~/Library/Fonts/NotoSansCJKkr-Bold.otf \
  integrations/ads-manager/public/examples/sample-logo.svg \
  design/assets/sample-logo/sample-logo-emblem.svg
resvg --width 512 design/assets/sample-logo/sample-logo-emblem.svg \
  integrations/ads-manager/public/examples/sample-logo.png
```

- `outline.py`가 글자를 path로 바꿔 두 SVG를 씁니다. 가로형 SVG는 바로 공개 파일이고, 엠블럼 SVG(`sample-logo-emblem.svg`)는 PNG의 원본입니다.
- 글꼴 파일 경로는 기계마다 다릅니다. 같은 글꼴의 다른 판을 쓰면 글자 모양이 조금 달라질 수 있습니다.
- 확인: `sips -g pixelWidth -g pixelHeight -g hasAlpha integrations/ads-manager/public/examples/sample-logo.png`
