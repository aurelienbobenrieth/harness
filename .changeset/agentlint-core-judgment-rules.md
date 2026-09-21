---
"@aurelienbbn/agentlint-plugin-core": minor
---

Add 4 judgment rules, all registered in strictPreset: comment-signal (narration comments and signature-restating docblocks, with an Effect-style good-docblock standard), test-behavior-coverage (mock-dense test files with zero outcome assertions), boundary-resilience (outbound network calls without a visible timeout/AbortSignal), and abstraction-earns-keep (premature-interface naming and single-delegation wrapper exports). Each rule ships a defineX(options) factory plus a default instance.
