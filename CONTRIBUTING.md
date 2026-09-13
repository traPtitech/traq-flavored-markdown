# Development

Use Node 24 with npm 11.17.0, Bun 1.3.14+, Go 1.26+, and rustup. The Rust toolchain
and Wasm target are pinned in `rust-toolchain.toml`. Windows additionally needs the
MSVC C++ build tools; WSL and Bash are not required.

Run shared commands from the repository root:

```sh
bun install --frozen-lockfile
bun run build
bun run check
bun run --cwd packages/sdk examples
```

## Ownership

| Location                                     | Responsibility                                                                  |
| -------------------------------------------- | ------------------------------------------------------------------------------- |
| `packages/core`                              | Grammar-independent AST, declarations, parsing, rendering, extraction and codec |
| `packages/plugins/commonmark`                | CommonMark and generic extension contracts, syntax and rendering                |
| `packages/plugins/traq`                      | traP extension contracts, syntax, rendering and extraction                      |
| `packages/sdk/crates/grammar`                | Published grammar presets and their catalog                                     |
| `packages/sdk/crates/processing`             | traQ notification, message and extraction policies                              |
| `packages/sdk/crates/wasm`                   | Wasm ABI and exported contracts                                                 |
| `packages/sdk/typescript`, `packages/sdk/go` | traQ SDK, preset and artifact selection                                         |
| `packages/sdk/styles`                        | traQ presentation CSS                                                           |
| `packages/sdk/scripts`                       | traQ artifact build and distribution-specific code generation                   |
| `scripts/codegen`                            | Shared Go and TypeScript contract generation, with its tests                    |
| `scripts/checks`                             | Repository dependency boundaries, generated sources and packaged consumers      |
| `tools/corpus`                               | Corpus collection/comparison CLI, viewer, dependencies and tests                |
| `tests/fixtures`                             | Shared CommonMark specification data and attribution                            |
| `packages/sdk/tests/fixtures`                | Frozen traQ compatibility expectations shared across languages                  |

Keep component code with its owner, grouped into `crates`, `typescript` and `go`.
Core does not depend on plugins or traQ. Plugins may depend on core; the traP
syntax also uses CommonMark syntax. The SDK composes these parts for traQ and owns application
policy. Parser, renderer and extractor share a native AST without depending on
the codec or Wasm distribution.

A script that knows traQ presets or artifact metadata belongs to the SDK. Shared
code generators belong to `scripts/codegen`; root entry points coordinate them.
Keep generator tests beside the generator. Package README files describe their
APIs and responsibilities; this file owns common development instructions.

## Generation and build

Rust is the source of truth for payload types, validation, presets and processing
contracts. Bindings are authored in TypeScript; JavaScript and declarations are
build outputs. Do not hand-edit generated TypeScript or Go files.

The root `build` command runs the following pipeline:

1. Export Rust contracts and generate **all** plugin and SDK bindings.
2. Compile TypeScript packages in dependency order.
3. Build and package the traQ Wasm, JavaScript, declarations and CSS, then write
   `packages/sdk/dist/contract.json` with the artifact digest.

Generated sources remain in each owner's `typescript/generated` and
`go/generated_*.go`. Intermediate Rust contracts are under `target/`; distributable
outputs are under each package's `dist/`. Source changes, including path changes
in the Rust inputs, can change the Wasm build ID. Rebuild and distribute the SDK
and Wasm together; runtime initialization rejects mismatched IDs.

```sh
bun run generate:bindings             # update generated sources explicitly
bun run scripts/generate-bindings.ts commonmark-plugin
bun run scripts/generate-bindings.ts traq-plugin
bun run scripts/generate-bindings.ts sdk
bun run build                         # generate and build the four packages
bun run check:generated               # regenerate and reject changed sources
bun run build:corpus                  # build the standalone report viewer
```

The full `check` command compares generated sources before and after generation
within its build stage, then compiles and tests those same sources. It performs
generation once. This checks reproducibility against the working files, including
added or removed outputs, and does not require a clean Git index. After editing
Rust contracts, run `build`, review the generated diff, then run `check`.

