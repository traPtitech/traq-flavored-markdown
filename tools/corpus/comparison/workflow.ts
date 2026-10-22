import path from 'path'

import { $ } from 'bun'

import { readGoPackageGraph } from '../../../scripts/package-graph.ts'
import { packageRoot, repositoryRoot, sdkRoot } from '../../../scripts/paths.ts'
import { resolveRepositoryPath } from '../scripts/args.ts'
import { GitRepo } from '../scripts/git.ts'
import {
  type ComparisonProvenance,
  byMode,
  defaultWarmups,
  modes,
  parseComparisonPlan
} from '../shared/comparison.ts'

export type ComparisonOptions = {
  corpus: string
  output?: string
  suiDirectory: string
  traqDirectory: string
  suiRef: string
  traqRef: string
  origin: string
  max: number
  warmups?: number
}

export async function runComparison(options: ComparisonOptions) {
  const root = sdkRoot
  const privateRoot = path.join(repositoryRoot, '.private')
  if (!options.corpus) throw Error('--corpus messages.jsonl is required')
  if (!Number.isSafeInteger(options.max) || options.max <= 0) {
    throw Error('--max must be a positive integer')
  }
  const warmups = options.warmups ?? defaultWarmups
  if (!Number.isSafeInteger(warmups) || warmups < 0)
    throw new Error('--warmups must be a nonnegative integer')

  const corpus = resolveRepositoryPath(options.corpus)
  const out = resolveRepositoryPath(
    options.output ?? path.join(privateRoot, 'corpora', 'comparison')
  )
  const baseline = path.join(privateRoot, 'corpus-baseline')

  await $`mkdir -p ${baseline}`
  await $`mkdir -p ${out}`

  const run = async (
    cmd: string,
    args: string[],
    cwd = root,
    env = Bun.env
  ) => {
    await $`${cmd} ${args}`.cwd(cwd).env(env)
  }

  const suiRepo = new GitRepo(resolveRepositoryPath(options.suiDirectory))
  const traqRepo = new GitRepo(resolveRepositoryPath(options.traqDirectory))
  const currentRepo = new GitRepo(root)

  const [frontendRevision, plainTextRevision, candidateRevision] =
    await Promise.all([
      suiRepo.revParse(options.suiRef),
      traqRepo.revParse(options.traqRef),
      currentRepo.revParse('HEAD')
    ])
  const provenance: ComparisonProvenance = {
    before: byMode(mode => ({
      label: mode === 'plainText' ? 'traQ' : 'traQ_S-UI',
      revision: mode === 'plainText' ? plainTextRevision : frontendRevision
    })),
    after: { label: 'traQ Markdown SDK', revision: candidateRevision },
    dependencies: {}
  }

  async function setupBaselinePackage() {
    const lock = JSON.parse(
      await suiRepo.show(options.suiRef, 'package-lock.json')
    )
    const rendererVersion =
      lock.packages['node_modules/@traptitech/traq-markdown-it'].version

    const packageVersion = async (name: string, parent: string) =>
      JSON.parse(
        await Bun.file(
          Bun.resolveSync(`${name}/package.json`, path.resolve(parent))
        ).text()
      ).version

    const commonmark = packageRoot('commonmark-plugin')
    const katexVersion = await packageVersion(
      'katex',
      packageRoot('extensions-plugin')
    )
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
      throw Error(
        'Comparison requires matching KaTeX and highlight.js versions'
      )
    }

    provenance.dependencies = {
      katex: { before: katexBefore, after: katexVersion },
      'highlight.js': { before: highlightBefore, after: highlightVersion },
      renderer: { before: rendererVersion, after: candidateRevision }
    }
  }

  async function setupBaselineGo() {
    const goRoot = path.join(baseline, 'plain-text')
    const go = (args: string[]) =>
      run('go', args, goRoot, { ...Bun.env, GOWORK: 'off' } as Record<
        string,
        string
      >)

    await $`mkdir -p ${path.join(goRoot, 'go-before')}`

    for (const name of ['parser.go', 'spoiler.go']) {
      const content = await traqRepo.show(
        options.traqRef,
        'utils/message/' + name
      )
      await Bun.write(path.join(goRoot, 'go-before', name), content)
    }

    await Bun.write(
      path.join(goRoot, 'main.go'),
      Bun.file(new URL('../scripts/plain-text/main.go', import.meta.url))
    )

    const goMod = await traqRepo.show(options.traqRef, 'go.mod')
    const getVersion = (name: string) => {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const match = goMod.match(new RegExp('\\s' + escaped + '\\s+(\\S+)'))
      if (!match) throw Error('Missing baseline dependency ' + name)
      return match[1]
    }

    const { published } = await readGoPackageGraph()
    const sdkModule = published.find(module => module.owner === 'sdk')!

    const modContent =
      [
        `module corpuscomparison`,
        `go 1.26.0`,
        `require (`,
        ` github.com/gofrs/uuid ${getVersion('github.com/gofrs/uuid')}`,
        ` github.com/json-iterator/go ${getVersion('github.com/json-iterator/go')}`,
        ` ${sdkModule.path} v0.0.0`,
        `)`
      ].join('\n') +
      '\n' +
      published
        .map(
          module =>
            `replace ${module.path} => ${JSON.stringify(path.join(repositoryRoot, module.directory).replaceAll('\\', '/'))}`
        )
        .join('\n') +
      '\n'

    await Bun.write(path.join(goRoot, 'go.mod'), modContent)

    await go(['mod', 'tidy'])
    return { go }
  }

  // 1. Setup Phase
  await setupBaselinePackage()
  const { go } = await setupBaselineGo()
  const planPath = path.join(out, 'run.json')
  const plan = parseComparisonPlan({
    format: 1,
    corpus,
    output: out,
    baselineDirectory: baseline,
    wasm: path.join(root, 'dist/parser.wasm'),
    origin: options.origin,
    max: options.max,
    warmups,
    profiles: modes,
    provenance
  })
  await Bun.write(planPath, JSON.stringify(plan, null, 2) + '\n')

  // 2. Execution Phase
  await run(Bun.argv[0], [
    Bun.fileURLToPath(
      new URL('../scripts/compare-frontend.ts', import.meta.url)
    ),
    '--plan',
    planPath
  ])

  await go(['run', '.', '-plan', planPath])

  // Viewer preparation is an explicit artifact task, outside report aggregation.
  await run(Bun.argv[0], ['run', 'build:corpus'], repositoryRoot)
  await run(Bun.argv[0], [
    Bun.fileURLToPath(new URL('../scripts/report.ts', import.meta.url)),
    '--data',
    out,
    '--out',
    out
  ])

  return { out, messagesLimit: plan.max }
}
