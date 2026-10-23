import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import type { DifferenceRow } from '../report-schema.ts'
import DiffTable from './DiffTable.tsx'

test('text and error results render their full content without mounting DOM effects', () => {
  const row: DifferenceRow = {
    index: 0,
    mode: 'plainText',
    source: 'source',
    before: '<b>literal</b>',
    after: 'failure & details',
    beforeType: 'text',
    afterType: 'error'
  }
  const html = renderToStaticMarkup(
    <DiffTable rows={[row]} outputView="rendered" />
  )
  expect(html).toContain('&lt;b&gt;literal&lt;/b&gt;')
  expect(html).toContain('failure &amp; details')
  expect(html).not.toContain('<b>literal</b>')
})
