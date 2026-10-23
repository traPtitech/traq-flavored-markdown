import { mkdir } from 'node:fs/promises'
import path from 'node:path'

import { corpusRoot } from '../../../tools/workspace/paths.ts'
import { type ReportMetadata, modes } from '../report-schema.ts'
import { aggregateDifferences, reportDocument } from '../report/aggregate.ts'
import { parseComparisonPlan } from '../shared/comparison.ts'
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
const [frontend, plainText, rawPlan] = await Promise.all([
  read('frontend-results.json'),
  read('plain-text-results.json'),
  read('run.json')
])
const plan = parseComparisonPlan(rawPlan)
const results: ReportMetadata['results'] = { ...frontend, ...plainText }
const metadata: ReportMetadata = {
  filters: aggregated.filters,
  counts: aggregated.counts,
  messages: results[modes[0]].messages,
  results,
  run: { warmups: plan.warmups, provenance: plan.provenance },
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
