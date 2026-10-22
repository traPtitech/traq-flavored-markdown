import { expect, test } from 'bun:test'

import { semanticContractId } from './node-contracts.ts'

test('contract identity is independent of order and provenance but includes semantic changes', () => {
  const first = {
    abi: { version: 1 },
    nodes: { text: { type: 'string' } },
    provenance: { sourceFingerprint: 'a' },
    contractId: 'unbound'
  }
  const second = {
    contractId: 'old',
    provenance: { sourceFingerprint: 'b' },
    nodes: first.nodes,
    abi: first.abi
  }
  expect(semanticContractId(first)).toBe(semanticContractId(second))
  expect(semanticContractId({ ...first, abi: { version: 2 } })).not.toBe(
    semanticContractId(first)
  )
})
