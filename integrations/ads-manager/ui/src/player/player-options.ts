/**
 * Option reference rows for the `#/players/options` screen. `tests/player-options.test.ts` compares the names with the
 * ads package, the skin guide, the loader and the demo pages so rows cannot go missing or outlive their source, and
 * `tests/admin/examples.test.ts` keeps the public help table (`public/examples/options.js`) the same.
 */

export interface PlayerOptionRow {
  readonly name: string;
  readonly type: string;
  readonly defaultValue: string;
  /** 해요체 description. */
  readonly description: string;
  /** Preset field path that sets this option, when a preset can. */
  readonly presetField?: string;
  /** `stable`: documented public API. `preview`: the ads package and examples, internal while integration continues. */
  readonly status: 'stable' | 'preview';
}

export interface PlayerOptionGroup {
  readonly id: 'loaderData' | 'element' | 'controller' | 'controllerMethods' | 'skinCss' | 'adsCss' | 'exampleQuery';
  readonly title: string;
  /** 해요체 caution shown with the whole table. */
  readonly note?: string;
  /** Where the rows come from. */
  readonly source: string;
  readonly rows: readonly PlayerOptionRow[];
}

const loaderData: PlayerOptionGroup = {
  id: 'loaderData',
  title: '자리 요소 data-* 속성',
  note: '로더(player/loader.js)가 읽어요. 잘못된 값은 그 속성만 무시하고 콘솔에 경고를 남겨요. JS API 옵션이 data-*보다, data-*가 프리셋보다 앞서요.',
  source: 'integrations/ads-manager/public/player/loader.js',
  rows: [
    {
      name: 'data-solad-player',
      type: '있음',
      defaultValue: '없음(필수)',
      description: '로더가 플레이어를 만들 자리예요. 한 페이지에 여러 개 둘 수 있고, 나중에 넣은 요소도 만들어요.',
      status: 'preview',
    },
    {
      name: 'data-video-id',
      type: '문자열, 128자 이하',
      defaultValue: '없음(필수)',
      description:
        '편성과 통계에 쓰는 고정 영상 ID예요. 없거나 제어 문자가 있으면 그 자리만 건너뛰고 solad-error를 보내요.',
      status: 'preview',
    },
    {
      name: 'data-src',
      type: '/경로 또는 http(s):// 주소',
      defaultValue: '없음(필수)',
      description: '본편 주소예요. 경로가 .m3u8로 끝나면 HLS로 재생해요. 상대 경로는 받지 않아요.',
      status: 'preview',
    },
    {
      name: 'data-poster',
      type: '/경로 또는 http(s):// 주소',
      defaultValue: '없음',
      description: '포스터 이미지예요. 보일지는 프리셋의 포스터 표시가 정해요.',
      presetField: 'display.poster',
      status: 'preview',
    },
    {
      name: 'data-title',
      type: '글자',
      defaultValue: '없음',
      description: '영상 제목이에요. 보일지는 프리셋의 제목 표시가 정하고, 기본 video에서는 보이지 않아요.',
      presetField: 'display.title',
      status: 'preview',
    },
    {
      name: 'data-thumbnails',
      type: 'WebVTT 주소',
      defaultValue: '없음',
      description: '탐색 막대에 띄울 미리보기 이미지 목록이에요. Video.js 플레이어에서만 써요.',
      status: 'preview',
    },
    {
      name: 'data-captions',
      type: 'WebVTT 주소',
      defaultValue: '없음',
      description:
        '자막 파일이에요. 플레이어 화면 언어의 자막으로 붙이고 처음에는 꺼 둬요. 자막 버튼은 프리셋의 자막이 정하고, Video.js 플레이어에서만 써요.',
      status: 'preview',
    },
    {
      name: 'data-autoplay',
      type: 'true | false',
      defaultValue: '프리셋 값, 없으면 false',
      description: '자동재생이에요. 켜면 늘 음소거로 시작해요.',
      presetField: 'playback.autoplay',
      status: 'preview',
    },
    {
      name: 'data-muted',
      type: 'true | false',
      defaultValue: '프리셋 값, 없으면 false',
      description: '음소거로 시작해요. 자동재생이 켜져 있으면 false여도 음소거로 시작하고 콘솔에 경고를 남겨요.',
      presetField: 'playback.muted',
      status: 'preview',
    },
    {
      name: 'data-loop',
      type: 'true | false',
      defaultValue: '프리셋 값, 없으면 false',
      description: '끝나면 처음부터 다시 재생해요. 반복할 때 포스트롤은 나오지 않고 미드롤은 첫 회에만 나와요.',
      presetField: 'playback.loop',
      status: 'preview',
    },
    {
      name: 'data-preload',
      type: 'none | metadata | auto',
      defaultValue: '프리셋 값, 없으면 metadata',
      description: '재생 전에 영상을 얼마나 미리 받을지예요.',
      presetField: 'playback.preload',
      status: 'preview',
    },
    {
      name: 'data-lang',
      type: 'ko | en | ja | zh-CN',
      defaultValue: '프리셋 값, 없으면 자리 요소부터 위로 찾은 lang',
      description:
        '플레이어 화면 언어예요. 페이지 lang은 ko·en·ja·zh-CN으로 맞추고 그 밖은 영어로 보여요. 광고 문구는 늘 한국어예요.',
      presetField: 'language',
      status: 'preview',
    },
    {
      name: 'data-lecture',
      type: '/경로 또는 http(s):// 주소',
      defaultValue: '없음',
      description: '강의 자료 매니페스트(JSON) 주소예요. 강의 프리셋에서만 쓰고, 없으면 패널에 진도 줄만 보여요.',
      status: 'preview',
    },
    {
      name: 'data-learner-token',
      type: '문자열, 1024자 이하',
      defaultValue: '없음',
      description:
        '사이트의 LMS가 학습자마다 서명한 토큰이에요. 맞으면 진도와 메모를 서버에 저장하고, 없거나 틀리면 이 브라우저에만 저장해요.',
      status: 'preview',
    },
    {
      name: 'data-engine',
      type: 'spf | hlsjs',
      defaultValue: 'spf',
      description: 'HLS를 재생할 엔진이에요. Video.js 플레이어에서 .m3u8 주소일 때만 써요.',
      status: 'preview',
    },
    {
      name: 'data-solad-manual',
      type: '있음',
      defaultValue: '없음',
      description: '자동으로 만들지 않아요. JS API의 mount로만 만들어요.',
      status: 'preview',
    },
  ],
};

