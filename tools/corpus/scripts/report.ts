import path from 'path'

import { $ } from 'bun'

import { corpusRoot } from '../../../scripts/paths.ts'
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

const filterMasks: Record<string, number[]> = {
  render: [],
  inline: [],
  notification: []
}
const chunks: Record<string, string[]> = {
  render: [],
  inline: [],
  notification: []
}
const pending: Record<string, string[]> = {
  render: [],
  inline: [],
  notification: []
}
const counts: Record<string, number> = { render: 0, inline: 0, notification: 0 }

function flush(mode: string) {
  if (!pending[mode].length) return
  chunks[mode].push(
    Bun.gzipSync(JSON.stringify(pending[mode]), { level: 9 }).toBase64()
  )
  pending[mode] = []
}

for (const file of ['sui-differences.jsonl', 'traq-differences.jsonl']) {
  for await (const line of readLines(path.join(values.data, file))) {
    if (!line) continue
    const row = JSON.parse(line)
    if (row.before === row.after && !row.error) {
      throw new Error('Equal result in difference list')
    }
    filterMasks[row.mode].push(ignoreMask(row))
    pending[row.mode].push(row)
    counts[row.mode]++
    if (pending[row.mode].length === 50) flush(row.mode)
  }
}
for (const mode of Object.keys(chunks)) flush(mode)

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
  counts.notification !== traq.differences
) {
  throw new Error('Report counts mismatch')
}

const filters = Object.fromEntries(
  Object.entries(filterMasks).map(([mode, flags]) => [mode, flags.join('')])
)
const metadata = {
  filters,
  messages: sui.messages,
  counts,
  sui,
  traq,
  revisions,
  generated: new Date().toISOString(),
  pageSize: 50
}

// Build React view
await $`bun run build`.cwd(corpusRoot).quiet()

const indexHtmlPath = path.join(corpusRoot, 'dist', 'index.html')
let html = await Bun.file(indexHtmlPath).text()

// Inject data
html = html.replace(
  '<script type="application/json" id="metadata"></script>',
  `<script type="application/json" id="metadata">${JSON.stringify(metadata).replaceAll('<', '\\u003c')}</script>`
)
html = html.replace(
  '<script type="application/json" id="payload"></script>',
  `<script type="application/json" id="payload">${JSON.stringify(chunks)}</script>`
)

await Bun.write(path.join(values.out, 'differences.html'), html)
const documentLength = new TextEncoder().encode(html).byteLength

const excluded = Object.fromEntries(
  Object.entries(filterMasks).map(([mode, flags]) => [
    mode,
    { whitespace: flags.filter(n => n & 1).length }
  ])
)
console.log(
  JSON.stringify({
    excluded,
    messages: metadata.messages,
    counts,
    bytes: documentLength,
    selfContained: true
  })
)
