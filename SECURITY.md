# Security

Keep vulnerability details private until maintainers have a fix or a coordinated disclosure plan. Do not put credentials, customer data, working exploits, or private project source in public issues.

Use **Report a vulnerability** in this repository's [Security tab](https://github.com/aurelienbobenrieth/harness/security). If GitHub makes that route temporarily unavailable, open an issue containing only a request for a private reporting channel, or contact a maintainer through an already established private channel. This repository does not currently advertise a monitored security email address.

Private vulnerability reporting, vulnerability alerts, and Dependabot security updates were enabled and verified through the GitHub API on 2026-09-21; see [release readiness](docs/release-readiness.md).

A private report should include the affected package and version, supported runtime, a minimal reproduction, impact, and any suggested fix. Maintainers should confirm receipt, reproduce the report, agree a disclosure window with the reporter, and release an advisory with the fix. No response-time or support SLA is promised.

Development currently targets the latest source and the candidate packages in [the release policy](policy/release.json). Draft packages are private and excluded from publication. Historical release branches have no promised security-backport window. Tool findings and passing conformance checks cover their documented contracts; they are not a complete security audit of a consumer application.