const element: PlayerOptionGroup = {
  id: 'element',
  title: '<media-ads> 속성',
  source: 'packages/extensions/ads/src/html/element.ts',
  rows: [
    {
      name: 'for',
      type: '요소 id',
      defaultValue: '없음(필수)',
      description: '광고를 붙일 본편 미디어 요소의 id예요. 같은 플레이어 안의 요소를 가리켜야 해요.',
      status: 'preview',
    },
    {
      name: 'src',
      type: 'URL',
      defaultValue: '없음(필수)',
      description:
        '편성 주소예요. raw 편성 JSON이나 관리자 API 응답({ok, data})을 받아요. http(s):// 주소나 /로 시작하는 경로만 받고 상대 경로는 거부해요. 편성 요청 시간 제한은 5초로 고정돼요.',
      status: 'preview',
    },
    {
      name: 'video-id',
      type: '문자열',
      defaultValue: '없음(필수)',
      description: '편성과 통계에 쓰는 고정 영상 ID예요. 편성의 videoId와 같아야 광고가 붙어요.',
      status: 'preview',
    },
    {
      name: 'lang',
      type: 'ko | en',
      defaultValue: '<media-ads>부터 위로 찾은 lang, 없으면 영어',
      description:
        '광고 화면 문구 언어예요. 로더와 설치 코드는 늘 ko를 넣어서 광고 문구는 플레이어 언어와 상관없이 한국어예요.',
      status: 'preview',
    },
    {
      name: 'skip-label',
      type: '글자',
      defaultValue: '광고 건너뛰기',
      description: '건너뛰기 버튼 문구예요.',
      presetField: 'ads.labels.skip',
      status: 'preview',
    },
    {
      name: 'skip-countdown-label',
      type: '글자, {seconds}',
      defaultValue: '{seconds}초 후 건너뛰기',
      description: '건너뛰기를 기다리는 동안 보이는 문구예요. {seconds}에 남은 초가 들어가요.',
      presetField: 'ads.labels.skipCountdown',
      status: 'preview',
    },
    {
      name: 'timer-label',
      type: '글자, {elapsed} {duration} {remaining}',
      defaultValue: '{elapsed} / {duration}',
      description:
        '광고 시간 표시 문구예요. {elapsed}(지난 시간), {duration}(길이), {remaining}(남은 시간)을 쓸 수 있어요.',
      presetField: 'ads.labels.timer',
      status: 'preview',
    },
    {
      name: 'media-alt',
      type: '글자',
      defaultValue: '소재의 대체 텍스트, 없으면 광고 / Advertisement',
      description:
        '모든 광고 소재의 대체 텍스트를 이 값으로 덮어써요. 소재마다 입력한 대체 텍스트가 가려지므로 프리셋에서는 설정하지 않아요.',
      status: 'preview',
    },
  ],
};

