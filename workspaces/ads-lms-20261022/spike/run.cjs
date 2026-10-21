// TASK L-1-SPIKE runner: node run.cjs <scenario> [browser]. Writes evidence/<scenario>-<browser>.json (+ screenshots).
const path = require('node:path');
const fs = require('node:fs');
const pw = require('/Users/brian/works/tools/videojs/video.js/node_modules/.pnpm/playwright@1.59.1/node_modules/playwright');

const BASE = 'http://127.0.0.1:18791';
const EVIDENCE = path.join(__dirname, 'evidence');
const scenario = process.argv[2];
const engine = process.argv[3] ?? 'chromium';
const result = { scenario, engine, startedAt: new Date().toISOString(), steps: [] };

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function open(browser, query) {
  const page = await browser.newPage({ viewport: { width: 900, height: 620 } });
  const errors = [];

  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) errors.push(`${message.type()}: ${message.text().slice(0, 300)}`);
  });
  await page.goto(`${BASE}/spike/page.html?${query}`);
  await page.waitForFunction(() => window.__lms?.ready, null, { timeout: 20000 });
  await page.waitForFunction(() => window.__lms.state()?.duration > 0, null, { timeout: 20000 });
  await wait(300);
  page.errors = errors;
  return page;
}

/** Snapshot of the seek-related state, the slider thumb position and LMS counters. */
const snap = (page) =>
  page.evaluate(() => {
    const l = window.__lms;
    const s = l.state();
    const slider = l.slider;
    const thumb = slider.querySelector('media-slider-thumb');
    const sr = slider.getBoundingClientRect();
    const tr = thumb.getBoundingClientRect();
    const r = (v) => Math.round(v * 1000) / 1000;

    return {
      media: r(l.media.currentTime),
      store: r(s.currentTime),
      seeking: s.seeking,
      mediaSeeking: l.media.seeking,
      paused: l.media.paused,
      rate: l.media.playbackRate,
      allowed: r(l.lms.allowed),
      thumbPct: r(((tr.left + tr.width / 2 - sr.left) / sr.width) * 100),
      expectPct: r((l.media.currentTime / s.duration) * 100),
      fillVar: getComputedStyle(slider).getPropertyValue('--media-slider-fill').trim(),
      counts: { ...l.lms.counts },
    };
  });

const logSince = (page, from) => page.evaluate((from) => window.__lms.log.slice(from), from);
const logLength = (page) => page.evaluate(() => window.__lms.log.length);

async function step(page, name, action, settle = 1200) {
  const from = await logLength(page);
  const before = await snap(page);
  let error = null;

  try {
    await action();
  } catch (e) {
    error = String(e).slice(0, 300);
  }

  await wait(settle);

  const after = await snap(page);
  const events = (await logSince(page, from)).filter((e) => /^media:(seeking|seeked|ratechange)|seek-blocked|rate|bookmark|safety|ads-event/.test(e.type));
  const entry = { name, before, after, events, error };

  result.steps.push(entry);
  console.log(`${name}: media ${before.media}→${after.media} store ${after.store} seeking ${after.seeking} thumb ${after.thumbPct}% (expect ${after.expectPct}%) events ${events.map((e) => e.type).join(',')}${error ? ` ERROR ${error}` : ''}`);
  return entry;
}

async function sliderBox(page) {
  return page.evaluate(() => {
    const r = window.__lms.slider.getBoundingClientRect();
    return { x: r.left, y: r.top, width: r.width, height: r.height };
  });
}

async function showControls(page) {
  const box = await sliderBox(page);
  await page.mouse.move(box.x + box.width / 2, box.y - 120);
  await wait(200);
}

async function focusPlay(page) {
  await page.locator('media-play-button').first().focus();
}

