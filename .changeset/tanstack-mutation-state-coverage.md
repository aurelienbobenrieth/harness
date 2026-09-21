---
"@aurelienbbn/agentlint-plugin-tanstack-query": minor
---

Add `mutation-state-coverage` to the strict preset. It reviews user-triggered `useMutation` calls for visible pending, error, retry, success, duplicate-submission, and paused/offline behavior while leaving tests and custom wrappers silent.
