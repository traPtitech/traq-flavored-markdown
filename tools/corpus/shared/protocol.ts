import type { SourceRecord } from '../comparison/runner.ts'
import { parseDifferenceRow } from '../report-schema.ts'

export type RunManifest = {
  format: 1
  revisions: Record<string, string>
  max: number
  warmups: number
  modes: readonly string[]
}
export function parseRunManifest(value: unknown): RunManifest {
  if (!value || typeof value !== 'object')
    throw new Error('Invalid comparison run manifest')
  const manifest = value as RunManifest
  if (
    manifest.format !== 1 ||
    !Number.isSafeInteger(manifest.max) ||
    manifest.max <= 0 ||
    !Number.isSafeInteger(manifest.warmups) ||
    manifest.warmups < 0 ||
    !Array.isArray(manifest.modes) ||
    !manifest.modes.length ||
    !manifest.modes.every(mode =>
      ['render', 'inline', 'plainText'].includes(mode)
    ) ||
    new Set(manifest.modes).size !== manifest.modes.length ||
    !manifest.revisions ||
    typeof manifest.revisions !== 'object' ||
    !Object.values(manifest.revisions).every(
      revision => typeof revision === 'string' && revision.length > 0
    )
  )
    throw new Error('Invalid comparison run manifest')
  return manifest
}
export function parseSource(line: string): SourceRecord {
  const value = JSON.parse(line)
  if (!value || typeof value.source !== 'string')
    throw new Error('Invalid corpus source record')
  return { source: value.source }
}
export const parseDifferenceLine = (line: string) =>
  parseDifferenceRow(JSON.parse(line))
export const encodeRecord = (value: unknown) => JSON.stringify(value) + '\n'
