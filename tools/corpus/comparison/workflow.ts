import path from 'path'

import { $ } from 'bun'

import { packageRoot, repositoryRoot, sdkRoot } from '../../../scripts/paths.ts'
import { resolveRepositoryPath } from '../scripts/args.ts'
import { GitRepo } from '../scripts/git.ts'
import { parseRunManifest } from '../shared/protocol.ts'

export async function runComparison(v: Record<string, string | undefined>) {
  const root = sdkRoot
  const privateRoot = path.join(repositoryRoot, '.private')
  if (!v.corpus) throw Error('--corpus messages.jsonl is required')
  if (!Number.isSafeInteger(Number(v.max)) || Number(v.max) <= 0) {
    throw Error('--max must be a positive integer')
  }

  const corpus = resolveRepositoryPath(v.corpus)
  const out = resolveRepositoryPath(
    v.out ?? path.join(privateRoot, 'corpora', 'comparison')
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

  const suiRepo = new GitRepo(resolveRepositoryPath(v.sui!))
  const traqRepo = new GitRepo(resolveRepositoryPath(v.traq!))
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

    Object.assign(versions, {
      katexBefore,
      highlightBefore,
      highlightAfter: highlightVersion,
      katexAfter: katexVersion,
      baselineRenderer: rendererVersion
    })
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
        v['traq-ref']!,
        'utils/message/' + name
      )
      await Bun.write(path.join(goRoot, 'go-before', name), content)
    }

    await Bun.write(
      path.join(goRoot, 'main.go'),
      Bun.file(new URL('../scripts/plain-text/main.go', import.meta.url))
    )

    const goMod = await traqRepo.show(v['traq-ref']!, 'go.mod')
    const getVersion = (name: string) => {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const match = goMod.match(new RegExp('\\s' + escaped + '\\s+(\\S+)'))
      if (!match) throw Error('Missing baseline dependency ' + name)
      return match[1]
    }

    const localGoModule = (root: string) =>
      JSON.stringify(path.join(root, 'go').replaceAll('\\', '/'))
    const localGoModules = {
      'github.com/traPtitech/traq-flavored-markdown/packages/core/go':
        packageRoot('core'),
      'github.com/traPtitech/traq-flavored-markdown/packages/plugins/commonmark/go':
        packageRoot('commonmark-plugin'),
      'github.com/traPtitech/traq-flavored-markdown/packages/plugins/extensions/go':
        packageRoot('extensions-plugin'),
      'github.com/traPtitech/traq-flavored-markdown/packages/plugins/traq/go':
        packageRoot('traq-plugin'),
      'github.com/traPtitech/traq-flavored-markdown/packages/sdk/go': sdkRoot
    }

    const modContent =
      [
        `module corpuscomparison`,
        `go 1.26.0`,
        `require (`,
        ` github.com/gofrs/uuid ${getVersion('github.com/gofrs/uuid')}`,
        ` github.com/json-iterator/go ${getVersion('github.com/json-iterator/go')}`,
        ` github.com/traPtitech/traq-flavored-markdown/packages/sdk/go v0.1.0`,
        `)`
      ].join('\n') +
      '\n' +
      Object.entries(localGoModules)
        .map(([module, root]) => `replace ${module} => ${localGoModule(root)}`)
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
  await Bun.write(
    path.join(out, 'run.json'),
    JSON.stringify(
      parseRunManifest({
        format: 1,
        revisions: versions,
        max: Number(v.max),
        warmups: 200,
        modes: ['render', 'inline', 'plainText']
      }),
      null,
      2
    ) + '\n'
  )

  // 2. Execution Phase
  await run(Bun.argv[0], [
    Bun.fileURLToPath(
      new URL('../scripts/compare-frontend.ts', import.meta.url)
    ),
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

  // Viewer preparation is an explicit artifact task, outside report aggregation.
  await run(Bun.argv[0], ['run', 'build:corpus'], repositoryRoot)
  await run(Bun.argv[0], [
    Bun.fileURLToPath(new URL('../scripts/report.ts', import.meta.url)),
    '--data',
    out,
    '--out',
    out
  ])

  return { out, messagesLimit: Number(v.max) }
}
