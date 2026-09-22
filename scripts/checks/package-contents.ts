import path from 'path'

import { $ } from 'bun'

import { type PackageName, packageRoot, sdkRoot } from '../paths.ts'

const tempRoot = (
  Bun.env.TEMP ??
  Bun.env.TMP ??
  Bun.env.TMPDIR ??
  '/tmp'
).replace(/[\\/]+$/, '')
const temporaryDirectory = `${tempRoot}/markdown-packages-${Bun.randomUUIDv7()}`
if (!temporaryDirectory.startsWith(`${tempRoot}/`))
  throw new Error('Invalid temporary path')
const bun = Bun.argv[0]
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const archiveName = (archive: string) =>
  archive.slice(
    Math.max(archive.lastIndexOf('/'), archive.lastIndexOf('\\')) + 1
  )
const packageNames: PackageName[] = [
  'core',
  'commonmark-plugin',
  'traq-plugin',
  'sdk'
]
const capture = async (command: string, args: string[], cwd: string) => {
  return (await $.cwd(cwd)`${command} ${args}`.quiet()).text()
}
await $`mkdir -p ${temporaryDirectory}`
try {
  const archives: string[] = []
  for (const repo of packageNames) {
    const cwd = packageRoot(repo)
    const [packed] = JSON.parse(
      await capture(
        npm,
        [
          'pack',
          '--json',
          '--ignore-scripts',
          '--pack-destination',
          temporaryDirectory
        ],
        cwd
      )
    ) as { filename: string; files: { path: string }[] }[]
    const archive = path.join(temporaryDirectory, packed.filename)
    archives.push(archive)
    const files = new Set(packed.files.map(file => file.path))
    for (const name of [
      'LICENSE',
      ...(repo === 'sdk' ? ['dist/browser.js', 'dist/browser.d.ts'] : []),
      'dist/renderer/index.js',
      'dist/renderer/index.d.ts'
    ])
      if (!files.has(name)) throw Error(repo + ': missing ' + name)
    for (const name of files)
      if (/^(?:typescript|crates|go|tests|node_modules)\//.test(name))
        throw Error(repo + ': shipped source ' + name)
    if (repo !== 'sdk' && [...files].some(n => n.endsWith('.wasm')))
      throw Error('Unexpected Wasm in ' + repo)
  }
  const packageDependencies = Object.fromEntries(
    packageNames.map((name, index) => [
      `@traq-flavored-markdown/${name}`,
      `file:./${archiveName(archives[index])}`
    ])
  )
  await Bun.write(
    `${temporaryDirectory}/package.json`,
    JSON.stringify({
      private: true,
      type: 'module',
      dependencies: packageDependencies,
      overrides: packageDependencies
    })
  )
  await capture(
    npm,
    [
      'install',
      '--ignore-scripts',
      '--no-save',
      '--no-audit',
      '--no-fund',
      '--registry=https://registry.npmjs.org'
    ],
    temporaryDirectory
  )
  const tsc = Bun.fileURLToPath(import.meta.resolve('typescript/bin/tsc'))
  for (const [source, name] of [
    ['typescript/tests/package-consumer', 'sdk'],
    ['typescript/tests/rendering', 'renderer']
  ]) {
    await Bun.write(
      `${temporaryDirectory}/${name}.ts`,
      Bun.file(path.join(sdkRoot, source, 'types.ts'))
    )
    await capture(
      bun,
      [
        tsc,
        '--noEmit',
        '--strict',
        '--target',
        'ES2022',
        '--module',
        'NodeNext',
        '--moduleResolution',
        'NodeNext',
        name + '.ts'
      ],
      temporaryDirectory
    )
    await Bun.write(
      `${temporaryDirectory}/${name}.ts`,
      Bun.file(
        path.join(
          sdkRoot,
          source,
          name === 'sdk' ? 'runtime.ts' : 'package-runtime.ts'
        )
      )
    )
    const contract = await Bun.file(
      path.join(sdkRoot, 'dist', 'contract.json')
    ).json()
    await Bun.stdout.write(
      await capture(bun, [name + '.ts', contract.sha256], temporaryDirectory)
    )
    await Bun.stdout.write(
      await capture('node', [name + '.ts', contract.sha256], temporaryDirectory)
    )
  }
  console.log(
    'Four packed packages: SDK, renderer, declarations, CSS and Wasm integration passed'
  )
} finally {
  await $`rm -rf ${temporaryDirectory}`
}
