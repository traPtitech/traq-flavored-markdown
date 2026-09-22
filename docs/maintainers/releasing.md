# Releasing npm packages and Go modules

This is a maintainer runbook. It records the operational steps for publishing;
it is not required reading for ordinary contributions.

## Release policy

The four public npm packages and four Go modules are released together at one
shared version:

| npm package                                 | Package directory             |
| ------------------------------------------- | ----------------------------- |
| `@traq-flavored-markdown/core`              | `packages/core`               |
| `@traq-flavored-markdown/commonmark-plugin` | `packages/plugins/commonmark` |
| `@traq-flavored-markdown/traq-plugin`       | `packages/plugins/traq`       |
| `@traq-flavored-markdown/sdk`               | `packages/sdk`                |

| Go module directory              | Tag                                         |
| -------------------------------- | ------------------------------------------- |
| `packages/core/go`               | `packages/core/go/v<version>`               |
| `packages/plugins/commonmark/go` | `packages/plugins/commonmark/go/v<version>` |
| `packages/plugins/traq/go`       | `packages/plugins/traq/go/v<version>`       |
| `packages/sdk/go`                | `packages/sdk/go/v<version>`                |

The root workspace and `tools` workspaces remain private. Internal peer
dependencies and Go module requirements use the exact shared version. The Go
example is not published as a module. A release does not update external
dependencies, tooling, or Rust crate versions.

Release versions are `<version>`. The npm release tag is `v<version>`; each Go
module uses its directory prefix, such as `packages/sdk/go/v<version>`. All five
tags point to the same release commit. The workflow synchronizes npm manifests,
`bun.lock`, Go requirements and sums, and `go.work` in its isolated runner. The
SDK Go module includes its matching Wasm as `parser.wasm`. After checks pass, the
workflow commits release metadata, publishes npm packages, pushes all tags, and
verifies a Go consumer with `GOWORK=off` before creating the GitHub Release.
The first synchronized Go release is v0.1.4; earlier npm tags have no Go module
tags. Go v2 and later require `/v2` module paths, so the workflow rejects a
version beyond v1 until those paths are migrated.

## Prepare and validate

`bun run release` prepares and publishes npm packages. The separate
`scripts/release-go.ts` synchronizes and checks Go module versions; pushing the
four prefixed Git tags publishes them to Go consumers. Local use is optional and
is useful when investigating a failed workflow.

```sh
bun run release -- v0.1.4 --prepare
bun run scripts/release-go.ts v0.1.4 --prepare
bun run release -- v0.1.4 --check
bun run scripts/release-go.ts v0.1.4 --check
bun run release -- v0.1.4            # pack and dry-run npm publishing
bun run scripts/release-go.ts v0.1.4 --tags
```

The npm `--prepare` uses native npm workspace commands and updates `bun.lock`.
The Go `--prepare` updates all internal `go.mod` requirements, including the
example, and the root `go.work` replacements. Neither command commits, tags,
publishes, or changes external dependencies. `bun run check` builds the SDK and
verifies that its tracked Go Wasm has the same source build ID, contract, and ABI
as the build. It also runs a temporary
consumer with `GOWORK=off` and local release-candidate modules.

## Normal release

From the Actions page, run `Release npm and Go packages` on the default branch.
Select whether to increment `patch`, `minor`, or `major`, then turn off `dry_run`.
Do not run a local build, dry run, `--prepare`, or create a tag.

The workflow checks out the current default branch, calculates the next stable
SemVer version from its root `package.json`, synchronizes npm and Go release
metadata, and runs `bun run check`. It commits the synchronized manifests,
`bun.lock`, `go.work`, Go sums, and tracked Go Wasm to the default branch with
the message `chore(release): <version>`. It publishes the npm workspaces in
dependency order (core, commonmark-plugin, traq-plugin, then SDK), then atomically pushes the npm tag and
four Go module tags for that commit. A fresh consumer fetches the tagged Go SDK
without `go.work` or local replacements and runs the bundled Wasm. The workflow
then creates a GitHub Release with generated notes. These increment options
produce stable npm releases using the `latest` dist-tag. The global
`package-publish` concurrency group serializes queued releases.

The workflow uses GitHub Actions OIDC and only accepts manual dispatch from the
default branch. A dry run synchronizes metadata and tests a local external Go
consumer on its isolated runner without committing, tagging, publishing, or
creating a GitHub Release.

## Trusted publishing

Configure a GitHub Actions trusted publisher in the npm settings of each
existing package:

- Organization or user: `traPtitech`
- Repository: `traq-flavored-markdown`
- Workflow filename: `release.yml`
- Environment: leave empty unless the workflow later uses a GitHub environment
- Allowed action: enable direct `npm publish`; otherwise a new configuration only
  permits staged publishing

No npm token or GitHub Actions secret is required for publishing. The workflow
uses its short-lived OIDC identity. Its `GITHUB_TOKEN` also needs permission to
push the generated release commit to the default branch; allow the GitHub
Actions bot to bypass any branch rule that would reject that push.

## Recover from a partial publication

Native npm publishing is sequential, not atomic, and stops at the first failure.
Published versions are immutable. Do not rerun the full release after a partial
failure. The generated `<version>` commit is already on the default branch at
this point. Use `npm view` to identify published packages, then publish only the
remaining workspaces from that commit after a successful
`bun run check`. The Go tags have not yet been pushed.

For example, if core and commonmark-plugin were published:

```sh
npm publish --workspace=packages/plugins/traq --workspace=packages/sdk --access public --ignore-scripts --tag latest
```

Use `--tag next` for a prerelease. npm does not retry a partial publication. If a
local `min-release-age` policy hides newly published versions from `npm view`,
add `--min-release-age-exclude=@traq-flavored-markdown/*` to that inspection
command.

After the npm packages are complete, push the npm release tag and four Go module
tags from the release commit, then run
`bun run scripts/checks/go-consumer.ts v<version> --remote` and create the GitHub
Release. Never move an existing published Go tag. If the tag push fails, inspect
all five remote tags before retrying; the workflow uses one atomic push so they
should either all exist or all be absent. If the remote Go consumer check fails
after the tags are published, diagnose the download or module graph and publish a
new version for any content correction.

For npm's current settings, see its
[trusted-publishing guide](https://docs.npmjs.com/trusted-publishers/) and
[`npm trust` reference](https://docs.npmjs.com/cli/v11/commands/npm-trust/).
