import path from 'node:path'

import { $ } from 'bun'
import { expect, test } from 'bun:test'

import { withTempDirectory } from '../../../scripts/testing/temp-directory.ts'
import {
  type ReportMetadata,
  type ReportPayload,
  pageSize
} from '../report-schema.ts'
import { ignoreMask } from './ignore-differences.ts'

test('corpus report filters whitespace-only differences', () => {
  expect(ignoreMask({ before: 'a \nb', after: 'ab' })).toBe(1)
  expect(ignoreMask({ before: 'a', after: 'b' })).toBe(0)
})

test('corpus report embeds the same rows and metadata that the viewer reads', async () => {
  await withTempDirectory('corpus-report-', async root => {
    const timing = { meanUs: 1, p50Us: 1, p95Us: 1 }
    const comparison = { before: timing, after: timing }
    const rows = [
      { index: 0, mode: 'render', source: 'a', before: 'a ', after: 'a' },
      { index: 1, mode: 'inline', source: 'b', before: 'b', after: 'c' },
      { index: 2, mode: 'plainText', source: 'c', before: 'c', after: 'd' }
    ]
    await Bun.write(
      path.join(root, 'sui-differences.jsonl'),
      rows
        .slice(0, 2)
        .map(row => JSON.stringify(row))
        .join('\n') + '\n'
    )
    await Bun.write(
      path.join(root, 'plain-text-differences.jsonl'),
      JSON.stringify(rows[2]) + '\n'
    )
    await Bun.write(
      path.join(root, 'sui-summary.json'),
      JSON.stringify({
        messages: 3,
        modes: {
          render: { differences: 1, ...comparison },
          inline: { differences: 1, ...comparison }
        },
        beforeInitializationMs: 1,
        afterInitializationMs: 1
      })
    )
    await Bun.write(
      path.join(root, 'traq-summary.json'),
      JSON.stringify({
        messages: 3,
        differences: 1,
        afterInitializationMs: 1,
        ...comparison
      })
    )
    await Bun.write(
      path.join(root, 'revisions.json'),
      JSON.stringify({
        suiMaster: 'a',
        traqMaster: 'b',
        renderer: 'c',
        processor: 'd'
      })
    )

    const script = Bun.fileURLToPath(new URL('./report.ts', import.meta.url))
    await $`${Bun.argv[0]} ${script} --data ${root}`.quiet()
    const html = await Bun.file(path.join(root, 'differences.html')).text()
    const embedded = (id: string) => {
      const data = html.match(
        new RegExp(
          `<script type="application/json" id="${id}">([^<]*)</script>`
        )
      )?.[1]
      if (!data) throw new Error(`Missing ${id}`)
      return JSON.parse(data)
    }
    const metadata = embedded('metadata') as ReportMetadata
    const payload = embedded('payload') as ReportPayload
    expect(metadata.counts).toEqual({ render: 1, inline: 1, plainText: 1 })
    expect(metadata.filters.render).toBe('1')
    expect(metadata.pageSize).toBe(pageSize)
    for (const mode of ['render', 'inline', 'plainText'] as const) {
      const decoded = JSON.parse(
        new TextDecoder().decode(
          Bun.gunzipSync(Buffer.from(payload[mode][0], 'base64'))
        )
      )
      expect(decoded).toEqual([rows.find(row => row.mode === mode)])
    }
  })
})
