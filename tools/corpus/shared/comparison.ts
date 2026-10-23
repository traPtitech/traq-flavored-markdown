export const profileDefinitions = {
  render: { label: 'traQ_S-UI · 通常', output: 'html' },
  inline: { label: 'traQ_S-UI · インライン', output: 'html' },
  plainText: { label: 'traQ · プレーンテキスト', output: 'text' }
} as const

export type Mode = keyof typeof profileDefinitions
export const modes = Object.keys(profileDefinitions) as Mode[]
export const defaultWarmups = 200

export const byMode = <T>(create: (mode: Mode) => T): Record<Mode, T> =>
  Object.fromEntries(modes.map(mode => [mode, create(mode)])) as Record<Mode, T>

export function isMode(value: unknown): value is Mode {
  return typeof value === 'string' && Object.hasOwn(profileDefinitions, value)
}

export type Timing = {
  calls: number
  totalMs: number
  meanUs: number
  p50Us: number
  p95Us: number
  p99Us: number
}

export type ComparisonResult = {
  messages: number
  differences: number
  embeddingDifferences: number
  beforeErrors: number
  afterErrors: number
  before: Timing
  after: Timing
  initialization: { beforeMs: number; afterMs: number }
}

export type Revision = { label: string; revision: string }
export type ComparisonProvenance = {
  before: Record<Mode, Revision>
  after: Revision
  dependencies: Record<string, { before: string; after: string }>
}

/** The persisted input shared by both runners and report generation. */
export type ComparisonPlan = {
  format: 1
  corpus: string
  output: string
  baselineDirectory: string
  wasm: string
  origin: string
  max: number
  warmups: number
  profiles: Mode[]
  provenance: ComparisonProvenance
}

export function validateProvenance(value: unknown): ComparisonProvenance {
  if (!value || typeof value !== 'object')
    throw new Error('Invalid comparison provenance')
  const provenance = value as ComparisonProvenance
  const revision = (value: Revision | undefined) =>
    value &&
    typeof value.label === 'string' &&
    value.label.length > 0 &&
    typeof value.revision === 'string' &&
    value.revision.length > 0
  if (
    !modes.every(mode => revision(provenance.before?.[mode])) ||
    !revision(provenance.after) ||
    !provenance.dependencies ||
    typeof provenance.dependencies !== 'object' ||
    !Object.values(provenance.dependencies).every(
      dependency =>
        dependency &&
        typeof dependency.before === 'string' &&
        typeof dependency.after === 'string'
    )
  )
    throw new Error('Invalid comparison provenance')
  return provenance
}

export function parseComparisonPlan(value: unknown): ComparisonPlan {
  if (!value || typeof value !== 'object')
    throw new Error('Invalid comparison plan')
  const plan = value as ComparisonPlan
  if (
    plan.format !== 1 ||
    !['corpus', 'output', 'baselineDirectory', 'wasm', 'origin'].every(
      key => typeof plan[key as keyof ComparisonPlan] === 'string'
    ) ||
    !plan.corpus ||
    !plan.output ||
    !plan.baselineDirectory ||
    !plan.wasm ||
    !Number.isSafeInteger(plan.max) ||
    plan.max <= 0 ||
    !Number.isSafeInteger(plan.warmups) ||
    plan.warmups < 0 ||
    !Array.isArray(plan.profiles) ||
    plan.profiles.length !== modes.length ||
    !plan.profiles.every(isMode) ||
    new Set(plan.profiles).size !== modes.length
  )
    throw new Error('Invalid comparison plan')
  validateProvenance(plan.provenance)
  return plan
}
