import { expect, test } from 'bun:test'

import { differenceFilters } from '../protocol/report.ts'
import { differenceFilterMask } from './filter.ts'
import { normalizeKatexErrors } from './katex.ts'

const error = (text: string) =>
  `<span class="katex-error" title="diagnostic ${text}">${text}</span>`
const filtered = (before: string, after: string) =>
  Boolean(
    differenceFilterMask({
      before: { kind: 'html', value: before },
      after: { kind: 'html', value: after }
    }) & differenceFilters.katexErrors
  )

test('KaTeX diagnostics are removed only inside real, explicitly closed error elements', () => {
  const old = `<p>same</p><span title='old&#39;s error' class='katex-error'>&lt;/span&gt; &amp; \\bad</span>`
  const current = `<p>same</p>${error('different')}`
  expect(filtered(old, current)).toBe(true)
  expect(normalizeKatexErrors(old)).toEqual({
    value: '<p>same</p><span class="katex-error"></span>',
    errors: 1
  })
  expect(
    filtered(
      `<blockquote>${error('first')}${error('second')}</blockquote>`,
      `<blockquote>${error('third')}${error('fourth')}</blockquote>`
    )
  ).toBe(true)
  for (const context of [
    'code',
    'pre',
    'script',
    'style',
    'textarea',
    'template'
  ])
    expect(
      filtered(
        `<${context}>${error('old')}</${context}>`,
        `<${context}>${error('new')}</${context}>`
      )
    ).toBe(false)
  expect(filtered('<p>katex-error old</p>', '<p>katex-error new</p>')).toBe(
    false
  )
  expect(
    filtered(
      '<span class="not-katex-error">old</span>',
      '<span class="not-katex-error">new</span>'
    )
  ).toBe(false)
})

test('KaTeX-only exclusion retains success/error transitions, counts, layout and outside changes', () => {
  const old = error('old')
  for (const changed of [
    '<span class="katex">success</span>',
    error('new') + error('extra'),
    error('new').replaceAll('span', 'p'),
    error('new').replace('katex-error', 'katex-error different'),
    error('new').replace(' title=', ' style="display:none" title='),
    error('new') + '<p>outside text</p>',
    error('new').replace('new</span>', '<strong>new</strong></span>'),
    '<span class="katex-error">unclosed',
    '<span class="katex-error" class="other">duplicate</span>'
  ]) {
    expect(filtered(old, changed)).toBe(false)
    expect(filtered(changed, old)).toBe(false)
  }
  expect(filtered('<p>old</p>' + old, '<p>new</p>' + error('new'))).toBe(false)
  for (const kind of ['text', 'error'] as const)
    expect(
      differenceFilterMask({
        before: { kind, value: old },
        after: { kind, value: error('new') }
      }) & differenceFilters.katexErrors
    ).toBe(0)
  expect(
    differenceFilterMask({
      before: { kind: 'html', value: old },
      after: { kind: 'error', value: error('new') }
    })
  ).toBe(0)
})
