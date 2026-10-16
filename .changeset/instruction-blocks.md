---
"@aurelienbbn/conformance-core": minor
---

Add `instruction-blocks`: marked blocks in `AGENTS.md` (or another instructions file) must match their source file exactly, so always-on agent rules are loaded every turn and still written once. Opt in with `instructionBlocks: { blocks: { <name>: "<source path>" } }`; unset, the check is skipped.