Individual package `build` and `typecheck` commands are for iteration after the
root build has prepared dependency outputs. The SDK's individual build regenerates
its own bindings. Use the root build after changing plugin contracts.

## Verification

`bun run check` runs formatting, lint, dependency boundaries, binding freshness,
all package and corpus builds, type checking, TypeScript/Rust/Go tests, Clippy and
packed consumer verification. CI runs this command on Ubuntu and Windows.

`check:package` packs all four distributable packages into a fresh temporary
consumer and checks public declarations, AST parsing, HTML, CSS and the Wasm
digest. Temporary files and archives are removed afterwards. API examples are
available through `bun run --cwd packages/sdk examples`.

Go tests execute the built Wasm. Build first when invoking them separately; use
`-count=1` when the Wasm artifact changes to avoid stale test-cache results.
Changes to Go concurrency also require
`go -C packages/sdk/go test -race ./...` with a supported C compiler installed.

`packages/sdk/crates/processing` borrows native ASTs. Its normal dependencies must
not include `markdown-codec`. Native Rust and Go/Wasm exercise 787 frozen
notification expectations. TypeScript/Wasm covers extraction, and TypeScript
covers HTML rendering. Packed consumers and examples exercise public processing
APIs.

## Publishing to npm

Only these four packages are published publicly to npm:

| npm package                               | Package directory             |
| ----------------------------------------- | ----------------------------- |
| `@traq-markdown-engine/core`              | `packages/core`               |
| `@traq-markdown-engine/commonmark-plugin` | `packages/plugins/commonmark` |
| `@traq-markdown-engine/traq-plugin`       | `packages/plugins/traq`       |
| `@traq-markdown-engine/sdk`               | `packages/sdk`                |

The root workspace and `tools` workspaces stay private. The public packages
are independently installable and composable, but every release synchronizes
the root and all four package versions. Internal peer dependencies must use the
same exact version. Releases never update external dependencies, tools, Rust
crates, Go modules, or their versions.

Release tags are `v<version>`. The tag version must match the root and all four
package `package.json` versions, and every sibling peer dependency must use that
exact version. `bun run release` defaults to a dry run; `--publish` is the only
mode that performs a live publish. A dry run also checks the npm registry, so its
version must be unpublished and match the manifests on the selected branch.
Prepare an unreleased version before testing a release.

```sh
bun run release -- v0.1.1 --prepare  # synchronize manifests, peer dependencies, and bun.lock
bun run release -- v0.1.1 --check    # validate manifests and peer graph without packing or network access
bun run release -- v0.1.1            # pack all packages and dry-run publishing
bun run release -- v0.1.1 --publish  # publish all packages
```

`--prepare` is a thin wrapper around native npm workspace commands. It updates the
root and all four public package versions with `npm version`, sets internal peer
dependencies to the exact version with `npm pkg set`, and lets Bun update
`bun.lock`. It does not create a tag or commit and does not reify dependencies.
It preserves external dependencies and the versions of tools, Rust crates, and Go
modules.

### Normal release

Prepare and validate a release before committing its synchronized manifests and
lockfile. Push the commit before pushing its release tag.

```sh
bun run release -- v0.1.1 --prepare
bun run check
bun run release -- v0.1.1
git add package.json packages/core/package.json packages/plugins/commonmark/package.json packages/plugins/traq/package.json packages/sdk/package.json bun.lock
git commit -m "Release v0.1.1"
git push
git tag v0.1.1
git push origin v0.1.1
```

The `v*` release workflow publishes all four workspaces with one native
`npm publish` invocation, in dependency order: core, commonmark-plugin,
traq-plugin, then SDK. It names all four workspaces explicitly; a parent workspace
selector would not include the nested plugin workspaces. Stable versions use the
`latest` dist-tag; prereleases use `next`. Global `npm-publish` concurrency
serializes queued releases.

### Initial trusted-publisher bootstrap

