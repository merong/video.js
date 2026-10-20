/** Preserve the host's logical video and explicit source while changing only the chosen mode. */
export function configureExampleLinks(root, address) {
  const current = new URL(address);
  const query = current.searchParams;
  const media = query.get('media') === 'hls' ? 'hls' : 'mp4';
  const engine = query.get('engine') === 'hlsjs' ? 'hlsjs' : 'spf';

  for (const link of root.querySelectorAll('[data-example-link]')) {
    const target = new URL(link.getAttribute('href'), current);

    target.search = current.search;
    if (link.dataset.media) target.searchParams.set('media', link.dataset.media);
    if (link.dataset.engine) target.searchParams.set('engine', link.dataset.engine);
    link.href = target.href;
    const selected =
      target.pathname === current.pathname &&
      (!link.dataset.media || link.dataset.media === media) &&
      (!link.dataset.engine || (media === 'hls' && link.dataset.engine === engine));

    if (selected) link.setAttribute('aria-current', link.dataset.media ? 'true' : 'page');
    else link.removeAttribute('aria-current');
  }

  const content = new URL(
    query.get('content') || `../demo-media/${media === 'hls' ? 'content-master.m3u8' : 'content.mp4'}`,
    current
  );

  if (!['http:', 'https:'].includes(content.protocol))
    throw new Error('본편 주소는 HTTP(S) 주소 또는 상대 경로여야 합니다.');

  return { media, engine, content: content.href, videoId: query.get('video') || 'video-1' };
}
