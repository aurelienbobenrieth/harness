---
"@aurelienbbn/agentlint-plugin-shopify-app": minor
---

`settings-save-bar` (detector version 2) ignores forms on public routes (`_index`, `auth*`, `login*`, `signin`, `landing*`, `unauthenticated` path segments): the official template's landing and login forms are not embedded settings. `webhook-handler-review` (detector version 2) no longer fires on a trivial handler whose body only authenticates with `authenticate.webhook`, logs, and returns; any other statement, or a file naming a compliance topic, still reports.
