import { mkdir } from 'node:fs/promises'
import path from 'node:path'

import { corpusRoot } from '../../../scripts/paths.ts'
import { type ReportMetadata } from '../report-schema.ts'
import { aggregateDifferences, reportDocument } from '../report/aggregate.ts'
import { parseDifferenceLine } from '../shared/protocol.ts'
import { parseArgs, resolveRepositoryPath } from './args.ts'
import { readLines } from './read-lines.ts'

const { values } = parseArgs({
  options: { data: { type: 'string' }, out: { type: 'string' } }
})
if (!values.data) throw new Error('--data required')
const data = resolveRepositoryPath(values.data),
  output = resolveRepositoryPath(values.out ?? values.data)
await mkdir(output, { recursive: true })
const aggregated = await aggregateDifferences(
  (async function* () {
    for (const file of [
      'sui-differences.jsonl',
      'plain-text-differences.jsonl'
    ])
      for await (const line of readLines(path.join(data, file)))
        if (line) yield parseDifferenceLine(line)
  })()
)
const read = (file: string) => Bun.file(path.join(data, file)).json()
const [sui, traq, revisions] = await Promise.all([
  read('sui-summary.json'),
  read('traq-summary.json'),
  read('revisions.json')
])
const metadata: ReportMetadata = {
  filters: aggregated.filters,
  counts: aggregated.counts,
  messages: sui.messages,
  sui,
  traq,
  revisions,
  generated: new Date().toISOString(),
  pageSize: aggregated.pageSize
}
const template = Bun.file(path.join(corpusRoot, 'dist/index.html'))
if (!(await template.exists()))
  throw new Error('Build the report viewer first: bun run build:corpus')
const html = reportDocument(await template.text(), metadata, aggregated.payload)
await Bun.write(path.join(output, 'differences.html'), html)
console.log(
  JSON.stringify({
    excluded: aggregated.excluded,
    messages: metadata.messages,
    counts: aggregated.counts,
    bytes: new TextEncoder().encode(html).byteLength,
    selfContained: true
  })
)
