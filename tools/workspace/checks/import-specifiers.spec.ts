import { expect, test } from 'bun:test'

import { importSpecifiers } from './import-specifiers.ts'
import { validateTypescriptDependency } from './typescript-dependencies.ts'

test('public imports must satisfy both ownership and direct runtime declarations', () => {
  const check = (specifier: string, peers: Record<string, string> = {}) =>
    validateTypescriptDependency({
      owner: 'commonmark-plugin',
      root: '/workspace/commonmark',
      file: '/workspace/commonmark/typescript/src/index.ts',
      specifier,
      manifest: {
        name: '@traq-flavored-markdown/commonmark-plugin',
        peerDependencies: peers
      },
      owners: new Map([
        ['@traq-flavored-markdown/core', 'core'],
        ['@traq-flavored-markdown/sdk', 'sdk']
      ])
    })

  expect(() => check('@traq-flavored-markdown/core')).toThrow('undeclared')

  expect(() =>
    check('@traq-flavored-markdown/core', {
      '@traq-flavored-markdown/core': '0.3.0'
    })
  ).not.toThrow()

  expect(() =>
    check('@traq-flavored-markdown/sdk', {
      '@traq-flavored-markdown/sdk': '0.3.0'
    })
  ).toThrow('upward')

  expect(() => check('highlight.js/lib/core')).toThrow('undeclared')
  expect(() => check('vue', { vue: '*' })).toThrow('UI dependency')
  expect(() => check('node:fs')).toThrow('host runtime')
  expect(() => check('../../../sdk/index.js')).toThrow('escapes')
})

test('keeps authored imports, re-exports and literal module loads', () => {
  expect(
    importSpecifiers(
      'module.ts',
      `import type { Node } from 'types'
       import 'side-effect'
       export { value } from 'exports'
       const lazy = import('lazy')
       const legacy = require('legacy')
       type Inline = import('inline-types').Node
       import Equals = require('equals')
       const computed = import(name)
       const text = "import 'not-a-module'"
       // import 'comment-only'
      `
    )
  ).toEqual([
    'types',
    'side-effect',
    'exports',
    'lazy',
    'legacy',
    'inline-types',
    'equals'
  ])
})

test.each(['</script>', '</script >', '</script\t>', '</script\n>'])(
  'reads dependencies before the Vue closing tag %s',
  closing => {
    expect(
      importSpecifiers(
        'input.vue',
        `<script setup lang="ts">import value from '/@/store'${closing}`
      )
    ).toEqual(['/@/store'])
  }
)

test('reads ordinary and setup scripts independently, including quoted tag delimiters', () => {
  expect(
    importSpecifiers(
      'input.vue',
      `<script lang="ts" data-example=">">
         export { value } from 'ordinary'
       </script>
       <script setup lang="ts">
         import type { Node } from 'setup-types'
         const lazy = import('setup-lazy')
       </script>`
    )
  ).toEqual(['ordinary', 'setup-types', 'setup-lazy'])
})

test('ignores fake scripts in comments and dependencies in non-script blocks', () => {
  expect(
    importSpecifiers(
      'input.vue',
      `<!-- <script src="comment-only">import 'comment-only'</script> -->
       <template><p>import 'template-only'</p></template>
       <docs>import 'docs-only'</docs>
       <style>.example { content: "import 'style-only'"; }</style>
       <script setup>import 'actual'</script>`
    )
  ).toEqual(['actual'])
})

test.each(['./external.ts', '/@/store', '../../outside.ts'])(
  'includes external script %s in the ownership check',
  src => {
    expect(importSpecifiers('input.vue', `<script src="${src}" />`)).toEqual([
      src
    ])
  }
)

test('reads imports after JSX in a TSX script', () => {
  expect(
    importSpecifiers(
      'input.vue',
      `<script setup lang="tsx">
         const element = <span>Example</span>
         import value from 'after-jsx'
       </script>`
    )
  ).toEqual(['after-jsx'])
})

test('allows components with only a template', () => {
  expect(
    importSpecifiers('input.vue', '<template><p>Example</p></template>')
  ).toEqual([])
})

test.each([
  '<script setup>import value from "unfinished"',
  '<script>import "first"</script><script>import "second"</script>',
  '<script setup src="./external.ts" />',
  '<SCRIPT>import "invalid-uppercase-block"</SCRIPT>'
])(
  'rejects malformed SFCs instead of silently skipping dependencies: %s',
  source => {
    expect(() => importSpecifiers('invalid.vue', source)).toThrow(
      'invalid.vue: invalid Vue SFC:'
    )
  }
)
