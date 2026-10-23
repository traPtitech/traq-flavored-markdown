import { parseDifferenceRow } from '../report-schema.ts'

export type SourceRecord = { source: string }

export function parseSource(line: string): SourceRecord {
  const value = JSON.parse(line)
  if (!value || typeof value.source !== 'string')
    throw new Error('Invalid corpus source record')
  return { source: value.source }
}
export const parseDifferenceLine = (line: string) =>
  parseDifferenceRow(JSON.parse(line))
export const encodeRecord = (value: unknown) => JSON.stringify(value) + '\n'
