import {
  type Infer,
  array,
  boolean,
  count,
  digest,
  duration,
  enumeration,
  keyedRecord,
  nonempty,
  object,
  parse,
  positiveCount,
  record,
  string
} from './schema.ts'

export const profileIds = ['render', 'inline', 'plainText'] as const
export const profileSchema = enumeration('ProfileId', profileIds)
export type ProfileId = Infer<typeof profileSchema>
export const isProfileId = (value: unknown): value is ProfileId =>
  typeof value === 'string' && profileIds.includes(value as ProfileId)
export const byProfile = <T>(
  create: (profile: ProfileId) => T
): Record<ProfileId, T> =>
  Object.fromEntries(
    profileIds.map(profile => [profile, create(profile)])
  ) as Record<ProfileId, T>
export const defaultWarmups = 200

export const outputKindSchema = enumeration('OutputKind', [
  'html',
  'text',
  'error'
])
export type OutputKind = Infer<typeof outputKindSchema>
export const outcomeSchema = object('Outcome', {
  kind: outputKindSchema,
  value: string
})
export type Outcome = {
  [K in OutputKind]: { kind: K; value: string }
}[OutputKind]
export const isFailure = (outcome: Outcome) => outcome.kind === 'error'
export const outcomesEqual = (before: Outcome, after: Outcome) =>
  before.kind === after.kind && before.value === after.value

export const sourceSchema = object('SourceRecord', { source: string }, true)
export type SourceRecord = Infer<typeof sourceSchema>
export const parseSource = (line: string): SourceRecord => {
  const { source } = parse(sourceSchema, JSON.parse(line))
  return { source }
}
export const differenceSchema = object('DifferenceRow', {
  runId: nonempty,
  index: count,
  profile: profileSchema,
  source: string,
  before: outcomeSchema,
  after: outcomeSchema
})
export type DifferenceRow = Infer<typeof differenceSchema>
export const parseDifferenceRow = (value: unknown): DifferenceRow =>
  parse(differenceSchema, value)

export const timingSchema = object('Timing', {
  calls: count,
  totalMs: duration,
  meanUs: duration,
  p50Us: duration,
  p95Us: duration,
  p99Us: duration
})
export type Timing = Infer<typeof timingSchema>
export const initializationSchema = object('Initialization', {
  beforeMs: duration,
  afterMs: duration
})
export const profileResultSchema = object('ProfileResult', {
  messages: count,
  differences: count,
  embeddingDifferences: count,
  beforeErrors: count,
  afterErrors: count,
  before: timingSchema,
  after: timingSchema,
  initialization: initializationSchema,
  actualWarmups: count
})
export type ProfileResult = Infer<typeof profileResultSchema>
export const workerResultsSchema = object('WorkerResults', {
  runId: nonempty,
  corpusSha256: digest,
  results: record(profileResultSchema)
})
export type WorkerResults = Infer<typeof workerResultsSchema>
export const parseWorkerResults = (value: unknown): WorkerResults => {
  const result = parse(workerResultsSchema, value)
  for (const key of Object.keys(result.results))
    if (!isProfileId(key)) throw new Error(`Invalid profile: ${key}`)
  return result
}

export const revisionSchema = object('Revision', {
  label: nonempty,
  revision: nonempty,
  dirty: boolean
})
export const artifactSchema = object('CandidateArtifacts', {
  wasmSha256: digest,
  javascriptSha256: digest,
  contractId: nonempty,
  sourceFingerprint: nonempty
})
export const dependencySchema = object('DependencyVersions', {
  before: nonempty,
  after: nonempty
})
export const provenanceSchema = object('ComparisonProvenance', {
  before: keyedRecord(revisionSchema, profileIds),
  after: revisionSchema,
  artifacts: artifactSchema,
  dependencies: record(dependencySchema)
})
export type ComparisonProvenance = Infer<typeof provenanceSchema>
export const environmentSchema = object('RunEnvironment', {
  bun: nonempty,
  go: nonempty,
  platform: nonempty,
  arch: nonempty
})
export const planSchema = object('ComparisonPlan', {
  format: enumeration('ProtocolVersion', ['1']),
  runId: nonempty,
  corpus: nonempty,
  corpusSha256: digest,
  output: nonempty,
  baselineDirectory: nonempty,
  wasm: nonempty,
  candidateDirectory: nonempty,
  origin: string,
  max: positiveCount,
  warmups: count,
  provenance: provenanceSchema,
  environment: environmentSchema
})
export type ComparisonPlan = Infer<typeof planSchema>
export const parseComparisonPlan = (value: unknown): ComparisonPlan =>
  parse(planSchema, value)

export const runSummarySchema = object('RunSummary', {
  runId: nonempty,
  corpusSha256: digest,
  warmups: count,
  provenance: provenanceSchema,
  environment: environmentSchema
})
export type RunSummary = Infer<typeof runSummarySchema>
export const manifestFileSchema = object('RunFile', {
  path: nonempty,
  sha256: digest
})
export const manifestSchema = object('CompletedRun', {
  format: enumeration('ManifestVersion', ['1']),
  runId: nonempty,
  corpusSha256: digest,
  status: enumeration('CompletionStatus', ['complete']),
  files: array(manifestFileSchema)
})
export type CompletedRun = Infer<typeof manifestSchema>
export const parseCompletedRun = (value: unknown): CompletedRun =>
  parse(manifestSchema, value)

/** All cross-language inputs and outputs, also embedded by the Go worker. */
export const protocolSchemas = {
  source: sourceSchema,
  difference: differenceSchema,
  plan: planSchema,
  results: workerResultsSchema
}
