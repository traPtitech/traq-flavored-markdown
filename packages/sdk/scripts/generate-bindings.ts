import path from 'path'

import {
  formatTypescript,
  readManifest,
  runCommand,
  writeFiles
} from '../../../scripts/codegen/io.ts'
import type { RawSchema } from '../../../scripts/codegen/schema.ts'
import { packageOutputRoot, repositoryRoot } from '../../../scripts/paths.ts'
import { goNodes } from './codegen/nodes-go.ts'
import { typescriptFiles } from './codegen/nodes-typescript.ts'
import { presetFiles } from './codegen/presets.ts'
import type { PresetTree } from './codegen/presets.ts'
import { processingFiles } from './codegen/processing.ts'
import { exportNodeContracts } from './node-contracts.ts'

type Manifest = {
  buildId: string
  limits: { inputBytes: number; memoryBytes: number }
  nodes: Record<string, { group: string; schema: RawSchema }>
  parseError: RawSchema
  presets: PresetTree
  processing: Record<string, RawSchema>
}

export async function generateSdk(input?: string, outputRoot = repositoryRoot) {
  const contracts = input ?? (await exportNodeContracts())
  const manifest = await readManifest<Manifest>(contracts)
  const files = typescriptFiles(manifest)
  files.set('go/generated_nodes.go', goNodes(manifest))
  for (const [name, source] of presetFiles(manifest.presets))
    files.set(name, source)
  for (const [name, source] of processingFiles(manifest.processing))
    files.set(name, source)
  files.set(
    'typescript/generated/artifact.ts',
    [
      '// Generated for this Wasm build. Do not edit.',
      `export const buildId = '${manifest.buildId}';`,
      `export const inputBytes = ${manifest.limits.inputBytes};`,
      ''
    ].join('\n')
  )
  files.set(
    'go/generated_artifact.go',
    [
      '// Code generated for this Wasm build. DO NOT EDIT.',
      'package markdown',
      `const buildID = "${manifest.buildId}"`,
      `const inputBytes = ${manifest.limits.inputBytes}`,
      `const memoryPages = ${manifest.limits.memoryBytes / 65536}`,
      ''
    ].join('\n')
  )
  const paths = await writeFiles(packageOutputRoot('sdk', outputRoot), files)
  await runCommand([
    'gofmt',
    '-w',
    ...paths.filter(name => name.endsWith('.go'))
  ])
  await formatTypescript(paths.filter(name => name.endsWith('.ts')))
  console.log(
    `Generated ${files.size} binding files from ${Object.keys(manifest.nodes).length} Rust payloads`
  )
}

if (Bun.main === Bun.fileURLToPath(import.meta.url)) {
  const [input, ...rest] = Bun.argv.slice(2)
  if (rest.length)
    throw new Error(
      'usage: bun packages/sdk/scripts/generate-bindings.ts [contracts-dir]'
    )
  await generateSdk(input ? path.resolve(input) : undefined)
}
