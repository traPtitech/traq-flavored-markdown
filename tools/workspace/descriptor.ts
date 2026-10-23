/** Ownership is architectural policy; manifest order and publication peers are not. */
export const owners = {
  core: { directory: 'packages/core', allows: [] },
  'commonmark-plugin': {
    directory: 'packages/plugins/commonmark',
    allows: ['core']
  },
  'extensions-plugin': {
    directory: 'packages/plugins/extensions',
    allows: ['core', 'commonmark-plugin']
  },
  'traq-plugin': {
    directory: 'packages/plugins/traq',
    allows: ['core', 'commonmark-plugin', 'extensions-plugin']
  },
  sdk: {
    directory: 'packages/sdk',
    allows: ['core', 'commonmark-plugin', 'extensions-plugin', 'traq-plugin']
  }
} as const

export type PackageName = keyof typeof owners
export const packageNames = Object.keys(owners) as PackageName[]

export function allowsOwner(source: PackageName, destination: PackageName) {
  return (
    source === destination ||
    (owners[source].allows as readonly PackageName[]).includes(destination)
  )
}

/** Capability boundaries apply to every production crate, including plugin layers. */
const engines = [
  'markdown-parser',
  'markdown-codec',
  'markdown-renderer',
  'markdown-extractor'
] as const
const assemblies = [
  'traq-markdown-grammar',
  'traq-markdown-processing',
  'traq-markdown-wasm'
] as const
const without = (names: readonly string[], ...allowed: string[]) =>
  names.filter(name => !allowed.includes(name))
const restrictions: Record<string, readonly string[]> = {}
for (const name of [
  'markdown-ast',
  'markdown-definitions',
  'markdown-definitions-derive'
])
  restrictions[name] = [...engines, ...assemblies]
for (const name of engines)
  restrictions[name] = [...without(engines, name), ...assemblies]
for (const plugin of ['commonmark', 'extensions', 'trap']) {
  restrictions['markdown-' + plugin + '-contracts'] = [
    ...engines,
    ...assemblies
  ]
  restrictions['markdown-' + plugin + '-text'] = [
    ...without(engines, 'markdown-renderer'),
    ...assemblies
  ]
  restrictions[
    plugin === 'commonmark'
      ? 'markdown-commonmark'
      : 'markdown-' + plugin + '-syntax'
  ] = [...without(engines, 'markdown-parser'), ...assemblies]
}
restrictions['markdown-trap-extraction'] = [
  ...without(engines, 'markdown-extractor'),
  ...assemblies
]
restrictions['traq-markdown-features'] = [...engines, ...assemblies]
restrictions['traq-markdown-grammar'] = [
  'markdown-codec',
  'markdown-renderer',
  'markdown-extractor',
  'traq-markdown-processing',
  'traq-markdown-wasm'
]
restrictions['traq-markdown-processing'] = [
  'markdown-parser',
  'markdown-codec',
  'traq-markdown-grammar',
  'traq-markdown-wasm'
]
restrictions['traq-markdown-wasm'] = []
restrictions['traq-markdown-example'] = []
export const crateRestrictions: Readonly<Record<string, readonly string[]>> =
  Object.freeze(restrictions)
