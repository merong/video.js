# 솔애드 관리자 design system guide

Use this when building or restyling ads manager screens. `README.md` holds the usage rules (type, color, status, spacing, copy, accessibility); read it first, then the `components/<Name>/README.md` of every component you use.

## Using it in a screen

- Load `components/fonts.css`, then `tokens.css`, then `components/bundle.css`. Use the `sa-` classes and markup shown in each `components/<Name>/preview.html`; `components/Dashboard/` and `components/ExecutionList/` show full screens.
- Style through `var(--…)` tokens only. Do not add raw hex colors, shadows, or font sizes that are not in `tokens.json`.
- Put `sa-dense` on table cards only and `sa-kpis is-hero` on dashboard and report KPI rows only.
- The logo text is "솔애드 관리자" (`sa-logo`); keep it in the side menu head (`sa-side-head`) and the browser tab title.
- Public player pages (demo, guide, help, play test) use "솔애드 플레이어" instead; see `components/DocShell/README.md`.

## Changing it

- Change values in `tokens.json`, then run `node design/build-tokens.mjs`. Never edit `tokens.css` by hand.
- A new component gets styles in `components/bundle.css` with the `sa-` prefix, plus `components/<Name>/README.md`, `components/<Name>/preview.html`, and an entry in `index.html`.
- Previews must open standalone: link `../fonts.css`, `../../tokens.css`, and `../bundle.css` like the existing ones.
- Run `pnpm lint:fix:file <file>` on changed files.
