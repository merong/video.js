# 2026-10-20 커밋 전 검증

사용자가 Claude takeoff 문서와 기존 작업의 commit/push를 요청해 실행한 검사다. 10월 18일 브라우저 검증을 오늘 다시 실행한 것으로 집계하지 않는다.

## 저장 범위

- 광고 패키지와 PHP 관리자, 예제, 테스트, 관련 workspace 설정.
- C0·인터뷰·오케스트레이션·검증 계획.
- Grok 원본 영상 11개, manifest, 브라우저 캡처 및 원본 증거, Claude takeoff 문서.
- 이 디렉터리의 명시적으로 선택한 검사 로그. 기존 private 설정·DB·업로드·세션 파일은 포함하지 않는다.
- 생성된 `dist/`, 관리자에 복사한 player assets와 `public/demo-media/`는 기존 ignore 정책을 유지한다.

`origin`은 읽기 권한만 있는 공식 `videojs/video.js`다. 기존 포크 `merong/video.js`의 ADMIN 권한을 확인하고 `fork` remote를 추가했다. 작업 브랜치는 `feat/vod-ads-plugin`이며 기존 main을 변경하지 않는다. 원격 게시 결과는 최종 Git ref를 조회해 확인한다.

## 실제 검사

아래 명령은 저장소 루트에서 실행했다. pnpm 명령 접두사는 모두 `mise exec node@24.14.0 -- corepack pnpm@12.6.0`다.

| 검사 | 결과 | 원본 |
| --- | --- | --- |
| `exec vp run @videojs/ads#build` | exit 0; 33/33 Vite+ cache hit | [build.log](build.log) |
| `-F @videojs/ads test` | 7 files, **150/150** | [ads-tests.log](ads-tests.log) |
| `typecheck` | exit 0; task graph 34/35 cache hit, 최종 `tsgo --build` cache disabled | [typecheck.log](typecheck.log) |
| `exec vp test run --config integrations/ads-manager/tests/admin/vite.config.ts` | 6 files, **59/59** | [admin-tests.log](admin-tests.log) |
| `php integrations/ads-manager/tests/backend/run.php` | 격리 **SQLite 70** assertions | [backend-tests.log](backend-tests.log) |
| `python3 integrations/ads-manager/tests/backend/http_test.py` | 임시 port에서 실제 **HTTP 110** assertions | [backend-http.log](backend-http.log) |
| `check:workspace` | **11 passed, 0 failed** | [workspace-check.log](workspace-check.log) |
| PHP 파일별 `php -l` | **24개** syntax PASS | [php-lint.log](php-lint.log) |
| `exec vp check --no-lint --no-error-on-unmatched-pattern packages/extensions/ads integrations/ads-manager commitlint.config.js pnpm-lock.yaml tsconfig.json` | 선택된 **45개** format PASS | [format.log](format.log) |
| `exec vp lint packages/extensions/ads integrations/ads-manager/public/assets/admin integrations/ads-manager/tests/admin` | exit 0 | [lint.log](lint.log) |
| `exec vp check --no-error-on-unmatched-pattern vite.config.ts commitlint.config.js tsconfig.json` | format 3개, lint 2개 PASS | [root-check.log](root-check.log) |
| 직접 Oxlint: examples의 `context.js`, `example.js`, `grok.js` | 3개 실제 선택 확인, exit 0. 기본 규칙 검사이며 repo의 examples 제외 결과와 구분 | [examples-lint.log](examples-lint.log), [선택 파일](examples-lint-files.log) |
| HTTP 페이지 4개 및 dist/served/HTTP 번들 동일성 | 4개 200; 79,134 bytes, SHA-256 일치 | [http-bundle-check.json](http-bundle-check.json) |
| Grok 원본 manifest 대조 | **11개** 파일 SHA-256·크기 일치 | [media-integrity.json](media-integrity.json) |

직접 Oxlint 명령은 `exec ./node_modules/.pnpm/node_modules/.bin/oxlint --no-ignore` 뒤에 세 파일을 명시했다. `--debug files`로 선택 목록을 따로 확인했다. 루트의 `pnpm exec oxlint`는 실행 파일을 찾지 못해 사용하지 않았다.

`mise WARN missing: pnpm@12.6.0`가 출력되지만 명시한 Corepack pnpm 명령은 위 종료 코드와 결과로 확인했다. 경고를 없애려고 패키지나 환경을 변경하지 않았다.

## 원본 보존 및 포함 검토

- 기능 커밋 전 staged diff의 whitespace 검사 통과. hook 실행 뒤 소스 86개 파일의 bytes가 직전 검사 상태와 같았다.
- JSON 48개를 parse했다. Grok 파일마다 manifest의 크기·SHA-256을 대조했다.
- 과거 증거·미디어 105개 파일의 로컬 SHA-256 기준을 저장하고 evidence 커밋 후 변경 0개를 확인했다. 이 수에는 기존 ignore 로그 등 로컬 보존 파일도 포함되며 Git 추가 파일 수와는 다르다.
- raw JSON fixture·manifest·브라우저 증거를 자동 포맷하지 않도록 `vite.config.ts`의 도구 제외 경로에 `workspaces/ads-*/**`를 추가했다. 제품 코드 검사 범위는 유지했다. Git hook을 끄지 않았다.
- 이 디렉터리의 `.gitattributes`는 원본 로그의 끝 빈 줄을 유지하도록 `*.log -whitespace`만 설정한다. takeoff 문서의 불필요한 끝 공백은 제거했다.
- 검토 대상 비추적 파일에서 private key/GitHub token/provider key/URL credential 패턴을 검사했다. 유일한 URL credential 일치는 `tests/admin/model.test.ts`의 `example.test` 거부 테스트였으며 실제 자격 증명이 아니다. 선택한 검사 로그에서도 해당 비밀 값 패턴은 발견되지 않았다. 이는 전용 보안 감사 전체를 의미하지 않는다.
- takeoff 문서의 상대 파일 링크가 실제 파일로 연결되는지 확인했다.

## 오늘 실행하지 않은 항목

실제 브라우저 광고 재생, 관리자 로그인/수정, MySQL/GnuBoard 전체 행렬, Safari/iOS/Android, 실제 음향·장시간 background/stall, 고객 배포는 오늘 실행하지 않았다. 과거 결과는 [UX1 보고서](../ads-ux-20261018/review.md)와 [Grok 보고서](../ads-grok-demo-20261018/README.md)의 날짜·번들·검증 범위를 따른다.
