import { cp } from 'node:fs/promises'
import path from 'node:path'

import { expect, test } from 'bun:test'

import { withTempDirectory } from '../infrastructure/temp-directory.ts'
import { dependencyGraph } from '../package-graph.ts'
import { repositoryRoot } from '../paths.ts'
import type { PackageName } from '../paths.ts'
import { runTasks } from './tasks.ts'
import { workspaceTasks } from './workspace.ts'

test('selective builds generate only artifacts reachable from the requested package', async () => {
  const graph = dependencyGraph<PackageName>([
    ['core', []],
    ['commonmark-plugin', ['core']],
    ['extensions-plugin', ['core', 'commonmark-plugin']],
    ['traq-plugin', ['core', 'commonmark-plugin', 'extensions-plugin']],
    ['sdk', ['core', 'commonmark-plugin', 'extensions-plugin', 'traq-plugin']]
  ])
  const calls: string[] = []
  const tasks = workspaceTasks(graph, {
    contracts: async name => {
      calls.push(`contracts:${name}`)
    },
    build: async name => {
      calls.push(`build:${name}`)
    }
  })
  await runTasks(tasks, ['build:core'])
  expect(calls).toEqual(['contracts:core', 'build:core'])
  calls.length = 0
  await runTasks(tasks, ['build:extensions-plugin'])
  expect(calls).not.toContain('contracts:traq-plugin')
  expect(calls).not.toContain('contracts:sdk')
  expect(calls.filter(call => call === 'contracts:core')).toHaveLength(1)
  expect(calls.indexOf('build:core')).toBeLessThan(
    calls.indexOf('build:commonmark-plugin')
  )
  expect(calls.at(-1)).toBe('build:extensions-plugin')
})

test('build modules load before workspace packages have been built', async () => {
  await withTempDirectory('build-bootstrap-', async root => {
    // Copy sources without installed workspace links or existing dist artifacts.
    for (const directory of [
      'tools/workspace',
      'tools/contracts',
      'packages/sdk/scripts',
      'packages/sdk/typescript/src/generated'
    ])
      await cp(
        path.join(repositoryRoot, directory),
        path.join(root, directory),
        { recursive: true }
      )

    const child = Bun.spawn(
      [
        Bun.argv[0],
        '--no-install',
        '--eval',
        `
          import assert from 'node:assert/strict'
          const { buildWorkspace } = await import('./tools/workspace/build/workspace.ts')
          const { assembleSdk } = await import('./packages/sdk/scripts/build.ts')
          assert.equal(typeof buildWorkspace, 'function')
          assert.equal(typeof assembleSdk, 'function')
        `
      ],
      { cwd: root, stdout: 'pipe', stderr: 'pipe' }
    )
    const [exitCode, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text()
    ])
    expect({ exitCode, stdout, stderr }).toEqual({
      exitCode: 0,
      stdout: '',
      stderr: ''
    })
  })
})
