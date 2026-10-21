# A2-E 광고 전용 스킨 조사 (ads-source-analyst, 2026-10-21)

- 임시 기록. `ads-a2e-spec.md` 3절 구현의 근거다. 오케스트레이터 결정은 맨 아래 "결정" 절에 있다.

## 조사 보고

결론부터 말하면, VJSC 빌드를 `integrations/` 경로로 돌리는 길은 `packages/` 수정 없이는 막혀 있습니다. 대신 **`packages/` 변경 없이, 새 빌드 없이** 만들 수 있는 방법이 있어 그것을 추천합니다. 이미 빌드된 `<video-skin>` 클래스를 런타임에 상속하고 템플릿을 고치는 방식입니다. 브라우저 동작은 하나도 확인하지 않았습니다.

### 1. Q5: 빌드 경로

**지금 자산이 만들어지는 경로**
- `public/assets/videojs/`는 `packages/cdn`의 빌드 결과를 복사한 것입니다. `cmp`로 비교한 결과 `video.js`와 `video.css` 모두 `packages/cdn/`의 파일과 같습니다.
- `video.js`는 i18n, 플레이어, `<video-skin>`을 묶은 것입니다(`packages/cdn/src/video.ts:1-3`).
- 빌드 순서와 명령은 아래와 같습니다. 복사 명령의 근거는 `.agents/plans/ads-admin-player-facts.md:38-42`입니다.
  1. `@videojs/skins#generate`(`vp -C build pack`, `packages/skins/vite.config.ts:25-26`)
  2. `@videojs/html#build`(`packages/html/vite.config.ts:107-109`)
  3. `@videojs/cdn#build:cdn`(`packages/cdn/vite.config.ts:223-224`)
  4. rsync로 복사
- `public/assets/videojs/`는 Git에서 무시됩니다(`A/.gitignore:4`).

**VJSC 빌드를 `integrations/`로 돌릴 수 있는가: `packages/` 수정 없이는 안 됩니다.**
- 소스 루트와 수집 범위가 `packages/skins/src`로 고정되어 있습니다(`skins/build/config.ts:8-14`).
- 스킨 이름은 `skins/<theme>/<preset>/skin.tsx` 경로에서 만들어집니다(`config.ts:39-40`).
- 스킨 목록 `skinStyles`는 닫힌 맵이고, theme도 4개 값으로 제한됩니다(`skins/src/meta.ts:16-20,30-`).
- 출력 경로가 `packages/html/src/internal/skins`로 고정되어 있습니다(`skins/build/packages/html.ts:14-15`, `skins/vite.config.ts:7-20`).
- React 출력과 CDN 프리셋 목록(`cdn/vite.config.ts:31-53`)도 모든 스킨을 대상으로 합니다.
- 이 길로 가려면 최소한 다음을 고쳐야 합니다.
  - `meta.ts`에 스킨 추가
  - `skins/src/skins/solad/video/` 추가
  - html 프리셋·정의 추가
  - CDN 프리셋 목록 추가
  - React 출력 제외 처리
- 공개 패키지에 제품 전용 스킨이 들어가므로 6.1절의 "packages/skins에 넣지 않는다"와 어긋납니다. **추천하지 않습니다.**

**빌드된 템플릿을 복사해 손으로 고치는 방식(대안 B): 비용이 큽니다.**
- 대상은 `internal/skins/default-video/template.ts`(18KB)와 `skin.css`(99KB)입니다.
- 템플릿의 id가 해시(`vjs-t8h5QXcn-0-3-trigger`)라 원본을 다시 생성할 때마다 바뀝니다.
- 따로 번들러를 돌리면 CDN의 공유 청크와 런타임이 따로 생깁니다. `media/hls-video.js`와 같은 core 인스턴스를 쓴다는 보장도 없습니다.
- 결국 손으로 쓴 템플릿을 그대로 들고 가는 것이라 대안 C보다 나은 점이 없습니다.

