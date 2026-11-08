import path from 'path'

import { readManifest } from '../../../tools/contracts/io/io.ts'
import {
  OutputManifest,
  applyOutputManifest
} from '../../../tools/contracts/io/output-manifest.ts'
import {
  type ArtifactManifest,
  parseArtifactManifest
} from '../../../tools/contracts/model/manifest.ts'
import {
  packageOutputRoot,
  repositoryRoot
} from '../../../tools/workspace/paths.ts'
import { abiFiles } from './codegen/abi.ts'
import { goNodes } from './codegen/nodes-go.ts'
import { typescriptFiles } from './codegen/nodes-typescript.ts'
import { presetFiles } from './codegen/presets.ts'
import { processingFiles } from './codegen/processing.ts'
import { exportNodeContracts } from './node-contracts.ts'

export function sdkOutputManifest(manifest: ArtifactManifest) {
  const files = typescriptFiles(manifest)
  files.set('go/generated_nodes.go', goNodes(manifest))

  for (const [name, source] of presetFiles(manifest.presets)) {
    files.set(name, source)
  }

  for (const [name, source] of processingFiles(
    manifest.processing,
    manifest.directions
  )) {
    files.set(name, source)
  }

  for (const [name, source] of abiFiles(manifest)) files.set(name, source)

  const plan = new OutputManifest()

  for (const [name, source] of files) {
    plan.add(
      'sdk',
      path.relative(repositoryRoot, path.join(packageOutputRoot('sdk'), name)),
      source
    )
  }

  return plan
}

export async function planSdkBindings(input?: string) {
  const contracts = input ?? (await exportNodeContracts())
  const manifest = await readManifest(contracts, parseArtifactManifest)
  const plan = sdkOutputManifest(manifest)

  console.log(
    `Generated ${plan.outputs.size} binding files from ${Object.keys(manifest.nodes).length} Rust payloads`
  )

  return plan
}

if (Bun.main === Bun.fileURLToPath(import.meta.url)) {
  const [input, ...rest] = Bun.argv.slice(2)

  if (rest.length) {
    throw new Error(
      'usage: bun packages/sdk/scripts/generate-bindings.ts [contracts-dir]'
    )
  }

  await applyOutputManifest(
    repositoryRoot,
    await planSdkBindings(input ? path.resolve(input) : undefined)
  )
}
