# @videojs/ads

Optional JSON-driven VOD advertising for the Video.js 10.1.0 workspace. This package is private and its APIs are internal while integration is under development.

- `@videojs/ads`: runtime-neutral schedule parser, immutable contracts and scheduler.
- `@videojs/ads/dom`: imperative browser controller; no element registration.
- `@videojs/ads/html`: `MediaAdsElement` class without registration.
- `@videojs/ads/define`: registers `<media-ads>` if the name is available.
- `dist/cdn/ads.js`: self-contained ESM browser bundle, registers the element and exports `createAdsController`. Serve the built file yourself; no published CDN URL is assumed. It does not include the player or its skin.

## HTML setup

Serve the module and a resolved v1 schedule over HTTP. `src` accepts a raw schedule or the manager's `{ok:true,data:{schedule,...tracking}}` response. The schedule's `videoId` must match `video-id`.

```html
<script type="module" src="/assets/ads.js"></script>
<div style="position:relative;aspect-ratio:16/9">
  <video id="content" controls playsinline src="/content.mp4" style="width:100%;height:100%"></video>
  <media-ads for="content" src="/schedule.json" video-id="video-1"></media-ads>
</div>
```

Inside a Video.js player, place the element under that player and target its content media explicitly. The binding uses the player's internal extension/container contexts, including a skin's shadow container. Keep player and ads versions aligned. Duplicate registration keeps the first element class; it does not negotiate incompatible versions.

## Imperative setup and preview

```js
import { createAdsController } from '@videojs/ads/dom';

const response = await fetch('/api/index.php?action=schedule&videoId=video-1');
if (!response.ok) throw new Error('Schedule request failed');
const payload = await response.json();
if (!payload.ok) throw new Error('Schedule unavailable');
const { schedule, ...tracking } = payload.data;
const controller = createAdsController({
  media: document.querySelector('#content'),
  container: document.querySelector('#content').parentElement,
  schedule,
  tracking,
  onEvent: (event) => console.log(event.type, event.itemId),
});

window.addEventListener('pagehide', () => controller.destroy(), { once: true });
```

For manager preview, pass the preview response's `schedule` with `preview:true`; omit tracking. Preview still invokes `onEvent` but never sends collector requests. Construction waits for content play; it does not autoplay paused content. A source replacement/reload invalidates an imperative controller: recreate it with freshly resolved data. HTML performs a fresh request. Same-session replay and unchanged HTML reconnect preserve consumed breaks.

Preroll runs before any initially reserved midroll. Forward seek runs one earliest unconsumed crossed break; other missed breaks require another crossing. Skip advances only the current ad. Postroll takes precedence at actual ended and does not restart content. Image/GIF display time accumulates after load while visible and unpaused; pausing its clock does not freeze GIF animation.

The element emits `ads-event` observations and local `ads-error` diagnostics. Malformed schedules fail open without invented ad identifiers. Tracking uses bounded batches/retries and one bounded final keepalive attempt on teardown; delivery is best effort. Request/load defaults to five seconds and video stall to ten seconds. Ready media paused by the user or blocked on autoplay waits for explicit Play.

## Advertising controls and language

Creatives fill the frame with `object-fit: contain`. The ad indicator and controls sit over a scrim, so wrapping controls does not resize the creative. Play/pause, mute, volume, advertiser link and current-ad skip operate only on the active ad. The timer shows elapsed/total; video duration remains `–:––` until metadata is available. Loading, paused and blocked states use a separate live status that does not announce every clock tick.

English is the fallback. The nearest nonempty `lang` on the element/container or its composed ancestors selects Korean for `ko`/`ko-*`, otherwise English. Changes to those language attributes update the current ad. The HTML binding also supports the v10 text overrides:

```html
<div lang="ko">
  <!-- Place the content media and media-ads in the same player/container. -->
  <media-ads for="content" src="/schedule.json" video-id="video-1"
    skip-label="광고 건너뛰기"
    skip-countdown-label="{seconds}초 후 건너뛰기"
    timer-label="남은 시간 {remaining}"
    media-alt="광고 소재"></media-ads>
</div>
```

`timer-label` accepts `{elapsed}`, `{duration}` and `{remaining}` as formatted `m:ss` values. `media-alt` explicitly overrides the creative's alt text; without it the creative's alt text wins. All overrides are plain text. Removing an override restores its default. Other HTML control/state labels follow the inherited language; the imperative API below allows individual overrides for all labels.

Imperative controllers accept `ui: { locale?, labels? }`. Update it during an ad without fetching another schedule or changing the media, clock, IDs or consumed history:

```js
const controller = createAdsController({ media, container, schedule, ui: { locale: 'ko' } });
controller.updateUI({ locale: 'en', labels: { skip: 'Continue', timer: '{elapsed} / {duration}' } });
controller.updateUI({}); // Clear overrides and inherit the container's language again.
```

`updateUI` replaces the presentation options. `AdsUIOptions` and `AdsLabels` are internal type exports from `@videojs/ads/dom`. Templates also include `sequence` (`{index}`, `{count}`) and `skipCountdown` (`{seconds}`). Other keys name controls and states: `advertisement`, `playPause`, `mute`, `volume`, `advertiser`, `newWindow`, `skip`, `mediaAlt`, `loading`, `paused`, `blocked`, `enterFullscreen`, `exitFullscreen`, `fullscreenError`.

With focus inside the ad, `K` toggles playback, `M` toggles mute, `F` toggles supported container fullscreen, and Up/Down adjust volume. `Escape` exits the current container fullscreen, including from the volume slider; it never enters fullscreen or changes playback. Space activates the focused button normally or toggles playback on the ad surface. Native range Arrow/Home/End keys retain their volume behavior. Seek shortcuts cannot seek the ad or content. Tab remains normal page navigation; covered content controls are inert. Focus moves to Play when a focused CTA/skip becomes unavailable, and returns to the original connected content control after teardown.

Fullscreen is exposed only when the container API is enabled. It never falls back to content-video-only/native presentation, which could hide the ad. Browser permission failures leave playback running. Safari and physical-device fullscreen require separate browser verification.

Theme values inherit the current skin with standalone fallbacks. Set package overrides on a common player/container ancestor: `--ads-font-family`, `--ads-font-size`, `--ads-color`, `--ads-background`, `--ads-radius`, `--ads-control-size`, `--ads-control-radius`, `--ads-focus-color`, `--ads-accent-color`, `--ads-inset`, `--ads-scrim`, `--ads-button-background`, `--ads-hover-background`, `--ads-skip-radius`. The overlay host has `data-ad-state="loading|playing|paused|blocked"`; its shadow parts are `panel`, `creative`, `media`, `status`, `controls`, `timer`, `play`, `mute`, `volume`, `cta`, `skip`, and `fullscreen`. These styling hooks are internal during integration. Ad video stays inside its own shadow root to avoid content-media discovery conflicts.

## Workspace checks

Run from the repository root after workspace dependencies are linked:

```sh
pnpm exec vp run @videojs/ads#build
pnpm -F @videojs/ads test
pnpm exec tsgo --project packages/extensions/ads/tsconfig.json --noEmit
```

The shared wire fixture is `integrations/ads-manager/contract/playback-v1.json`. Unit tests cover parser, scheduler, DOM lifecycle and HTML binding with simulated media observations. They do not prove actual decoding, HLS playback, fullscreen, browser focus behavior or server persistence. React, live, VAST/IMA and PiP/Cast ad playback are outside this version's supported scope. No deployment is performed by these commands.
