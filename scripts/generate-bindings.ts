import path from 'path'

import { $ } from 'bun'

import { generateTraq } from '../packages/traq/scripts/generate-bindings.ts'
import { goNodes as contractGoNodes } from './codegen/go.ts'
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

export async function generateBindings(
  packageName?: keyof typeof contractGroups | 'traq',
  input?: string
) {
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

if (Bun.main === Bun.fileURLToPath(import.meta.url)) {
  const [packageName, input, ...rest] = Bun.argv.slice(2)
  if (
    rest.length ||
    (packageName !== undefined &&
      packageName !== 'commonmark' &&
      packageName !== 'trap-extension' &&
      packageName !== 'traq') ||
    (input !== undefined && packageName !== 'traq')
  )
    throw new Error(
      'usage: bun scripts/generate-bindings.ts [commonmark|trap-extension|traq] [contracts-dir]'
    )
  await generateBindings(packageName, input)
}
