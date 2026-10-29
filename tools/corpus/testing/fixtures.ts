import {
  type ComparisonPlan,
  type DifferenceRow,
  type ProfileResult,
  byProfile
} from '../protocol/comparison.ts'
import { type ReportMetadata, filterMaskWidth } from '../protocol/report.ts'

export const fixtureDigest = 'a'.repeat(64)
export function fixturePlan(
  overrides: Partial<ComparisonPlan> = {}
): ComparisonPlan {
  return {
    format: '1',
    runId: 'synthetic-run',
    corpus: 'messages.jsonl',
    corpusSha256: fixtureDigest,
    output: 'comparison',
    baselineDirectory: 'baseline',
    wasm: 'parser.wasm',
    candidateDirectory: 'dist',
    origin: 'https://q.example.test',
    max: 100,
    warmups: 2,
    provenance: {
      before: byProfile(() => ({
        label: 'before',
        revision: 'a',
        dirty: false
      })),
      after: { label: 'after', revision: 'b', dirty: false },
      artifacts: {
        wasmSha256: fixtureDigest,
        javascriptSha256: fixtureDigest,
        contractId: 'contract',
        sourceFingerprint: 'source'
      },
      dependencies: {}
    },
    environment: {
      bun: 'synthetic',
      go: 'synthetic',
      platform: 'test',
      arch: 'test'
    },
    ...overrides
  }
}

export function fixtureResult(
  messages: number,
  overrides: Partial<ProfileResult> = {}
): ProfileResult {
  const timing = {
    calls: messages,
    totalMs: 1,
    meanUs: 1,
    p50Us: 1,
    p95Us: 1,
    p99Us: 1
  }
  return {
    messages,
    differences: 0,
    embeddingDifferences: 0,
    beforeErrors: 0,
    afterErrors: 0,
    before: timing,
    after: timing,
    initialization: { beforeMs: 1, afterMs: 1 },
    actualWarmups: 0,
    ...overrides
  }
}

export function fixtureMetadata(
  counts = byProfile(() => 0),
  pageSize = 50,
  messages = 3
) {
  const plan = fixturePlan()
  return {
    messages,
    counts,
    filters: byProfile(profile =>
      '0'.repeat(counts[profile] * filterMaskWidth)
    ),
    authors: byProfile(profile => 'u'.repeat(counts[profile])),
    results: byProfile(profile =>
      fixtureResult(messages, { differences: counts[profile] })
    ),
    run: {
      runId: plan.runId,
      corpusSha256: plan.corpusSha256,
      warmups: plan.warmups,
      provenance: plan.provenance,
      environment: plan.environment
    },
    generated: '2026-01-01T00:00:00Z',
    pageSize
  } satisfies ReportMetadata
}

export const fixtureRows: DifferenceRow[] = [
  {
    runId: 'synthetic-run',
    index: 0,
    profile: 'render',
    source: 'Alpha',
    before: { kind: 'html', value: 'a ' },
    after: { kind: 'html', value: 'a' }
  },
  {
    runId: 'synthetic-run',
    index: 1,
    profile: 'render',
    source: 'Beta',
    before: { kind: 'html', value: 'same' },
    after: { kind: 'error', value: 'same' }
  },
  {
    runId: 'synthetic-run',
    index: 2,
    profile: 'plainText',
    source: 'Gamma',
    before: { kind: 'text', value: 'c' },
    after: { kind: 'text', value: 'd' }
  }
]

export const fixtureLinkedImage: DifferenceRow = {
  ...fixtureRows[0],
  source:
    '[![badge](https://images.example.test/badge.svg)](https://example.test/docs)',
  before: {
    kind: 'html',
    value:
      '[!<a href="https://images.example.test/badge.svg">badge</a>](<a href="https://example.test/docs">https://example.test/docs</a>)'
  },
  after: {
    kind: 'html',
    value: '<a href="https://example.test/docs">!badge</a>'
  }
}

export const fixtureHtmlSerialization: DifferenceRow = {
  ...fixtureRows[0],
  source: 'HTML spelling',
  before: {
    kind: 'html',
    value: `<span title='a&#039;b' class='error'>a&#39;b</span>`
  },
  after: { kind: 'html', value: `<span class="error" title="a'b">a'b</span>` }
}

export const fixtureKatexError: DifferenceRow = {
  ...fixtureRows[0],
  source: 'KaTeX error only',
  before: {
    kind: 'html',
    value: `<p class='katex-block katex-error is-scroll' title='old diagnostic'>\\invalid-before</p>`
  },
  after: {
    kind: 'html',
    value: `<p class="katex-block katex-error is-scroll" title="new diagnostic">\\invalid-after</p>`
  }
}
