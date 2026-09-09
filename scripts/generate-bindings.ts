import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { goNodes } from '../packages/core/scripts/contracts/go.mjs'
import { nodeFiles } from '../packages/core/scripts/contracts/nodes.mjs'

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url))
const formatTypescript = paths => {
  if (!paths.length) return
  execFileSync(
    process.execPath,
    ['run', 'prettier', '--write', '--ignore-path', '.gitignore', ...paths],
    { cwd: repositoryRoot, stdio: 'inherit', windowsHide: true }
  )
}

const contractGroups = {
  commonmark: [
    ['commonmark', 'markdown-commonmark-contracts'],
    ['generic', 'markdown-generic-contracts']
  ],
  'trap-extension': [['trap', 'markdown-trap-contracts']]
}

async function generateContractGroup(packageName, group, crate) {
  const root = path.join(repositoryRoot, 'packages', packageName)
  const input = path.join(root, 'target', 'typescript-contracts', group)
  execFileSync(
    'cargo',
    [
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
    { cwd: root, stdio: 'inherit', windowsHide: true }
  )

  const manifest = JSON.parse(
    await readFile(path.join(input, 'contracts.json'), 'utf8')
  )
  const goPath = path.join(
    root,
    'go',
    group === 'generic' ? 'generic' : '',
    'generated_nodes.go'
  )
  await mkdir(path.dirname(goPath), { recursive: true })
  const entries = Object.entries(manifest.nodes).map(([key, node]) => [
    key,
    node.schema
  ])
  await writeFile(goPath, goNodes(entries, group))
  execFileSync('gofmt', ['-w', goPath], { windowsHide: true })

  const typescriptPaths = []
  for (const [name, source] of await nodeFiles(manifest, input)) {
    const output = path.join(root, 'typescript', 'generated', name)
    await mkdir(path.dirname(output), { recursive: true })
    await writeFile(output, source)
    typescriptPaths.push(output)
  }
  formatTypescript(typescriptPaths)
}

async function generateContracts(packageName) {
  for (const [group, crate] of contractGroups[packageName])
    await generateContractGroup(packageName, group, crate)
}

async function generateTraq(inputPath) {
  const root = path.join(repositoryRoot, 'packages', 'traq')
  const input = path.resolve(
    inputPath ?? path.join(root, 'target', 'node-contracts')
  )
  const manifest = JSON.parse(
    await readFile(path.join(input, 'contracts.json'), 'utf8')
  )
  const [go, presets, processing, typescript] = await Promise.all([
    import(
      pathToFileURL(path.join(root, 'scripts', 'contracts', 'go.ts')).href
    ),
    import(
      pathToFileURL(path.join(root, 'scripts', 'contracts', 'presets.ts')).href
    ),
    import(
      pathToFileURL(path.join(root, 'scripts', 'contracts', 'processing.ts'))
        .href
    ),
    import(
      pathToFileURL(path.join(root, 'scripts', 'contracts', 'typescript.ts'))
        .href
    )
  ])
  const files = await typescript.typescriptFiles(manifest, input)
  files.set('go/generated_nodes.go', go.goNodes(manifest))
  for (const [name, source] of presets.presetFiles(manifest.presets))
    files.set(name, source)
  for (const [name, source] of await processing.processingFiles(
    manifest.processing,
    input
  ))
    files.set(name, source)
  files.set(
    'typescript/generated/artifact.ts',
    `// Generated for this Wasm build. Do not edit.\nexport const buildId = '${manifest.buildId}';\nexport const inputBytes = ${manifest.limits.inputBytes};\n`
  )
  files.set(
    'go/generated_artifact.go',
    `// Code generated for this Wasm build. DO NOT EDIT.\npackage markdown\nconst buildID = "${manifest.buildId}"\nconst inputBytes = ${manifest.limits.inputBytes}\nconst memoryPages = ${manifest.limits.memoryBytes / 65536}\n`
  )
  const paths = []
  for (const [name, source] of files) {
    const output = path.join(root, name)
    await mkdir(path.dirname(output), { recursive: true })
    await writeFile(output, source)
    paths.push(output)
  }
  execFileSync('gofmt', ['-w', ...paths.filter(name => name.endsWith('.go'))], {
    windowsHide: true
  })
  formatTypescript(paths.filter(name => name.endsWith('.ts')))
  console.log(
    `Generated ${files.size} binding files from ${Object.keys(manifest.nodes).length} Rust payloads`
  )
}

const [packageName, input] = Bun.argv.slice(2)
if (packageName === 'commonmark' || packageName === 'trap-extension')
  await generateContracts(packageName)
else if (packageName === 'traq') await generateTraq(input)
else
  throw new Error(
    'usage: bun scripts/generate-bindings.ts <commonmark|trap-extension|traq> [contracts-dir]'
  )
