import { $ } from 'bun'

const root = Bun.fileURLToPath(new URL('../', import.meta.url))
const generated = [
  [
    'packages/commonmark/typescript/generated',
    'packages/commonmark/go/generated_nodes.go',
    'packages/commonmark/go/generic/generated_nodes.go'
  ],
  [
    'packages/trap-extension/typescript/generated',
    'packages/trap-extension/go/generated_nodes.go'
  ],
  ['packages/traq/typescript/generated'],
  [
    'packages/traq/go/generated_nodes.go',
    'packages/traq/go/generated_processing.go',
    'packages/traq/go/generated_presets.go',
    'packages/traq/go/generated_artifact.go'
  ]
]

const safeDirectory = `safe.directory=${root}`
const result =
  await $`git -c ${safeDirectory} status --porcelain=v1 --untracked-files=all -- ${generated.flat()}`
    .cwd(root)
    .quiet()
if (result.text().trim())
  throw new Error(`Generated files differ:\n${result.text().trim()}`)
