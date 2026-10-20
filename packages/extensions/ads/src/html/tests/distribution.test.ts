import { execFileSync } from 'node:child_process';
import { fileURLToPath, URL as NodeURL } from 'node:url';

import { describe, expect, it } from 'vite-plus/test';

describe('CDN distribution', () => {
  it('registers media-ads when the built browser entry is imported twice', () => {
    const bundle = new NodeURL('../../../dist/cdn/ads.js', import.meta.url).href;
    const output = execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `
      const registry = new Map();
      let registrations = 0;
      globalThis.customElements = {
        get: (name) => registry.get(name),
        define: (name, element) => { if (registry.has(name)) throw new Error('duplicate'); registry.set(name, element); registrations++; }
      };
      const first = await import(${JSON.stringify(bundle)});
      await import(${JSON.stringify(`${bundle}?second`)});
      console.log(JSON.stringify({ registered: registry.get('media-ads')?.tagName, registrations, controller: typeof first.createAdsController }));
    `,
      ],
      { encoding: 'utf8' }
    );

    expect(JSON.parse(output)).toEqual({ registered: 'media-ads', registrations: 1, controller: 'function' });
  });

  it('imports the neutral build without browser globals', () => {
    const entry = fileURLToPath(new NodeURL('../../../dist/default/index.js', import.meta.url));
    const output = execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `
      if ('document' in globalThis || 'HTMLElement' in globalThis) throw new Error('unexpected browser environment');
      const { parsePlaybackSchedule, AdsScheduler } = await import(${JSON.stringify(entry)});
      const parsed = parsePlaybackSchedule({schemaVersion:1,siteId:'site',videoId:'video',boardId:null,categoryId:null,scheduleId:'none',scheduleVersion:1,breaks:[]});
      if (!parsed.ok) throw new Error('parse failed');
      console.log(new AdsScheduler(parsed.schedule).observe({type:'play',currentTime:0}));
    `,
      ],
      { encoding: 'utf8' }
    );

    expect(output.trim()).toBe('null');
  });
});
