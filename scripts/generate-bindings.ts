import path from 'path'

import { $ } from 'bun'

import { generateSdk } from '../packages/sdk/scripts/generate-bindings.ts'
import { goNodes as contractGoNodes } from './codegen/go.ts'
import {
  type ContractPackage,
  nodeGroup,
  nodeGroups
} from './codegen/groups.ts'
import { nodeFiles } from './codegen/nodes.ts'
import type { RawSchema } from './codegen/schema.ts'
import { cargoTargetDirectory, packageRoot, repositoryRoot } from './paths.ts'

type Manifest = {
  buildId: string
  limits: { inputBytes: number; memoryBytes: number }
  nodes: Record<string, { group: string; schema: RawSchema }>
}

const readManifest = (input: string) =>
  Bun.file(path.join(input, 'contracts.json')).json() as Promise<Manifest>

const runCommand = (command: string[], cwd = repositoryRoot) =>
  $`${command[0]} ${command.slice(1)}`.cwd(cwd)

const runCargo = (command: string[], cwd = repositoryRoot) =>
  runCommand(command, cwd).env({
    ...Bun.env,
    CARGO_TARGET_DIR: cargoTargetDirectory()
  })

const writeFiles = async (
  root: string,
  files: Map<string, string>,
  ...prefix: string[]
) => {
  const paths = []
  for (const [name, source] of files) {
    const output = path.join(root, ...prefix, name)
    await Bun.write(output, source)
    paths.push(output)
  }
  return paths
}

const formatTypescript = async (paths: string[]) => {
  if (!paths.length) return
  await runCommand([
    Bun.argv[0],
    'run',
    'prettier',
    '--write',
    '--ignore-path',
    '.gitignore',
    ...paths
  ])
}

async function generateContractGroup(
  packageName: ContractPackage,
  group: string
) {
  const root = packageRoot(packageName)
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

  const manifest = await readManifest(input)
  for (const [key, node] of Object.entries(manifest.nodes))
    if (node.group !== group)
      throw new Error(
        `${key}: expected ${group} contract group, got ${node.group}`
      )
  const goPath = path.join(root, metadata.goGeneratedPath)
  const entries: [string, RawSchema][] = Object.entries(manifest.nodes).map(
    ([key, node]) => [key, node.schema]
  )
  await Bun.write(goPath, contractGoNodes(entries, group))
  await runCommand(['gofmt', '-w', goPath])

  const typescriptPaths = await writeFiles(
    root,
    await nodeFiles(manifest, input),
    'typescript',
    'generated'
  )
  await formatTypescript(typescriptPaths)
}

export async function generateContracts(packageName: ContractPackage) {
  for (const [group, metadata] of Object.entries(nodeGroups))
    if (metadata.owner === packageName)
      await generateContractGroup(packageName, group)
}

export async function generateBindings(
  packageName?: ContractPackage | 'sdk',
  input?: string
) {
  if (!packageName) {
    for (const name of ['commonmark-plugin', 'traq-plugin'] as const)
      await generateContracts(name)
    await generateSdk()
    return
  }
  if (packageName === 'commonmark-plugin' || packageName === 'traq-plugin') {
    await generateContracts(packageName)
    return
  }
  if (packageName === 'sdk') {
    await generateSdk(input ? path.resolve(input) : undefined)
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