**추천안: 대안 C, 런타임 하위 클래스**
- `SkinElement`는 생성자에서 `this.constructor.template`과 `styles`를 읽어 그림자 트리를 만듭니다(`html/src/presets/skin.ts:30-46`). 따라서 하위 클래스가 `static template`만 바꿔도 됩니다.
- CDN 묶음은 클래스를 내보내지 않습니다(`cdn/vite.config.ts:120-121`). 하지만 `video.js`를 불러온 뒤 `customElements.get('video-skin')`으로 클래스를 받을 수 있습니다. 이 클래스는 npm에서는 공개 export입니다(`html/src/presets/video/index.ts`).
- `<media-seek-button>` 정의는 CDN의 `ui/seek-button.js`를 import하면 되고, 같은 빌드의 공유 청크를 씁니다. 이 파일은 지금 `public/assets/videojs/ui/seek-button.js`에도 있습니다.
- 원본을 따라가는 비용이 낮습니다. CDN을 다시 빌드하면 스킨 본체는 자동으로 원본을 따릅니다. 깨질 수 있는 곳은 선택자 몇 개뿐입니다.

### 2. 자막 버튼

**트랙이 없을 때 지금 모습: 숨겨집니다.**
- 상태는 `availability: 'unavailable'`, `disabled: true`, `hidden: true`이고 처음부터 이 값입니다(`core/src/core/ui/captions-button/core.ts:41-50,84-93`).
- `hidden` 속성이 실제로 붙습니다(`html/src/ui/media-button-element.ts:156-165`).
- 함께 붙는 속성은 `data-availability="unavailable"`, `data-hidden`, `aria-disabled="true"`입니다(`captions-button/data.ts`).
- 스킨 CSS의 `:where(.media-skin) [hidden][hidden]{display:none !important}`가 실제로 숨깁니다(`default-video/skin.css:71-73`).

**"자막 없음" 비활성 버튼으로 보이게 하는 방법(`packages/` 수정 없음)**
- **보이기:** 솔애드 스킨 CSS에 아래 규칙을 넣습니다. 좁은 폭 규칙을 지키려면 반드시 `@container` 안에 두어야 합니다.
  ```css
  @container media-root (width >= 32rem) {
    .video-controls-captions-button[hidden][data-availability="unavailable"] { display: grid !important }
  }
  ```
  - `.media-button`의 원래 표시값은 `grid`입니다(skin.css:153).
- **이미 되어 있는 것:**
  - 비활성 모양(`opacity .5`, `cursor: not-allowed`)이 있습니다(skin.css:172-174).
  - `tabIndex 0`은 비활성이어도 유지되어 초점을 받습니다(`core/src/dom/ui/button.ts:28`).
  - 버튼을 눌러도 아무 일이 없습니다(`html/src/ui/captions-button/element.ts:55-63`).
- **이름과 툴팁:** 버튼 요소의 `label` 속성에 함수를 넣습니다.
  - 넣을 함수: `s => s.availability === 'unavailable' ? {key:'solad.captionsUnavailable', text:'No captions'} : ''`
  - 함수 label은 지원됩니다(`core/src/core/ui/utils/resolve-label.ts:9-13`).
  - 툴팁도 같은 값을 씁니다(`tooltip/element.ts:249-250` → `getResolvedLabel`).
  - 툴팁은 버튼이 `aria-disabled`여도 열립니다. 툴팁 자신의 `disabled`만 봅니다(`core/src/dom/ui/tooltip/tooltip.ts:147,158`).

**`c` 단축키**
- 묶이는 곳은 `<media-hotkey keys="c" action="toggleSubtitles">`입니다(`skins/src/skins/shared/video/behaviors/hotkeys.tsx:14`).
- 끄는 방법은 그 요소에 `disabled`를 주는 것입니다(`html/src/ui/hotkey/element.ts:17`).
- 트랙이 없으면 이미 아무 일도 하지 않습니다.
  - 동작 자체가 없음: `core/src/dom/store/features/text-track.ts:81`
  - 상태 표시 없음: `status-indicator/status.ts:55`
  - 화면 읽기 안내 없음: `status-announcer/status.ts:21`

