import { expect, test } from 'bun:test'

import { assertNodeGroup } from '../model/groups.ts'

test('contract groups use their plugin-owned wire namespaces', () => {
  expect(() =>
    assertNodeGroup('commonmark', {
      'commonmark.text': { group: 'commonmark' }
    })
  ).not.toThrow()
  expect(() =>
    assertNodeGroup('extensions', {
      'extensions.table': { group: 'extensions' }
    })
  ).not.toThrow()
  expect(() =>
    assertNodeGroup('traq', { 'traq.blank_line': { group: 'traq' } })
  ).not.toThrow()
})

test('contract ownership rejects mismatched groups and undeclared wire namespaces', () => {
  expect(() =>
    assertNodeGroup('extensions', {
      'extensions.table': { group: 'commonmark' }
    })
  ).toThrow('contract group')
  expect(() =>
    assertNodeGroup('extensions', {
      'traq.blank_line': { group: 'extensions' }
    })
  ).toThrow('wire namespace')
  expect(() =>
    assertNodeGroup('traq', { 'trap.blank_line': { group: 'traq' } })
  ).toThrow('wire namespace')
  expect(() =>
    assertNodeGroup('extensions', {
      'generically.table': { group: 'extensions' }
    })
  ).toThrow('wire namespace')
})
