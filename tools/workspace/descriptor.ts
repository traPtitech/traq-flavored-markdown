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

/** Capability boundaries inside an owner, independent of npm packaging. */
export const crateRestrictions: Readonly<Record<string, readonly string[]>> = {
  'traq-markdown-processing': [
    'markdown-parser',
    'markdown-codec',
    'traq-markdown-grammar',
    'traq-markdown-wasm'
  ],
  'markdown-trap-text': [
    'markdown-parser',
    'markdown-codec',
    'traq-markdown-grammar',
    'traq-markdown-wasm'
  ],
  'markdown-trap-extraction': [
    'markdown-parser',
    'markdown-codec',
    'traq-markdown-grammar',
    'traq-markdown-wasm'
  ],
  'markdown-trap-contracts': [
    'markdown-parser',
    'markdown-codec',
    'traq-markdown-grammar',
    'traq-markdown-wasm'
  ],
  'markdown-trap-syntax': ['traq-markdown-grammar', 'traq-markdown-wasm']
}