**설정 메뉴의 자막 항목**
- 항목 위치는 `<media-menu-item>`(그 안에 `media-text token="menu.captions"`)과 다음 `media-menu-content`입니다. 소스는 `shared/video/menus/settings-menu.tsx:17`입니다.
- 트랙이 없으면 이미 숨겨집니다(`html/src/ui/menu/element.ts:269`).
- **CSS만으로 숨기면 안 됩니다.** 메뉴의 방향키 탐색은 `hidden`, `data-hidden`, `aria-hidden` 속성만 보고 항목을 거릅니다(`core/src/dom/ui/menu/menu.ts:147-157`).
- 연결 뒤에 `hidden`을 붙이면 메뉴가 덮어씁니다. 첫 동기화 때만 원래 숨김 상태를 기억하기 때문입니다(`menu/content.ts:300,311`).
- **추천:** 스킨 호스트의 `connectedCallback` 안에서 해당 노드를 지웁니다. 이 콜백은 그림자 트리 안 요소보다 먼저 실행됩니다. 지울 노드는 다음과 같습니다.
  - 자막 버튼과 그 툴팁
  - 메뉴 항목과 그 내용
  - `c` 단축키 요소
- 이렇게 하면 탭 순서, 메뉴 탐색, 단축키에서 모두 빠집니다.
- 차선책은 `data-hidden` 속성과 CSS를 함께 쓰는 것입니다.

**좁은 폭 규칙과의 관계**
- 근거:
  - 폭이 32rem 미만이면 `.video-controls-captions-button{display:none}`(skin.css:2400-2404)
  - 소스는 `skins/src/styles/layout/controls.styles.ts:23-28`의 `media-max-lg:hidden`
- 위 CSS를 `@container (width >= 32rem)` 안에 두면 이 규칙이 그대로 유지됩니다.
- **영향:** 좁은 폭에서 트랙이 없으면 "자막 없음"이 어디에도 보이지 않습니다. 버튼은 숨고 메뉴 항목도 숨기 때문입니다.

### 3. ±초 버튼
- **기본 스킨의 상태:**
  - 기본 스킨에는 seek 버튼 CSS가 0줄입니다.
  - 아이콘 `seek`도 등록되어 있지 않습니다(`default-video/register.ts`).
- **부품:**
  - 스킨 부품은 `skins/src/components/buttons/seek-button.tsx:11-21`입니다.
  - 요소 `<media-seek-button seconds="±N">`는 `html/src/ui/seek-button/element.ts:13-27`에 있습니다.
  - core의 기본값은 30초입니다(`core.ts:31-33`). 그래서 `seconds`를 반드시 써야 합니다.
  - 이름은 "N초 뒤로 탐색"처럼 나오고 ko·ja·zh-CN 번역이 있습니다(`core.ts:61-65`, `locales/ko.ts:11-14`).
- **compat·scaffold의 모양:**
  - 가운데 큰 버튼 `seconds={±10}`, `tooltip={false}`입니다(`skins/scaffold/video/controls.tsx:16-31`, compat도 같음).
  - 마크업: `div.media-seek-button-content > media-icon(name=seek) + span.media-seek-button-label`
  - 숫자는 빌드 때 글자로 박힙니다.
  - CSS는 `compat-video/skin.css:825-849`에 있고, 범위를 default로 바꿔 옮기면 됩니다.
- **아이콘:** CDN은 `registerIcons`를 내보내지 않습니다. `packages/icons/src/assets/default/seek.svg`를 인라인 `<svg class="media-button-icon">`로 넣는 것을 추천합니다.
- **초 값:** `seconds` 속성과 라벨 span의 글자를 N으로 바꿉니다. 마운트할 때 정합니다.
- **두 번 탭 탐색 폭:**
  - `media-gesture[type=doubletap][action=seekStep]`에 `value`를 줍니다(`html/src/ui/gesture/element.ts:21`).
  - 왼쪽은 **음수(-N)**를 넣어야 합니다. 값을 주면 부호를 자동으로 바꾸지 않습니다(`core/src/dom/gesture/action-value.ts:17`).
  - 지금 기본값은 10입니다(`core/src/core/ui/constants.ts:6`).
