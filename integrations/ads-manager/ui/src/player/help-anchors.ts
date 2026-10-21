import type { PlayerOptionGroup } from './player-options';

/**
 * Fixed anchors of the public help page `examples/help.html` (contract A2-D 4). `public/examples/options.js` has the
 * same functions for the page itself; `tests/admin/examples.test.ts` checks that both give the same anchor for every
 * row.
 */

/** Help page sections, in page order. */
export const HELP_SECTIONS = [
  'install',
  'attributes',
  'js-api',
  'events',
  'precedence',
  'autoplay',
  'language',
  'preset-fields',
  'failure',
  'same-origin',
] as const;

export type HelpSection = (typeof HELP_SECTIONS)[number];

/** Help-only install groups, beside the admin's `playerOptions` groups. */
export type HelpOptionGroup = PlayerOptionGroup['id'] | 'mount' | 'events';

// Groups whose row names repeat in other groups (`media`, `preset`) get their own prefix.
function anchorPrefix(group: HelpOptionGroup | undefined): string {
  switch (group) {
    case 'mount':
      return 'mount-';
    case 'events':
      return 'event-';
    case 'exampleQuery':
      return 'query-';
    default:
      return '';
  }
}

/** `opt-<name>` for an install option row: leading `--` removed, lowercased, only `a-z`, `0-9` and `-` kept. */
export function optionAnchor(name: string, group?: HelpOptionGroup): string {
  const slug = name
    .replace(/^--/, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '');

  return `opt-${anchorPrefix(group)}${slug}`;
}

/** `field-<path>` for a preset field, dots as `-`. */
export function fieldAnchor(path: string): string {
  return `field-${path.replaceAll('.', '-')}`;
}

/** Help page address for `anchor` (a section, `optionAnchor` or `fieldAnchor`), relative to the examples directory. */
export function helpHref(anchor: HelpSection | string): string {
  return `help.html#${anchor}`;
}