const controller: PlayerOptionGroup = {
  id: 'controller',
  title: 'createAdsController 옵션',
  source: 'packages/extensions/ads/src/dom/controller.ts',
  rows: [
    {
      name: 'media',
      type: 'HTMLMediaElement',
      defaultValue: '없음(필수)',
      description: '광고를 붙일 본편 미디어 요소예요.',
      status: 'preview',
    },
    {
      name: 'container',
      type: 'HTMLElement',
      defaultValue: '없음(필수)',
      description: '광고 화면을 올릴 요소예요. 본편을 감싸고 position이 지정된 요소를 넘겨요.',
      status: 'preview',
    },
    {
      name: 'schedule',
      type: '편성 객체',
      defaultValue: '없음(필수)',
      description: '편성 API 응답의 schedule이에요. 형식이 맞지 않으면 광고 없이 본편만 재생해요.',
      status: 'preview',
    },
    {
      name: 'tracking',
      type: '추적 정보 객체',
      defaultValue: '없음',
      description: '편성 응답에서 schedule을 뺀 나머지예요. 있으면 광고 이벤트를 수집 API로 보내요.',
      status: 'preview',
    },
    {
      name: 'preview',
      type: 'boolean',
      defaultValue: 'false',
      description: 'true면 수집 요청을 보내지 않아요. 관리자 미리보기에서 써요.',
      status: 'preview',
    },
    {
      name: 'onEvent',
      type: '(event) => void',
      defaultValue: '없음',
      description: '광고 시작·완료·건너뜀·클릭·오류·중단을 관측할 때마다 불려요.',
      status: 'preview',
    },
    {
      name: 'timeouts.loadSeconds',
      type: '초(0 초과 60 이하)',
      defaultValue: '5',
      description:
        '광고 소재를 불러오고 재생을 시작하기까지 기다리는 시간이에요. 범위 밖 값은 오류 없이 기본값으로 바뀌어요. 프리셋은 기본 video에서만 1–60초 정수로 정해요. <media-ads>에는 이 옵션이 없어요.',
      presetField: 'ads.timeouts.loadSeconds',
      status: 'preview',
    },
    {
      name: 'timeouts.stallSeconds',
      type: '초(0 초과 120 이하)',
      defaultValue: '10',
      description:
        '광고 영상이 멈췄을 때 다음 순서로 넘어가기 전까지 기다리는 시간이에요. 범위 밖 값은 오류 없이 기본값으로 바뀌어요. 프리셋은 기본 video에서만 1–120초 정수로 정해요.',
      presetField: 'ads.timeouts.stallSeconds',
      status: 'preview',
    },
    {
      name: 'ui.locale',
      type: '언어 코드',
      defaultValue: 'container부터 위로 찾은 lang, 없으면 영어',
      description: '광고 화면 문구 언어예요. 로더와 설치 코드는 늘 ko를 넘겨서 광고 문구는 한국어예요.',
      status: 'preview',
    },
    {
      name: 'ui.labels',
      type: '문구 객체',
      defaultValue: '한국어 패키지 문구',
      description:
        '광고 화면 문구를 바꿔요. 프리셋에서는 광고 문구 16개를 정하고, 비운 문구는 한국어 기본 문구예요. mediaAlt는 소재 대체 텍스트를 덮어써서 프리셋에서 정하지 않아요.',
      presetField: 'ads.labels',
      status: 'preview',
    },
  ],
};

