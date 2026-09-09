import { execFileSync } from 'node:child_process'
import {
  copyFile,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const run = (args, cwd = root) =>
  execFileSync(process.execPath, args, {
    cwd,
    encoding: 'utf8',
    windowsHide: true
  })
const bun = (args, cwd) => run(args, cwd)
const temp = await realpath(tmpdir()),
  dir = await mkdtemp(path.join(temp, 'markdown-packages-'))
try {
  const archives = []
  for (const repo of ['core', 'commonmark', 'trap-extension', 'traq']) {
    const cwd = path.resolve(root, '..', repo)
    const output = bun(
      ['pm', 'pack', '--dry-run', '--ignore-scripts', '--destination', dir],
      cwd
    )
    const archive = bun(
      ['pm', 'pack', '--quiet', '--ignore-scripts', '--destination', dir],
      cwd
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
  await writeFile(
    path.join(dir, 'package.json'),
    JSON.stringify({
      private: true,
      type: 'module',
      dependencies: {
        '@traq-markdown-parser/core': 'file:./' + path.basename(archives[0]),
        '@traq-markdown-parser/commonmark':
          'file:./' + path.basename(archives[1]),
        '@traq-markdown-parser/trap-extension':
          'file:./' + path.basename(archives[2]),
        '@traq-markdown-parser/traq': 'file:./' + path.basename(archives[3])
      },
      overrides: {
        '@traq-markdown-parser/core': 'file:./' + path.basename(archives[0]),
        '@traq-markdown-parser/commonmark':
          'file:./' + path.basename(archives[1]),
        '@traq-markdown-parser/trap-extension':
          'file:./' + path.basename(archives[2]),
        '@traq-markdown-parser/traq': 'file:./' + path.basename(archives[3])
      }
    })
  )
  bun(
    [
      'install',
      '--ignore-scripts',
      '--no-save',
      '--no-progress',
      '--omit',
      'peer'
    ],
    dir
  )
  const tsc = fileURLToPath(import.meta.resolve('typescript/bin/tsc'))
  for (const [source, name] of [
    ['typescript/tests/package-consumer', 'sdk'],
    ['typescript/tests/rendering', 'renderer']
  ]) {
    await copyFile(
      path.join(root, source, 'types.ts'),
      path.join(dir, name + '.ts')
    )
    run(
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
      dir
    )
    await copyFile(
      path.join(
        root,
        source,
        name === 'sdk' ? 'runtime.ts' : 'package-runtime.ts'
      ),
      path.join(dir, name + '.ts')
    )
    const contract = JSON.parse(
      await readFile(path.join(root, 'dist/contract.json'))
    )
    process.stdout.write(run([name + '.ts', contract.sha256], dir))
  }
  console.log(
    'Four packed packages: SDK, renderer, declarations, CSS and Wasm integration passed'
  )
} finally {
  if (path.dirname(path.resolve(dir)) !== temp)
    throw Error('Invalid temporary path')
  await rm(dir, { recursive: true, force: true })
}
