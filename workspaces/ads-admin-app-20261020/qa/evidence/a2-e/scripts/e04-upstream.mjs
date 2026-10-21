// A2-E-QA E04 comparison: the sample cue with the controls shown in the upstream <video-skin> and in <solad-video-skin>
// on two QA paste pages (same CDN build, same video and track, no ads), to tell an ad-skin change from upstream behaviour.
import { launch, newContext, save, shot, sleep } from './lib.mjs';
import { writePaste, CONTENT } from './a2.mjs';

const page = (skin) => writePaste(`a2e-cc-${skin}`, `<div style="width:818px">
<video-player><${skin}><video src="${CONTENT}" playsinline muted preload="auto"><track kind="subtitles" srclang="ko" label="한국어" src="/examples/sample-captions.vtt"></video></${skin}></video-player>
</div>`, {
  title: `A2-E-QA ${skin} captions`,
  head: `<link rel="stylesheet" href="/assets/videojs/video.css">
<script type="module">
await import('/assets/videojs/video.js');
${skin === 'solad-video-skin' ? "await import('/assets/videojs/ui/seek-button.js'); await import('/player/solad-video-skin.js');" : ''}
</script>
<style>body{margin:16px;background:#f7f7f7}</style>
`,
});

const browser = await launch();
const context = await newContext(browser, { width: 900, height: 600 });
const out = {};
for (const skin of ['video-skin', 'solad-video-skin']) {
  const p = await context.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  await p.goto(page(skin));
  await p.waitForFunction((s) => document.querySelector(s)?.shadowRoot?.querySelector('media-play-button'), skin, { timeout: 15000 });
  await p.evaluate(() => { const v = document.querySelector('video'); v.currentTime = 3.5; document.querySelector('video').textTracks[0].mode = 'showing'; });
  await sleep(500);
  await p.locator(skin).hover();
  await sleep(800);
  out[skin] = await p.evaluate((s) => {
    const v = document.querySelector('video');
    const root = document.querySelector(s).shadowRoot;
    const cont = root.querySelector('media-container');
    const pc = getComputedStyle(v, '::-webkit-media-text-track-container');
    return { controlsVisible: cont.hasAttribute('data-controls-visible'), translate: pc.translate, transform: pc.transform, varY: getComputedStyle(v).getPropertyValue('--media-caption-track-y').trim(), mode: v.textTracks[0].mode, cue: v.textTracks[0].activeCues?.[0]?.text ?? null, t: v.currentTime };
  }, skin);
  out[skin].errors = errors;
  await shot(p, `E04/upstream-compare-${skin}.png`, { clip: await p.locator(skin).boundingBox() });
  await p.close();
}
save('E04/upstream-compare.json', out);
console.log(JSON.stringify(out, null, 1));
await browser.close();