- **방향키 단축키 표시:** 방향키는 값 없이 10초로 묶여 있습니다(`playback-hotkeys.tsx:13-16`). 그래서 N이 10일 때만 버튼에 ←/→ 단축키가 표시됩니다. 근거는 `scaffold/shared/seek-button.tsx:10-12`의 주석입니다. 방향키도 N으로 맞출지는 **결정이 필요합니다**.

### 4. 로더가 값을 넘기는 방법
- 로더에 이미 연결 지점이 있습니다.
  - `render.skinTag`와 `render.styles`를 씁니다(`public/player/preset.js:422-423`, `loader.js:419-433`).
  - `controls`가 바뀌면 `structure()` 값이 달라져 다시 마운트합니다(`loader.js:359-363,836`).
- 6.1절 3번의 호스트 속성안은 됩니다. 예: `seek-buttons="10"`, `captions="off"`.
- 다만 속성 변화에 즉시 반응하게 만들 필요는 없습니다. 연결할 때 한 번 읽는 방식이 메뉴 경쟁 문제가 없어 안전합니다.

### 5. 문구
- "자막 없음"에 해당하는 문자열은 없습니다.
  - 있는 것: `captions.enable`/`disable`(`locales/en.ts:19-22`)
  - `status.captionsOff`는 "자막 꺼짐"이라 뜻이 다릅니다(`locales/en.ts:70`).
- **packages에 넣는 경우:** `en.ts`와 로케일 54개를 모두 고치고 생성을 돌려야 합니다(`core/src/core/i18n/README.md`). 추천하지 않습니다.
- **추천:** 로더가 CDN의 `i18n.js`에서 `registerI18n`을 불러 4개 언어를 등록합니다.
  - `registerI18n`은 공개 export입니다(`cdn/src/i18n.ts`, `registry.ts:149-156`).
  - 레지스트리는 모든 묶음이 공유합니다(`cdn-i18n-external-plugin.ts`, `globalThis`).
  - 키 이름은 업스트림과 겹치지 않게 `solad.` 접두어를 씁니다.
  - 등록되지 않은 언어는 `text`('No captions')로 대체됩니다(`translator.ts:49`).

### 6. 캐스트·AirPlay 빼기
- 템플릿에서 `media-cast-button`, `media-airplay-button`과 각각의 `media-tooltip[trigger=<id>]`를 지우면 끝입니다. 소스 위치는 `default/video/layout/controls.tsx:46-53`입니다.
- 걸리는 의존은 없습니다.
  - 둘 다 사용할 수 없으면 이미 숨겨집니다(`airplay-button/core.ts:92`, `cast-button/core.ts:25`).
  - 그래서 실제로 달라지는 것은 Safari에서 AirPlay가 사라지는 정도입니다.
  - 정의 코드는 `video.js`에 남지만 해가 없습니다.

### 추천안 요약
- **만들 파일:** `integrations/ads-manager/public/player/solad-video-skin.js` 하나입니다(추적 대상).
  - `customElements.get('video-skin')`을 상속해 `solad-video-skin`을 정의합니다.
  - 템플릿 편집, 추가 CSS 문자열, 4개 언어 문구 등록을 담습니다.
  - 명세의 `public/assets/videojs/solad-video.*` 위치는 Git에서 무시되고 rsync가 덮어쓰는 곳이라 **바꿀 것을 제안합니다**.
- **고칠 파일:**
  - `preset.js`: `skinTag`와 `styles`
  - `loader.js`: `ui/seek-button.js`, `solad-video-skin.js` 불러오기와 호스트 속성
  - `tests/admin`: 다음 선택자가 `default-video/template.ts`에 있는지 확인하는 테스트
    - `media-captions-button.video-controls-captions-button`
    - `media-text[token="menu.captions"]`
    - `media-hotkey[keys="c"]`
    - doubletap 제스처
    - cast·airplay 버튼
