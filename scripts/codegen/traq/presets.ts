const q = JSON.stringify

export type PresetTree = { [key: string]: number | PresetTree }

function leaves(tree: PresetTree, path: string[] = []): string[][] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === 'number'
      ? [[...path, key]]
      : leaves(value as PresetTree, [...path, key])
  )
}

function named(
  tree: PresetTree,
  path: string[] = []
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(tree).map(([key, value]) => [
      key,
      typeof value === 'number'
        ? [...path, key].join('.')
        : named(value as PresetTree, [...path, key])
    ])
  )
}

export function presetFiles(tree: PresetTree): Map<string, string> {
  const paths = leaves(tree)
  const goName = (part: string) =>
    ({ traq: 'TraQ', commonmark: 'CommonMark' } as Record<string, string>)[
      part
    ] ?? part[0].toUpperCase() + part.slice(1)
  return new Map([
    [
      'typescript/generated/presets.ts',
      '// Generated from Rust preset exports. Do not edit.\n' +
        'export type Preset = ' +
        paths.map(p => q(p.join('.'))).join(' | ') +
        ';\n' +
        'export const presets = ' +
        q(named(tree)) +
        ' as const;\n'
    ],
    [
      'go/generated_presets.go',
      '// Code generated from Rust preset exports. DO NOT EDIT.\npackage markdown\ntype Preset string\nconst (\n' +
        paths
          .map(
            p =>
              'Preset' + p.map(goName).join('') + ' Preset = ' + q(p.join('.'))
          )
          .join('\n') +
        '\n)\n'
    ]
  ])
}
