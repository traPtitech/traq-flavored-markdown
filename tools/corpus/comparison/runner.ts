import {
  type DifferenceRow,
  type Outcome,
  type ProfileId,
  type ProfileResult,
  type SourceRecord,
  type Timing,
  defaultWarmups,
  isFailure,
  outcomesEqual
} from '../protocol/comparison.ts'

export type AdapterOutput = {
  outcome: Exclude<Outcome, { kind: 'error' }>
  embeddings?: unknown
}
export type Adapter = (source: string) => AdapterOutput | Promise<AdapterOutput>
export type Profile = { id: ProfileId; before: Adapter; after: Adapter }
type Measured = { outcome: Outcome; embeddings?: unknown; ms: number }
export type EmbeddingDifference = {
  runId: string
  index: number
  profile: ProfileId
  source: string
  before: unknown
  after: unknown
}
type Measurement = Omit<
  ProfileResult,
  'messages' | 'initialization' | 'actualWarmups'
>

export function summarize(values: readonly number[]): Timing {
  const sorted = [...values].sort((a, b) => a - b)
  const totalMs = sorted.reduce((sum, value) => sum + value, 0)
  const percentile = (p: number) =>
    (sorted[Math.floor((sorted.length - 1) * p)] ?? 0) * 1000
  return {
    calls: sorted.length,
    totalMs,
    meanUs: (totalMs / Math.max(sorted.length, 1)) * 1000,
    p50Us: percentile(0.5),
    p95Us: percentile(0.95),
    p99Us: percentile(0.99)
  }
}

async function measure(
  adapter: Adapter,
  source: string,
  now: () => number
): Promise<Measured> {
  const start = now()
  try {
    const output = adapter(source)
    const value = output instanceof Promise ? await output : output
    return { ...value, ms: now() - start }
  } catch (error) {
    return {
      outcome: {
        kind: 'error',
        value: error instanceof Error ? error.message : String(error)
      },
      ms: now() - start
    }
  }
}

/** Adapters retain language-local measurement; storage and process startup stay outside. */
export async function compareSources({
  runId,
  input,
  profiles,
  max = Infinity,
  warmups = defaultWarmups,
  difference,
  embeddingDifference = async () => undefined,
  progress = () => undefined,
  now = () => performance.now()
}: {
  runId: string
  input: () => AsyncIterable<SourceRecord>
  profiles: readonly Profile[]
  max?: number
  warmups?: number
  difference: (row: DifferenceRow) => void | Promise<void>
  embeddingDifference?: (row: EmbeddingDifference) => void | Promise<void>
  progress?: (messages: number) => void
  now?: () => number
}) {
  if (
    !runId ||
    !profiles.length ||
    new Set(profiles.map(profile => profile.id)).size !== profiles.length
  )
    throw new Error('Comparison requires a run ID and unique profiles')
  if (
    (max !== Infinity && (!Number.isSafeInteger(max) || max <= 0)) ||
    !Number.isSafeInteger(warmups) ||
    warmups < 0
  )
    throw new Error('Invalid measurement bounds')
  const stats = new Map(
    profiles.map(profile => [
      profile.id,
      {
        differences: 0,
        embeddingDifferences: 0,
        beforeErrors: 0,
        afterErrors: 0,
        before: [] as number[],
        after: [] as number[]
      }
    ])
  )
  let actualWarmups = 0
  if (warmups > 0)
    for await (const { source } of input()) {
      for (const profile of profiles) {
        await measure(profile.before, source, now)
        await measure(profile.after, source, now)
      }
      if (++actualWarmups >= warmups) break
    }
  const start = now()
  let messages = 0
  for await (const { source } of input()) {
    if (messages >= max) break
    for (const profile of profiles) {
      let before: Measured, after: Measured
      if (messages % 2 === 0) {
        before = await measure(profile.before, source, now)
        after = await measure(profile.after, source, now)
      } else {
        after = await measure(profile.after, source, now)
        before = await measure(profile.before, source, now)
      }
      const current = stats.get(profile.id)!
      current.before.push(before.ms)
      current.after.push(after.ms)
      current.beforeErrors += Number(isFailure(before.outcome))
      current.afterErrors += Number(isFailure(after.outcome))
      if (
        !isFailure(before.outcome) &&
        !isFailure(after.outcome) &&
        JSON.stringify(before.embeddings) !== JSON.stringify(after.embeddings)
      ) {
        current.embeddingDifferences++
        await embeddingDifference({
          runId,
          index: messages,
          profile: profile.id,
          source,
          before: before.embeddings,
          after: after.embeddings
        })
      }
      if (!outcomesEqual(before.outcome, after.outcome)) {
        current.differences++
        await difference({
          runId,
          index: messages,
          profile: profile.id,
          source,
          before: before.outcome,
          after: after.outcome
        })
      }
    }
    messages++
    progress(messages)
    if (messages >= max) break
  }
  const results: Partial<Record<ProfileId, Measurement>> = Object.fromEntries(
    [...stats].map(([profile, value]) => [
      profile,
      {
        ...value,
        before: summarize(value.before),
        after: summarize(value.after)
      }
    ])
  )
  return {
    messages,
    actualWarmups,
    wallSeconds: (now() - start) / 1000,
    results
  }
}