const controllerMethods: PlayerOptionGroup = {
  id: 'controllerMethods',
  title: 'createAdsController 반환 메서드',
  source: 'packages/extensions/ads/src/dom/controller.ts',
  rows: [
    {
      name: 'destroy()',
      type: '() => void',
      defaultValue: '—',
      description: '광고를 끝내고 화면과 이벤트 연결을 정리해요. 페이지를 떠날 때(pagehide) 불러 주세요.',
      status: 'preview',
    },
    {
      name: 'updateUI(ui)',
      type: '(ui) => void',
      defaultValue: '—',
      description: '편성을 다시 받지 않고 광고 화면 언어와 문구를 바꿔요. 빈 객체를 넘기면 기본값으로 돌아가요.',
      status: 'preview',
    },
  ],
};

const skinCss: PlayerOptionGroup = {
  id: 'skinCss',
  title: '스킨 CSS 속성',
  source: 'site/src/content/docs/guides/customize-skins.mdx',
  rows: [
    {
      name: '--media-accent-color',
      type: '색',
      defaultValue: '흰색 oklch(1 0 0)',
      description:
        '슬라이더 채움, 강조된 컨트롤과 메뉴, 주요 동작의 색이에요. 광고 화면의 음량 막대도 이 색을 이어받아요. 초점 테두리는 Video.js 스킨 안에서 흰색(--media-ring)으로 고정돼 바뀌지 않아요.',
      presetField: 'theme.accentColor',
      status: 'stable',
    },
    {
      name: '--media-accent-text-color',
      type: '색',
      defaultValue: '자동 대비, contrast-color() 미지원 브라우저는 검정',
      description:
        '강조색 위 글자와 아이콘 색이에요. Chrome 147, Firefox 146, Safari 26 미만은 검정으로 고정되니 어두운 강조색이면 함께 정해 주세요.',
      presetField: 'theme.accentTextColor',
      status: 'stable',
    },
    {
      name: '--media-border-color',
      type: '색',
      defaultValue: 'rgb(0 0 0 / .1)',
      description:
        '플레이어 둘레의 가는 선 색이에요. 8자리로 투명도를 줄 수 있고 #00000000이면 선이 없어요. 내장 프리셋 "플랫"은 선이 없어요.',
      presetField: 'theme.borderColor',
      status: 'stable',
    },
    {
      name: '--media-border-radius',
      type: '길이',
      defaultValue: '28px',
      description:
        '플레이어 모서리 둥글기예요. 광고 화면 모서리도 따라가요. 내장 프리셋 "플랫"은 0px, "둥근 테두리"는 12px예요.',
      presetField: 'theme.borderRadius',
      status: 'stable',
    },
    {
      name: '--media-font-family',
      type: '글꼴 목록',
      defaultValue: '"Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
      description:
        '플레이어 글꼴이에요. 바꾸면 광고 화면 글꼴도 따라가요. Inter는 페이지가 불러와야 보여요. 프리셋에서는 시스템 글꼴만 고를 수 있어요.',
      presetField: 'theme.fontFamily',
      status: 'stable',
    },
    {
      name: '--media-object-fit',
      type: 'object-fit',
      defaultValue: 'contain',
      description:
        '영상과 포스터를 플레이어에 채우는 방식이에요. 전체화면에서는 항상 contain이에요. 광고 소재는 이 값과 상관없이 contain이에요.',
      presetField: 'theme.objectFit',
      status: 'stable',
    },
    {
      name: '--media-object-position',
      type: 'object-position',
      defaultValue: 'center',
      description: '영상과 포스터가 다 채우지 않을 때의 위치예요. 프리셋에서는 설정하지 않아요.',
      status: 'stable',
    },
    {
      name: '--media-scale-unit',
      type: '길이',
      defaultValue: '16px',
      description:
        '컨트롤 간격, 아이콘, 글자 크기의 기준이에요. 1rem이면 문서 글자 크기를 따라요. 광고 화면에는 영향이 없어요.',
      presetField: 'theme.scaleUnit',
      status: 'stable',
    },
  ],
};

