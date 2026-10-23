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
    prepare: async name => {
      calls.push(`prepare:${name}`)
    },
    typescript: async name => {
      calls.push(`typescript:${name}`)
    },
    styles: async () => {
      calls.push('styles:sdk')
    },
    wasm: async () => {
      calls.push('wasm:sdk')
    },
    metadata: async () => {
      calls.push('metadata:sdk')
    }
  })
  await runTasks(tasks, ['build:core'])
  expect(calls).toEqual(['contracts:core', 'prepare:core', 'typescript:core'])
  calls.length = 0
  await runTasks(tasks, ['build:extensions-plugin'])
  expect(calls).not.toContain('contracts:traq-plugin')
  expect(calls).not.toContain('contracts:sdk')
  expect(calls.filter(call => call === 'contracts:core')).toHaveLength(1)
  expect(calls.indexOf('typescript:core')).toBeLessThan(
    calls.indexOf('typescript:commonmark-plugin')
  )
  expect(calls.at(-1)).toBe('typescript:extensions-plugin')
  calls.length = 0
  await runTasks(tasks, ['build:sdk'])
  expect(calls.filter(call => call === 'prepare:sdk')).toHaveLength(1)
  expect(calls.indexOf('wasm:sdk')).toBeGreaterThan(
    calls.indexOf('typescript:core')
  )
  expect(calls.indexOf('metadata:sdk')).toBeGreaterThan(
    calls.indexOf('wasm:sdk')
  )
  expect(calls).toContain('styles:sdk')
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
          const { buildSdkWasm } = await import('./packages/sdk/scripts/build.ts')
          assert.equal(typeof buildWorkspace, 'function')
          assert.equal(typeof buildSdkWasm, 'function')
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
