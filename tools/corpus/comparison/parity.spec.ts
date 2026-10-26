import { expect, test } from 'bun:test'

import {
  type DifferenceRow,
  parseDifferenceRow
} from '../protocol/comparison.ts'
import fixture from '../testing/measurement.json' with { type: 'json' }
import { compareSources } from './runner.ts'

test('TypeScript follows the language-independent measurement fixture', async () => {
  const order: string[] = [],
    differences: DifferenceRow[] = []
  const result = await compareSources({
    runId: 'shared-fixture',
    warmups: fixture.warmups,
    max: fixture.max,
    input: async function* () {
      for (const source of fixture.sources) yield { source }
    },
    profiles: [
      {
        id: 'plainText',
        before: source => {
          order.push('before:' + source)
          return {
            outcome: {
              kind: 'text',
              value: fixture.before[source as keyof typeof fixture.before]
            }
          }
        },
        after: source => {
          order.push('after:' + source)
          if (fixture.errors.includes(source))
            throw new Error(fixture.after[source as keyof typeof fixture.after])
          return {
            outcome: {
              kind: 'text',
              value: fixture.after[source as keyof typeof fixture.after]
            }
          }
        }
      }
    ],
    difference: row => {
      differences.push(row)
    }
  })
  expect(order).toEqual(fixture.order)
  expect(differences).toEqual(fixture.differences.map(parseDifferenceRow))
  expect(result.messages).toBe(3)
  expect(result.actualWarmups).toBe(1)
  expect(result.results.plainText?.afterErrors).toBe(1)
})
