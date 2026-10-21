/**
 * The Grok sample the demo and the admin preview play (contract A2-D 2). The folder is not in Git; when it is missing
 * the pages show how to prepare it instead of playing substitute media.
 */

const here = import.meta.url;

export const SAMPLE_VIDEO_ID = 'grok-demo-scene-01';
export const SAMPLE_CONTENT_URL = new URL('../demo-media/grok-20261018/content-scene-01.mp4', here).href;
export const SAMPLE_SCHEDULE_URL = new URL('../demo-media/grok-20261018/schedule.json.js', here).href;
/** Demo HLS content, which has no schedule of its own: the demo plays the Grok schedule over it. */
export const DEMO_HLS_URL = new URL('../demo-media/content-master.m3u8', here).href;
export const SAMPLE_TITLE = 'Grok 해안 도시 장면';
/** The admin preview's poster placeholder, in Git unlike the sample, so "포스터 표시" shows on any content. */
export const SAMPLE_POSTER_URL = new URL('./sample-poster.svg', here).href;

export const MISSING_SAMPLE_MESSAGE =
  '샘플 미디어가 없어요. 서버의 demo-media/grok-20261018/ 폴더에 content-scene-01.mp4, schedule.json.js와 광고 영상 3개를 넣어 주세요.';
export const INVALID_SAMPLE_MESSAGE =
  '샘플 편성 파일의 형식이 달라요. demo-media/grok-20261018/schedule.json.js가 원본 raw 편성인지 확인해 주세요.';

/**
 * Check that the sample schedule and content are there. Resolves `{ ok: true, schedule }` or
 * `{ ok: false, reason: 'missing' | 'invalid', message }`; an aborted check rejects.
 */
export async function checkSample({ signal } = {}) {
  const missing = { ok: false, reason: 'missing', message: MISSING_SAMPLE_MESSAGE };
  const request = { credentials: 'same-origin', cache: 'no-store', signal };
  let response;

  try {
    response = await fetch(SAMPLE_SCHEDULE_URL, request);
  } catch (error) {
    if (signal?.aborted) throw error;

    return missing;
  }

  if (!response.ok) return missing;

  const schedule = await response.json().catch(() => null);

  if (!Array.isArray(schedule?.breaks) || schedule.videoId !== SAMPLE_VIDEO_ID)
    return { ok: false, reason: 'invalid', message: INVALID_SAMPLE_MESSAGE };

  try {
    const content = await fetch(SAMPLE_CONTENT_URL, { ...request, method: 'HEAD' });

    if (!content.ok) return missing;
  } catch (error) {
    if (signal?.aborted) throw error;

    return missing;
  }

  return { ok: true, schedule };
}
