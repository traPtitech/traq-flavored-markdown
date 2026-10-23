import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { expect, test } from 'bun:test'

import { sha256, writeJson } from '../infrastructure/files.ts'
import { createJsonlSink } from '../infrastructure/jsonl.ts'
import { type ComparisonPlan, byProfile } from '../protocol/comparison.ts'
import { buildReport } from '../report/build.ts'
import { fixturePlan, fixtureResult } from '../testing/fixtures.ts'
import { readCompletedRun } from './run-files.ts'
import { createRun, executeRun } from './run.ts'

const template =
  '<script type="application/json" id="metadata"></script><script type="application/json" id="payload"></script>'

async function withRun(action: (plan: ComparisonPlan) => Promise<void>) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'corpus-run-'))
  try {
    const corpus = path.join(directory, 'input.jsonl')
    await Bun.write(corpus, '{"source":"synthetic"}\n')
    const plan = await createRun(
      fixturePlan({
        corpus,
        corpusSha256: await sha256(corpus),
        output: path.join(directory, 'run')
      })
    )
    await action(plan)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

async function frontend(plan: ComparisonPlan) {
  await using rows = await createJsonlSink(
    path.join(plan.output, 'frontend-differences.jsonl')
  )
  await using _embeddings = await createJsonlSink(
    path.join(plan.output, 'embedding-differences.jsonl')
  )
  await rows.write({
    runId: plan.runId,
    index: 0,
    profile: 'render',
    source: 'synthetic',
    before: { kind: 'html', value: 'before' },
    after: { kind: 'error', value: 'failed' }
  })
  await writeJson(path.join(plan.output, 'frontend-results.json'), {
    runId: plan.runId,
    corpusSha256: plan.corpusSha256,
    results: {
      render: fixtureResult(1, { differences: 1, afterErrors: 1 }),
      inline: fixtureResult(1)
    }
  })
}

async function plainText(plan: ComparisonPlan) {
  await using _rows = await createJsonlSink(
    path.join(plan.output, 'plain-text-differences.jsonl')
  )
  await writeJson(path.join(plan.output, 'plain-text-results.json'), {
    runId: plan.runId,
    corpusSha256: plan.corpusSha256,
    results: { plainText: fixtureResult(1) }
  })
}

test('only complete runs with matching file identities become reports', async () =>
  withRun(async plan => {
    await expect(readCompletedRun(plan.output)).rejects.toThrow()
    await executeRun(plan, { frontend, plainText })
    const report = await buildReport(plan.output, template)
    expect(report.metadata.messages).toBe(1)
    expect(report.metadata.results.render.afterErrors).toBe(1)
    expect(report.metadata.counts).toEqual({ ...byProfile(() => 0), render: 1 })
    await expect(createRun(plan)).rejects.toThrow()
    await Bun.write(path.join(plan.output, 'plain-text-results.json'), '{}')
    await expect(buildReport(plan.output, template)).rejects.toThrow(
      'digest mismatch'
    )
  }))

test('failed workers and replaced input cannot be mistaken for a completed run', async () =>
  withRun(async plan => {
    await expect(
      executeRun(plan, {
        frontend,
        plainText: async () => {
          throw new Error('worker failed')
        }
      })
    ).rejects.toThrow('worker failed')
    expect(
      await Bun.file(path.join(plan.output, 'complete.json')).exists()
    ).toBe(false)
    await Bun.write(plan.corpus, '{"source":"changed"}\n')
    await expect(executeRun(plan, { frontend, plainText })).rejects.toThrow(
      'Corpus changed'
    )
  }))

test('summaries from another run are rejected even with identical message counts', async () =>
  withRun(async plan => {
    await expect(
      executeRun(plan, {
        frontend,
        plainText: async current => {
          await plainText({ ...current, runId: 'other-run' })
        }
      })
    ).rejects.toThrow('different comparison run')
    expect(
      await Bun.file(path.join(plan.output, 'complete.json')).exists()
    ).toBe(false)
  }))
