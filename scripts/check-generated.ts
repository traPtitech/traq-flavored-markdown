import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
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

for (const paths of generated) {
  const result = spawnSync(
    'git',
    ['-c', `safe.directory=${root}`, 'diff', '--exit-code', '--', ...paths],
    { cwd: root, stdio: 'inherit' }
  )
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}
