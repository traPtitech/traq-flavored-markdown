# Contributing

Thank you for improving the traQ Markdown engine. This document defines the
contribution contract; the linked guides own setup, testing, and release details.

## Get started

Follow the [development guide](docs/development.md) to set up the workspace and
build its generated artifacts.

## Contribution policy

- **Rust contracts are authoritative.** Payload types, validation, grammar
  presets, and processing contracts originate in Rust. Review regenerated
  TypeScript and Go files, but do not hand-edit them.
- **Preserve compatibility deliberately.** A grammar version is a persistent
  interpretation of stored source. Do not change an existing version's accepted
  meaning; add a new version when behavior must change. Never regenerate a
  compatibility fixture from the parser under test.
- **Keep dependencies flowing downward.** Core does not depend on plugins or
  traQ. Plugins may depend on core, and the SDK composes them for traQ. Keep
  application policy and artifact-specific code in the SDK, and shared generators
  in `scripts/codegen`.
- **Keep code with its owner.** Place implementation and its tests in the owning
  package. Package README files describe public APIs; do not introduce a second
  source of truth for an API in a root document.
- **Do not commit private data.** Fixtures contain no production messages or
  credentials. Private corpus inputs and reports belong under ignored `.private`
  directories.

The [architecture guide](docs/architecture.md) is the source of truth for
package ownership and dependency direction.

## Verify your change

Run the narrowest relevant check while iterating, then run `bun run check` for a
cross-package or release-bound change. The [testing guide](docs/testing.md)
maps changes to checks and covers generated sources, fixtures, corpus comparison,
Go concurrency, and packaged consumers. Maintainers should use the separate
[release runbook](docs/maintainers/releasing.md).
