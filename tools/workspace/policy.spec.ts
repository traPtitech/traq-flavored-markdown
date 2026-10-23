import { expect, test } from 'bun:test'

import { validateCapabilities, validateModules } from './policy.ts'

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
