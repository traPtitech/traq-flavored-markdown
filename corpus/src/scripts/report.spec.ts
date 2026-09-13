import { expect, test } from 'bun:test'

import { ignoreMask } from './ignore-differences.ts'
import { inertHtml, mhtml } from './report-assets.ts'

test('corpus report output is inert and round-trips UTF-8 MHTML', () => {
  const source =
    '<script>bad()</script><img src="https://invalid.example/a" onerror="bad()"><a href="javascript:bad()" onclick="bad()">&lt;text&gt;</a><span style="height:2em;background-image:url(https://invalid.example)">math</span>'
  const result = inertHtml(source)
  expect(result).not.toMatch(
    /<script|<img|<a\s|onclick|onerror|background-image/
  )
  expect(result).toContain('&lt;text&gt;')
  expect(result).toContain('height:2em')
  expect(result).not.toContain('>bad()</')
  expect(ignoreMask({ before: 'a \nb', after: 'ab' })).toBe(1)
  expect(ignoreMask({ before: 'a', after: 'b' })).toBe(0)
  const html = '<!doctype html><html lang="ja"><body>日本語 $x$</body></html>'
  const archive = mhtml(html)
  const payload = archive
    .split(
      'Content-Location: https://markdown-report.invalid/differences.html\r\n\r\n'
    )[1]
    .split('\r\n------markdown-corpus-report--')[0]
  expect(
    new TextDecoder().decode(
      Uint8Array.fromBase64(payload.replaceAll('\r\n', ''))
    )
  ).toBe(html)
})
