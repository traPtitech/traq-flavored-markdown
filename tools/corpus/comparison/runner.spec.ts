import { expect, test } from 'bun:test'

import type { DifferenceRow } from '../protocol/comparison.ts'
import { compareSources, summarize } from './runner.ts'

test('comparison alternates execution and retains typed errors without external resources', async () => {
  const order: string[] = [],
    rows: DifferenceRow[] = []
  const result = await compareSources({
    runId: 'test',
    input: async function* () {
      yield { source: 'a' }
      yield { source: 'b' }
    },
    warmups: 0,
    profiles: [
      {
        id: 'render',
        before: source => {
          order.push('before:' + source)
          return { outcome: { kind: 'html', value: source } }
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
  expect(rows.map(row => row.after.kind)).toEqual(['error', 'error'])
  expect(result.results.render?.afterErrors).toBe(2)
  expect(result.actualWarmups).toBe(0)
})

test('measurement excludes warmups and records their actual count on a short corpus', async () => {
  const calls: string[] = []
  const adapter = (source: string) => {
    calls.push(source)
    return { outcome: { kind: 'text' as const, value: source } }
  }
  const result = await compareSources({
    runId: 'test',
    input: async function* () {
      yield { source: 'only' }
    },
    profiles: [{ id: 'plainText', before: adapter, after: adapter }],
    warmups: 200,
    max: 1,
    difference: () => {
      throw new Error('equal output')
    }
  })
  expect(result.actualWarmups).toBe(1)
  expect(result.messages).toBe(1)
  expect(calls).toEqual(['only', 'only', 'only', 'only'])
  expect(result.results.plainText?.before.calls).toBe(1)
})

test('timing quantiles have one deterministic convention shared by the Go worker', () => {
  expect(summarize([4, 1, 3, 2])).toEqual({
    calls: 4,
    totalMs: 10,
    meanUs: 2500,
    p50Us: 2000,
    p95Us: 3000,
    p99Us: 3000
  })
  expect(summarize([]).calls).toBe(0)
})
