import path from 'node:path'

import { sha256, writeJson } from '../infrastructure/files.ts'
import { parseAuthorIndex } from '../protocol/authors.ts'
import {
  type ComparisonPlan,
  type CompletedRun,
  type ProfileId,
  type ProfileResult,
  parseComparisonPlan,
  parseCompletedRun,
  parseWorkerResults
} from '../protocol/comparison.ts'
import { authorIndexFile } from './authors.ts'

export const resultFiles = [
  'frontend-results.json',
  'plain-text-results.json'
] as const
export const differenceFiles = [
  'frontend-differences.jsonl',
  'plain-text-differences.jsonl'
] as const
export const runFiles = [
  'run.json',
  ...resultFiles,
  ...differenceFiles,
  'embedding-differences.jsonl'
] as const

export async function readResults(
  plan: ComparisonPlan
): Promise<Record<ProfileId, ProfileResult>> {
  const results: Partial<Record<ProfileId, ProfileResult>> = {}
  for (const file of resultFiles) {
    const worker = parseWorkerResults(
      await Bun.file(path.join(plan.output, file)).json()
    )
    if (
      worker.runId !== plan.runId ||
      worker.corpusSha256 !== plan.corpusSha256
    )
      throw new Error('Worker results belong to a different comparison run')
    for (const [key, result] of Object.entries(worker.results)) {
      const profile = key as ProfileId
      if (results[profile])
        throw new Error('Duplicate profile result: ' + profile)
      results[profile] = result
    }
  }
  if (!results.render || !results.inline || !results.plainText)
    throw new Error('Comparison run has incomplete profile results')
  return results as Record<ProfileId, ProfileResult>
}

export async function completeRun(plan: ComparisonPlan): Promise<CompletedRun> {
  const results = await readResults(plan)
  const authors = parseAuthorIndex(
    await Bun.file(path.join(plan.output, authorIndexFile)).json()
  )
  validateAuthors(plan, authors, results.render.messages)
  if (
    Object.values(results).some(
      result => result.messages !== authors.kinds.length
    )
  )
    throw new Error('Author index message counts mismatch')
  const files = await Promise.all(
    [...runFiles, authorIndexFile].map(async file => ({
      path: file,
      sha256: await sha256(path.join(plan.output, file))
    }))
  )
  const manifest = parseCompletedRun({
    format: '1',
    runId: plan.runId,
    corpusSha256: plan.corpusSha256,
    status: 'complete',
    files
  })
  await writeJson(path.join(plan.output, 'complete.json'), manifest)
  return manifest
}

export async function readCompletedRun(directory: string) {
  const manifest = parseCompletedRun(
    await Bun.file(path.join(directory, 'complete.json')).json()
  )
  const names = manifest.files.map(file => file.path)
  // Six-file runs predate account metadata and remain portable and verifiable.
  const expected = names.includes(authorIndexFile)
    ? [...runFiles, authorIndexFile]
    : runFiles
  if (
    names.length !== expected.length ||
    new Set(names).size !== expected.length ||
    !expected.every(file => names.includes(file))
  )
    throw new Error('Invalid comparison run file manifest')
  for (const file of manifest.files)
    if ((await sha256(path.join(directory, file.path))) !== file.sha256)
      throw new Error('Comparison file digest mismatch: ' + file.path)
  const plan = parseComparisonPlan(
    await Bun.file(path.join(directory, 'run.json')).json()
  )
  if (
    plan.runId !== manifest.runId ||
    plan.corpusSha256 !== manifest.corpusSha256
  )
    throw new Error('Completion manifest belongs to a different run')
  // Reports can be regenerated after moving an immutable completed run directory.
  return { plan: { ...plan, output: path.resolve(directory) }, manifest }
}

export function validateAuthors(
  plan: ComparisonPlan,
  authors: ReturnType<typeof parseAuthorIndex>,
  messages: number
) {
  if (
    authors.runId !== plan.runId ||
    authors.corpusSha256 !== plan.corpusSha256
  )
    throw new Error('Author index belongs to a different comparison run')
  if (authors.kinds.length !== messages)
    throw new Error('Author index message counts mismatch')
}
