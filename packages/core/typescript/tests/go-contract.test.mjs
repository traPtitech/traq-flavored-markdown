import assert from 'node:assert/strict'
import test from 'node:test'

import { goContract } from '../../scripts/contracts/go.mjs'

test('named string enums remain compatible with Go string fields', () => {
  assert.equal(
    goContract({
      title: 'LookupKind',
      type: 'string',
      enum: ['user', 'group']
    }),
    'type LookupKind = string\n'
  )
})
