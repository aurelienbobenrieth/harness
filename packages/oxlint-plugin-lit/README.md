# @aurelienbbn/oxlint-plugin-lit

Custom oxlint rules for Lit `html` tagged templates. oxlint's built-in jsx-a11y rules only cover JSX; these rules bring the highest-value equivalents to lit-html templates. For the full ruleset under ESLint, see `eslint-plugin-lit-a11y` (open-wc) — this plugin exists so oxlint-only toolchains keep the essentials.

## Rules

- `lit/no-shadow-dom`: components extending a Lit base class must define `createRenderRoot() { return this; }` (light DOM). Configure `baseClasses` for project base classes to check and `lightDomBaseClasses` for base classes that already fix the render root.
- `lit/template-img-alt`: `img` elements in `html` templates need an `alt` attribute (static, bound, or empty for decorative images).
- `lit/template-no-positive-tabindex`: positive `tabindex` values break natural focus order.
- `lit/template-no-autofocus`: `autofocus` steals focus and disorients assistive technology users.

## Notes

Rules match the static parts of templates; attribute bindings (`alt=${...}`) count as present. Only `html` and `svg` tagged templates are scanned.
