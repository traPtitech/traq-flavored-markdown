import path from 'path'

import { $ } from 'bun'

import { corpusRoot } from '../../../scripts/paths.ts'
import {
  type DifferenceRow,
  type ReportMetadata,
  type ReportPayload,
  byMode,
  modes,
  pageSize,
  parseDifferenceRow
} from '../report-schema.ts'
import { parseArgs, resolveRepositoryPath } from './args.ts'
import { ignoreMask } from './ignore-differences.ts'
import { readLines } from './read-lines.ts'

const { values } = parseArgs({
  options: {
    data: { type: 'string' },
    out: { type: 'string' }
  }
})
if (!values.data) throw new Error('--data required')
values.data = resolveRepositoryPath(values.data)
values.out = resolveRepositoryPath(values.out ?? values.data)
await $`mkdir -p ${values.out}`

const filterMasks = byMode<number[]>(() => [])
const chunks: ReportPayload = byMode<string[]>(() => [])
const pending = byMode<DifferenceRow[]>(() => [])
const counts = byMode(() => 0)

function flush(mode: (typeof modes)[number]) {
  if (!pending[mode].length) return
  chunks[mode].push(
    Bun.gzipSync(JSON.stringify(pending[mode]), { level: 9 }).toBase64()
  )
  pending[mode] = []
}

for (const file of ['sui-differences.jsonl', 'plain-text-differences.jsonl']) {
  for await (const line of readLines(path.join(values.data, file))) {
    if (!line) continue
    const row = parseDifferenceRow(JSON.parse(line))
    if (row.before === row.after && !row.error) {
      throw new Error('Equal result in difference list')
    }
    filterMasks[row.mode].push(ignoreMask(row))
    pending[row.mode].push(row)
    counts[row.mode]++
    if (pending[row.mode].length === pageSize) flush(row.mode)
  }
}
for (const mode of modes) flush(mode)

const sui = JSON.parse(
  await Bun.file(path.join(values.data, 'sui-summary.json')).text()
)
const traq = JSON.parse(
  await Bun.file(path.join(values.data, 'traq-summary.json')).text()
)
const revisions = JSON.parse(
  await Bun.file(path.join(values.data, 'revisions.json')).text()
)

if (
  sui.messages !== traq.messages ||
  counts.render !== sui.modes.render.differences ||
  counts.inline !== sui.modes.inline.differences ||
  counts.plainText !== traq.differences
) {
  throw new Error('Report counts mismatch')
}

const filters = byMode(() => '')
for (const mode of modes) filters[mode] = filterMasks[mode].join('')
const metadata: ReportMetadata = {
  filters,
  messages: sui.messages,
  counts,
  sui,
  traq,
  revisions,
  generated: new Date().toISOString(),
  pageSize
}

// Build React view
await $`bun run build`.cwd(corpusRoot).quiet()

const indexHtmlPath = path.join(corpusRoot, 'dist', 'index.html')
let html = await Bun.file(indexHtmlPath).text()

// Inject data
for (const [id, data] of [
  ['metadata', metadata],
  ['payload', chunks]
] as const) {
  const placeholder = `<script type="application/json" id="${id}"></script>`
  if (!html.includes(placeholder)) {
    throw new Error(`Missing ${id} placeholder in built viewer`)
  }
  html = html.replace(
    placeholder,
    `<script type="application/json" id="${id}">${JSON.stringify(data).replaceAll('<', '\\u003c')}</script>`
  )
}

await Bun.write(path.join(values.out, 'differences.html'), html)
const documentLength = new TextEncoder().encode(html).byteLength

const excluded = byMode(() => ({ whitespace: 0 }))
for (const mode of modes) {
  excluded[mode] = {
    whitespace: filterMasks[mode].filter(n => n & 1).length
  }
}
console.log(
  JSON.stringify({
    excluded,
    messages: metadata.messages,
    counts,
    bytes: documentLength,
    selfContained: true
  })
)
