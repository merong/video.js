# LogoUpload

로고 이미지를 고르고, 올린 파일을 확인하고, 바꾸거나 지우는 칸입니다.

- 빈 칸: `div.sa-upload[role=group][aria-labelledby][aria-describedby]` 안에 안내 문장과 "이미지 고르기" 버튼. 버튼이 숨긴 `input[type=file][accept="image/png,image/jpeg,image/webp"]`를 엽니다. 끌어다 놓기는 덤이고, 버튼만으로 모든 일을 할 수 있어야 합니다.
- 끌어다 놓는 중에는 `is-drag`, 올리는 중에는 `is-busy`와 버튼 `disabled`, 상태 문구는 StatusMessage(`sa-status`, `aria-live`)로 "올리는 중…"을 알립니다.
- 올린 뒤: `div.sa-file[role=group]`에 썸네일(`sa-file-thumb`, `dark` 바탕), 파일 이름(`sa-file-name`, 넘치면 말줄임), 형식·용량·크기(`sa-small`), "바꾸기"·"지우기" 버튼. 지우기는 `is-danger`이고 확인 없이 지운 뒤 "되돌리기"를 상태 문구에 둡니다.
- 오류는 `sa-field.is-error`로 감쌉니다. 문구는 무엇이 문제인지와 고치는 방법입니다.
  - 형식: "SVG는 올릴 수 없어요. PNG, JPEG, WebP 가운데 하나로 바꿔서 올려 주세요."
  - 용량: "파일이 512KB보다 커요(780KB). 용량을 줄여서 다시 올려 주세요."
  - 크기: "이미지가 1024px보다 커요(2048×512px). 가로·세로 모두 1024px 이하로 줄여 주세요."
- 제한은 PNG·JPEG·WebP, 512KB, 가로·세로 1024px 이하입니다(결정 28 확정). 도움말에 늘 적습니다.
- 근거: 캔버스 C(로고), 명세 6.4절.
