import { expect, test } from 'bun:test'

import { byMode, modes, parseComparisonPlan } from '../shared/comparison.ts'
import { compareSources } from './runner.ts'

const plan = {
  format: 1,
  corpus: 'messages.jsonl',
  output: 'comparison',
  baselineDirectory: 'baseline',
  wasm: 'parser.wasm',
  origin: 'https://q.example.test',
  max: 1,
  warmups: 2,
  profiles: modes,
  provenance: {
    before: byMode(() => ({ label: 'before', revision: 'a' })),
    after: { label: 'after', revision: 'b' },
    dependencies: {}
  }
}

test('a persisted plan supplies the same measurement limits and warmups to runners', async () => {
  const input = parseComparisonPlan(JSON.parse(JSON.stringify(plan)))
  const calls: string[] = []
  const result = await compareSources({
    input: async function* () {
      yield { source: 'a' }
      yield { source: 'b' }
      yield { source: 'c' }
    },
    max: input.max,
    warmups: input.warmups,
    profiles: [
      {
        mode: 'render',
        before: source => {
          calls.push('before:' + source)
          return { kind: 'html', value: source }
        },
        after: source => {
          calls.push('after:' + source)
          return { kind: 'html', value: source }
        }
      }
    ],
    difference: () => {
      throw new Error('equal outputs are not differences')
    }
  })
  expect(calls).toEqual([
    'before:a',
    'after:a',
    'before:b',
    'after:b',
    'before:a',
    'after:a'
  ])
  expect(result.messages).toBe(1)
  expect(result.modes.render.before.calls).toBe(1)
})

test('plans reject missing or repeated profiles and incomplete provenance before execution', () => {
  expect(() =>
    parseComparisonPlan({
      ...plan,
      profiles: ['render', 'render', 'plainText']
    })
  ).toThrow()
  expect(() => parseComparisonPlan({ ...plan, warmups: -1 })).toThrow()
  expect(() =>
    parseComparisonPlan({
      ...plan,
      provenance: { ...plan.provenance, before: {} }
    })
  ).toThrow()
})
