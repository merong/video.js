/**
 * Resolve an operator-entered address against the admin page into an absolute HTTP(S) URL. Unlike v1 `safeUrl`, which
 * accepts only absolute URLs and `/` paths, relative paths such as `demo-media/…` are accepted and resolved against
 * `base`, so the examples never resolve them against their own page. Like v1 it rejects other schemes,
 * protocol-relative hosts, credentials and control characters.
 */
export function resolveHttpUrl(value: string | null | undefined, base: string): URL | null {
  // These addresses cross the JSON/form boundary; reject controls before URL normalization.
  // oxlint-disable-next-line no-control-regex
  if (!value || /[\u0000- \u007f\\]/u.test(value) || value.startsWith('//')) return null;

  try {
    const url = new URL(value, base);

    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url : null;
  } catch {
    return null;
  }
}
