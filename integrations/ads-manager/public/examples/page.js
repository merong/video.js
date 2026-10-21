/**
 * Shared behavior of the public example pages (design DocShell and CodeBlock): the folding table of contents with the
 * section being read, and copy buttons. Values go into text nodes only.
 */

/** DocShell: fold the table of contents at 960px or narrower, and mark the link of the section being read. */
export function startToc(root = document, { narrow = matchMedia('(max-width: 960px)').matches } = {}) {
  const toc = root.querySelector('.sa-toc');

  if (!toc) return;

  // Without this script the list stays open, so it never disappears.
  if (narrow) toc.open = false;

  const links = [...toc.querySelectorAll('a[href^="#"]')];
  const mark = (id) => {
    for (const link of links)
      if (link.getAttribute('href') === `#${id}`) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
  };

  if (typeof IntersectionObserver === 'undefined') return;

  const spy = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) if (entry.isIntersecting) mark(entry.target.id);
    },
    { rootMargin: '0px 0px -70% 0px' }
  );

  for (const heading of root.querySelectorAll('.sa-doc-sec > .sa-doc-hrow > h2')) spy.observe(heading);
}

/**
 * CodeBlock copy: `navigator.clipboard`, or, where the clipboard is missing or refused, the code selected with focus
 * on it. The result line is made anew each time so the same result is announced again; `clearCopy` empties it when the
 * code changes.
 */
export function bindCopy(block) {
  const button = block.querySelector('.sa-codeblock-head button');
  const pre = block.querySelector('pre');

  button.addEventListener('click', async () => {
    const status = freshStatus(block);

    try {
      await navigator.clipboard.writeText(pre.textContent);
      status.textContent = '복사했어요.';
      pre.removeAttribute('aria-describedby');
    } catch {
      status.id ||= `${pre.getAttribute('aria-labelledby')}-copy`;
      status.classList.add('is-warn');
      status.textContent = '복사하지 못했어요. 코드를 직접 선택해 복사해 주세요.';
      pre.setAttribute('aria-describedby', status.id);
      pre.focus();
      getSelection()?.selectAllChildren(pre);
    }
  });
}

/** Empty a CodeBlock's result line; its code changed. */
export function clearCopy(block) {
  freshStatus(block);
  block.querySelector('pre').removeAttribute('aria-describedby');
}

function freshStatus(block) {
  const status = block.ownerDocument.createElement('p');

  status.className = 'sa-status';
  status.setAttribute('role', 'status');
  block.querySelector('.sa-status').replaceWith(status);
  return status;
}

/** Set a status line (`sa-status`): `tone` `''`, `is-warn` or `is-bad`; a bad one is an alert. */
export function setStatus(element, text, tone = '') {
  element.className = tone ? `sa-status ${tone}` : 'sa-status';
  element.setAttribute('role', tone === 'is-bad' ? 'alert' : 'status');
  element.textContent = text;
}

/** A Note (`p.sa-note`) whose text starts with a bold sentence: "<b>lead</b> rest". */
export function noteText(note, lead, rest) {
  const span = note.ownerDocument.createElement('span');
  const bold = note.ownerDocument.createElement('b');

  bold.textContent = lead;
  span.append(bold, rest ? ` ${rest}` : '');
  note.replaceChildren(span);
}
