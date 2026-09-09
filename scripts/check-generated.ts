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
for (const generatedPaths of generated) {
  const result =
    await $`git -c ${safeDirectory} diff --exit-code -- ${generatedPaths}`
      .cwd(root)
      .nothrow()
  if (result.exitCode !== 0)
    throw new Error(
      `Generated files differ (git exited with ${result.exitCode})`
    )
}
