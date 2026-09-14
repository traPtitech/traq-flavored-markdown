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

Release tags are `v<version>`. The tag version must match the root and all four
package `package.json` versions, and each sibling peer dependency must use that
exact version.

## Prepare and validate

`bun run release` performs a dry run by default; `--publish` is the only mode
that publishes. A dry run also checks the npm registry, so its version must be
unpublished and match the manifests on the selected branch. Prepare an
unreleased version before testing a release.

```sh
bun run release -- v0.1.1 --prepare  # synchronize manifests, peer dependencies, and bun.lock
bun run release -- v0.1.1 --check    # validate manifests and peer graph without packing or network access
bun run release -- v0.1.1            # pack all packages and dry-run publishing
bun run release -- v0.1.1 --publish  # publish all packages
```

`--prepare` uses native npm workspace commands to update the root and all public
package versions, set sibling peer dependencies, and let Bun update `bun.lock`.
It does not tag, commit, reify dependencies, or change external dependency,
tooling, Rust crate, or Go module versions.

## Normal release

Prepare and validate the release before committing the synchronized manifests
and lockfile. Push that commit before the release tag.

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

The `v*` workflow publishes all four workspaces in dependency order: core,
commonmark-plugin, traq-plugin, then SDK. Stable versions use the `latest`
dist-tag; prereleases use `next`. The global `npm-publish` concurrency group
serializes queued releases.

The workflow uses GitHub Actions OIDC, builds the workspace, runs `bun run
check`, and publishes the synchronized set for a `v*` tag. Manual dispatch takes
a `v<version>` tag and defaults to a dry run. A dry run uses the selected branch
without requiring the tag; a live dispatch checks out `refs/tags/<tag>`.

## First publication and trusted publishing

Use Node 24 with npm 11.17.0 and Bun 1.3.14. Sign in with an npm account that
uses two-factor authentication and owns the `@traq-markdown-engine` organization.
Verify that ownership before publishing; this repository does not establish it.

```sh
npm login
bun install --frozen-lockfile
bun run build
bun run check
bun run release -- v0.1.0 --publish
```

After the initial release, configure a GitHub Actions trusted publisher in the
npm settings of each package:

- Organization or user: `uni-kakurenbo`
- Repository: `traq-markdown-engine`
- Workflow filename: `release.yml`
- Environment: leave empty unless the workflow later uses a GitHub environment
- Allowed action: enable direct `npm publish`; otherwise a new configuration only
  permits staged publishing

## Recover from a partial publication

Native npm publishing is sequential, not atomic, and stops at the first failure.
Published versions are immutable. Do not rerun the full release after a partial
failure. Use `npm view` to identify published packages, then publish only the
remaining workspaces from the same unchanged tag after a successful
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
