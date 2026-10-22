import { expect, test } from 'bun:test'

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
