import { expect, test } from 'bun:test'

import { assertNodeGroup } from './groups.ts'

test('contract groups accept their independently named legacy wire kinds', () => {
  expect(() =>
    assertNodeGroup('commonmark', {
      'commonmark.text': { group: 'commonmark' }
    })
  ).not.toThrow()
  expect(() =>
    assertNodeGroup('extensions', { 'generic.table': { group: 'extensions' } })
  ).not.toThrow()
  expect(() =>
    assertNodeGroup('trap', { 'traq.blank_line': { group: 'trap' } })
  ).not.toThrow()
})

test('contract ownership rejects mismatched groups and undeclared wire namespaces', () => {
  expect(() =>
    assertNodeGroup('extensions', { 'generic.table': { group: 'commonmark' } })
  ).toThrow('contract group')
  expect(() =>
    assertNodeGroup('extensions', {
      'traq.blank_line': { group: 'extensions' }
    })
  ).toThrow('wire namespace')
  expect(() =>
    assertNodeGroup('trap', { 'trap.blank_line': { group: 'trap' } })
  ).toThrow('wire namespace')
  expect(() =>
    assertNodeGroup('extensions', {
      'generically.table': { group: 'extensions' }
    })
  ).toThrow('wire namespace')
})
