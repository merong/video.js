// A2-E-QA E05: the logo link opens its address in a new tab after load, with no opener and no referrer.
import { BASE, launch, newContext, login, sleep } from '/Users/brian/works/tools/videojs/video.js/workspaces/ads-admin-app-20261020/qa/evidence/a2-e/scripts/lib.mjs';
import { openDemo } from '/Users/brian/works/tools/videojs/video.js/workspaces/ads-admin-app-20261020/qa/evidence/a2-e/scripts/demo.mjs';
const browser = await launch();
const context = await newContext(browser, { width: 1280, height: 900 });
const page = await context.newPage();
await login(page);
await openDemo(page, `?logo=sample-svg&logoPosition=bottom-left&logoHref=${encodeURIComponent(BASE + '/examples/guide.html')}&logoAlt=DEMO+STORE`);
await sleep(1500);
const [popup] = await Promise.all([context.waitForEvent('page'), page.locator('#player a.solad-logo-link').click()]);
await popup.waitForLoadState('load');
console.log(JSON.stringify({ raw: popup.url(), title: await popup.title(), opener: await popup.evaluate(() => window.opener), referrer: await popup.evaluate(() => document.referrer) }));
await context.close(); await browser.close();