const adsCss: PlayerOptionGroup = {
  id: 'adsCss',
  title: '광고 화면 CSS 속성',
  note: '광고 패키지 내부 속성이라 바뀔 수 있어요. 스킨 요소나 광고 컨테이너에 넣어요. <media-ads>에 직접 넣으면 효과가 없어요.',
  source: 'packages/extensions/ads/src/dom/overlay.styles.ts',
  rows: [
    {
      name: '--ads-accent-color',
      type: '색',
      defaultValue: '--media-accent-color, 없으면 #fff',
      description: '광고 음량 막대 색만 바꿔요. 건너뛰기 버튼과 초점 테두리는 바뀌지 않아요.',
      presetField: 'ads.accentColor',
      status: 'preview',
    },
    {
      name: '--ads-skip-radius',
      type: '길이',
      defaultValue: '6px',
      description: '건너뛰기 버튼 모서리 둥글기예요.',
      presetField: 'ads.skipRadius',
      status: 'preview',
    },
    {
      name: '--ads-font-size',
      type: '길이',
      defaultValue: '13px',
      description: '광고 화면 글자 크기예요. 컨테이너 폭 280px 이하에서는 11px로 고정돼요.',
      presetField: 'ads.fontSize',
      status: 'preview',
    },
    {
      name: '--ads-font-family',
      type: '글꼴 목록',
      defaultValue: '--media-font-family, 없으면 system-ui',
      description:
        '광고 화면 글꼴이에요. 플레이어 글꼴(--media-font-family)을 지정했으면 그것을 따라가요. 둘 다 비우면 플레이어는 스킨 글꼴(Inter 우선)을, 광고 화면은 system-ui를 써요.',
      status: 'preview',
    },
    {
      name: '--ads-color',
      type: '색',
      defaultValue: '--media-foreground, 없으면 #fff',
      description: '광고 화면 글자와 아이콘 색이에요.',
      status: 'preview',
    },
    {
      name: '--ads-background',
      type: '색',
      defaultValue: '#000',
      description: '광고 소재 뒤 바탕색이에요.',
      status: 'preview',
    },
    {
      name: '--ads-radius',
      type: '길이',
      defaultValue: '스킨 모서리(--media-border-radius, 기본 28px), 스킨 밖이면 0',
      description: '광고 화면 모서리 둥글기예요.',
      status: 'preview',
    },
    {
      name: '--ads-inset',
      type: '길이',
      defaultValue: '12px',
      description: '광고 표시와 컨트롤의 바깥 여백이에요.',
      status: 'preview',
    },
    {
      name: '--ads-scrim',
      type: '배경',
      defaultValue: '아래쪽 어두운 그러데이션',
      description: '컨트롤 뒤 어둡게 깔리는 배경이에요.',
      status: 'preview',
    },
    {
      name: '--ads-control-size',
      type: '길이',
      defaultValue: '--media-control-size, 없으면 36px',
      description: '광고 컨트롤 버튼의 최소 크기예요.',
      status: 'preview',
    },
    {
      name: '--ads-control-radius',
      type: '길이',
      defaultValue: '--media-control-radius: 스킨 안에서 99px(알약 모양), 스킨 밖에서는 8px',
      description: '광고 컨트롤 버튼 모서리 둥글기예요.',
      status: 'preview',
    },
    {
      name: '--ads-button-background',
      type: '색',
      defaultValue: '반투명 검정(#0005)',
      description: '광고 컨트롤 버튼 바탕색이에요.',
      status: 'preview',
    },
    {
      name: '--ads-hover-background',
      type: '색',
      defaultValue: '반투명 흰색(#ffffff26)',
      description: '포인터를 올렸을 때 버튼과 링크 바탕색이에요.',
      status: 'preview',
    },
    {
      name: '--ads-focus-color',
      type: '색',
      defaultValue: '--media-ring(Video.js 스킨은 흰색 oklch(1 0 0)) → --media-accent-color, 없으면 #fff',
      description:
        '키보드 초점 테두리 색이에요. Video.js 스킨 안에서는 --media-ring이 있어서 강조색을 바꿔도 흰색이에요.',
      status: 'preview',
    },
  ],
};

