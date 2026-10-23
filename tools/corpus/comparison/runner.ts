import type { DifferenceRow, Mode, OutputKind } from '../report-schema.ts'
import { defaultWarmups } from '../shared/comparison.ts'
import type { SourceRecord } from '../shared/protocol.ts'

export type AdapterOutput = {
  kind: Exclude<OutputKind, 'error'>
  value: string
  embeddings?: unknown
}
export type Adapter = (source: string) => AdapterOutput | Promise<AdapterOutput>
export type Profile = { mode: Mode; before: Adapter; after: Adapter }
type Measured = {
  kind: OutputKind
  value: string
  embeddings?: unknown
  ms: number
}

export function summarize(values: readonly number[]) {
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
      kind: 'error',
      value: error instanceof Error ? error.message : String(error),
      ms: now() - start
    }
  }
}

/** Input, adapters, clock, and sinks are ports; comparison policy needs no Git/network. */
export async function compareSources({
  input,
  profiles,
  max = Infinity,
  warmups = defaultWarmups,
  difference,
  embeddingDifference = async () => undefined,
  progress = () => undefined,
  now = () => performance.now()
}: {
  input: () => AsyncIterable<SourceRecord>
  profiles: readonly Profile[]
  max?: number
  warmups?: number
  difference: (row: DifferenceRow) => void | Promise<void>
  embeddingDifference?: (row: {
    index: number
    mode: Mode
    source: string
    before: unknown
    after: unknown
  }) => void | Promise<void>
  progress?: (messages: number) => void
  now?: () => number
}) {
  const stats = new Map(
    profiles.map(profile => [
      profile.mode,
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
  let warmed = 0
  if (warmups > 0)
    for await (const { source } of input()) {
      for (const profile of profiles) {
        await measure(profile.before, source, now)
        await measure(profile.after, source, now)
      }
      if (++warmed >= warmups) break
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
      const current = stats.get(profile.mode)!
      current.before.push(before.ms)
      current.after.push(after.ms)
      current.beforeErrors += Number(before.kind === 'error')
      current.afterErrors += Number(after.kind === 'error')
      if (
        before.kind !== 'error' &&
        after.kind !== 'error' &&
        JSON.stringify(before.embeddings) !== JSON.stringify(after.embeddings)
      ) {
        current.embeddingDifferences++
        await embeddingDifference({
          index: messages,
          mode: profile.mode,
          source,
          before: before.embeddings,
          after: after.embeddings
        })
      }
      if (before.kind !== after.kind || before.value !== after.value) {
        current.differences++
        await difference({
          index: messages,
          mode: profile.mode,
          source,
          before: before.value,
          after: after.value,
          beforeType: before.kind,
          afterType: after.kind,
          error: before.kind === 'error' || after.kind === 'error'
        })
      }
    }
    messages++
    progress(messages)
  }
  return {
    messages,
    wallSeconds: (now() - start) / 1000,
    modes: Object.fromEntries(
      [...stats].map(([mode, value]) => [
        mode,
        {
          ...value,
          before: summarize(value.before),
          after: summarize(value.after)
        }
      ])
    )
  }
}
