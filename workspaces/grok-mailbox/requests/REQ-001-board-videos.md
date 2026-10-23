---
id: REQ-001
status: answered
to: grok
created: 2026-10-23
---

# 게시판 예제 영상 2편: 10초 클립 7개씩, 720p

## 배경

GnuBoard 동영상 갤러리 게시판에 올릴 예제 영상입니다. 각 영상은 10초 클립 7개를 이어 붙인 70초짜리입니다. 이어 붙이기와 HLS 변환은 이쪽(orchestrator)에서 하므로 grok은 클립만 만들면 됩니다.

같은 내용을 Grok CLI(`grok -p`)로 시도했을 때 영상 생성 단계에서 ZDR 오류가 났습니다. 첫 장면 PNG는 그때 일부 만들어 두었습니다.

## grok에게 보낼 내용

게시판 예제 영상 2편에 쓸 10초 클립을 만들어 주세요. 이어 붙이기는 우리가 하니 클립만 저장하면 됩니다.

- 기획서: `~/Downloads/grok/camping/brief.txt`("숲속 캠핑의 하루"), `~/Downloads/grok/lake/brief.txt`("호수의 사계절"). 공통 규칙은 `~/Downloads/grok/common.txt`이며, 그중 "최종본 합성", "poster.jpg"는 하지 않아도 됩니다.
- 클립 설정: reference_to_video, 16:9, 10초, 720p. 컷마다 `shots/shot-0N.png`를 first_frame으로 씁니다.
- 이미 있는 첫 장면은 그대로 다시 씁니다.
  - camping: `shot-01, 04, 05, 06.png` 있음. `shot-02, 03, 07.png`만 새로 만듭니다(주전자·텐트에 글자나 상표가 없게, 카누 컷 5는 끝 프레임 위치를 달리해 이동을 고정).
  - lake: `reference.png`, `shot-01 ~ 07.png` 모두 있음.
- 저장: `~/Downloads/grok/<camping|lake>/shots/shot-01.mp4 ~ shot-07.mp4`, 그리고 같은 폴더에 `manifest.json`(`[{"n","file","prompt","duration_s","width","height","fps","regenerated"}]`, 값은 ffprobe로).
- 순서: lake 컷 1 하나를 먼저 만들어 보고, ZDR·저장소·업그레이드 오류가 나면 다른 생성은 하지 말고 즉시 멈춘 뒤 오류 문구를 그대로 알려 주세요. 문제없으면 lake 나머지 → camping 순서로 진행합니다.
- 사람 얼굴 클로즈업, 실존 인물, 상표·로고, 화면 속 글자는 넣지 않습니다. 모더레이션에 막히면 우회하지 말고 장면을 바꿉니다.
- `~/Downloads/grok/` 밖의 파일은 만들거나 고치지 않습니다.

## 받을 것

- 클립 14개 경로와 각 길이·해상도
- 다시 만든 컷과 이유
- 실패했다면 오류 문구 원문
