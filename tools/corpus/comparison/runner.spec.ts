import { expect, test } from 'bun:test'

import type { DifferenceRow } from '../report-schema.ts'
import { compareSources } from './runner.ts'

test('comparison alternates execution and preserves typed errors without external resources', async () => {
  const order: string[] = [],
    rows: DifferenceRow[] = []
  const result = await compareSources({
    input: async function* () {
      yield { source: 'a' }
      yield { source: 'b' }
    },
    warmups: 0,
    profiles: [
      {
        mode: 'render',
        before: source => {
          order.push('before:' + source)
          return { kind: 'html', value: source }
        },
        after: source => {
          order.push('after:' + source)
          throw new Error(source)
        }
      }
    ],
    difference: row => {
      rows.push(row)
    }
  })
  expect(order).toEqual(['before:a', 'after:a', 'after:b', 'before:b'])
  expect(rows.map(row => row.afterType)).toEqual(['error', 'error'])
  expect(result.modes.render.afterErrors).toBe(2)
})
