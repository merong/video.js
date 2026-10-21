# 관리자 UI 검증

저장소 루트에서 기존 도구만 사용합니다. 별도 SPA 빌드나 의존성 설치는 없습니다.

```sh
php -l integrations/ads-manager/admin/index.php
mise exec node@24.14.0 -- corepack pnpm@12.6.0 exec vp test run --config integrations/ads-manager/tests/admin/vite.config.ts
```

`admin.test.ts`는 PHP가 렌더링한 실제 화면을 jsdom에서 읽고, 명시적인 C0 API 응답 fixture로 폼·상태·요청을 검사합니다. `preview.test.ts`의 플레이어는 import/preview 플래그/destroy 연결만 확인하는 테스트 대역입니다. 둘 다 실제 인증·DB 저장·업로드·광고 재생의 증거는 아닙니다.

`playback-status.test.ts`는 전달된 미디어·광고 이벤트에 대한 상태 표시와 종료 후 알림 차단을 검사합니다. `examples.test.ts`는 `public/examples/`의 데모 쿼리 읽기·쓰기, 설치 코드가 관리자 `loaderSnippet`과 같은지, `options.js`와 관리자 `playerOptions`·프리셋 규칙·도움말 앵커의 일치, 재생 테스트 쿼리와 실제 `play-test.html` 전환 링크, 미리보기 프레임의 메시지 출처 검사·명령·샘플 없음 처리를 검사합니다. `loader.test.ts`는 로더의 미리보기 모드(수집 요청 없음)를 검사합니다. 재생 이벤트는 이 UI의 입력 fixture이며 실제 재생·광고 전환·모바일 배치·전체화면을 검증한 결과가 아닙니다.

실제 호스트는 `$adsPage['apiUrl']`을 제공한 뒤 `admin/index.php`를 include합니다. 주소는 C0의 `/api/index.php` 형태이며 하위 설치 경로를 유지해 `/assets/admin/` 자산을 찾습니다. 나머지 설정은 `bootstrap` 응답만 사용합니다.

통합 시 확인할 항목:

- 로그인/세션 만료 후 재로그인, 권한 거부, CSRF 회전, 독립 설치·그누보드 분기.
- 실제 URL/업로드 저장·재조회·새 소재 버전·보관 및 업로드 한도 오류.
- 사이트/게시판/분류/영상 상속, 전체 대체, 비활성화, 동시 편집 충돌과 게시본 유지.
- 실제 콘텐츠 URL과 게시 전 편성의 프리/미드/포스트 광고 재생, 스킵, 모달 종료·재실행, 운영 이벤트 미수집.
- 실제 수집 통계의 기간·광고·영상·게시판 필터 및 같은 조건의 CSV.
- 키보드 순서 편집, 모달 포커스 복귀, 오류 안내, 모바일 표 스크롤과 레이아웃.
