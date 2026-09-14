# Contributing

Thank you for improving the traQ Markdown engine. This document defines the
contribution contract and the shortest path to a verified change. Detailed build
instructions, architecture, testing guidance, and release operations are linked
below.

## Get started

Install the required tools and build the workspace from the repository root:

```sh
bun install --frozen-lockfile
bun run build
bun run check
```

See the [development guide](docs/development.md) for supported tool versions,
common commands, local package iteration, and the generated-artifact pipeline.

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

Read [architecture.md](docs/architecture.md) for the complete ownership map and
dependency direction.

## Verify your change

Run the narrowest relevant check while iterating, then run `bun run check` for a
cross-package or release-bound change. Build before individual Wasm or Go tests.
After changing Rust contracts, run `bun run build`, inspect the generated diff,
and then run `bun run check`.

The [testing guide](docs/testing.md) maps change types to commands and explains
generated-source, fixture, corpus, Go concurrency, and packed-consumer checks.

## Documentation map

| Document                                           | Audience and purpose                                           |
| -------------------------------------------------- | -------------------------------------------------------------- |
| [Development guide](docs/development.md)           | Local setup, builds, generation, and workspace tooling         |
| [Architecture and ownership](docs/architecture.md) | Package boundaries and dependency direction                    |
| [Testing and compatibility](docs/testing.md)       | Checks, fixtures, corpus comparison, and compatibility policy  |
| [Release runbook](docs/maintainers/releasing.md)   | Maintainers preparing, publishing, and recovering npm releases |

The release runbook is intentionally separate from ordinary contribution
guidance. It contains maintainer-only operational steps, including npm trusted
publisher setup and partial-publication recovery.
