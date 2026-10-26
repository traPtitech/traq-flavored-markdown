import { expect, test } from 'bun:test'

import { discoverTests, suiteFor } from './suites.ts'

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
  expect(suiteFor('tools/contracts/tests/go-contract.spec.ts')).toBe('codegen')
  expect(suiteFor('tools/workspace/package-graph.spec.ts')).toBe('workspace')
})

test('every current test declares exactly one resource suite', () => {
  const files = discoverTests()
  for (const root of ['packages/', 'tools/workspace/', 'tools/contracts/'])
    expect(
      files.some(file => file.replaceAll('\\', '/').startsWith(root))
    ).toBe(true)
  for (const file of files) {
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
