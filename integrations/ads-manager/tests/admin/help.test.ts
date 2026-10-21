import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { renderHelpTables } from '../../public/examples/help.js';
import { INSTALL_OPTIONS, PRESET_FIELDS } from '../../public/examples/options.js';
import { fieldAnchor, HELP_SECTIONS, optionAnchor } from '../../ui/src/player/help-anchors';
import { playerOptions } from '../../ui/src/player/player-options';

const examples = 'integrations/ads-manager/public/examples';
const read = (name: string) =>
  new DOMParser().parseFromString(readFileSync(`${examples}/${name}`, 'utf8'), 'text/html');

function helpPage() {
  const page = read('help.html');

  renderHelpTables(page);
  return page;
}

describe('renderHelpTables', () => {
  it('fills every placeholder and keeps ids unique', () => {
    const page = helpPage();
    const ids = [...page.querySelectorAll('[id]')].map((element) => element.id);

    expect(page.querySelector('[data-options], [data-fields]')).toBeNull();
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has a row for every install option and preset field, and every section', () => {
    const page = helpPage();
    const missing = [
      ...INSTALL_OPTIONS.flatMap((group) =>
        group.rows.map((row: { name: string }) => optionAnchor(row.name, group.id))
      ),
      ...PRESET_FIELDS.map((field) => fieldAnchor(field.path)),
    ].filter((id) => page.getElementById(id)?.tagName !== 'TR');

    expect(missing).toEqual([]);

    for (const id of HELP_SECTIONS) expect(page.getElementById(id)?.tagName).toBe('H2');

    expect([...page.querySelectorAll('h2[id]')].map((h2) => h2.id)).toEqual([...HELP_SECTIONS]);
  });

  it('resolves every admin option link', () => {
    const page = helpPage();
    const missing = playerOptions
      .flatMap((group) => group.rows.map((row) => optionAnchor(row.name, group.id)))
      .filter((id) => !page.getElementById(id));

    expect(missing).toEqual([]);
  });

  it('resolves every same-page and help link in the guide and help', () => {
    const help = helpPage();
    const pages = new Map([
      ['help.html', help],
      ['guide.html', read('guide.html')],
    ]);
    const broken: string[] = [];

    for (const [name, page] of pages) {
      for (const link of page.querySelectorAll<HTMLAnchorElement>('a[href*="#"]')) {
        const [file, hash] = link.getAttribute('href')!.split('#');
        const target = file ? pages.get(file) : page;

        if (target && !target.getElementById(decodeURIComponent(hash!)))
          broken.push(`${name} → ${link.getAttribute('href')}`);
      }
    }

    expect(broken).toEqual([]);
  });
});

describe('page navigation', () => {
  it.each([
    ['index.html', 'index.html'],
    ['guide.html', 'guide.html'],
    ['help.html', 'help.html'],
    ['play-test.html', null],
    ['lecture.html', 'lecture.html'],
  ])('%s marks its own page in the top navigation', (name, current) => {
    const page = read(name);
    const links = [...page.querySelectorAll<HTMLAnchorElement>('.sa-nav a')];
    const marked = links.filter((link) => link.getAttribute('aria-current') === 'page');

    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      'index.html',
      'lecture.html',
      'guide.html',
      'help.html',
    ]);
    expect(marked.map((link) => link.getAttribute('href'))).toEqual(current ? [current] : []);
  });
});
