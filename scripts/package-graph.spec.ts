import { mkdir } from 'node:fs/promises'
import path from 'node:path'

import { expect, test } from 'bun:test'

import {
  dependencyGraph,
  npmPackageGraph,
  readGoPackageGraph,
  readNpmPackageGraph,
  validateGoOwnership
} from './package-graph.ts'
import { withTempDirectory } from './testing/temp-directory.ts'

const repository = 'github.com/traPtitech/traq-flavored-markdown'
const modulePath = (directory: string) => `${repository}/${directory}`

test('dependency order and ownership follow the manifest graph', async () => {
  const { graph } = await readNpmPackageGraph()
  expect(graph.order).toEqual([
    'core',
    'commonmark-plugin',
    'traq-plugin',
    'sdk'
  ])
  expect(graph.allows('sdk', 'core')).toBe(true)
  expect(graph.allows('core', 'sdk')).toBe(false)
  const go = await readGoPackageGraph()
  expect(go.published.map(module => module.owner)).toEqual(graph.order)
  expect(() => validateGoOwnership(go, graph)).not.toThrow()
})

test('peer graph catches cycles, undeclared transitive peers, and runtime coupling', async () => {
  const { manifests } = await readNpmPackageGraph()
  const copy = () => structuredClone(manifests)
  const missing = copy()
  delete missing.sdk.peerDependencies!['@traq-flavored-markdown/core']
  expect(() => npmPackageGraph(missing)).toThrow('package graph')
  const runtime = copy()
  runtime['commonmark-plugin'].dependencies = {
    '@traq-flavored-markdown/core': '0.1.7'
  }
  expect(() => npmPackageGraph(runtime)).toThrow('must be peer dependencies')
  runtime['commonmark-plugin'].dependencies = {
    '@traq-flavored-markdown/missing': '0.1.7'
  }
  expect(() => npmPackageGraph(runtime)).toThrow('must be peer dependencies')
  const cycle = copy()
  cycle.core.peerDependencies = { '@traq-flavored-markdown/sdk': '0.1.7' }
  expect(() => npmPackageGraph(cycle)).toThrow('Circular package dependency')
  const upward = copy()
  delete upward['commonmark-plugin'].peerDependencies
  upward.core.peerDependencies = {
    '@traq-flavored-markdown/commonmark-plugin': '0.1.7'
  }
  expect(() => npmPackageGraph(upward)).toThrow('upward npm dependency')
  expect(() =>
    dependencyGraph<string>([
      ['a', ['missing']],
      ['b', []]
    ])
  ).toThrow('Unknown package dependency')
  expect(() =>
    dependencyGraph<string>([
      ['a', ['b']],
      ['b', ['a']]
    ])
  ).toThrow('Circular package dependency')
})

test('Go manifest graph rejects cycles and upward dependencies', async () => {
  await withTempDirectory('go-package-graph-', async root => {
    const directories = [
      'packages/core/go',
      'packages/plugins/commonmark/go',
      'packages/plugins/traq/go',
      'packages/sdk/go',
      'packages/sdk/examples/go'
    ]
    const dependencies: Record<string, string[]> = {
      'packages/core/go': [],
      'packages/plugins/commonmark/go': ['packages/core/go'],
      'packages/plugins/traq/go': ['packages/core/go'],
      'packages/sdk/go': [
        'packages/core/go',
        'packages/plugins/commonmark/go',
        'packages/plugins/traq/go'
      ],
      'packages/sdk/examples/go': ['packages/sdk/go']
    }
    const write = async () => {
      for (const directory of directories) {
        await mkdir(path.join(root, directory), { recursive: true })
        const name =
          directory === 'packages/sdk/examples/go'
            ? 'traq-markdown-example'
            : modulePath(directory)
        await Bun.write(
          path.join(root, directory, 'go.mod'),
          `module ${name}\n\ngo 1.26.0\n\n${dependencies[directory]
            .map(dependency => `require ${modulePath(dependency)} v0.1.7`)
            .join('\n')}\n`
        )
      }
    }
    await write()
    const npm = (await readNpmPackageGraph()).graph
    const normal = await readGoPackageGraph(root)
    expect(() => validateGoOwnership(normal, npm)).not.toThrow()
    dependencies['packages/plugins/commonmark/go'].push(
      'packages/plugins/traq/go'
    )
    await write()
    await expect(readGoPackageGraph(root)).rejects.toThrow(
      'upward Go dependency'
    )
    dependencies['packages/plugins/commonmark/go'].pop()
    dependencies['packages/core/go'].push('packages/sdk/go')
    await write()
    await expect(readGoPackageGraph(root)).rejects.toThrow(
      'upward Go dependency'
    )
  })
}, 20_000)
