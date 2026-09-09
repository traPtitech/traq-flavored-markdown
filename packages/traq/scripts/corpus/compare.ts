import path from 'path'

import { $ } from 'bun'

import { parseArgs } from './args.ts'

const root = Bun.fileURLToPath(new URL('../../', import.meta.url))
const { values: v } = parseArgs({
  options: {
    corpus: { type: 'string' },
    out: { type: 'string' },
    traq: {
      type: 'string',
      default: path.resolve(root, '../../traPtitech/traQ')
    },
    sui: {
      type: 'string',
      default: path.resolve(root, '../../traPtitech/traQ_S-UI')
    },
    'traq-ref': { type: 'string', default: 'origin/master' },
    'sui-ref': { type: 'string', default: 'origin/master' },
    origin: { type: 'string', default: 'https://q.trap.jp' },
    max: { type: 'string', default: '100000' },
    format: { type: 'string', default: 'both' }
  }
})
if (!v.corpus) throw Error('--corpus messages.jsonl is required')
if (!Number.isSafeInteger(Number(v.max)) || Number(v.max) <= 0)
  throw Error('--max must be a positive integer')
const corpus = path.resolve(v.corpus)
const out = path.resolve(
  v.out ?? path.join(root, '.private/corpora/comparison')
)
const baseline = path.join(root, '.private/corpus-baseline')
await $`mkdir -p ${baseline}`
await $`mkdir -p ${out}`

const run = async (cmd, args, cwd = root) => {
  await $`${cmd} ${args}`.cwd(cwd)
}
const git = async (repo, args) =>
  (await $`git -C ${path.resolve(repo)} ${args}`.quiet()).text().trim()
const show = async (repo, ref, file) =>
  (await git(repo, ['show', ref + ':' + file])) + '\n'

const versions = {
  suiMaster: await git(v.sui, ['rev-parse', v['sui-ref']]),
  traqMaster: await git(v.traq, ['rev-parse', v['traq-ref']]),
  renderer: await git(root, ['rev-parse', 'HEAD']),
  processor: await git(root, ['rev-parse', 'HEAD'])
}

const lock = JSON.parse(await show(v.sui, v['sui-ref'], 'package-lock.json'))
const rendererVersion =
  lock.packages['node_modules/@traptitech/traq-markdown-it'].version

const packageVersion = async (name, parent) =>
  JSON.parse(
    await Bun.file(
      Bun.resolveSync(`${name}/package.json`, path.resolve(parent))
    ).text()
  ).version
const commonmark = path.resolve(root, '../commonmark')
const katexVersion = await packageVersion('katex', commonmark)
const highlightVersion = await packageVersion('highlight.js', commonmark)

const baselinePackage = {
  private: true,
  type: 'module',
  dependencies: {
    '@traptitech/traq-markdown-it': rendererVersion,
    katex: katexVersion,
    'highlight.js': highlightVersion
  },
  overrides: { katex: katexVersion, 'highlight.js': highlightVersion }
}
await Bun.write(
  path.join(baseline, 'package.json'),
  JSON.stringify(baselinePackage, null, 2)
)

await run(
  Bun.argv[0],
  ['install', '--ignore-scripts', '--no-save', '--no-progress'],
  baseline
)
const legacyPackage = Bun.resolveSync(
  '@traptitech/traq-markdown-it',
  path.resolve(baseline)
)
const { traQMarkdownIt } = await import(Bun.pathToFileURL(legacyPackage).href)
const katexBefore = await packageVersion('katex', baseline)
const highlightBefore = await packageVersion('highlight.js', baseline)
if (katexBefore !== katexVersion || highlightBefore !== highlightVersion)
  throw Error('Comparison requires matching KaTeX and highlight.js versions')
Object.assign(versions, {
  katexBefore,
  highlightBefore,
  highlightAfter: highlightVersion,
  katexAfter: katexVersion,
  baselineRenderer: rendererVersion
})
await Bun.write(
  path.join(out, 'revisions.json'),
  JSON.stringify(versions, null, 2)
)
const goRoot = path.join(baseline, 'notification')
await $`mkdir -p ${path.join(goRoot, 'go-before')}`

for (const name of ['parser.go', 'spoiler.go'])
  await Bun.write(
    path.join(goRoot, 'go-before', name),
    await show(v.traq, v['traq-ref'], 'utils/message/' + name)
  )
await Bun.write(
  path.join(goRoot, 'main.go'),
  Bun.file(new URL('./notification/main.go', import.meta.url))
)

const goMod = await show(v.traq, v['traq-ref'], 'go.mod')
const version = name => {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = goMod.match(new RegExp('\\s' + escaped + '\\s+(\\S+)'))
  if (!match) throw Error('Missing baseline dependency ' + name)
  return match[1]
}
await Bun.write(
  path.join(goRoot, 'go.mod'),
  `module corpuscomparison\n\ngo 1.26.0\n\nrequire (\n github.com/gofrs/uuid ${version('github.com/gofrs/uuid')}\n github.com/json-iterator/go ${version('github.com/json-iterator/go')}\n github.com/traq-markdown-parser/traq/go v0.1.0\n)\nreplace github.com/traq-markdown-parser/traq/go => ${JSON.stringify(path.join(root, 'go').replaceAll('\\', '/'))}\n`
)
await Bun.write(
  path.join(goRoot, 'config.json'),
  JSON.stringify({
    origin: v.origin,
    wasm: path.join(root, 'dist/parser.wasm')
  })
)
await run('go', ['mod', 'tidy'], goRoot)
await run(Bun.argv[0], [
  Bun.fileURLToPath(new URL('./compare-frontend.ts', import.meta.url)),
  '--corpus',
  corpus,
  '--out',
  out,
  '--max',
  v.max,
  '--baseline',
  baseline,
  '--origin',
  v.origin
])
await run(
  'go',
  [
    'run',
    '.',
    '-corpus',
    corpus,
    '-out',
    out,
    '-max',
    v.max,
    '-config',
    path.join(goRoot, 'config.json')
  ],
  goRoot
)
await run(Bun.argv[0], [
  Bun.fileURLToPath(new URL('./report.ts', import.meta.url)),
  '--data',
  out,
  '--out',
  out,
  '--format',
  v.format
])
console.log(
  JSON.stringify({ out, messagesLimit: Number(v.max), format: v.format })
)
