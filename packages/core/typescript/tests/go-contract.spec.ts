import { expect, test } from 'bun:test'

import { goContract } from '../../scripts/contracts/go.ts'

test('named string enums remain compatible with Go string fields', () => {
  expect(
    goContract({
      title: 'LookupKind',
      type: 'string',
      enum: ['user', 'group']
    })
  ).toBe('type LookupKind = string\n')
})
