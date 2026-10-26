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
      '// Generated from Rust preset exports. Do not edit.\n' +
        'export type GrammarPresetId = ' +
        paths.map(p => q(p.join('.'))).join(' | ') +
        ';\n' +
        'export const presets = ' +
        frozen(tree) +
        ';\n' +
        'const knownPresets: ReadonlySet<string> = new Set([' +
        paths.map(path => q(path.join('.'))).join(', ') +
        ']);\n' +
        'export function isGrammarPresetId(value: string): value is GrammarPresetId { return knownPresets.has(value); }\n'
    ],
    [
      'go/generated_presets.go',
      '// Code generated from Rust preset exports. DO NOT EDIT.\npackage markdown\ntype GrammarPresetID string\nconst (\n' +
        paths
          .map(
            p =>
              'Grammar' +
              p.map(goName).join('') +
              ' GrammarPresetID = ' +
              q(p.join('.'))
          )
          .join('\n') +
        '\n)\n'
    ]
  ])
}