Use Node 24 with npm 11.17.0 and Bun 1.3.14. Sign in interactively with an npm
account that has two-factor authentication and owns the `@traq-markdown-engine`
organization. Verify that scope ownership before publishing; this repository does
not establish it.

```sh
npm login
bun install --frozen-lockfile
bun run build
bun run check
bun run release -- v0.1.0 --publish
```

After the initial release exists on npm, open each package's settings and add a
GitHub Actions trusted publisher:

- Organization or user: `uni-kakurenbo`
- Repository: `traq-markdown-engine`
- Workflow filename: `release.yml`
- Environment: leave empty unless the workflow later uses a GitHub environment.
- Allowed action: enable direct `npm publish`; new trusted-publisher configurations
  otherwise allow staged publishing only.

Configure this publisher for each of the four packages. The
`.github/workflows/release.yml` workflow uses GitHub Actions OIDC, builds the
workspace, runs `bun run check`, and publishes the synchronized set for a `v*`
tag. A manual workflow dispatch accepts a `v<version>` tag and defaults to a dry
run; dry runs use the selected branch and do not require that tag to exist. A live
manual dispatch checks out `refs/tags/<tag>` before publishing.

Native npm publishing is sequential rather than atomic and stops on the first
failure. A published version is immutable, so do not rerun the full release after
a partial failure. Use `npm view` to identify the packages already published, then
from the same unchanged tag and a build that passed `bun run check`, publish only
the remaining workspaces. For example, if core and commonmark-plugin were
published, run:

```sh
npm publish --workspace=packages/plugins/traq --workspace=packages/sdk --access public --ignore-scripts --tag latest
```

Use `--tag next` for a prerelease. npm does not retry a partial release
automatically.

If a local `min-release-age` policy hides newly published versions from `npm view`,
add `--min-release-age-exclude=@traq-markdown-engine/*` to that inspection command.

See npm's [trusted-publishing guide](https://docs.npmjs.com/trusted-publishers/)
and [`npm trust` reference](https://docs.npmjs.com/cli/v11/commands/npm-trust/)
for the current npm UI and trusted-publisher details.

## Dependencies and module paths

All Rust crates use the root Cargo workspace and lockfile. Root
`workspace.dependencies` declares cross-package paths; crates within a package may
use relative paths. No sibling checkouts or machine-local Cargo patches are needed.

The root `go.work` connects the local Go modules and owns version-specific local
replacements for their unpublished dependency versions. This keeps workspace
resolution offline without repeating replacements in every module. `go mod tidy`
works on an individual module rather than this workspace graph, so use workspace
tests and `go list -m all` to verify local resolution during development.
Their module paths match the
repository layout, including `packages/plugins/commonmark/go` and
`packages/plugins/traq/go`. Update external Go consumers to those paths when
migrating from the previous flat layout. The npm package identities are
`@traq-markdown-engine/core`, `@traq-markdown-engine/commonmark-plugin`,
`@traq-markdown-engine/traq-plugin`, and `@traq-markdown-engine/sdk`.

`tsconfig.build.base.json` holds shared TypeScript emit options. Packages own their
source/output selections. `tsconfig.base.json` holds tooling type-check options;
the corpus has its own configuration. `scripts/tsc.ts` resolves the selected
compiler independently of package directory depth. The older `typescript`
dependency checks published declarations against the consumer compiler.

After dependency changes, rebuild and inspect generated contract diffs. The
corpus owns its viewer dependencies and comparison-specific libraries; shared
formatting, linting and compiler tools stay at the root.

## Fixtures and corpus

The unmodified CommonMark specification data has one copy in
[tests/fixtures](tests/fixtures/README.md). traQ's frozen AST and notification
expectations are in [its fixture directory](packages/sdk/tests/fixtures/README.md).
Do not regenerate compatibility expectations from the parser under test. Preserve
source, provenance, attribution and the accepted meaning of existing grammar IDs.

Fixtures contain no production messages or credentials. Private corpus data stays
in ignored `.private` directories. Collection, comparison, synthetic sample inputs
and the self-contained report are documented by the
[corpus tool](tools/corpus/README.md).
