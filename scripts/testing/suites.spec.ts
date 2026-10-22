import { expect, test } from 'bun:test'

import { repositoryRoot } from '../paths.ts'
import { suiteFor } from './suites.ts'

test('test resources are explicit across owner, runtime, compiler, and workspace suites', () => {
  expect(
    suiteFor('packages/plugins/extensions/typescript/tests/renderer.spec.ts')
  ).toBe('unit')
  expect(suiteFor('packages/sdk/typescript/tests/unit/runtime.spec.ts')).toBe(
    'unit'
  )
  expect(suiteFor('packages/sdk/typescript/tests/processing.spec.ts')).toBe(
    'wasm'
  )
  expect(suiteFor('scripts/codegen/go-contract.spec.ts')).toBe('codegen')
  expect(suiteFor('scripts/package-graph.spec.ts')).toBe('workspace')
})

test('every current test declares exactly one resource suite', () => {
  const files = new Bun.Glob('{scripts,packages}/**/*.spec.ts').scanSync({
    cwd: repositoryRoot
  })
  for (const file of files) {
    if (
      file.split(/[\\/]/).some(part => ['node_modules', 'dist'].includes(part))
    )
      continue
    expect(() => suiteFor(file)).not.toThrow()
  }
})

test('new unclassified tests and overlapping declarations fail visibly', () => {
  expect(() => suiteFor('scripts/new-compiler.spec.ts')).toThrow(
    'no resource suite'
  )
  expect(() =>
    suiteFor('example.spec.ts', {
      first: { include: ['*.spec.ts'] },
      second: { include: ['example.spec.ts'] }
    })
  ).toThrow('multiple resource suites')
})
