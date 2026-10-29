import { mkdir } from 'node:fs/promises'
import path from 'node:path'

import {
  captureProcess,
  runProcess
} from '../../workspace/infrastructure/process.ts'
import { corpusRoot, repositoryRoot, sdkRoot } from '../../workspace/paths.ts'
import { sha256, writeJson } from '../infrastructure/files.ts'
import { GitRepo } from '../infrastructure/git.ts'
import { resolveRepositoryPath } from '../infrastructure/paths.ts'
import {
  type ComparisonPlan,
  defaultWarmups,
  parseComparisonPlan
} from '../protocol/comparison.ts'
import { buildReport } from '../report/build.ts'
import { candidateArtifacts } from './artifacts.ts'
import { writeAuthorIndex } from './authors.ts'
import { prepareBaseline } from './baseline.ts'
import { completeRun } from './run-files.ts'

export type ComparisonOptions = {
  corpus: string
  output?: string
  suiDirectory: string
  traqDirectory: string
  suiRef: string
  traqRef: string
  origin: string
  max: number
  warmups?: number
  frontendOnly?: boolean
}
export type RunWorkers = {
  frontend(plan: ComparisonPlan): Promise<void>
  plainText?(plan: ComparisonPlan): Promise<void>
  verifyCandidate?(plan: ComparisonPlan): Promise<void>
}

/** A failed run never receives a completion manifest and cannot become a report. */
export async function executeRun(plan: ComparisonPlan, workers: RunWorkers) {
  parseComparisonPlan(plan)
  if ((await sha256(plan.corpus)) !== plan.corpusSha256)
    throw new Error('Corpus changed before comparison')
  await workers.frontend(plan)
  if (plan.provenance.before.plainText) {
    if (!workers.plainText) throw new Error('Plain-text worker is required')
    await workers.plainText(plan)
  }
  await writeAuthorIndex(plan)
  if ((await sha256(plan.corpus)) !== plan.corpusSha256)
    throw new Error('Corpus changed during comparison')
  await workers.verifyCandidate?.(plan)
  return completeRun(plan)
}

export async function createRun(plan: ComparisonPlan) {
  parseComparisonPlan(plan)
  await mkdir(path.dirname(plan.output), { recursive: true })
  await mkdir(plan.output, { mode: 0o700 })
  await writeJson(path.join(plan.output, 'run.json'), plan)
  return plan
}

export async function runComparison(options: ComparisonOptions) {
  const warmups = options.warmups ?? defaultWarmups
  if (
    !options.corpus ||
    !Number.isSafeInteger(options.max) ||
    options.max <= 0 ||
    !Number.isSafeInteger(warmups) ||
    warmups < 0
  )
    throw new Error(
      'Comparison requires a corpus, positive maximum, and nonnegative warmups'
    )
  const runId = crypto.randomUUID()
  const corpus = resolveRepositoryPath(options.corpus)
  const output = resolveRepositoryPath(
    options.output ?? path.join('.private', 'corpora', 'comparisons', runId)
  )
  const sui = new GitRepo(resolveRepositoryPath(options.suiDirectory))
  const traq = options.frontendOnly
    ? undefined
    : new GitRepo(resolveRepositoryPath(options.traqDirectory))
  const candidate = new GitRepo(repositoryRoot)
  const [
    suiRevision,
    traqRevision,
    candidateRevision,
    dirty,
    goVersion,
    corpusSha256
  ] = await Promise.all([
    sui.revParse(options.suiRef),
    traq?.revParse(options.traqRef),
    candidate.revParse('HEAD'),
    candidate.exec(['status', '--porcelain']),
    options.frontendOnly
      ? Promise.resolve('Go not used (frontend-only)')
      : captureProcess('go', ['version'], repositoryRoot),
    sha256(corpus)
  ])
  const candidateDirectory = path.join(sdkRoot, 'dist')
  const wasm = path.join(candidateDirectory, 'parser.wasm')
  const artifacts = await candidateArtifacts(wasm, candidateDirectory)
  const baseline = await prepareBaseline({
    sui,
    traq,
    suiRevision,
    traqRevision,
    cache: path.join(repositoryRoot, '.private', 'corpus-cache')
  })
  const plan = await createRun(
    parseComparisonPlan({
      format: '1',
      runId,
      corpus,
      corpusSha256,
      output,
      baselineDirectory: baseline.directory,
      wasm,
      candidateDirectory,
      origin: options.origin,
      max: options.max,
      warmups,
      provenance: {
        before: {
          render: { label: 'traQ_S-UI', revision: suiRevision, dirty: false },
          inline: { label: 'traQ_S-UI', revision: suiRevision, dirty: false },
          ...(traqRevision
            ? {
                plainText: {
                  label: 'traQ',
                  revision: traqRevision,
                  dirty: false
                }
              }
            : {})
        },
        after: {
          label: 'traQ Markdown SDK',
          revision: candidateRevision,
          dirty: Boolean(dirty.trim())
        },
        artifacts,
        dependencies: baseline.dependencies
      },
      environment: {
        bun: Bun.version,
        go: goVersion.trim(),
        platform: process.platform,
        arch: process.arch
      }
    })
  )
  const planPath = path.join(output, 'run.json')
  await executeRun(plan, {
    frontend: () =>
      runProcess(
        Bun.argv[0],
        [path.join(corpusRoot, 'cli/compare-frontend.ts'), '--plan', planPath],
        repositoryRoot,
        { timeoutMs: 60 * 60 * 1000 }
      ),
    plainText: () =>
      runProcess(
        'go',
        ['run', '.', '-plan', planPath],
        path.join(baseline.directory, 'plain-text'),
        { env: { ...process.env, GOWORK: 'off' }, timeoutMs: 60 * 60 * 1000 }
      ),
    verifyCandidate: async current => {
      if (
        JSON.stringify(
          await candidateArtifacts(current.wasm, current.candidateDirectory)
        ) !== JSON.stringify(current.provenance.artifacts)
      )
        throw new Error('Candidate artifacts changed during comparison')
    }
  })
  await runProcess(Bun.argv[0], ['run', 'build'], corpusRoot)
  const report = await buildReport(
    output,
    await Bun.file(path.join(corpusRoot, 'dist/index.html')).text()
  )
  await Bun.write(path.join(output, 'differences.html'), report.html)
  return { runId, out: output, messages: report.metadata.messages }
}