const exampleQuery: PlayerOptionGroup = {
  id: 'exampleQuery',
  title: '데모·재생 테스트 페이지 쿼리',
  note: '데모(examples/index.html)는 고른 프리셋과 바꾼 옵션을 주소에 담아요. 재생 테스트(examples/play-test.html)는 preset·video·type·content·media·engine만 읽어요. 잘못된 값은 무시하고 안내 한 줄을 남겨요.',
  source: 'integrations/ads-manager/public/examples',
  rows: [
    {
      name: 'preset',
      type: '프리셋 id',
      defaultValue: '없음(사이트 적용 프리셋)',
      description:
        '고를 프리셋이에요. 재생 테스트에서 플레이어 종류와 다른 프리셋이거나 불러오지 못하면 이유를 보여 주고 기본값으로 재생해요.',
      status: 'preview',
    },
    {
      name: 'video',
      type: '문자열',
      defaultValue: 'video-1',
      description:
        '재생 테스트에서 재생할 고정 영상 ID예요. 실제 게시 편성을 불러오고 통계를 보내요. 그누보드에서는 게시판:글번호:영상키 형식이에요.',
      status: 'preview',
    },
    {
      name: 'type',
      type: 'videojs | native',
      defaultValue: 'videojs',
      description: '재생 테스트의 플레이어 종류예요.',
      status: 'preview',
    },
    {
      name: 'content',
      type: 'http(s):// 주소',
      defaultValue: '../demo-media/content.mp4(HLS는 content-master.m3u8)',
      description: '재생 테스트의 본편 주소예요. 페이지 기준으로 해석하니 절대 주소로 넘겨 주세요.',
      status: 'preview',
    },
    {
      name: 'media',
      type: 'mp4 | hls',
      defaultValue: 'mp4',
      description: '본편 형식이에요. 데모의 MP4는 Grok 샘플이에요. 기본 video의 HLS 지원은 브라우저마다 달라요.',
      status: 'preview',
    },
    {
      name: 'engine',
      type: 'spf | hlsjs',
      defaultValue: 'spf',
      description: 'Video.js에서 HLS를 재생할 엔진이에요. media=hls일 때만 써요.',
      status: 'preview',
    },
    {
      name: 'autoplay',
      type: 'true | false',
      defaultValue: '프리셋 값',
      description: '데모에서 프리셋 대신 쓸 자동재생이에요. 켜면 음소거가 켜진 채 잠겨요.',
      presetField: 'playback.autoplay',
      status: 'preview',
    },
    {
      name: 'muted',
      type: 'true | false',
      defaultValue: '프리셋 값',
      description: '데모에서 프리셋 대신 쓸 음소거예요.',
      presetField: 'playback.muted',
      status: 'preview',
    },
    {
      name: 'loop',
      type: 'true | false',
      defaultValue: '프리셋 값',
      description: '데모에서 프리셋 대신 쓸 반복 재생이에요.',
      presetField: 'playback.loop',
      status: 'preview',
    },
    {
      name: 'preload',
      type: 'none | metadata | auto',
      defaultValue: '프리셋 값',
      description: '데모에서 프리셋 대신 쓸 미리 받기예요.',
      presetField: 'playback.preload',
      status: 'preview',
    },
    {
      name: 'language',
      type: "'' | ko | en | ja | zh-CN",
      defaultValue: '프리셋 값',
      description: '데모에서 프리셋 대신 쓸 플레이어 언어예요. 빈 값이면 언어를 비워 페이지 언어를 따라요.',
      presetField: 'language',
      status: 'preview',
    },
    {
      name: 'pageLang',
      type: 'ko | en | ja | zh-CN',
      defaultValue: 'ko',
      description: '데모에서 language가 비었을 때 따를 페이지 언어예요.',
      status: 'preview',
    },
    {
      name: 'poster',
      type: 'true | false',
      defaultValue: '프리셋 값',
      description: '데모에서 프리셋 대신 쓸 포스터 표시예요.',
      presetField: 'display.poster',
      status: 'preview',
    },
    {
      name: 'posterUrl',
      type: '/경로 또는 http(s):// 주소',
      defaultValue: '없음',
      description: '데모 플레이어의 포스터 주소예요.',
      status: 'preview',
    },
    {
      name: 'title',
      type: 'true | false',
      defaultValue: '프리셋 값',
      description: '데모에서 프리셋 대신 쓸 제목 표시예요. 기본 video에서는 쓰지 않아요.',
      presetField: 'display.title',
      status: 'preview',
    },
    {
      name: 'titleText',
      type: '글자',
      defaultValue: '없음',
      description: '데모 플레이어의 영상 제목이에요.',
      status: 'preview',
    },
    {
      name: 'thumbnails',
      type: 'WebVTT 주소',
      defaultValue: '없음',
      description: '데모 플레이어의 탐색 막대 미리보기 이미지 목록이에요. Video.js 플레이어에서만 써요.',
      status: 'preview',
    },
    {
      name: 'seekButtons',
      type: "'' | 5 | 10 | 15 | 30",
      defaultValue: '프리셋 값',
      description:
        '데모에서 프리셋 대신 쓸 이전·이후 버튼의 건너뛰는 폭(초)이에요. 빈 값이면 버튼을 숨겨요. 기본 video에서는 쓰지 않아요.',
      presetField: 'controls.seekButtons',
      status: 'preview',
    },
    {
      name: 'captions',
      type: 'true | false',
      defaultValue: '프리셋 값',
      description: '데모에서 프리셋 대신 쓸 자막 버튼이에요. 끄면 단축키 c도 꺼져요. 기본 video에서는 쓰지 않아요.',
      presetField: 'controls.captions',
      status: 'preview',
    },
    {
      name: 'captionsUrl',
      type: 'WebVTT 주소',
      defaultValue: '없음',
      description:
        '데모 플레이어의 자막 파일이에요. 설치 코드에는 data-captions로 들어가요. Video.js 플레이어에서만 써요.',
      status: 'preview',
    },
    {
      name: 'logo',
      type: 'sample-svg | sample-png | custom | /경로 또는 http(s):// 주소',
      defaultValue: '없음',
      description:
        '데모에서 미리 볼 로고 이미지예요. 프리셋 값이 아닌 미리보기 전용 입력(preview.logo)이라 설치 코드에는 들어가지 않아요. custom은 주소를 넣기 전이라 이미지가 없어요. 기본 video에서는 쓰지 않아요.',
      status: 'preview',
    },
    {
      name: 'logoPosition',
      type: 'top-left | top-right | bottom-left | bottom-right',
      defaultValue: '프리셋 값',
      description: '데모에서 프리셋 대신 쓸 로고 위치예요. logo를 골랐을 때만 쓰고, 기본 video에서는 쓰지 않아요.',
      presetField: 'logo.position',
      status: 'preview',
    },
    {
      name: 'logoWidth',
      type: 'px(24 이상 240 이하 정수)',
      defaultValue: '프리셋 값',
      description: '데모에서 프리셋 대신 쓸 로고 너비예요. logo를 골랐을 때만 쓰고, 기본 video에서는 쓰지 않아요.',
      presetField: 'logo.width',
      status: 'preview',
    },
    {
      name: 'logoOpacity',
      type: '%(10 이상 100 이하 정수)',
      defaultValue: '프리셋 값',
      description: '데모에서 프리셋 대신 쓸 로고 불투명도예요. logo를 골랐을 때만 쓰고, 기본 video에서는 쓰지 않아요.',
      presetField: 'logo.opacity',
      status: 'preview',
    },
    {
      name: 'logoMargin',
      type: 'px(0 이상 48 이하 정수)',
      defaultValue: '프리셋 값',
      description:
        '데모에서 프리셋 대신 쓸 로고와 가장자리 사이 간격이에요. logo를 골랐을 때만 쓰고, 기본 video에서는 쓰지 않아요.',
      presetField: 'logo.margin',
      status: 'preview',
    },
    {
      name: 'logoHref',
      type: "'' | http(s):// 주소",
      defaultValue: '프리셋 값',
      description:
        '데모에서 프리셋 대신 쓸 로고 링크예요. 빈 값이면 링크를 비워요. 대체 텍스트(logoAlt나 프리셋 값)가 없으면 링크 없이 이미지만 보여요. logo를 골랐을 때만 쓰고, 기본 video에서는 쓰지 않아요.',
      presetField: 'logo.href',
      status: 'preview',
    },
    {
      name: 'logoAlt',
      type: "'' | 글자, 80자 이하",
      defaultValue: '프리셋 값',
      description:
        '데모에서 프리셋 대신 쓸 로고 대체 텍스트예요. 빈 값이면 비워요. 로고 링크는 대체 텍스트가 있어야 쓰여요. logo를 골랐을 때만 쓰고, 기본 video에서는 쓰지 않아요.',
      presetField: 'logo.alt',
      status: 'preview',
    },
    {
      name: 'logoHideDuringAds',
      type: 'true | false',
      defaultValue: '프리셋 값',
      description:
        '데모에서 프리셋 대신 쓸 광고 중 로고 숨김이에요. logo를 골랐을 때만 쓰고, 기본 video에서는 쓰지 않아요.',
      presetField: 'logo.hideDuringAds',
      status: 'preview',
    },
    {
      name: 'logoHideWithControls',
      type: 'true | false',
      defaultValue: '프리셋 값',
      description:
        '데모에서 프리셋 대신 쓸 컨트롤과 함께 로고 숨김이에요. 컨트롤이 숨을 때 로고도 숨겨요. logo를 골랐을 때만 쓰고, 기본 video에서는 쓰지 않아요.',
      presetField: 'logo.hideWithControls',
      status: 'preview',
    },
  ],
};

/** Option reference tables, in screen order. */
export const playerOptions: readonly PlayerOptionGroup[] = [
  loaderData,
  element,
  controller,
  controllerMethods,
  skinCss,
  adsCss,
  exampleQuery,
];

/**
 * The loader's JS API (`mount`) as copyable example code for `loaderUrl`, the manager's `player/loader.js`. It leaves
 * out `preset`, which the admin does not offer (spec decision 28).
 */
export function loaderApiExample(loaderUrl = '/ads/player/loader.js'): string {
  return [
    `import { mount } from ${JSON.stringify(loaderUrl).replace(/</g, '\\u003c')};`,
    '',
    "const handle = await mount(document.getElementById('player'), {",
    "  videoId: 'notice:12:main',",
    "  src: '/media/intro.mp4',",
    "  poster: '/media/intro.jpg',",
    "  title: '회사 소개 영상',",
    '  overrides: { playback: { autoplay: true } },',
    '  onEvent(event) {}, // ads-event의 detail',
    '  onError(error) {}, // { code, message }',
    '});',
    '',
    'handle.player; // <video-player> 또는 <video>',
    'handle.destroy();',
  ].join('\n');
}
