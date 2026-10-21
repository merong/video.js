import { readFileSync } from 'node:fs';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { BUILT_IN_PRESETS } from '../../public/examples/demo-state.js';
import { startDemo } from '../../public/examples/demo.js';
import { parsePlayerPreset, presetRender, readPresetRender } from '../../public/player/preset.js';

const page = readFileSync('integrations/ads-manager/public/examples/index.html', 'utf8');
const schedule = {
  videoId: 'grok-demo-scene-01',
  breaks: [{ breakId: 'pre', position: 'pre', ads: [{ itemId: 'a' }] }],
};

/** A public `player-preset` result for a Video.js preset. */
function source(id: string, input: Record<string, unknown> = {}) {
  const parsed = parsePlayerPreset({ id, name: id, playerType: 'videojs', ...input });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));

  const read = readPresetRender(presetRender(parsed.preset));
  if (!read.ok) throw new Error(JSON.stringify(read.errors));

  return { render: read.render, preset: read.preset };
}

const presets: Record<string, ReturnType<typeof source>> = {
  default: source('default'),
  flat: source('flat', { theme: { borderColor: '#00000000', borderRadius: 0 } }),
  rounded: source('rounded', { theme: { borderRadius: 12 } }),
  accent: source('accent', { theme: { accentColor: '#16a34a' } }),
  'p-native0001': source('p-native0001', { playerType: 'native' }),
  'p-logo000001': source('p-logo000001', { logo: { position: 'bottom-left', width: 120 } }),
};

/** Run the demo on the real page with fake API, sample and loader. */
async function demo(
  search: string,
  { sample = { ok: true, schedule } as Record<string, unknown>, checkImage = async (_url: string) => true } = {}
) {
  const parsed = new DOMParser().parseFromString(page, 'text/html');
  const address = new URL(`https://host.test/examples/index.html${search}`);
  const history = { state: null, replaceState: vi.fn() };
  const handles: {
    restyle: ReturnType<typeof vi.fn>;
    seek: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
  }[] = [];
  const mount = vi.fn(async (_element: HTMLElement, _options: { onEvent: (event: AdEvent) => void }) => {
    const handle = { schedule, restyle: vi.fn(() => true), seek: vi.fn(async () => true), destroy: vi.fn() };

    handles.push(handle);
    return handle;
  });
  const loadPreset = vi.fn(async (id: string) => presets[id] ?? { missing: true });

  document.body.replaceChildren(...parsed.body.childNodes);

  const started = startDemo({
    root: document,
    address,
    history,
    mount,
    loadPresets: async () => ({
      items: BUILT_IN_PRESETS.map((item) => ({ ...item, site: item.id === 'default', builtIn: true })),
      siteId: 'default',
      signedIn: false,
      notice: '',
    }),
    loadPreset,
    checkSample: async () => sample,
    checkImage,
  });

  await started.ready;
  await settle();

  return { started, mount, handles, history, loadPreset };
}

interface AdEvent {
  type: string;
  breakId: string;
  itemId: string;
  occurredAt: string;
}

const settle = () => new Promise((resolve) => setTimeout(resolve));
const $ = (id: string) => document.getElementById(id)!;
const code = (id: string) => $(id).querySelector('pre > code')!.textContent ?? '';

afterEach(() => {
  document.body.replaceChildren();
});

