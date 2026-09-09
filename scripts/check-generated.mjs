import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const generated = [
  ['packages/traq/typescript/generated'],
  [
    'packages/traq/go/nodes_generated.go',
    'packages/traq/go/processing_generated.go',
    'packages/traq/go/presets_generated.go',
    'packages/traq/go/artifact_generated.go'
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
