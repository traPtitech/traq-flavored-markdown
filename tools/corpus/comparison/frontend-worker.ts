import path from 'node:path'

import { writeJson } from '../infrastructure/files.ts'
import { createJsonlSink, readSources } from '../infrastructure/jsonl.ts'
import { countPrivateWarnings } from '../infrastructure/warnings.ts'
import {
  type ComparisonPlan,
  parseWorkerResults
} from '../protocol/comparison.ts'
import { frontendAdapters } from './adapters/frontend.ts'
import { compareSources } from './runner.ts'

export async function runFrontend(
  plan: ComparisonPlan,
  progress: (messages: number) => void = () => undefined
) {
  using warnings = countPrivateWarnings()
  using adapters = await frontendAdapters(plan)
  await using output = await createJsonlSink(
    path.join(plan.output, 'frontend-differences.jsonl')
  )
  await using embeddings = await createJsonlSink(
    path.join(plan.output, 'embedding-differences.jsonl')
  )
  const result = await compareSources({
    runId: plan.runId,
    input: () => readSources(plan.corpus),
    profiles: adapters.profiles,
    max: plan.max,
    warmups: plan.warmups,
    difference: row => output.write(row),
    embeddingDifference: row => embeddings.write(row),
    progress
  })
  const report = parseWorkerResults({
    runId: plan.runId,
    corpusSha256: plan.corpusSha256,
    results: Object.fromEntries(
      Object.entries(result.results).map(([profile, measurement]) => [
        profile,
        {
          ...measurement,
          messages: result.messages,
          actualWarmups: result.actualWarmups,
          initialization: {
            beforeMs: adapters.beforeInitializationMs,
            afterMs: adapters.afterInitializationMs
          }
        }
      ])
    )
  })
  await output.close()
  await embeddings.close()
  await writeJson(path.join(plan.output, 'frontend-results.json'), report)
  return {
    results: report.results,
    warnings: warnings.count,
    wallSeconds: result.wallSeconds
  }
}
