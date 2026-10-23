import { expect, test } from 'bun:test'

import { crateRestrictions } from './descriptor.ts'
import { validateCapabilities, validateModules } from './policy.ts'

test('core and every plugin layer reject capabilities belonging to another stage', () => {
  for (const [root, forbidden] of [
    ['markdown-ast', 'markdown-parser'],
    ['markdown-parser', 'markdown-renderer'],
    ['markdown-codec', 'markdown-extractor'],
    ['markdown-commonmark-contracts', 'markdown-parser'],
    ['markdown-extensions-contracts', 'markdown-codec'],
    ['markdown-commonmark-text', 'markdown-parser'],
    ['markdown-extensions-text', 'markdown-codec'],
    ['markdown-extensions-syntax', 'markdown-renderer'],
    ['markdown-traq-extraction', 'markdown-parser'],
    ['traq-markdown-grammar', 'traq-markdown-processing']
  ]) {
    expect(Object.hasOwn(crateRestrictions, root)).toBe(true)
    expect(() => validateCapabilities(root, new Set([forbidden]))).toThrow(
      'disallowed capability'
    )
  }
})

test('owner permissions and selected-root capabilities are independent policies', () => {
  expect(() =>
    validateModules([
      {
        name: 'markdown-ast',
        owner: 'core',
        dependencies: ['traq-markdown-processing']
      },
      { name: 'traq-markdown-processing', owner: 'sdk', dependencies: [] }
    ])
  ).toThrow('disallowed owner dependency')

  // A feature assembly can declare optional parser and renderer dependencies;
  // capability enforcement consumes only the dependencies enabled for one root.
  expect(() =>
    validateModules(
      [
        {
          name: 'traq-markdown-processing',
          owner: 'sdk',
          dependencies: ['features']
        },
        { name: 'features', owner: 'sdk', dependencies: ['markdown-parser'] },
        { name: 'markdown-parser', owner: 'core', dependencies: [] }
      ],
      false
    )
  ).not.toThrow()
  expect(() =>
    validateCapabilities(
      'traq-markdown-processing',
      new Set(['features', 'markdown-renderer'])
    )
  ).not.toThrow()
  expect(() =>
    validateCapabilities(
      'traq-markdown-processing',
      new Set(['features', 'markdown-parser'])
    )
  ).toThrow('disallowed capability dependency markdown-parser')
})
