import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import type { DifferenceRow } from '../protocol/report.ts'
import DiffTable from './DiffTable.tsx'

test('text and error results render their full content without mounting DOM effects', () => {
  const row: DifferenceRow = {
    runId: 'synthetic-run',
    index: 0,
    profile: 'plainText',
    source: 'source',
    before: { kind: 'text', value: '<b>literal</b>' },
    after: { kind: 'error', value: 'failure & details' }
  }
  const html = renderToStaticMarkup(
    <DiffTable rows={[row]} outputView="rendered" />
  )
  expect(html).toContain('&lt;b&gt;literal&lt;/b&gt;')
  expect(html).toContain('failure &amp; details')
  expect(html).not.toContain('<b>literal</b>')
})
