---
"@aurelienbbn/oxlint-plugin-core": minor
---

Adds `core/workspace-boundaries`: reads the members of the nearest `pnpm-workspace.yaml` (or `package.json` `workspaces`) and reports an import, re-export, or `import()` between members when a package imports an app, a member reaches another by relative path, or the subpath is not opened by the target's `exports`. `apps` sets which member directories are deployables (default `["apps/**"]`); `forbidden` lists member directory pairs that never import each other, such as vertical packages or a kernel and its adapters. Off until enabled.
