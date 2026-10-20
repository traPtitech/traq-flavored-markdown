# Releasing npm packages and Go modules

This is a maintainer runbook. It records the operational steps for publishing;
it is not required reading for ordinary contributions.

## Release policy

The five public npm packages and five Go modules are released together at one
shared version:

| npm package                                 | Package directory             |
| ------------------------------------------- | ----------------------------- |
| `@traq-flavored-markdown/core`              | `packages/core`               |
| `@traq-flavored-markdown/commonmark-plugin` | `packages/plugins/commonmark` |
| `@traq-flavored-markdown/extensions-plugin` | `packages/plugins/extensions` |
| `@traq-flavored-markdown/traq-plugin`       | `packages/plugins/traq`       |
| `@traq-flavored-markdown/sdk`               | `packages/sdk`                |

| Go module directory              | Tag                                         |
| -------------------------------- | ------------------------------------------- |
| `packages/core/go`               | `packages/core/go/v<version>`               |
| `packages/plugins/commonmark/go` | `packages/plugins/commonmark/go/v<version>` |
| `packages/plugins/extensions/go` | `packages/plugins/extensions/go/v<version>` |
| `packages/plugins/traq/go`       | `packages/plugins/traq/go/v<version>`       |
| `packages/sdk/go`                | `packages/sdk/go/v<version>`                |

The root workspace and `tools` workspaces remain private. Internal peer
dependencies and Go module requirements use the exact shared version. The Go
example is not published as a module. A release does not update external
dependencies, tooling, or Rust crate versions.

Release versions are `<version>`. The npm release tag is `v<version>`; each Go
module uses its directory prefix, such as `packages/sdk/go/v<version>`. All six
tags point to the same release commit. The workflow synchronizes npm manifests,
`bun.lock`, Go requirements and sums, and `go.work` in its isolated runner. The
SDK Go module includes its matching Wasm as `parser.wasm`. After checks pass, the
workflow commits release metadata, publishes npm packages, pushes all tags, and
verifies a Go consumer with `GOWORK=off` before creating the GitHub Release.
The first synchronized Go release is v0.1.4; earlier npm tags have no Go module
tags. Go v2 and later require `/v2` module paths, so the workflow rejects a
version beyond v1 until those paths are migrated.

## Prepare and validate

All phases consume the same release plan: npm packages in dependency order,
Go module tags, generated output paths, changed release files, and artifacts.
The plan is derived from the workspace descriptor, manifests, and managed output
index. The version parser is shared by npm, Go, and external consumer checks;
stable releases use the `latest` dist-tag and prereleases use `next`.

`--plan` and `--files` inspect local inputs. `--inspect` also reads the npm
registry and remote Git tags without changing them. Local use is optional and
helps investigate a failed workflow.

```sh
bun run release -- v0.1.8 --plan
bun run release -- v0.1.8 --prepare
bun run release -- v0.1.8 --check
bun run release -- v0.1.8 --dry-run
bun run release -- v0.1.8 --inspect
```

`--prepare` updates npm versions and internal peers, `bun.lock`, all internal
Go requirements including the example, and `go.work` replacements. It does not
commit, tag, or publish. The lower-level `scripts/release-go.ts` commands remain
available for isolated module diagnostics. `bun run check` verifies generated
sources, semantic contract identity, source provenance, matching Wasm bytes,
and a temporary Go consumer with `GOWORK=off`.

## Normal release

From the Actions page, run `Release npm and Go packages` on the default branch.
Select whether to increment `patch`, `minor`, or `major`, then turn off `dry_run`.
Do not run a local build, dry run, `--prepare`, or create a tag.

The workflow checks out the current default branch, calculates the next stable
SemVer version from its root `package.json`, synchronizes npm and Go release
metadata, and runs `bun run check`. It commits the synchronized manifests,
`bun.lock`, `go.work`, Go sums, and tracked Go Wasm to the default branch with
the message `chore(release): <version>`. It publishes the npm workspaces in
dependency order (core, CommonMark, extensions, traQ, then SDK), then publishes
the npm release tag and five Go module tags for that commit. A fresh consumer fetches the tagged Go SDK
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

A partial publication is recoverable from the exact release commit. Published
npm versions and Git tags are immutable. Check out that commit, verify the
artifacts with `bun run check`, and inspect the remote state before resuming:

```sh
bun run release -- v0.1.8 --inspect
bun run release -- v0.1.8 --resume
```

`--resume` checks every npm version and release tag, skips completed actions,
and publishes only missing packages and tags. A remote tag pointing to a
different commit fails before any publishing begins. A local tag left by a
failed push is reused only when it already points to the release commit.
`--publish` performs the npm portion alone, as used by the normal workflow.
The CLI prints or performs the computed plan; it never moves an existing tag.

After resuming, run `bun run scripts/checks/go-consumer.ts v0.1.8 --remote`
and create the GitHub Release if that final workflow step did not complete.
If the published content needs correction, prepare a new version.

For npm's current settings, see its
[trusted-publishing guide](https://docs.npmjs.com/trusted-publishers/) and
[`npm trust` reference](https://docs.npmjs.com/cli/v11/commands/npm-trust/).
