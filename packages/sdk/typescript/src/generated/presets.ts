// Generated from Rust preset exports. Do not edit.
export type GrammarPresetId = 'commonmark' | 'traq.v1'
export const presets = Object.freeze({
  commonmark: 'commonmark',
  traq: Object.freeze({ v1: 'traq.v1' } as const)
} as const)
const knownPresets: ReadonlySet<string> = new Set(['commonmark', 'traq.v1'])
export function isGrammarPresetId(value: string): value is GrammarPresetId {
  return knownPresets.has(value)
}
