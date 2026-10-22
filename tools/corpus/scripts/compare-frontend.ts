import { mkdir } from 'node:fs/promises'
import path from 'node:path'

import { frontendAdapters } from '../comparison/adapters/frontend.ts'
import { compareSources } from '../comparison/runner.ts'
import { encodeRecord, parseSource } from '../shared/protocol.ts'
import { parseArgs } from './args.ts'
import { readLines } from './read-lines.ts'

const { values } = parseArgs({
  options: {
    corpus: { type: 'string' },
    out: { type: 'string' },
    max: { type: 'number', default: 100000, integer: true, min: 1 },
    baseline: { type: 'string' },
    origin: { type: 'string' }
  }
})
if (!values.corpus || !values.out)
  throw new Error('--corpus and --out are required')
await mkdir(values.out, { recursive: true })

const adapters = await frontendAdapters(values.baseline!, values.origin)
const outputPath = path.join(values.out, 'sui-differences.jsonl')
const embeddingOutputPath = path.join(
  values.out,
  'sui-embedding-differences.jsonl'
)
await Promise.all([
  Bun.write(outputPath, ''),
  Bun.write(embeddingOutputPath, '')
])
const output = Bun.file(outputPath).writer(),
  embeddings = Bun.file(embeddingOutputPath).writer()
let warnings = 0
const logger = console.warn
console.warn = () => warnings++
try {
  const result = await compareSources({
    input: async function* () {
      for await (const line of readLines(values.corpus!))
        if (line) yield parseSource(line)
    },
    profiles: adapters.profiles,
    max: values.max,
    difference: async row => {
      await output.write(encodeRecord(row))
    },
    embeddingDifference: async row => {
      await embeddings.write(encodeRecord(row))
    },
    progress: messages => {
      if (messages % 10000 === 0)
        console.log(JSON.stringify({ processed: messages }))
    }
  })
  const report = {
    ...result,
    execution: 'standalone',
    beforeInitializationMs: adapters.beforeInitializationMs,
    afterInitializationMs: adapters.afterInitializationMs,
    warnings,
    timed:
      'Parse + render; 200 warmups; alternating before/after order; I/O excluded; deterministic reference/stamp ports'
  }
  await Bun.write(
    path.join(values.out, 'sui-summary.json'),
    JSON.stringify(report, null, 2) + '\n'
  )
  console.log(JSON.stringify(report))
} finally {
  await output.end()
  await embeddings.end()
  console.warn = logger
  adapters.dispose()
}