describe('startDemo', () => {
  it('lists the five built-ins with 플랫 second and starts flat from the address', async () => {
    const { mount } = await demo('?preset=flat');
    const select = document.querySelector<HTMLSelectElement>('#preset')!;

    expect(BUILT_IN_PRESETS).toEqual([
      { id: 'default', name: '기본' },
      { id: 'flat', name: '플랫' },
      { id: 'rounded', name: '둥근 테두리' },
      { id: 'accent', name: '강조색' },
      { id: 'lms', name: '강의' },
    ]);
    expect([...select.options].slice(0, 4).map((option) => [option.value, option.textContent])).toEqual([
      ['default', expect.stringContaining('기본')],
      ['flat', '플랫'],
      ['rounded', '둥근 테두리'],
      ['accent', '강조색'],
    ]);
    expect(select.value).toBe('flat');
    expect(mount.mock.calls[0]![1]).toMatchObject({ preview: { preset: presets.flat!.preset } });
    expect(presets.flat!.render.css).toEqual({ '--media-border-color': '#00000000', '--media-border-radius': '0px' });
  });

  it('starts on the address preset and notes the ignored query values', async () => {
    const { mount, loadPreset } = await demo('?preset=accent&autoplay=maybe');

    expect(($('preset') as HTMLSelectElement).value).toBe('accent');
    expect(loadPreset).toHaveBeenCalledWith('accent', expect.anything());
    expect($('query-note').hidden).toBe(false);
    expect($('query-note').textContent).toBe(
      '주소의 값 1개를 무시했어요. autoplay=maybe · 지금은 프리셋 값으로 보여요.'
    );
    expect(mount).toHaveBeenCalledTimes(1);
    expect(mount.mock.calls[0]![1]).toMatchObject({
      videoId: 'grok-demo-scene-01',
      preview: { preset: presets.accent!.preset },
    });
    expect(code('code-html')).toContain('data-preset="accent"');
    expect($('code-why').textContent).toContain('사이트 적용 프리셋이 아니라서');
  });

  it('starts on the site preset and installs without data-preset', async () => {
    const { loadPreset } = await demo('');

    expect(($('preset') as HTMLSelectElement).value).toBe('default');
    expect(loadPreset).toHaveBeenCalledWith('default', expect.anything());
    expect($('query-note').hidden).toBe(true);
    expect(code('code-html')).not.toContain('data-preset');
    expect($('code-why').textContent).toContain('사이트 적용 프리셋이라');
    expect($('reset').hasAttribute('disabled')).toBe(true);
  });

  it('falls back to the site preset for an unknown address preset', async () => {
    const { started } = await demo('?preset=p-abcdefghij');

    expect($('preset-note').hidden).toBe(false);
    expect($('preset-note').textContent).toBe(
      '주소의 프리셋을 찾지 못했어요. preset=p-abcdefghij · 사이트 적용 프리셋으로 보여요.'
    );
    expect(($('preset') as HTMLSelectElement).value).toBe('default');
    expect(started.state.preset).toBeNull();
  });

  it('mounts again with the changed option and updates the code and address', async () => {
    const { mount, history } = await demo('?autoplay=maybe');

    $('query-note').hidden = false;
    (document.querySelector('button[data-key="loop"]') as HTMLButtonElement).click();
    await settle();

    expect(mount).toHaveBeenCalledTimes(2);
    expect(mount.mock.calls[1]![1]).toMatchObject({ overrides: { playback: { loop: true } } });
    expect(code('code-html')).toContain('data-loop="true"');
    expect(code('code-js')).toContain('"loop":true');
    expect(history.replaceState.mock.calls.at(-1)![2]).toBe('/examples/index.html?loop=true');
    expect($('query-note').hidden).toBe(true);
    expect($('reset-h').textContent).toBe('프리셋과 다른 값 1개');
    expect($('reset').hasAttribute('disabled')).toBe(false);
  });

  it('restyles in place when only the theme changes', async () => {
    const { mount, handles } = await demo('?preset=rounded');
    const select = $('preset') as HTMLSelectElement;

    select.value = 'accent';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();

    expect(mount).toHaveBeenCalledTimes(1);
    expect(handles[0]!.restyle).toHaveBeenLastCalledWith(presets.accent!.preset, { overrides: undefined, logo: null });
  });

  it('locks muted on while autoplay is on', async () => {
    await demo('');

    (document.querySelector('button[data-key="autoplay"]') as HTMLButtonElement).click();
    await settle();

    const muted = document.querySelector('button[data-key="muted"]') as HTMLButtonElement;

    expect($('muted-row').classList.contains('is-locked')).toBe(true);
    expect(muted.disabled).toBe(true);
    expect(muted.getAttribute('aria-checked')).toBe('true');
    expect($('mu-d').textContent).toContain('자동재생을 켜면 음소거로 시작해요.');
    expect(code('code-html')).toContain('data-autoplay="true"');
    expect(code('code-html')).not.toContain('data-muted');
  });

  it('enables the scene shortcuts once ready and seeks on press', async () => {
    const { handles } = await demo('');
    const start = document.querySelector('button[data-scene="start"]') as HTMLButtonElement;
    const midroll = document.querySelector('button[data-scene="before-midroll"]') as HTMLButtonElement;

    expect(start.disabled).toBe(false);
    expect(midroll.disabled).toBe(true);
    expect(midroll.getAttribute('aria-describedby')).toBe('st-mid-why');
    start.click();
    expect(handles[0]!.seek).toHaveBeenCalledWith('start');
  });

  describe('scene shortcuts after ads (A2DD2-01)', () => {
    const scene = (name: string) => document.querySelector<HTMLButtonElement>(`button[data-scene="${name}"]`)!;
    const ad = (type: string) => ({ type, breakId: 'pre', itemId: 'a', occurredAt: '2026-10-21T03:04:05.000Z' });

    it('mounts a new player at a scene the player asks to remount for, and drops the old player events', async () => {
      const { mount, handles } = await demo('');

      mount.mock.calls[0]![1].onEvent(ad('start'));
      handles[0]!.seek.mockResolvedValueOnce('remount');
      scene('start').click();
      await settle();
      mount.mock.calls[0]![1].onEvent(ad('error'));

      expect(handles[0]!.destroy).toHaveBeenCalled();
      expect(mount).toHaveBeenCalledTimes(2);
      expect(mount.mock.calls[1]![1]).toMatchObject({ preview: { scene: 'start' } });
      expect($('now').textContent).toBe('최근 광고 진행아직 광고가 나오지 않았어요');
      expect($('log').querySelectorAll('li')).toHaveLength(1);
      expect(scene('start').disabled).toBe(false);
    });

    it('enables the shortcuts from the full sample while the player plays a trimmed schedule', async () => {
      const full = {
        ...schedule,
        breaks: [...schedule.breaks, { breakId: 'mid', position: 'mid', atSeconds: 5, ads: [{ itemId: 'b' }] }],
      };

      await demo('', { sample: { ok: true, schedule: full } });

      expect(scene('before-midroll').disabled).toBe(false);
    });

    it('moves the same player when the scene has not played', async () => {
      const { mount, handles } = await demo('');

      scene('before-end').click();
      await settle();

      expect(handles[0]!.seek).toHaveBeenCalledWith('before-end');
      expect(mount).toHaveBeenCalledTimes(1);
    });

    it('keeps only the last of quick scene presses', async () => {
      const { mount, handles } = await demo('');

      handles[0]!.seek.mockResolvedValue('remount');
      scene('start').click();
      scene('before-end').click();
      await settle();

      expect(mount).toHaveBeenCalledTimes(2);
      expect(mount.mock.calls[1]![1]).toMatchObject({ preview: { scene: 'before-end' } });
    });
  });

  it('shows the missing-sample state without mounting', async () => {
    const { mount } = await demo('', { sample: { ok: false, reason: 'missing', message: '' } });

    expect(mount).not.toHaveBeenCalled();
    expect($('stage-view').classList.contains('is-empty')).toBe(true);
    expect($('stage-empty').hidden).toBe(false);
    expect($('stage-bar').hidden).toBe(true);
    expect((document.querySelector('button[data-scene="start"]') as HTMLButtonElement).disabled).toBe(true);
    expect(code('code-html')).toContain('data-solad-player');
  });

  it('titles a sample schedule in the wrong format apart from a missing sample', async () => {
    await demo('', { sample: { ok: false, reason: 'invalid', message: '' } });

    expect($('stage-empty').querySelector('b')!.textContent).toBe('샘플 편성 형식이 달라요');
    expect($('stage-empty').querySelector('span')!.textContent).toBe(
      'demo-media/grok-20261018/schedule.json.js가 원본 raw 편성인지 확인해 주세요.'
    );
    expect($('stage-empty').querySelector('a')!.getAttribute('href')).toBe('guide.html#sample-media');
  });

  it('keeps the missing-sample title and line from the page', async () => {
    await demo('', { sample: { ok: false, reason: 'missing', message: '' } });

    expect($('stage-empty').querySelector('b')!.textContent).toBe('샘플 미디어가 없어요');
    expect($('stage-empty').querySelector('span')!.textContent).toBe(
      '서버의 demo-media/grok-20261018/ 폴더에 샘플을 넣으면 재생돼요.'
    );
  });

  it('logs ad progress newest first', async () => {
    const { mount } = await demo('');
    const { onEvent } = mount.mock.calls[0]![1];

    onEvent({ type: 'start', breakId: 'pre', itemId: 'a', occurredAt: '2026-10-21T03:04:05.000Z' });
    onEvent({ type: 'complete', breakId: 'pre', itemId: 'a', occurredAt: '2026-10-21T03:04:15.000Z' });

    expect([...$('log').querySelectorAll('li > span')].map((item) => item.textContent)).toEqual([
      '프리롤 1/1 · 끝남',
      '프리롤 1/1 · 시작',
    ]);
    expect($('now').textContent).toContain('프리롤 1/1 · 끝남');
  });

  it('resets the latest-progress line for a new player and keeps the log', async () => {
    const { mount } = await demo('');
    const { onEvent } = mount.mock.calls[0]![1];

    onEvent({ type: 'start', breakId: 'pre', itemId: 'a', occurredAt: '2026-10-21T03:04:05.000Z' });
    document.querySelector<HTMLButtonElement>('button[data-key="loop"]')!.click();
    await settle();

    expect(mount).toHaveBeenCalledTimes(2);
    expect($('now').textContent).toBe('최근 광고 진행아직 광고가 나오지 않았어요');
    expect([...$('log').querySelectorAll('li > span')].map((item) => item.textContent)).toEqual(['프리롤 1/1 · 시작']);
  });

  it('keeps the latest-progress line when it only restyles', async () => {
    const { mount } = await demo('');
    const { onEvent } = mount.mock.calls[0]![1];
    const select = document.querySelector<HTMLSelectElement>('#preset')!;

    onEvent({ type: 'start', breakId: 'pre', itemId: 'a', occurredAt: '2026-10-21T03:04:05.000Z' });
    select.value = 'accent';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();

    expect(mount).toHaveBeenCalledTimes(1);
    expect($('now').textContent).toContain('프리롤 1/1 재생 중');
  });

  describe('controls group (A2-E 3.4)', () => {
    const seek = () => $('seek') as HTMLButtonElement;
    const captions = () => document.querySelector<HTMLButtonElement>('button[data-key="captions"]')!;
    const step = (value: string) =>
      document.querySelector<HTMLInputElement>(`input[name="seek-step"][value="${value}"]`)!;
    const query = (history: { replaceState: ReturnType<typeof vi.fn> }) => history.replaceState.mock.calls.at(-1)![2];

    it('starts from the preset: no seek buttons, captions on, nothing blocked', async () => {
      await demo('');

      expect(seek().getAttribute('aria-checked')).toBe('false');
      expect(seek().getAttribute('aria-controls')).toBe('seek-sub');
      expect($('seek-sub').hidden).toBe(true);
      expect(captions().getAttribute('aria-checked')).toBe('true');
      expect($('off-c').hidden).toBe(true);
      expect(($('cc-url') as HTMLInputElement).disabled).toBe(false);
    });

    it('turns the seek buttons on at 10 seconds first, then at the last chosen width', async () => {
      const { mount, history } = await demo('');

      seek().click();
      await settle();

      expect(mount).toHaveBeenCalledTimes(2);
      expect(mount.mock.calls[1]![1]).toMatchObject({ overrides: { controls: { seekButtons: 10 } } });
      expect($('seek-sub').hidden).toBe(false);
      expect(step('10').checked).toBe(true);
      expect(query(history)).toBe('/examples/index.html?seekButtons=10');
      expect(code('code-js')).toContain('"controls":{"seekButtons":10}');

      step('30').checked = true;
      step('30').dispatchEvent(new Event('change', { bubbles: true }));
      seek().click();
      await settle();

      expect(query(history)).toBe('/examples/index.html');
      expect($('seek-sub').hidden).toBe(true);

      seek().click();
      await settle();

      expect(query(history)).toBe('/examples/index.html?seekButtons=30');
      expect(step('30').checked).toBe(true);
      expect($('reset-h').textContent).toBe('프리셋과 다른 값 1개');
    });

    it('turns captions off as an override and fills the sample captions address', async () => {
      const { mount, history } = await demo('');
      const fill = $('cc-fill') as HTMLButtonElement;

      captions().click();
      await settle();

      expect(mount.mock.calls.at(-1)![1]).toMatchObject({ overrides: { controls: { captions: false } } });
      expect(query(history)).toBe('/examples/index.html?captions=false');

      fill.focus();
      fill.click();
      await settle();

      expect(($('cc-url') as HTMLInputElement).value).toBe('/examples/sample-captions.vtt');
      expect(document.activeElement).toBe(fill);
      expect(mount.mock.calls.at(-1)![1]).toMatchObject({ captions: '/examples/sample-captions.vtt' });
      expect(code('code-html')).toContain('data-captions="/examples/sample-captions.vtt"');
      expect(query(history)).toBe('/examples/index.html?captions=false&captionsUrl=%2Fexamples%2Fsample-captions.vtt');
      // The address is an install value, not a preset value.
      expect($('reset-h').textContent).toBe('프리셋과 다른 값 1개');
    });

    it('marks a relative captions address on its field without changing the player', async () => {
      const { mount } = await demo('');
      const input = $('cc-url') as HTMLInputElement;

      input.value = 'captions.vtt';
      input.dispatchEvent(new Event('change'));
      await settle();

      expect(input.getAttribute('aria-invalid')).toBe('true');
      expect(input.closest('.sa-field')!.classList.contains('is-error')).toBe(true);
      expect(mount).toHaveBeenCalledTimes(1);
    });
  });

  describe('logo group (A2-E 5.6)', () => {
    const image = () => $('logo-img') as HTMLSelectElement;
    const choose = async (value: string) => {
      image().value = value;
      image().dispatchEvent(new Event('change'));
      await settle();
    };
    const type = async (id: string, value: string) => {
      const input = $(id) as HTMLInputElement;

      input.value = value;
      input.dispatchEvent(new Event('change'));
      await settle();
    };
    const query = (history: { replaceState: ReturnType<typeof vi.fn> }) => history.replaceState.mock.calls.at(-1)![2];

    it('blocks the layout until an image is chosen, keeping the image select usable', async () => {
      await demo('');

      expect(image().value).toBe('');
      expect(image().disabled).toBe(false);
      expect($('logo-off').hidden).toBe(false);
      expect($('logo-off-native').hidden).toBe(true);
      expect($('logo-body').classList.contains('sa-off-body')).toBe(true);
      expect(($('logo-pos') as HTMLFieldSetElement).disabled).toBe(true);

      for (const id of ['logo-w', 'logo-op', 'logo-m', 'logo-href', 'logo-alt']) {
        expect(($(id) as HTMLInputElement).disabled, id).toBe(true);
        expect($(id).getAttribute('aria-describedby'), id).toMatch(/^logo-off /);
      }

      expect(document.querySelector('button[data-key="logoHideDuringAds"]')!.closest('li')!.classList).toContain(
        'is-locked'
      );
      expect($('cd-logo').hidden).toBe(true);
    });

    it('shows a sample through restyle, without a new player, and notes it under the install code', async () => {
      const { mount, handles, history } = await demo('');

      await choose('sample-svg');

      expect(mount).toHaveBeenCalledTimes(1);
      expect(handles[0]!.restyle).toHaveBeenLastCalledWith(presets.default!.preset, {
        overrides: undefined,
        logo: '/examples/sample-logo.svg',
      });
      expect(query(history)).toBe('/examples/index.html?logo=sample-svg');
      expect($('logo-off').hidden).toBe(true);
      expect(($('logo-pos') as HTMLFieldSetElement).disabled).toBe(false);
      expect($('cd-logo').hidden).toBe(false);
      expect(code('code-html')).not.toMatch(/logo/);
      expect(code('code-js')).not.toMatch(/logo/);

      const corner = document.querySelector<HTMLInputElement>('input[name="logo-position"][value="bottom-left"]')!;

      corner.checked = true;
      corner.dispatchEvent(new Event('change', { bubbles: true }));
      await type('logo-w', '200');
      document.querySelector<HTMLButtonElement>('button[data-key="logoHideDuringAds"]')!.click();
      await settle();

      expect(mount).toHaveBeenCalledTimes(1);
      expect(handles[0]!.restyle).toHaveBeenLastCalledWith(presets.default!.preset, {
        overrides: { logo: { position: 'bottom-left', width: 200, hideDuringAds: false } },
        logo: '/examples/sample-logo.svg',
      });
      expect($('logo-pos-now').textContent).toBe('왼쪽 아래');
      expect($('reset-h').textContent).toBe('프리셋과 다른 값 3개');
    });

    it('marks a width out of range and keeps the last good value', async () => {
      const { history } = await demo('?logo=sample-png');

      await type('logo-w', '300');

      expect($('logo-w').getAttribute('aria-invalid')).toBe('true');
      expect($('logo-w-h').textContent).toBe('240px보다 커요. 24–240 사이의 정수로 입력해 주세요.');
      expect(query(history)).toBe('/examples/index.html?logo=sample-png');

      await type('logo-m', '-1');

      expect($('logo-m-h').textContent).toBe('0px보다 작아요. 0–48 사이의 정수로 입력해 주세요.');

      await type('logo-w', '24');

      expect($('logo-w').hasAttribute('aria-invalid')).toBe(false);
      expect($('logo-w-h').textContent).toBe('24–240 정수예요. 높이는 그림 비율을 따라요.');
    });

    it('asks for alt text beside a link and shows the image unlinked until then', async () => {
      const { handles } = await demo('?logo=sample-svg');

      await type('logo-href', 'www.example.com');

      expect($('logo-href-h').textContent).toBe('http:// 또는 https://로 시작하는 주소로 입력해 주세요.');

      await type('logo-href', 'https://example.com/store');

      expect($('logo-href').hasAttribute('aria-invalid')).toBe(false);
      expect($('logo-alt').getAttribute('aria-required')).toBe('true');
      expect($('logo-alt-h').textContent).toBe('링크가 있으면 대체 텍스트를 입력해 주세요.');
      expect(handles[0]!.restyle.mock.calls.at(-1)![1]).toMatchObject({ overrides: { logo: { href: null } } });

      await type('logo-alt', '데모 스토어');

      expect($('logo-alt').hasAttribute('aria-invalid')).toBe(false);
      expect(handles[0]!.restyle.mock.calls.at(-1)![1]).toMatchObject({
        overrides: { logo: { href: 'https://example.com/store', alt: '데모 스토어' } },
      });
    });

    it('takes an image address only for "주소 직접 넣기" and keeps it across choices', async () => {
      const { handles, history } = await demo('');

      await choose('custom');

      expect($('logo-url-field').hidden).toBe(false);
      expect(query(history)).toBe('/examples/index.html?logo=custom');

      await type('logo-url', 'images/logo.png');

      expect($('logo-url-h').textContent).toBe(
        '/로 시작하는 경로나 http(s):// 주소로 입력해 주세요. 상대 경로는 받지 않아요.'
      );

      await type('logo-url', '/media/logo.png');

      expect(query(history)).toBe('/examples/index.html?logo=%2Fmedia%2Flogo.png');
      expect(handles[0]!.restyle.mock.calls.at(-1)![1]).toMatchObject({ logo: '/media/logo.png' });

      await choose('sample-png');
      await choose('custom');

      expect(query(history)).toBe('/examples/index.html?logo=%2Fmedia%2Flogo.png');
      expect(($('logo-url') as HTMLInputElement).value).toBe('/media/logo.png');
    });

    it('says when the image cannot load', async () => {
      await demo('?logo=%2Fmedia%2Fmissing.png', { checkImage: async () => false });
      await settle();

      expect($('logo-img-field').classList.contains('is-warn')).toBe(true);
      expect($('logo-img-h').textContent).toBe(
        '이미지를 불러오지 못해 플레이어에 로고를 숨겼어요. 주소와 파일을 확인해 주세요.'
      );
    });

    // A2E-03: the failure note used to outlive a fixed address until another field changed.
    it('clears the failure note in the drawing that takes a new address', async () => {
      const failed = '이미지를 불러오지 못해 플레이어에 로고를 숨겼어요. 주소와 파일을 확인해 주세요.';
      const help = '미리보기 전용이라 저장하지 않아요. 로고 올리기(준비 중)는 PNG, JPEG, WebP만 받아요.';
      // Never settles for a good address, so only the drawing for the new address can clear the note.
      const checkImage = (url: string) =>
        url.includes('no-such') ? Promise.resolve(false) : new Promise<boolean>(() => {});
      const warned = () => $('logo-img-field').classList.contains('is-warn');

      await demo('?logo=%2Fexamples%2Fno-such-logo.png', { checkImage });
      await settle();

      expect(warned()).toBe(true);
      expect($('logo-img-h').textContent).toBe(failed);

      await type('logo-url', '/examples/sample-logo.png');

      expect(warned()).toBe(false);
      expect($('logo-img-h').textContent).toBe(help);

      await type('logo-url', '/examples/no-such-other.png');
      await settle();

      expect(warned()).toBe(true);
      expect($('logo-img-h').textContent).toBe(failed);

      await choose('');

      expect(warned()).toBe(false);
      expect($('logo-img-h').textContent).toBe(help);

      // The hidden address field's late change (its blur) keeps "없음".
      $('logo-url').dispatchEvent(new Event('change'));
      await settle();

      expect(image().value).toBe('');
      expect(warned()).toBe(false);

      await choose('custom');
      await settle();

      expect(warned()).toBe(true);

      const select = $('preset') as HTMLSelectElement;

      select.append(new Option('native', 'p-native0001'));
      select.value = 'p-native0001';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      await settle();
      await settle();

      expect(warned()).toBe(false);
      expect($('logo-img-h').textContent).toBe(help);
    });

    it('opens a shared address with the same logo state, over the preset values', async () => {
      const search =
        '?preset=p-logo000001&logo=sample-png&logoPosition=top-left&logoOpacity=40&logoHref=https%3A%2F%2Fexample.com' +
        '&logoAlt=%EB%8D%B0%EB%AA%A8&logoHideWithControls=true';
      const first = await demo(search);
      const shared = first.history.replaceState.mock.calls.at(-1)![2];
      const state = first.started.state;

      expect(shared).toBe(`/examples/index.html${search}`);

      const again = await demo(shared.slice('/examples/index.html'.length));

      expect(again.started.state).toEqual(state);
      expect(image().value).toBe('sample-png');
      expect(document.querySelector<HTMLInputElement>('input[name="logo-position"]:checked')!.value).toBe('top-left');
      // The public render keeps `logo: null` (spec 5.2), so a saved preset's logo layout never reaches the demo and the
      // render defaults show where the address says nothing; the player preview gets the same preset object.
      expect(($('logo-w') as HTMLInputElement).value).toBe('80');
      expect(presets['p-logo000001']!.preset.logo).toMatchObject({ position: null, width: null });
      expect(($('logo-op') as HTMLInputElement).value).toBe('40');
      expect(($('logo-alt') as HTMLInputElement).value).toBe('데모');
      expect(again.mount.mock.calls[0]![1]).toMatchObject({
        overrides: {
          logo: { position: 'top-left', opacity: 40, href: 'https://example.com', alt: '데모', hideWithControls: true },
        },
        preview: { logo: '/examples/sample-logo.png' },
      });
    });
  });

  it('blocks the controls and logo groups for a native preset and keeps their values', async () => {
    const { mount, history } = await demo('?preset=p-native0001&seekButtons=15&captionsUrl=%2Fa.vtt&logo=sample-svg');

    expect($('off-c').hidden).toBe(false);
    expect($('controls-body').classList.contains('sa-off-body')).toBe(true);
    expect(($('seek') as HTMLButtonElement).disabled).toBe(true);
    expect($('seek').getAttribute('aria-describedby')).toBe('off-c seek-d');
    expect($('seek-row').classList.contains('is-locked')).toBe(true);
    expect(($('cc-url') as HTMLInputElement).disabled).toBe(true);
    expect(($('cc-url') as HTMLInputElement).value).toBe('/a.vtt');
    expect(($('cc-fill') as HTMLButtonElement).disabled).toBe(true);
    expect($('logo-off-native').hidden).toBe(false);
    expect($('logo-off').hidden).toBe(true);
    expect(($('logo-img') as HTMLSelectElement).disabled).toBe(true);
    expect(($('logo-img') as HTMLSelectElement).value).toBe('sample-svg');
    expect($('cd-logo').hidden).toBe(true);
    expect(history.replaceState.mock.calls.at(-1)![2]).toBe(
      '/examples/index.html?preset=p-native0001&seekButtons=15&captionsUrl=%2Fa.vtt&logo=sample-svg'
    );

    const options = mount.mock.calls[0]![1] as Record<string, any>;

    expect(options.preview).not.toHaveProperty('logo');
    expect(options).not.toHaveProperty('captions');
    expect(options).not.toHaveProperty('overrides');
    expect(code('code-html')).not.toContain('data-captions');
  });
});
