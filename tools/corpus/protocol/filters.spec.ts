import { expect, test } from 'bun:test'

import {
  encodeFilterMasks,
  filterCombinations,
  filterMaskAt,
  filterMaskWidth,
  validFilterMasks
} from './filters.ts'

test('filter masks preserve the full supported bit range', () => {
  const maximum = (1n << BigInt(filterCombinations.length)) - 1n
  const encoded = encodeFilterMasks([0n, maximum])

  expect(validFilterMasks('', 0)).toBe(true)
  expect(validFilterMasks(encoded, 2)).toBe(true)
  expect(filterMaskAt(encoded, 0)).toBe(0n)
  expect(filterMaskAt(encoded, 1)).toBe(maximum)
})

test('filter masks reject malformed encoding, incorrect counts and unused bits', () => {
  const encoded = encodeFilterMasks([0n, 1n])

  for (const invalid of [
    encoded.slice(1),
    encoded + '0',
    encoded.slice(0, -1) + 'g',
    encoded.slice(0, -1) + 'A',
    encoded.slice(0, -1) + '\n',
    encodeFilterMasks([0n, 1n << BigInt(filterCombinations.length)])
  ]) {
    expect(validFilterMasks(invalid, 2)).toBe(false)
  }

  expect(validFilterMasks(encoded, 1)).toBe(false)
  expect(validFilterMasks('0'.repeat(filterMaskWidth), 0)).toBe(false)
})
