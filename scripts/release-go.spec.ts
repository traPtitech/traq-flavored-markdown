import { copyFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

import { expect, test } from 'bun:test'

import { repositoryRoot } from './paths.ts'
import {
  goReleaseModules,
  goReleaseTags,
  runGoRelease,
  validateGoMod,
  validateGoWork
} from './release-go.ts'
import { withTempDirectory } from './testing/temp-directory.ts'

const repository = 'github.com/uni-kakurenbo/traq-flavored-markdown'
const core = `${repository}/packages/core/go`
const sdk = `${repository}/packages/sdk/go`
const publishedModules = goReleaseModules.map(
  module => `${repository}/${module.directory}`
)

test('Go tags use each module directory as their prefix', () => {
  expect(goReleaseTags('v0.1.4')).toEqual([
    'packages/core/go/v0.1.4',
    'packages/plugins/commonmark/go/v0.1.4',
    'packages/plugins/traq/go/v0.1.4',
    'packages/sdk/go/v0.1.4'
  ])
})

test('Go module validation rejects unpublished versions and replacements', () => {
  const manifest = {
    Module: { Path: sdk },
    Require: [{ Path: core, Version: 'v0.1.4' }],
    Replace: null
  }
  expect(() =>
    validateGoMod(manifest, 'packages/sdk/go', ['packages/core/go'], 'v0.1.4')
  ).not.toThrow()
  manifest.Require[0].Version = 'v0.0.0-00010101000000-000000000000'
  expect(() =>
    validateGoMod(manifest, 'packages/sdk/go', ['packages/core/go'], 'v0.1.4')
  ).toThrow('Go dependencies')
  manifest.Require[0].Version = 'v0.1.4'
  expect(() =>
    validateGoMod(
      { ...manifest, Replace: [{}] },
      'packages/sdk/go',
      ['packages/core/go'],
      'v0.1.4'
    )
  ).toThrow('module-local replacements')
})

test('workspace replacements must point at the tagged local modules', () => {
  const workspace = {
    Use: [
      'packages/core/go',
      'packages/plugins/commonmark/go',
      'packages/plugins/traq/go',
      'packages/sdk/go',
      'packages/sdk/examples/go'
    ].map(directory => ({ DiskPath: `./${directory}` })),
    Replace: [
      'packages/core/go',
      'packages/plugins/commonmark/go',
      'packages/plugins/traq/go',
      'packages/sdk/go'
    ].map(directory => ({
      Old: { Path: `${repository}/${directory}`, Version: 'v0.1.4' },
      New: { Path: `./${directory}` }
    }))
  }
  expect(() => validateGoWork(workspace, 'v0.1.4')).not.toThrow()
  workspace.Replace[0].Old.Version = 'v0.1.3'
  expect(() => validateGoWork(workspace, 'v0.1.4')).toThrow(
    'go.work replacements'
  )
})

test('Go release refuses v2 until module paths have a major suffix', async () => {
  await expect(runGoRelease(['v2.0.0', '--check'])).rejects.toThrow('usage:')
})

test('Go release preparation synchronizes all module and workspace versions', async () => {
  await withTempDirectory('markdown-go-release-', async root => {
    const directories = [
      'packages/core/go',
      'packages/plugins/commonmark/go',
      'packages/plugins/traq/go',
      'packages/sdk/go',
      'packages/sdk/examples/go'
    ]
    await copyFile(
      path.join(repositoryRoot, 'go.work'),
      path.join(root, 'go.work')
    )
    for (const directory of directories) {
      await mkdir(path.join(root, directory), { recursive: true })
      await copyFile(
        path.join(repositoryRoot, directory, 'go.mod'),
        path.join(root, directory, 'go.mod')
      )
      await copyFile(
        path.join(repositoryRoot, directory, 'go.sum'),
        path.join(root, directory, 'go.sum')
      )
    }
    await runGoRelease(['v0.1.4', '--prepare'], root)
    await runGoRelease(['v0.1.4', '--check'], root)
    expect(await Bun.file(path.join(root, 'go.work')).text()).toContain(
      'packages/sdk/go v0.1.4 => ./packages/sdk/go'
    )
    expect(
      await Bun.file(path.join(root, 'packages/sdk/go/go.mod')).text()
    ).toContain(`${core} v0.1.4`)
    expect(
      await Bun.file(path.join(root, 'packages/sdk/go/go.sum')).text()
    ).not.toContain('v0.0.0-20260909')
    const list = Bun.spawn(['go', 'list', '-m', ...publishedModules], {
      cwd: path.join(root, 'packages/sdk/go'),
      env: { ...Bun.env, GOWORK: path.join(root, 'go.work'), GOPROXY: 'off' },
      stdout: 'pipe',
      stderr: 'pipe'
    })
    const [modules, diagnostics, exitCode] = await Promise.all([
      new Response(list.stdout).text(),
      new Response(list.stderr).text(),
      list.exited
    ])
    expect(diagnostics).toBe('')
    expect(exitCode).toBe(0)
    expect(modules.trim().split(/\r?\n/)).toEqual(publishedModules)
  })
}, 30_000)
