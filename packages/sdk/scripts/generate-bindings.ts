import path from 'path'

import { readManifest } from '../../../scripts/codegen/io.ts'
import type { Direction } from '../../../scripts/codegen/ir.ts'
import {
  OutputManifest,
  applyOutputManifest
} from '../../../scripts/codegen/output-manifest.ts'
import type { RawSchema } from '../../../scripts/codegen/schema.ts'
import { packageOutputRoot, repositoryRoot } from '../../../scripts/paths.ts'
import { type ArtifactManifest, abiFiles } from './codegen/abi.ts'
import { goNodes } from './codegen/nodes-go.ts'
import { typescriptFiles } from './codegen/nodes-typescript.ts'
import { presetFiles } from './codegen/presets.ts'
import type { PresetTree } from './codegen/presets.ts'
import { processingFiles } from './codegen/processing.ts'
import { exportNodeContracts } from './node-contracts.ts'

type Manifest = ArtifactManifest & {
  nodes: Record<string, { group: string; schema: RawSchema }>
  parseError: RawSchema
  presets: PresetTree
  processing: Record<string, RawSchema>
  directions: Record<string, Direction>
}

export function sdkOutputManifest(manifest: Manifest) {
  const files = typescriptFiles(manifest)
  files.set('go/generated_nodes.go', goNodes(manifest))
  for (const [name, source] of presetFiles(manifest.presets))
    files.set(name, source)
  for (const [name, source] of processingFiles(
    manifest.processing,
    manifest.directions
  ))
    files.set(name, source)
  for (const [name, source] of abiFiles(manifest)) files.set(name, source)
  const plan = new OutputManifest()
  for (const [name, source] of files)
    plan.add(
      'sdk',
      path.relative(repositoryRoot, path.join(packageOutputRoot('sdk'), name)),
      source
    )
  return plan
}

export async function generateSdk(input?: string, outputRoot = repositoryRoot) {
  const contracts = input ?? (await exportNodeContracts())
  const manifest = await readManifest<Manifest>(contracts)
  const plan = sdkOutputManifest(manifest)
  await applyOutputManifest(outputRoot, plan)
  console.log(
    `Generated ${plan.outputs.size} binding files from ${Object.keys(manifest.nodes).length} Rust payloads`
  )
  return plan
}

if (Bun.main === Bun.fileURLToPath(import.meta.url)) {
  const [input, ...rest] = Bun.argv.slice(2)
  if (rest.length)
    throw new Error(
      'usage: bun packages/sdk/scripts/generate-bindings.ts [contracts-dir]'
    )
  await generateSdk(input ? path.resolve(input) : undefined)
}
