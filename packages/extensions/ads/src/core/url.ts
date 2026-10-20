import { isString } from '@videojs/utils/predicate';

/** Shared syntax gate for creative, schedule and collector URLs; never fetches a reference. @internal */
// eslint-disable-next-line anti-slop/no-unknown-parameters -- Untrusted wire URL boundary.
export function isAdsUrl(value: unknown): value is string {
  // eslint-disable-next-line no-control-regex -- Wire URLs must not contain control characters or backslashes.
  if (!isString(value) || /[\u0000-\u0020\u007f\\]/u.test(value)) return false;

  if (value.startsWith('/') && !value.startsWith('//')) return true;

  if (!/^https?:\/\//i.test(value)) return false;

  try {
    const url = new URL(value);

    return !!url.hostname && (url.protocol === 'https:' || url.protocol === 'http:');
  } catch {
    return false;
  }
}
