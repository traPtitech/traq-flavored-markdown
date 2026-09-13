import path from 'path'

import { $ } from 'bun'

import { exportNodeContracts } from './build/node-contracts.ts'
import { goNodes as contractGoNodes } from './codegen/go.ts'
import { nodeFiles } from './codegen/nodes.ts'
import type { RawSchema } from './codegen/schema.ts'
import { goNodes as traqGoNodes } from './codegen/traq/nodes-go.ts'
import { typescriptFiles } from './codegen/traq/nodes-typescript.ts'
import { presetFiles } from './codegen/traq/presets.ts'
import type { PresetTree } from './codegen/traq/presets.ts'
import { processingFiles } from './codegen/traq/processing.ts'
import {
  cargoTargetDirectory,
  packageRoot,
  repositoryRoot,
  traqRoot
} from './paths.ts'

type Manifest = {
  buildId: string
  limits: { inputBytes: number; memoryBytes: number }
  nodes: Record<string, { group: string; schema: RawSchema }>
  presets: PresetTree
  processing: Record<string, RawSchema>
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

const contractGroups = {
  commonmark: [
    ['commonmark', 'markdown-commonmark-contracts'],
    ['generic', 'markdown-generic-contracts']
  ],
  'trap-extension': [['trap', 'markdown-trap-contracts']]
} as const

async function generateContractGroup(
  packageName: keyof typeof contractGroups,
  group: string,
  crate: string
) {
  const root = packageRoot(packageName)
  const input = path.join(cargoTargetDirectory(), 'typescript-contracts', group)
  await runCargo(
    [
      'cargo',
      'run',
      '--locked',
      '-p',
      crate,
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
  const goPath = path.join(
    root,
    'go',
    ...(group === 'generic' ? ['generic'] : []),
    'generated_nodes.go'
  )
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

export async function generateContracts(
  packageName: keyof typeof contractGroups
) {
  for (const [group, crate] of contractGroups[packageName])
    await generateContractGroup(packageName, group, crate)
}

export async function generateTraq(input?: string) {
  const contracts = input ?? (await exportNodeContracts())
  const manifest = await readManifest(contracts)
  const files = await typescriptFiles(manifest, contracts)
  files.set('go/generated_nodes.go', traqGoNodes(manifest))
  for (const [name, source] of presetFiles(manifest.presets))
    files.set(name, source)
  for (const [name, source] of await processingFiles(
    manifest.processing,
    contracts
  ))
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
  const paths = await writeFiles(traqRoot, files)
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

export async function generateBindings(packageName?: string, input?: string) {
  if (!packageName) {
    for (const name of Object.keys(contractGroups) as Array<
      keyof typeof contractGroups
    >)
      await generateContracts(name)
    await generateTraq()
    return
  }
  if (packageName === 'commonmark' || packageName === 'trap-extension') {
    await generateContracts(packageName)
    return
  }
  if (packageName === 'traq') {
    await generateTraq(input ? path.resolve(input) : undefined)
    return
  }
  throw new Error(
    'usage: bun scripts/generate-bindings.ts [commonmark|trap-extension|traq] [contracts-dir]'
  )
}

if (Bun.main === Bun.fileURLToPath(import.meta.url))
  await generateBindings(...Bun.argv.slice(2))
