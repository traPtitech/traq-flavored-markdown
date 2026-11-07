import {
  block,
  lines,
  sourceFile
} from '../../../../tools/contracts/emitters/source.ts'
import type { PresetTree } from '../../../../tools/contracts/model/manifest.ts'

export type { PresetTree } from '../../../../tools/contracts/model/manifest.ts'

const q = JSON.stringify

function leaves(tree: PresetTree, path: string[] = []): string[][] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === 'number'
      ? [[...path, key]]
      : leaves(value as PresetTree, [...path, key])
  )
}

function frozen(tree: PresetTree, path: string[] = []): string {
  const entries = Object.entries(tree).map(
    ([key, value]) =>
      q(key) +
      ': ' +
      (typeof value === 'number'
        ? q([...path, key].join('.'))
        : frozen(value, [...path, key]))
  )

  return `Object.freeze({ ${entries.join(', ')} } as const)`
}

export function presetFiles(tree: PresetTree): Map<string, string> {
  const paths = leaves(tree)

  const goName = (part: string) =>
    (({ traq: 'Traq', commonmark: 'CommonMark' }) as Record<string, string>)[
      part
    ] ?? part[0].toUpperCase() + part.slice(1)

  return new Map([
    [
      'typescript/src/generated/presets.ts',
      sourceFile(
        lines(
          '// Generated from Rust preset exports. Do not edit.',
          `export type GrammarPresetId = ${paths.map(path => q(path.join('.'))).join(' | ')};`
        ),
        `export const presets = ${frozen(tree)};`,
        `const knownPresets: ReadonlySet<string> = new Set([${paths.map(path => q(path.join('.'))).join(', ')}]);`,
        block(
          'export function isGrammarPresetId(value: string): value is GrammarPresetId {',
          'return knownPresets.has(value);'
        )
      )
    ],
    [
      'go/generated_presets.go',
      sourceFile(
        lines(
          '// Code generated from Rust preset exports. DO NOT EDIT.',
          'package markdown'
        ),
        'type GrammarPresetID string',
        block(
          'const (',
          paths.map(
            path =>
              `Grammar${path.map(goName).join('')} GrammarPresetID = ${q(path.join('.'))}`
          ),
          ')'
        )
      )
    ]
  ])
}
