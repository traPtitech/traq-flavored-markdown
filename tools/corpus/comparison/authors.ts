import path from 'node:path'

import { writeJson } from '../infrastructure/files.ts'
import { parseSource, readLines } from '../infrastructure/jsonl.ts'
import { type AuthorIndex, sourceAuthorKind } from '../protocol/authors.ts'
import type { ComparisonPlan } from '../protocol/comparison.ts'

export const authorIndexFile = 'authors.json'

/** Align categories with measured input indices, including rows used for warmup. */
export async function writeAuthorIndex(
  plan: ComparisonPlan
): Promise<AuthorIndex> {
  const kinds: string[] = []
  for await (const line of readLines(plan.corpus)) {
    if (kinds.length >= plan.max) break
    parseSource(line)
    kinds.push(sourceAuthorKind(JSON.parse(line)))
  }
  const index: AuthorIndex = {
    format: '1',
    runId: plan.runId,
    corpusSha256: plan.corpusSha256,
    kinds: kinds.join('')
  }
  await writeJson(path.join(plan.output, authorIndexFile), index)
  return index
}