const scenarios = {
  // Item 1 + 2: extension registration and every seek path against the clamp.
  async seek(browser, query = 'watched=10') {
    const page = await open(browser, query);

    result.registered = await page.evaluate(() => window.__lms.registered());
    result.facade = await page.evaluate(() => {
      const l = window.__lms;
      const media = l.player.store.target?.media;
      return { storeMediaIsReal: media === l.media, overrideNow: Boolean(l.lms.override()) };
    });

    await step(page, 'store.seek(30)', () => page.evaluate(() => window.__lms.state().seek(30)));
    await step(page, 'store.seek(3)', () => page.evaluate(() => window.__lms.state().seek(3)));

    await showControls(page);
    const box = await sliderBox(page);
    await step(page, 'slider drag 10%→80%', async () => {
      await page.mouse.move(box.x + box.width * 0.1, box.y + box.height / 2);
      await page.mouse.down();
      for (let i = 1; i <= 10; i++) await page.mouse.move(box.x + box.width * (0.1 + 0.07 * i), box.y + box.height / 2);
      await page.mouse.up();
    });
    await page.screenshot({ path: path.join(EVIDENCE, `item2-after-drag-${engine}.png`) });
    await step(page, 'slider click 90%', () => page.mouse.click(box.x + box.width * 0.9, box.y + box.height / 2));
    await step(page, 'store.seek(2)', () => page.evaluate(() => window.__lms.state().seek(2)));

    await focusPlay(page);
    await step(page, 'key 8 (80%)', () => page.keyboard.press('8'));
    await step(page, 'key Home', () => page.keyboard.press('Home'));
    await step(page, 'key End', () => page.keyboard.press('End'));
    await step(page, 'key ArrowRight', () => page.keyboard.press('ArrowRight'));
    await step(page, 'key ArrowLeft', () => page.keyboard.press('ArrowLeft'));
    await step(page, 'key l (+10)', () => page.keyboard.press('l'));
    await step(page, 'seek button +10', () => page.locator('#solad-seek-forward').click());
    await step(page, 'seek button -10', () => page.locator('#solad-seek-backward').click());

    const player = await page.evaluate(() => {
      const r = window.__lms.container.getBoundingClientRect();
      return { x: r.left, y: r.top, width: r.width, height: r.height };
    });
    await step(page, 'doubletap right (mouse dblclick)', () => page.mouse.dblclick(player.x + player.width * 0.85, player.y + player.height * 0.4));
    await step(page, 'store.seek(0)', () => page.evaluate(() => window.__lms.state().seek(0)));

    // Safety net: a write to the real media skips the facade (like OS media keys or the PiP window).
    await step(page, 'direct media.currentTime=30 (safety net)', () => page.evaluate(() => { window.__lms.media.currentTime = 30; }));
    await step(page, 'direct media.currentTime=5 (inside)', () => page.evaluate(() => { window.__lms.media.currentTime = 5; }));

    // While playing.
    await step(page, 'play', () => page.evaluate(() => window.__lms.media.play()), 1500);
    await step(page, 'store.seek(30) while playing', () => page.evaluate(() => window.__lms.state().seek(30)), 1500);
    await step(page, 'direct =33 while playing', () => page.evaluate(() => { window.__lms.media.currentTime = 33; }), 1500);
    await step(page, 'pause', () => page.evaluate(() => window.__lms.media.pause()), 300);

    result.seekingEvents = await page.evaluate(() => window.__lms.log.filter((e) => e.type === 'media:seeking').length);
    result.seekedEvents = await page.evaluate(() => window.__lms.log.filter((e) => e.type === 'media:seeked').length);
    result.errors = page.errors;
  },

  async 'seek-hls'(browser) {
    await scenarios.seek(browser, 'watched=10&media=hls');
  },

  async 'seek-hlsjs'(browser) {
    await scenarios.seek(browser, 'watched=10&media=hlsjs');
  },

  async 'seek-loader'(browser) {
    await scenarios.seek(browser, 'watched=10&mode=loader');
  },

  // Item 3: <media-ads> preroll with the LMS override in both orders.
  async ads(browser, query = process.env.Q ?? 'ads=preroll&order=lms-first&yield=1') {
    const page = await open(browser, query);

    result.query = query;
    await page.evaluate(() => {
      window.__lms.seekResults = [];
    });
    await step(page, 'play (preroll starts)', () => page.locator('media-play-button').first().click(), 2500);
    result.duringAd = await page.evaluate(() => ({
      overlay: Boolean(window.__lms.container.querySelector(':scope > [data-ads-overlay]')),
      lmsOverride: Boolean(window.__lms.lms.override()),
    }));
    await page.screenshot({ path: path.join(EVIDENCE, `item3-during-ad-${process.env.TAG ?? 'x'}-${engine}.png`) });
    await step(page, 'store.seek(20) during ad', () => page.evaluate(() => { window.__lms.state().seek(20).then((t) => window.__lms.seekResults.push(t)); }), 800);
    await step(page, 'direct media.currentTime=20 during ad', () => page.evaluate(() => { window.__lms.media.currentTime = 20; }), 800);
    await page.waitForFunction(() => !window.__lms.container.querySelector(':scope > [data-ads-overlay]'), null, { timeout: 30000 }).catch(() => {});
    await wait(2500);
    result.afterAd = await page.evaluate(() => ({
      overlay: Boolean(window.__lms.container.querySelector(':scope > [data-ads-overlay]')),
      lmsOverride: Boolean(window.__lms.lms.override()),
      maxWatched: window.__lms.lms.maxWatched,
      adsEvents: window.__lms.log.filter((e) => e.type === 'ads-event').map((e) => e.adType),
    }));
    await step(page, 'store.seek(30) after ad', () => page.evaluate(() => window.__lms.state().seek(30)), 1500);
    await step(page, 'direct =33 after ad', () => page.evaluate(() => { window.__lms.media.currentTime = 33; }), 1500);
    result.seekResults = await page.evaluate(() => window.__lms.seekResults);
    result.adsLog = await page.evaluate(() => window.__lms.log.filter((e) => /ads|lms-registered|attached/.test(e.type)));
    result.errors = page.errors;
  },

  // Item 4: rate cap.
  async rate(browser) {
    const query = process.env.Q ?? 'maxRate=1.5&rateKeys=off';
    const page = await open(browser, query);

    result.query = query;
    await showControls(page);
    await page.locator('.media-settings-menu-trigger').first().click().catch((e) => (result.menuError = String(e).slice(0, 200)));
    await wait(300);
    await page.locator('media-menu-item:has(media-text[token="menu.speed"])').first().click().catch((e) => (result.speedError = String(e).slice(0, 200)));
    await wait(400);
    result.items = await page.evaluate(() =>
      [...window.__lms.root.querySelectorAll('media-menu-radio-item')].map((item) => ({
        rate: item.getAttribute('data-rate'),
        value: item.getAttribute('value'),
        display: getComputedStyle(item).display,
        label: item.textContent.trim(),
      }))
    );
    await page.screenshot({ path: path.join(EVIDENCE, `item4-menu-${process.env.TAG ?? 'x'}-${engine}.png`) });
    await page.keyboard.press('Escape');
    await focusPlay(page);
    for (let i = 0; i < 5; i++) await step(page, `key > #${i + 1}`, () => page.keyboard.press('>'), 250);
    for (let i = 0; i < 9; i++) await step(page, `key < #${i + 1}`, () => page.keyboard.press('<'), 250);
    await step(page, 'set rate 1', () => page.evaluate(() => { window.__lms.media.playbackRate = 1; }), 250);
    await step(page, 'direct playbackRate=2', () => page.evaluate(() => { window.__lms.media.playbackRate = 2; }), 400);
    await step(page, 'store.setPlaybackRate(1.7)', () => page.evaluate(() => window.__lms.state().setPlaybackRate(1.7)), 400);
    // Other shortcuts still work after the speed bindings were removed and the page listens itself.
    const muted = await page.evaluate(() => window.__lms.media.muted);
    await page.keyboard.press('m');
    await wait(200);
    result.mToggledMute = (await page.evaluate(() => window.__lms.media.muted)) !== muted;
    await step(page, 'key ArrowLeft (still seeks)', () => page.keyboard.press('ArrowLeft'), 600);
    await step(page, 'key k (toggle play)', () => page.keyboard.press('k'), 600);
    await page.evaluate(() => window.__lms.media.pause());
    await step(page, 'key b (bookmark)', () => page.keyboard.press('b'), 200);
    await page.locator('#note').focus();
    await step(page, 'key > in input (ignored)', () => page.keyboard.press('>'), 200);
    result.inputValue = await page.locator('#note').inputValue();
    result.errors = page.errors;
  },

  // Item 4: keyboard navigation in the rate menu with hidden items.
  async 'rate-menu'(browser) {
    const page = await open(browser, process.env.Q ?? 'maxRate=1.5&rateKeys=off');

    await showControls(page);
    const triggers = await page.evaluate(() =>
      [...window.__lms.root.querySelectorAll('[commandfor], media-menu-trigger')].map((e) => `${e.localName}.${e.className}`)
    );
    result.triggers = triggers;
    await page.locator('.media-settings-menu-trigger').first().click().catch((e) => (result.clickError = String(e).slice(0, 200)));
    await wait(400);
    // Into the speed submenu.
    const speed = page.locator('media-menu-item:has(media-text[token="menu.speed"])').first();
    await speed.click().catch((e) => (result.speedError = String(e).slice(0, 200)));
    await wait(400);
    const focused = [];
    for (let i = 0; i < 10; i++) {
      focused.push(
        await page.evaluate(() => {
          let a = document.activeElement;
          while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
          return a ? `${a.localName}[${a.getAttribute('data-rate') ?? a.textContent.trim().slice(0, 12)}]` : null;
        })
      );
      await page.keyboard.press(process.env.KEY ?? 'ArrowDown');
      await wait(200);
    }
    result.focused = focused;
    await page.screenshot({ path: path.join(EVIDENCE, `item4-speed-menu-${engine}.png`) });
    result.errors = page.errors;
  },

  // Item 5: chapters from blob/data URL tracks, before and after mount, for mp4 and hls.
  async chapters(browser) {
    result.runs = [];
    for (const media of ['mp4', 'hls', 'hlsjs'])
      for (const as of ['blob', 'data'])
        for (const at of ['before', 'after']) {
          const page = await open(browser, `media=${media}&chapters=${as}&chapAt=${at}&layers=off`);

          await wait(at === 'after' ? 1500 : 800);
          await showControls(page);
          const box = await sliderBox(page);
          await page.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2);
          await wait(500);
          const run = await page.evaluate(() => {
            const l = window.__lms;
            const tracks = [...l.media.textTracks].map((t) => ({ kind: t.kind, mode: t.mode, cues: t.cues?.length ?? null }));
            return {
              tracks,
              storeCues: l.state().chaptersCues?.length ?? null,
              chapterEls: l.root.querySelectorAll('.media-time-slider-chapter').length,
              title: l.root.querySelector('media-time-slider-chapter-title')?.textContent.trim(),
            };
          });
          if (media === 'mp4' && as === 'blob' && at === 'before') await page.screenshot({ path: path.join(EVIDENCE, `item5-chapters-hover-${engine}.png`) });
          if (media === 'hls' && as === 'data' && at === 'after') await page.screenshot({ path: path.join(EVIDENCE, `item5-chapters-hls-after-${engine}.png`) });
          run.query = { media, as, at };
          run.errors = page.errors;
          result.runs.push(run);
          console.log(JSON.stringify(run));
          await page.close();
        }
  },

  // Item 6: slider layers in a template copy with chapters.
  async layers(browser) {
    const page = await open(browser, 'chapters=blob&watched=14');

    await page.evaluate(() => window.__lms.lms.segments.push([22, 26]));
    await page.evaluate(() => window.__lms.lms.paint());
    await page.evaluate(() => window.__lms.media.currentTime = 6);
    await wait(800);
    await showControls(page);
    const box = await sliderBox(page);
    result.geometry = await page.evaluate(() => {
      const l = window.__lms;
      const rect = (e) => { const r = e.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; };
      const layers = l.root.querySelector('.lms-slider-layers');
      const tracks = [...l.root.querySelectorAll('.media-time-slider-chapter-track')].map(rect);
      const parts = [...layers.querySelectorAll('.lms-watched-part')].map(rect);
      const center = l.slider.getBoundingClientRect();
      const hit = l.root.elementFromPoint(center.left + center.width * 0.3, center.top + center.height / 2);
      return {
        slider: rect(l.slider),
        layers: rect(layers),
        tracks,
        parts,
        limit: rect(layers.querySelector('.lms-limit')),
        hitAt30pct: hit ? `${hit.localName}.${hit.className}` : null,
        chapters: l.root.querySelectorAll('.media-time-slider-chapter').length,
        sliderAria: { role: l.slider.getAttribute('role'), valuetext: l.slider.getAttribute('aria-valuetext') },
      };
    });
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height / 2);
    await wait(500);
    result.previewTitle = await page.evaluate(() => window.__lms.root.querySelector('media-time-slider-chapter-title')?.textContent.trim());
    await page.screenshot({ path: path.join(EVIDENCE, `item6-layers-hover-${engine}.png`) });
    await page.locator('#player').screenshot({ path: path.join(EVIDENCE, `item6-layers-player-${engine}.png`) });
    await step(page, 'slider click 25% (through layers)', () => page.mouse.click(box.x + box.width * 0.25, box.y + box.height / 2));
    await page.locator('media-time-slider').first().focus();
    await step(page, 'slider focused ArrowLeft', () => page.keyboard.press('ArrowLeft'));
    await step(page, 'slider focused ArrowRight x5', async () => { for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight'); });
    await step(page, 'play 2s (fill/buffer over layer)', () => page.evaluate(() => window.__lms.media.play()), 2200);
    await page.evaluate(() => window.__lms.media.pause());
    await page.locator('#player').screenshot({ path: path.join(EVIDENCE, `item6-layers-after-play-${engine}.png`) });
    result.segmentsAfter = await page.evaluate(() => window.__lms.lms.segments);
    result.errors = page.errors;
  },

  // Item 7: the seek indicator on a blocked seek.
  async indicator(browser) {
    for (const indicator of ['on', 'off']) {
      const page = await open(browser, `watched=10&indicator=${indicator}`);

      await page.evaluate(() => window.__lms.state().seek(11));
      await wait(800);
      await focusPlay(page);
      await page.keyboard.press('ArrowRight');
      await wait(120);
      const shot = path.join(EVIDENCE, `item7-indicator-${indicator}-${engine}.png`);
      await page.locator('#player').screenshot({ path: shot });
      const seen = await page.evaluate(() => {
        const el = window.__lms.root.querySelector('media-seek-indicator');
        return el ? { attrs: Object.fromEntries([...el.attributes].map((a) => [a.name, a.value])), value: el.textContent.trim(), display: getComputedStyle(el).display } : null;
      });
      await wait(800);
      result.steps.push({ indicator, seen, after: await snap(page), shot: path.basename(shot) });
      console.log(indicator, JSON.stringify(seen));
      await page.close();
    }
  },

  // Extra: a resume overlay over inert controls, and focus.
  async overlay(browser) {
    const page = await open(browser, 'watched=10');

    result.before = await page.evaluate(() => {
      const l = window.__lms;
      const controls = l.root.querySelector('media-controls');
      const overlay = document.createElement('div');

      overlay.className = 'lms-resume';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-label', '이어보기');
      overlay.style.cssText = 'position:absolute;inset:0;display:grid;place-content:center;gap:8px;background:rgb(0 0 0/.6);z-index:10;color:#fff';
      overlay.innerHTML = '<p>00:10부터 이어볼까요?</p><button id="resume-yes">이어보기</button><button id="resume-no">처음부터</button>';
      controls.inert = true;
      l.container.append(overlay);
      overlay.querySelector('#resume-yes').focus();
      return { controlsTag: controls?.localName };
    });
    const focusPath = [];
    for (let i = 0; i < 6; i++) {
      focusPath.push(
        await page.evaluate(() => {
          let a = document.activeElement;
          const chain = [];
          while (a) { chain.push(a.id ? `${a.localName}#${a.id}` : a.localName); a = a.shadowRoot?.activeElement; }
          return chain.join(' > ');
        })
      );
      await page.keyboard.press('Tab');
      await wait(80);
    }
    result.focusPath = focusPath;
    await page.locator('#resume-yes').focus();
    await step(page, 'key Space on overlay button', () => page.keyboard.press('k'), 400);
    await step(page, 'key ArrowRight on overlay button', () => page.keyboard.press('ArrowRight'), 600);
    await step(page, 'key b on overlay button', () => page.keyboard.press('b'), 200);
    await page.locator('#player').screenshot({ path: path.join(EVIDENCE, `extra-overlay-${engine}.png`) });
    result.errors = page.errors;
  },

  // Item 8: pagehide delivery.
  async pagehide(browser) {
    const read = (run) =>
      fs.existsSync(path.join(EVIDENCE, 'beacon-log.jsonl'))
        ? fs.readFileSync(path.join(EVIDENCE, 'beacon-log.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l)).filter((l) => l.run === run)
        : [];
    const runs = [
      ['navigate', async (page) => page.goto(`${BASE}/spike/router-missing`)],
      ['reload', async (page) => { await page.reload(); return page.evaluate(() => sessionStorage.getItem('lms-spike-sent')); }],
      ['close', async (page) => page.close({ runBeforeUnload: true })],
      ['popup-window.close', null],
    ];
    result.runs = [];
    for (let round = 1; round <= 2; round++)
      for (const [how, leave] of runs) {
        const run = `${engine}-${how}-${round}-${Date.now()}`;
        let note = null;

        if (leave) {
          const page = await browser.newPage();

          await page.goto(`${BASE}/spike/pagehide.html?browser=${engine}&run=${run}`);
          await page.waitForFunction(() => window.__ready);
          note = await leave(page);
          await wait(2000);
          if (!page.isClosed()) await page.close();
        } else {
          const opener = await browser.newPage();

          await opener.goto(`${BASE}/spike/page.html?keys=off`).catch(() => {});
          await opener.evaluate(() => {
            window.__msgs = [];
            addEventListener('message', (e) => window.__msgs.push(e.data));
          });
          const [popup] = await Promise.all([
            opener.waitForEvent('popup'),
            opener.evaluate((url) => { window.__popup = window.open(url, 'lms', 'width=400,height=300'); }, `${BASE}/spike/pagehide.html?browser=${engine}&run=${run}`),
          ]);
          await popup.waitForFunction(() => window.__ready);
          await opener.evaluate(() => window.__popup.close());
          await wait(2000);
          note = await opener.evaluate(() => window.__msgs);
          await opener.close();
        }

        const entry = { how, round, run, note, received: read(run).map((l) => ({ kind: l.kind, contentType: l.contentType, json: l.json, secFetchMode: l.secFetchMode })) };
        result.runs.push(entry);
        console.log(JSON.stringify(entry));
      }
  },
};

(async () => {
  const args = engine === 'chromium' ? { args: ['--autoplay-policy=no-user-gesture-required'] } : {};
  const browser = await pw[engine].launch(args);

  try {
    await scenarios[scenario](browser);
  } catch (error) {
    result.fatal = String(error.stack ?? error).slice(0, 800);
    console.log('FATAL', result.fatal);
  } finally {
    await browser.close();
    const tag = process.env.TAG ? `-${process.env.TAG}` : '';
    fs.writeFileSync(path.join(EVIDENCE, `${scenario}${tag}-${engine}.json`), JSON.stringify(result, null, 1));
  }
})();
