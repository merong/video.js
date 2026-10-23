# Grok 우편함

herdr `grok` 에이전트(pane `w1:p7`)에게 일을 맡길 때 쓰는 우편함입니다.

```
orchestrator(w1:p1) ──requests/──▶ grok-liaison ──herdr agent prompt──▶ grok
orchestrator        ◀──replies/─── grok-liaison ◀──herdr agent read───── grok
```

## 파일

- `requests/<ID>.md`: 맡길 일. 앞머리 `status`가 `open`이면 아직 전달 전입니다.
- `replies/<ID>.md`: grok의 답. 요약, 꼭 필요한 원문 발췌, 받은 파일 경로와 확인 결과를 적습니다.
- `log.md`: 한 줄씩 시간순 기록(`YYYY-MM-DD HH:MM <ID> <무슨 일>`).

## 상태

`open` → `sent`(grok에 전달함) → `answered`(답을 replies에 남김) 또는 `blocked`(grok이 질문·승인을 기다림, 오류로 멈춤).

## liaison 규칙

1. `requests/`에서 `status: open`인 요청을 ID 순서대로 하나씩 처리합니다.
2. 요청의 "grok에게 보낼 내용" 절만 grok에 보냅니다. 첫 줄에 `[<ID>]`를 붙이고 끝에 "끝나면 결과를 한국어로 짧게 보고해 주세요."를 덧붙입니다.
3. grok이 일하는 동안 기다렸다가 답을 읽고 `replies/<ID>.md`를 씁니다. 결과 파일이 있으면 `ls -la`와 `ffprobe`로 길이·해상도·코덱을 확인해 함께 적습니다.
4. grok이 질문하거나 승인 창에서 멈추면 대신 답하지 않습니다. 그 질문을 replies에 그대로 옮기고 `blocked`로 둡니다.
5. 요청의 `status`를 바꾸고 `log.md`에 한 줄 남깁니다.
6. grok 화면에 비밀번호·키·토큰·DSN 같은 값이 보여도 어디에도 옮겨 적지 않습니다. 이 우편함 밖의 파일은 고치지 않습니다.
