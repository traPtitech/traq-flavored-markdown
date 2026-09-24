import path from 'path'

import { generateSdk } from '../packages/sdk/scripts/generate-bindings.ts'
import { goNodes as contractGoNodes } from './codegen/go.ts'
import {
  type ContractPackage,
  nodeGroup,
  nodeGroups
} from './codegen/groups.ts'
import {
  formatTypescript,
  readManifest,
  runCommand,
  writeFiles
} from './codegen/io.ts'
import { nodeFiles } from './codegen/nodes.ts'
import type { RawSchema } from './codegen/schema.ts'
import { readNpmPackageGraph } from './package-graph.ts'
import {
  cargoTargetDirectory,
  packageOutputRoot,
  packageRoot,
  repositoryRoot
} from './paths.ts'

type Manifest = {
  buildId: string
  limits: { inputBytes: number; memoryBytes: number }
  nodes: Record<string, { group: string; schema: RawSchema }>
}

const runCargo = (command: string[], cwd = repositoryRoot) =>
  runCommand(command, cwd).env({
    ...Bun.env,
    CARGO_TARGET_DIR: cargoTargetDirectory()
  })

async function generateContractGroup(
  packageName: ContractPackage,
  group: string,
  outputRoot: string
) {
  const root = packageRoot(packageName)
  const destination = packageOutputRoot(packageName, outputRoot)
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
  await Bun.write(goPath, contractGoNodes(entries, group))
  await runCommand(['gofmt', '-w', goPath])

  const typescriptPaths = await writeFiles(
    destination,
    nodeFiles(manifest),
    'typescript',
    'generated'
  )
  await formatTypescript(typescriptPaths)
}

export async function generateContracts(
  packageName: ContractPackage,
  outputRoot = repositoryRoot
) {
  for (const [group, metadata] of Object.entries(nodeGroups))
    if (metadata.owner === packageName)
      await generateContractGroup(packageName, group, outputRoot)
}

export async function generateBindings(
  packageName?: ContractPackage | 'sdk',
  input?: string,
  outputRoot = repositoryRoot
) {
  if (!packageName) {
    const { graph } = await readNpmPackageGraph()
    for (const name of graph.order)
      if (name === 'commonmark-plugin' || name === 'traq-plugin')
        await generateContracts(name, outputRoot)
      else if (name === 'sdk') await generateSdk(undefined, outputRoot)
    return
  }
  if (packageName === 'commonmark-plugin' || packageName === 'traq-plugin') {
    await generateContracts(packageName, outputRoot)
    return
  }
  if (packageName === 'sdk') {
    await generateSdk(input ? path.resolve(input) : undefined, outputRoot)
    return
  }
  throw new Error(
    'usage: bun scripts/generate-bindings.ts [commonmark-plugin|traq-plugin|sdk] [contracts-dir]'
  )
}

if (Bun.main === Bun.fileURLToPath(import.meta.url)) {
  const [packageName, input, ...rest] = Bun.argv.slice(2)
  if (
    rest.length ||
    (packageName !== undefined &&
      packageName !== 'commonmark-plugin' &&
      packageName !== 'traq-plugin' &&
      packageName !== 'sdk') ||
    (input !== undefined && packageName !== 'sdk')
  )
    throw new Error(
      'usage: bun scripts/generate-bindings.ts [commonmark-plugin|traq-plugin|sdk] [contracts-dir]'
    )
  await generateBindings(packageName, input)
}
