import path from 'node:path'

import { expect, test } from 'bun:test'

import { type PackageName, packageRoot, repositoryRoot } from './paths.ts'
import { type Manifest, parseRelease, validateWorkspace } from './release.ts'

const names = {
  core: '@traq-flavored-markdown/core',
  commonmark: '@traq-flavored-markdown/commonmark-plugin',
  traq: '@traq-flavored-markdown/traq-plugin',
  sdk: '@traq-flavored-markdown/sdk'
}

const manifest = (
  name: string,
  peerDependencies?: Record<string, string>
): Manifest => ({
  name,
  version: '0.1.0',
  publishConfig: { access: 'public', registry: 'https://registry.npmjs.org' },
  ...(peerDependencies && { peerDependencies })
})

const workspace = () => ({
  root: { name: 'traq-flavored-markdown', version: '0.1.0', private: true },
  packages: {
    core: manifest(names.core),
    'commonmark-plugin': manifest(names.commonmark, { [names.core]: '0.1.0' }),
    'traq-plugin': manifest(names.traq, {
      [names.core]: '0.1.0',
      [names.commonmark]: '0.1.0'
    }),
    sdk: manifest(names.sdk, {
      [names.core]: '0.1.0',
      [names.commonmark]: '0.1.0',
      [names.traq]: '0.1.0'
    })
  }
})

test('release labels are strict and choose the dist-tag', () => {
  expect(parseRelease(['v1.2.3'])).toEqual({
    version: '1.2.3',
    tag: 'latest',
    mode: 'dry-run'
  })
  expect(parseRelease(['v1.2.3-rc.1', '--publish'])).toEqual({
    version: '1.2.3-rc.1',
    tag: 'next',
    mode: 'publish'
  })
  for (const label of ['1.2.3', 'core@1.2.3', 'v01.2.3', 'v1.2.3+build.1'])
    expect(() => parseRelease([label])).toThrow('usage:')
  expect(() => parseRelease([])).toThrow('usage:')
  expect(() => parseRelease(['v1.2.3', '--unknown'])).toThrow('usage:')
  expect(() => parseRelease(['v1.2.3', '--check', '--publish'])).toThrow(
    'usage:'
  )
})

test('workspace validation rejects version and peer mismatches', () => {
  expect(() => validateWorkspace(workspace(), '0.1.0')).not.toThrow()
  const versionMismatch = workspace()
  versionMismatch.packages.sdk.version = '0.1.1'
  expect(() => validateWorkspace(versionMismatch, '0.1.0')).toThrow(
    'sdk manifest does not match'
  )
  const peerMismatch = workspace()
  peerMismatch.packages['traq-plugin'].peerDependencies![names.commonmark] =
    '0.1.1'
  expect(() => validateWorkspace(peerMismatch, '0.1.0')).toThrow(
    'peer dependencies'
  )
  expect(() => validateWorkspace(peerMismatch)).not.toThrow()

  const missingPeer = workspace()
  delete missingPeer.packages.sdk.peerDependencies![names.core]
  expect(() => validateWorkspace(missingPeer, '0.1.0')).toThrow('package graph')

  const extraPeer = workspace()
  extraPeer.packages['commonmark-plugin'].peerDependencies![names.sdk] = '0.1.0'
  expect(() => validateWorkspace(extraPeer, '0.1.0')).toThrow('package graph')
})

test('repository root keeps the four package versions and peers synchronized', async () => {
  const root = (await Bun.file(
    path.join(repositoryRoot, 'package.json')
  ).json()) as Manifest
  const packages = Object.fromEntries(
    await Promise.all(
      (
        ['core', 'commonmark-plugin', 'traq-plugin', 'sdk'] as PackageName[]
      ).map(
        async name =>
          [
            name,
            (await Bun.file(
              path.join(packageRoot(name), 'package.json')
            ).json()) as Manifest
          ] as const
      )
    )
  ) as ReturnType<typeof workspace>['packages']
  expect(() =>
    validateWorkspace({ root, packages }, root.version)
  ).not.toThrow()
})
