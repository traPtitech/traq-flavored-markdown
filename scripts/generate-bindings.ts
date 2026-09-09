import { $ } from 'bun'

import { goNodes } from '../packages/core/scripts/contracts/go.ts'
import { nodeFiles } from '../packages/core/scripts/contracts/nodes.ts'

const repositoryRoot = Bun.fileURLToPath(new URL('../', import.meta.url))
const resolvePath = (base, ...parts) =>
  Bun.fileURLToPath(new URL(parts.join('/'), Bun.pathToFileURL(`${base}/`)))

const readManifest = input =>
  Bun.file(resolvePath(input, 'contracts.json')).json()

const runCommand = (command, cwd = repositoryRoot) =>
  $`${command[0]} ${command.slice(1)}`.cwd(cwd)

const writeFiles = async (root, files, ...prefix) => {
  const paths = []
  for (const [name, source] of files) {
    const output = resolvePath(root, ...prefix, name)
    await Bun.write(output, source)
    paths.push(output)
  }
  return paths
}

const formatTypescript = async paths => {
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
}

async function generateContractGroup(packageName, group, crate) {
  const root = resolvePath(repositoryRoot, 'packages', packageName)
  const input = resolvePath(root, 'target', 'typescript-contracts', group)
  await runCommand(
    [
      'cargo',
      'run',
      '--locked',
      '--offline',
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
  const goPath = resolvePath(
    root,
    'go',
    ...(group === 'generic' ? ['generic'] : []),
    'generated_nodes.go'
  )
  const entries = Object.entries(manifest.nodes).map(([key, node]) => [
    key,
    node.schema
  ])
  await Bun.write(goPath, goNodes(entries, group))
  await runCommand(['gofmt', '-w', goPath])

  const typescriptPaths = await writeFiles(
    root,
    await nodeFiles(manifest, input),
    'typescript',
    'generated'
  )
  await formatTypescript(typescriptPaths)
}

async function generateContracts(packageName) {
  for (const [group, crate] of contractGroups[packageName]) {
    await generateContractGroup(packageName, group, crate)
  }
}

async function generateTraq(inputPath) {
  const root = resolvePath(repositoryRoot, 'packages', 'traq')
  const input = inputPath
    ? Bun.fileURLToPath(Bun.pathToFileURL(inputPath))
    : resolvePath(root, 'target', 'node-contracts')
  const manifest = await readManifest(input)
  const [go, presets, processing, typescript] = await Promise.all([
    import(
      Bun.pathToFileURL(resolvePath(root, 'scripts', 'contracts', 'go.ts')).href
    ),
    import(
      Bun.pathToFileURL(resolvePath(root, 'scripts', 'contracts', 'presets.ts'))
        .href
    ),
    import(
      Bun.pathToFileURL(
        resolvePath(root, 'scripts', 'contracts', 'processing.ts')
      ).href
    ),
    import(
      Bun.pathToFileURL(
        resolvePath(root, 'scripts', 'contracts', 'typescript.ts')
      ).href
    )
  ])
  const files = await typescript.typescriptFiles(manifest, input)
  files.set('go/generated_nodes.go', go.goNodes(manifest))
  for (const [name, source] of presets.presetFiles(manifest.presets)) {
    files.set(name, source)
  }
  for (const [name, source] of await processing.processingFiles(
    manifest.processing,
    input
  )) {
    files.set(name, source)
  }
  const typescriptArtifact = [
    '// Generated for this Wasm build. Do not edit.',
    `export const buildId = '${manifest.buildId}';`,
    `export const inputBytes = ${manifest.limits.inputBytes};`,
    ''
  ].join('\n')
  const goArtifact = [
    '// Code generated for this Wasm build. DO NOT EDIT.',
    'package markdown',
    `const buildID = "${manifest.buildId}"`,
    `const inputBytes = ${manifest.limits.inputBytes}`,
    `const memoryPages = ${manifest.limits.memoryBytes / 65536}`,
    ''
  ].join('\n')
  files.set('typescript/generated/artifact.ts', typescriptArtifact)
  files.set('go/generated_artifact.go', goArtifact)
  const paths = await writeFiles(root, files)
  await runCommand([
    'gofmt',
    '-w',
    ...paths.filter(name => name.endsWith('.go'))
  ])
  await formatTypescript(paths.filter(name => name.endsWith('.ts')))
  const payloadCount = Object.keys(manifest.nodes).length
  console.log(
    `Generated ${files.size} binding files from ${payloadCount} Rust payloads`
  )
}

const [packageName, input] = Bun.argv.slice(2)
if (packageName === 'commonmark' || packageName === 'trap-extension') {
  await generateContracts(packageName)
} else if (packageName === 'traq') {
  await generateTraq(input)
} else {
  throw new Error(
    'usage: bun scripts/generate-bindings.ts <commonmark|trap-extension|traq> [contracts-dir]'
  )
}