- **빌드 명령:** 새로 없습니다. 기존 `pnpm exec vp run @videojs/cdn#build:cdn`과 rsync를 그대로 씁니다.
- **packages/ 변경:** 필요 없습니다.
- **원본 기록:** 기본 스킨 소스를 마지막으로 바꾼 커밋은 `6e01e66d5`(2026-09-22)이고, `@videojs/cdn`은 10.1.0입니다.

### 위험과 모르는 것
1. **`hidden` 속성을 CSS로 덮었을 때의 동작은 확인하지 않았습니다.** 보조기술에 버튼이 노출되는지를 포함합니다. 브라우저 검증이 필요합니다.
2. **잠깐 "자막 없음"이 보일 수 있습니다.** core가 처음부터 `unavailable` 상태이므로, 트랙이 보고되기 전까지 "자막 없음"이 표시되었다가 바뀝니다(`core.ts:41-50`).
3. **툴팁에 "C"가 함께 보입니다.** 트랙이 없어도 `c` 단축키가 켜져 있으면 "자막 없음" 툴팁에 단축키가 표시됩니다. 트랙이 없을 때 단축키를 끌지 결정이 필요합니다. 끄려면 버튼의 `$state`를 구독하는 JS가 필요합니다.
4. **좁은 폭(32rem 미만)에서는 "자막 없음"이 보이지 않습니다.** 명세대로라면 그대로 두고 보고하는 사항입니다.
5. **업스트림 마크업에 의존합니다.** 클래스나 태그가 바뀌면 조용히 깨질 수 있어 위의 선택자 확인 테스트가 필요합니다. 템플릿의 id는 해시이므로 선택자로 쓰면 안 됩니다.
6. **`controls.captions` 기본값이 `true`입니다.** 따라서 자막 없는 영상은 모두 비활성 버튼이 보입니다(명세 3.4절 주의 그대로).

### 실행한 것과 미실행 항목
- **실행한 검사:** 소스 읽기, grep·sed·python 문자열 추출, `cmp` 2회, `git log`/`git status` 읽기.
- **변경 파일:** 없습니다.
- **미실행:** 빌드, 설치, 테스트, 서버(18765·18766·18810), 브라우저, `/private/tmp/ads-qa-*`, `public/assets/` 쓰기는 모두 하지 않았습니다.

## 결정 (오케스트레이터, 2026-10-21)

1. 대안 C(런타임 하위 클래스)로 간다. 파일은 추적되는 `public/player/solad-video-skin.js`다. 명세 6.1절의 위치 제안(`player/skin/`, `public/assets/videojs/solad-video.*`)을 이것으로 바꾼다. `packages/`는 고치지 않는다.
2. 방향키 단축키는 바꾸지 않는다(디자인 인계 1절 "단축키는 바꾸지 않는다"). N이 10이 아니면 ±초 버튼 툴팁에 방향키가 보이지 않는 업스트림 동작을 그대로 둔다.
3. 트랙이 없을 때 "자막 없음" 툴팁에는 단축키 표시를 빼는 것을 목표로 한다. 버튼 상태 구독이 필요하면 하고, 비용이 크면 보고한다. `c`는 트랙이 없으면 이미 아무 일도 하지 않으므로 끄지 않아도 된다.
4. 좁은 폭(32rem 미만)의 자막 버튼 숨김은 업스트림 그대로 둔다. 그 폭에서는 "자막 없음"이 보이지 않는다. 사용자에게 보고한다.
5. 처음 잠깐 "자막 없음"이 보일 수 있는 문제는 로더가 `<track>`을 직접 붙이므로 브라우저에서 재고 보고한다.
6. 문구는 `registerI18n`으로 `solad.` 접두어 키를 등록한다.
