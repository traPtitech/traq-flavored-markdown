import { expect, test } from 'bun:test'

import { fixturePlan, fixtureRows } from '../testing/fixtures.ts'
import {
  isFailure,
  parseComparisonPlan,
  parseDifferenceRow,
  parseSource
} from './comparison.ts'

test('outcomes carry their error status once and reject legacy or contradictory rows', () => {
  const row = parseDifferenceRow(fixtureRows[1])
  expect(isFailure(row.before)).toBe(false)
  expect(isFailure(row.after)).toBe(true)
  for (const invalid of [
    { ...row, error: false },
    { ...row, beforeType: 'error' },
    { ...row, before: 'same' },
    { ...row, after: { kind: 'unknown', value: 'x' } }
  ])
    expect(() => parseDifferenceRow(invalid)).toThrow()
})

test('source records are required but collection metadata can be retained on disk', () => {
  expect(parseSource('{"source":"","id":"private"}')).toEqual({ source: '' })
  for (const line of ['{}', 'null', '{"source":null}', '{"source":1}', '[]'])
    expect(() => parseSource(line)).toThrow()
})

test('comparison plans require frontend profiles and optionally include plain text', () => {
  expect(parseComparisonPlan(fixturePlan()).runId).toBe('synthetic-run')
  const { plainText: _unused, ...frontend } = fixturePlan().provenance.before
  const plan = fixturePlan({
    provenance: { ...fixturePlan().provenance, before: frontend }
  })
  expect(Object.keys(parseComparisonPlan(plan).provenance.before)).toEqual([
    'render',
    'inline'
  ])
  for (const before of [
    { render: frontend.render },
    { ...frontend, unknown: frontend.render }
  ])
    expect(() =>
      parseComparisonPlan({
        ...plan,
        provenance: { ...plan.provenance, before }
      })
    ).toThrow()
  expect(() =>
    parseComparisonPlan({ ...fixturePlan(), profiles: ['render'] })
  ).toThrow()
  expect(() => parseComparisonPlan({ ...fixturePlan(), warmups: -1 })).toThrow()
  expect(() =>
    parseComparisonPlan({ ...fixturePlan(), corpusSha256: 'invalid' })
  ).toThrow()
})
