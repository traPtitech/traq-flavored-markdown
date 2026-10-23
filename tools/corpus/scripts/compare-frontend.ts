import { mkdir } from 'node:fs/promises'
import path from 'node:path'

import { frontendAdapters } from '../comparison/adapters/frontend.ts'
import { compareSources } from '../comparison/runner.ts'
import {
  type ComparisonResult,
  type Mode,
  parseComparisonPlan
} from '../shared/comparison.ts'
import { encodeRecord, parseSource } from '../shared/protocol.ts'
import { parseArgs } from './args.ts'
import { readLines } from './read-lines.ts'

const { values } = parseArgs({
  options: {
    plan: { type: 'string' }
  }
})
if (!values.plan) throw new Error('--plan is required')
const plan = parseComparisonPlan(await Bun.file(values.plan).json())
await mkdir(plan.output, { recursive: true })

const adapters = await frontendAdapters(plan)
const outputPath = path.join(plan.output, 'sui-differences.jsonl')
const embeddingOutputPath = path.join(
  plan.output,
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
      for await (const line of readLines(plan.corpus))
        if (line) yield parseSource(line)
    },
    profiles: adapters.profiles,
    max: plan.max,
    warmups: plan.warmups,
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
  const report: Partial<Record<Mode, ComparisonResult>> = Object.fromEntries(
    Object.entries(result.modes).map(([mode, measurement]) => [
      mode,
      {
        ...measurement,
        messages: result.messages,
        initialization: {
          beforeMs: adapters.beforeInitializationMs,
          afterMs: adapters.afterInitializationMs
        }
      }
    ])
  )
  await Bun.write(
    path.join(plan.output, 'frontend-results.json'),
    JSON.stringify(report, null, 2) + '\n'
  )
  console.log(
    JSON.stringify({
      results: report,
      warnings,
      wallSeconds: result.wallSeconds
    })
  )
} finally {
  await output.end()
  await embeddings.end()
  console.warn = logger
  adapters.dispose()
}
