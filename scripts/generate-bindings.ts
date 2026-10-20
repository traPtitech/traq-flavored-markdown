import path from 'path'

import { generateSdk } from '../packages/sdk/scripts/generate-bindings.ts'
import { goNodes as contractGoNodes } from './codegen/go.ts'
import {
  type ContractPackage,
  nodeGroup,
  nodeGroups
} from './codegen/groups.ts'
import { readManifest, runCommand } from './codegen/io.ts'
import { nodeFiles } from './codegen/nodes.ts'
import {
  OutputManifest,
  applyOutputManifest
} from './codegen/output-manifest.ts'
import type { RawSchema } from './codegen/schema.ts'
import type { NodeStructure } from './codegen/structure.ts'
import { readNpmPackageGraph } from './package-graph.ts'
import {
  cargoTargetDirectory,
  packageOutputRoot,
  packageRoot,
  repositoryRoot
} from './paths.ts'

type Manifest = {
  nodes: Record<
    string,
    { group: string; schema: RawSchema; structure?: NodeStructure }
  >
}

const runCargo = (command: string[], cwd = repositoryRoot) =>
  runCommand(command, cwd).env({
    ...Bun.env,
    CARGO_TARGET_DIR: cargoTargetDirectory()
  })

async function generateContractGroup(
  packageName: ContractPackage,
  group: string
) {
  const root = packageRoot(packageName)
  const destination = packageOutputRoot(packageName)
  const metadata = nodeGroup(group)
  if (metadata.owner !== packageName)
    throw new Error(
      `Node contract group ${group} does not belong to ${packageName}`
    )
  const input = path.join(cargoTargetDirectory(), 'typescript-contracts', group)
  await runCargo(
    [
      'cargo',
      'run',
      '--locked',
      '-p',
      metadata.crate,
      '--features',
      'contracts',
      '--example',
      `export-${group}-types`,
      '--',
      input
    ],
    root
  )

  const manifest = await readManifest<Manifest>(input)
  for (const [key, node] of Object.entries(manifest.nodes))
    if (node.group !== group)
      throw new Error(
        `${key}: expected ${group} contract group, got ${node.group}`
      )
  const goPath = path.join(destination, metadata.goGeneratedPath)
  const entries: [string, RawSchema][] = Object.entries(manifest.nodes).map(
    ([key, node]) => [key, node.schema]
  )
  const plan = new OutputManifest()
  plan.add(
    packageName,
    path.relative(repositoryRoot, goPath),
    contractGoNodes(
      entries,
      group,
      Object.fromEntries(
        Object.entries(manifest.nodes).map(([key, node]) => [
          key,
          node.structure
        ])
      )
    )
  )
  const typescript = nodeFiles(manifest).get(`${group}.ts`)
  if (typescript === undefined)
    throw new Error('Missing TypeScript node group: ' + group)
  plan.add(
    packageName,
    path.relative(
      repositoryRoot,
      path.join(destination, metadata.typescriptGeneratedPath)
    ),
    typescript
  )
  return plan
}

export async function generateContracts(
  packageName: ContractPackage,
  outputRoot = repositoryRoot
) {
  const plan = new OutputManifest()
  for (const [group, metadata] of Object.entries(nodeGroups))
    if (metadata.owner === packageName)
      plan.merge(await generateContractGroup(packageName, group))
  await applyOutputManifest(outputRoot, plan)
  return plan
}

export async function generateBindings(
  packageName?: ContractPackage | 'sdk',
  input?: string,
  outputRoot = repositoryRoot
) {
  if (!packageName) {
    const { graph } = await readNpmPackageGraph()
    for (const name of graph.order)
      if (
        name === 'commonmark-plugin' ||
        name === 'extensions-plugin' ||
        name === 'traq-plugin'
      )
        await generateContracts(name, outputRoot)
      else if (name === 'sdk') await generateSdk(undefined, outputRoot)
    return
  }
  if (
    packageName === 'commonmark-plugin' ||
    packageName === 'extensions-plugin' ||
    packageName === 'traq-plugin'
  ) {
    await generateContracts(packageName, outputRoot)
    return
  }
  if (packageName === 'sdk') {
    await generateSdk(input ? path.resolve(input) : undefined, outputRoot)
    return
  }
  throw new Error(
    'usage: bun scripts/generate-bindings.ts [commonmark-plugin|extensions-plugin|traq-plugin|sdk] [contracts-dir]'
  )
}

if (Bun.main === Bun.fileURLToPath(import.meta.url)) {
  const [packageName, input, ...rest] = Bun.argv.slice(2)
  if (
    rest.length ||
    (packageName !== undefined &&
      packageName !== 'commonmark-plugin' &&
      packageName !== 'extensions-plugin' &&
      packageName !== 'traq-plugin' &&
      packageName !== 'sdk') ||
    (input !== undefined && packageName !== 'sdk')
  )
    throw new Error(
      'usage: bun scripts/generate-bindings.ts [commonmark-plugin|extensions-plugin|traq-plugin|sdk] [contracts-dir]'
    )
  await generateBindings(packageName, input)
}
