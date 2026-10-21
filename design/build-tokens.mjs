/**
 * Compiles `tokens.json` into `tokens.css`.
 *
 * The first color theme fills `:root`; later themes override only the values that differ. A theme named `dark` also
 * follows `prefers-color-scheme` unless the page pins `data-theme="light"`.
 *
 * Run: `node design/build-tokens.mjs`
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const tokens = JSON.parse(readFileSync(join(DIR, 'tokens.json'), 'utf8'));
const [firstTheme, ...otherThemes] = tokens.color.themes.map((theme) => theme.id);

// Color values are per-theme objects; a theme without its own value inherits the first theme's. `{name}` aliases
// another color token.
function colorValue(token, theme) {
  const value = token.value[theme] ?? token.value[firstTheme];

  return value.startsWith('#') ? value.toLowerCase() : value.replace(/^\{(.+)\}$/, 'var(--$1)');
}

function block(selector, entries, extra = []) {
  // Long values wrap the way the repository formatter does (print width 120).
  const lines = entries
    .map(([name, value]) => {
      const line = `  --${name}: ${value};`;

      return line.length > 120 ? `  --${name}:\n    ${value};` : line;
    })
    .concat(extra.map((line) => `  ${line}`));

  return `${selector} {\n${lines.join('\n')}\n}`;
}

function indent(text) {
  return text
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n');
}

const base = tokens.color.tokens.map((token) => [token.name, colorValue(token, firstTheme)]);
const out = [
  `/* ${tokens.name} — generated from tokens.json */`,
  block(`:root,\n[data-theme="${firstTheme}"]`, base, ['color-scheme: light;']),
];

for (const theme of otherThemes) {
  const changed = tokens.color.tokens
    .map((token, i) => [token.name, colorValue(token, theme), base[i][1]])
    .filter(([, value, baseValue]) => value !== baseValue)
    .map(([name, value]) => [name, value]);

  if (theme === 'dark') {
    out.push(
      `@media (prefers-color-scheme: dark) {\n${indent(block(':root:not([data-theme="light"])', changed, ['color-scheme: dark;']))}\n}`
    );
  }

  out.push(block(`[data-theme="${theme}"]`, changed, theme === 'dark' ? ['color-scheme: dark;'] : []));
}

const scalars = Object.entries(tokens)
  .filter(([key, family]) => key !== 'color' && key !== 'type' && Array.isArray(family?.tokens))
  .flatMap(([, family]) => family.tokens.map((token) => [token.name, token.value]));
const families = Object.entries(tokens.type.families).map(([key, stack]) => [`font-${key}`, stack]);

out.push(block(':root', [...scalars, ...families]));
writeFileSync(join(DIR, 'tokens.css'), `${out.join('\n\n')}\n`);
