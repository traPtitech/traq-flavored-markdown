# Releasing npm packages

This is a maintainer runbook. It records the operational steps for publishing;
it is not required reading for ordinary contributions.

## Release policy

The four public npm packages are released together at one shared version:

| npm package                               | Package directory             |
| ----------------------------------------- | ----------------------------- |
| `@traq-markdown-engine/core`              | `packages/core`               |
| `@traq-markdown-engine/commonmark-plugin` | `packages/plugins/commonmark` |
| `@traq-markdown-engine/traq-plugin`       | `packages/plugins/traq`       |
| `@traq-markdown-engine/sdk`               | `packages/sdk`                |

The root workspace and `tools` workspaces remain private. Internal peer
dependencies use the exact shared version. A release does not update external
dependencies, tooling, Rust crates, Go modules, or their versions.

Release versions are `<version>` and tags are `v<version>`. The release workflow
synchronizes the root and public package `package.json` files, sibling peer
dependencies, and `bun.lock` in its isolated runner before it builds. After all
checks succeed, it writes those generated metadata changes to the default branch
in a `<version>` commit, publishes the packages, then creates the `v<version>`
tag and its GitHub Release with generated notes.

## Prepare and validate

`bun run release` is the workflow's release primitive. It performs a dry run by
default; `--publish` is the only mode that publishes. Local use is optional and
is useful only when investigating a failed workflow.

```sh
bun run release -- v0.1.1 --prepare  # synchronize manifests, peer dependencies, and bun.lock
bun run release -- v0.1.1 --check    # validate the synchronized manifests and peer graph
bun run release -- v0.1.1            # pack all packages and dry-run publishing
bun run release -- v0.1.1 --publish  # publish all packages
```

`--prepare` uses native npm workspace commands to update the root and all public
package versions, set sibling peer dependencies, and let Bun update `bun.lock`.
It does not tag, commit, reify dependencies, or change external dependency,
tooling, Rust crate, or Go module versions.

## Normal release

From the Actions page, run `Release npm packages` on the default branch. Select
whether to increment `patch`, `minor`, or `major`, then turn off `dry_run`. Do
not run a local build, dry run, `--prepare`, or create a tag.

The workflow checks out the current default branch, calculates the next stable
SemVer version from its root `package.json`, synchronizes release metadata,
builds the workspace, and runs `bun run check`. It then commits only the
synchronized manifests and `bun.lock` to the default branch with the message
`<version>`, publishes all four workspaces in dependency order (core,
commonmark-plugin, traq-plugin, then SDK), and creates an annotated `v<version>`
tag on that commit followed by a GitHub Release with generated notes. These
three increment options produce stable releases using the `latest` dist-tag. The
global `npm-publish` concurrency group serializes queued releases.

The workflow uses GitHub Actions OIDC and only accepts manual dispatch from the
default branch. A dry run synchronizes metadata on its isolated runner without
committing, tagging, publishing, or creating a GitHub Release.

## Trusted publishing

Configure a GitHub Actions trusted publisher in the npm settings of each
existing package:

- Organization or user: `uni-kakurenbo`
- Repository: `traq-markdown-engine`
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
`bun run check`.

For example, if core and commonmark-plugin were published:

```sh
npm publish --workspace=packages/plugins/traq --workspace=packages/sdk --access public --ignore-scripts --tag latest
```

Use `--tag next` for a prerelease. npm does not retry a partial publication. If a
local `min-release-age` policy hides newly published versions from `npm view`,
add `--min-release-age-exclude=@traq-markdown-engine/*` to that inspection
command.

For npm's current settings, see its
[trusted-publishing guide](https://docs.npmjs.com/trusted-publishers/) and
[`npm trust` reference](https://docs.npmjs.com/cli/v11/commands/npm-trust/).
