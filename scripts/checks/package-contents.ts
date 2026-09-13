import path from 'path'

import { $ } from 'bun'

import { type PackageName, packageRoot, traqRoot } from '../paths.ts'

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
const archiveName = (archive: string) =>
  archive.slice(
    Math.max(archive.lastIndexOf('/'), archive.lastIndexOf('\\')) + 1
  )
const packageNames: PackageName[] = [
  'core',
  'commonmark',
  'trap-extension',
  'traq'
]
const capture = async (command: string, args: string[], cwd: string) => {
  return (await $.cwd(cwd)`${command} ${args}`.quiet()).text()
}
await $`mkdir -p ${temporaryDirectory}`
try {
  const archives: string[] = []
  for (const repo of packageNames) {
    const cwd = packageRoot(repo)
    const output = await capture(
      bun,
      [
        'pm',
        'pack',
        '--dry-run',
        '--ignore-scripts',
        '--destination',
        temporaryDirectory
      ],
      cwd
    )
    const archive = (
      await capture(
        bun,
        [
          'pm',
          'pack',
          '--quiet',
          '--ignore-scripts',
          '--destination',
          temporaryDirectory
        ],
        cwd
      )
    ).trim()
    archives.push(archive)
    const files = new Set(
      [...output.matchAll(/^packed\s+\S+\s+(.+)$/gm)].map(([, name]) => name)
    )
    for (const name of [
      'LICENSE',
      'dist/renderer/index.js',
      'dist/renderer/index.d.ts'
    ])
      if (!files.has(name)) throw Error(repo + ': missing ' + name)
    for (const name of files)
      if (/^(?:typescript|crates|go|tests|node_modules)\//.test(name))
        throw Error(repo + ': shipped source ' + name)
    if (repo !== 'traq' && [...files].some(n => n.endsWith('.wasm')))
      throw Error('Unexpected Wasm in ' + repo)
  }
  const packageDependencies = Object.fromEntries(
    packageNames.map((name, index) => [
      `@traq-markdown-parser/${name}`,
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
    bun,
    [
      'install',
      '--ignore-scripts',
      '--no-save',
      '--no-progress',
      '--omit',
      'peer'
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
      Bun.file(path.join(traqRoot, source, 'types.ts'))
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
          traqRoot,
          source,
          name === 'sdk' ? 'runtime.ts' : 'package-runtime.ts'
        )
      )
    )
    const contract = await Bun.file(
      path.join(traqRoot, 'dist', 'contract.json')
    ).json()
    await Bun.stdout.write(
      await capture(bun, [name + '.ts', contract.sha256], temporaryDirectory)
    )
  }
  console.log(
    'Four packed packages: SDK, renderer, declarations, CSS and Wasm integration passed'
  )
} finally {
  await $`rm -rf ${temporaryDirectory}`
}
