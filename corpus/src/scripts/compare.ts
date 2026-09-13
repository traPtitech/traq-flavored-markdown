import path from 'path'

import { $ } from 'bun'

import { repositoryRoot, traqRoot } from '../../../scripts/paths.ts'
import { parseArgs } from './args.ts'
import { GitRepo } from './git.ts'

const root = traqRoot
const privateRoot = path.join(repositoryRoot, '.private')

const { values: v } = parseArgs({
  options: {
    corpus: { type: 'string' },
    out: { type: 'string' },
    traq: {
      type: 'string',
      default: path.resolve(repositoryRoot, '../../traPtitech/traQ')
    },
    sui: {
      type: 'string',
      default: path.resolve(repositoryRoot, '../../traPtitech/traQ_S-UI')
    },
    'traq-ref': { type: 'string', default: 'origin/master' },
    'sui-ref': { type: 'string', default: 'origin/master' },
    origin: { type: 'string', default: 'https://q.trap.jp' },
    max: { type: 'string', default: '100000' },
    format: { type: 'string', default: 'both' }
  }
})

if (!v.corpus) throw Error('--corpus messages.jsonl is required')
if (!Number.isSafeInteger(Number(v.max)) || Number(v.max) <= 0) {
  throw Error('--max must be a positive integer')
}

const corpus = path.resolve(v.corpus)
const out = path.resolve(
  v.out ?? path.join(privateRoot, 'corpora', 'comparison')
)
const baseline = path.join(privateRoot, 'corpus-baseline')

await $`mkdir -p ${baseline}`
await $`mkdir -p ${out}`

const run = async (cmd: string, args: string[], cwd = root, env = Bun.env) => {
  await $`${cmd} ${args}`.cwd(cwd).env(env)
}

const suiRepo = new GitRepo(v.sui!)
const traqRepo = new GitRepo(v.traq!)
const currentRepo = new GitRepo(root)

const versions: Record<string, string> = {
  suiMaster: await suiRepo.revParse(v['sui-ref']!),
  traqMaster: await traqRepo.revParse(v['traq-ref']!),
  renderer: await currentRepo.revParse('HEAD'),
  processor: await currentRepo.revParse('HEAD')
}

async function setupBaselinePackage() {
  const lock = JSON.parse(
    await suiRepo.show(v['sui-ref']!, 'package-lock.json')
  )
  const rendererVersion =
    lock.packages['node_modules/@traptitech/traq-markdown-it'].version

  const packageVersion = async (name: string, parent: string) =>
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
  await import(Bun.pathToFileURL(legacyPackage).href)

  const katexBefore = await packageVersion('katex', baseline)
  const highlightBefore = await packageVersion('highlight.js', baseline)

  if (katexBefore !== katexVersion || highlightBefore !== highlightVersion) {
    throw Error('Comparison requires matching KaTeX and highlight.js versions')
  }

  Object.assign(versions, {
    katexBefore,
    highlightBefore,
    highlightAfter: highlightVersion,
    katexAfter: katexVersion,
    baselineRenderer: rendererVersion
  })
}

async function setupBaselineGo() {
  const goRoot = path.join(baseline, 'notification')
  const go = (args: string[]) =>
    run('go', args, goRoot, { ...Bun.env, GOWORK: 'off' } as Record<
      string,
      string
    >)

  await $`mkdir -p ${path.join(goRoot, 'go-before')}`

  for (const name of ['parser.go', 'spoiler.go']) {
    const content = await traqRepo.show(v['traq-ref']!, 'utils/message/' + name)
    await Bun.write(path.join(goRoot, 'go-before', name), content)
  }

  await Bun.write(
    path.join(goRoot, 'main.go'),
    Bun.file(new URL('./notification/main.go', import.meta.url))
  )

  const goMod = await traqRepo.show(v['traq-ref']!, 'go.mod')
  const getVersion = (name: string) => {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const match = goMod.match(new RegExp('\\s' + escaped + '\\s+(\\S+)'))
    if (!match) throw Error('Missing baseline dependency ' + name)
    return match[1]
  }

  const localGoModule = (name: string) =>
    JSON.stringify(
      path.join(repositoryRoot, 'packages', name, 'go').replaceAll('\\', '/')
    )

  const modContent =
    [
      `module corpuscomparison`,
      `go 1.26.0`,
      `require (`,
      ` github.com/gofrs/uuid ${getVersion('github.com/gofrs/uuid')}`,
      ` github.com/json-iterator/go ${getVersion('github.com/json-iterator/go')}`,
      ` github.com/uni-kakurenbo/traq-markdown-engine/packages/traq/go v0.1.0`,
      `)`
    ].join('\n') +
    '\n' +
    ['core', 'commonmark', 'trap-extension', 'traq']
      .map(
        name =>
          `replace github.com/uni-kakurenbo/traq-markdown-engine/packages/${name}/go => ${localGoModule(name)}`
      )
      .join('\n') +
    '\n'

  await Bun.write(path.join(goRoot, 'go.mod'), modContent)

  await Bun.write(
    path.join(goRoot, 'config.json'),
    JSON.stringify({
      origin: v.origin!,
      wasm: path.join(root, 'dist/parser.wasm')
    })
  )

  await go(['mod', 'tidy'])
  return { goRoot, go }
}

// 1. Setup Phase
await setupBaselinePackage()
await Bun.write(
  path.join(out, 'revisions.json'),
  JSON.stringify(versions, null, 2)
)
const { goRoot, go } = await setupBaselineGo()

// 2. Execution Phase
await run(Bun.argv[0], [
  Bun.fileURLToPath(new URL('./compare-frontend.ts', import.meta.url)),
  '--corpus',
  corpus,
  '--out',
  out,
  '--max',
  v.max!,
  '--baseline',
  baseline,
  '--origin',
  v.origin!
])

await go([
  'run',
  '.',
  '-corpus',
  corpus,
  '-out',
  out,
  '-max',
  v.max!,
  '-config',
  path.join(goRoot, 'config.json')
])

await run(Bun.argv[0], [
  Bun.fileURLToPath(new URL('./report.ts', import.meta.url)),
  '--data',
  out,
  '--out',
  out,
  '--format',
  v.format!
])

console.log(
  JSON.stringify({ out, messagesLimit: Number(v.max), format: v.format })
)
