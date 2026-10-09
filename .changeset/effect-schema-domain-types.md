---
"@aurelienbbn/oxlint-plugin-effect": minor
---

Adds `effect/schema-domain-types`: in a domain folder (`**/domain/**` by default, option `files`; tests and scripts skipped, option `allow`), an interface, an object type alias (bare, in `Readonly<>`, an array, a union or an intersection), a union of literal types or an enum is reported, so the domain is declared as Schemas (`Schema.Struct`, `Schema.TaggedStruct`, `Schema.Union`, `Schema.Literals`) with the type derived by `typeof X.Type`. Generic declarations, declarations holding behavior or runtime handles (`Schema.*`, `Effect.*` members), unions of named types and an empty interface extending a schema type stay silent. No autofix.
