---
"@aurelienbbn/oxfmt-config": minor
---

`printWidth` drops from 120 to 100, oxfmt's own default and the width executor and t3code format at. Re-run `vp fmt` after upgrading; pass `printWidth: 120` to `defineOxfmtConfig` to keep the old width.
