import { expect, test } from 'bun:test'

import { type CargoMetadata, rustFeatureChecks } from './rust-features.ts'

test('Rust features resolve separately for every library and feature combination', () => {
  const crate = (
    name: string,
    features: Record<string, string[]>,
    kind = 'lib'
  ) => ({ id: name, name, features, targets: [{ kind: [kind] }] })
  const metadata: CargoMetadata = {
    workspace_members: ['core', 'processing', 'features', 'wasm', 'example'],
    packages: [
      crate('core', {}),
      crate('processing', { contracts: ['dependency/contracts'] }),
      crate('features', { default: [], syntax: [], text: [] }),
      crate('wasm', { default: ['contracts'], contracts: [] }, 'cdylib'),
      crate('example', {}, 'bin'),
      crate('external', { contracts: [] })
    ]
  }
  const flags = (name: string, ...args: string[]) => [
    'check',
    '--locked',
    '--package',
    name,
    '--lib',
    ...args
  ]
  expect(rustFeatureChecks(metadata)).toEqual([
    flags('core', '--no-default-features'),
    flags('processing', '--no-default-features'),
    flags('processing', '--no-default-features', '--features', 'contracts'),
    flags('features', '--no-default-features'),
    flags('features', '--no-default-features', '--features', 'syntax'),
    flags('features', '--no-default-features', '--features', 'text'),
    flags('features', '--no-default-features', '--features', 'syntax,text'),
    flags('wasm', '--no-default-features'),
    flags('wasm', '--no-default-features', '--features', 'contracts'),
    flags('wasm')
  ])
})
