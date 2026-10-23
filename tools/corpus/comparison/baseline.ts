import { mkdir, mkdtemp, readFile, rename, rm } from 'node:fs/promises'
import path from 'node:path'

import {
  captureProcess,
  runProcess
} from '../../workspace/infrastructure/process.ts'
import {
  corpusRoot,
  packageRoot,
  repositoryRoot
} from '../../workspace/paths.ts'
import { fingerprintFiles, writeJson } from '../infrastructure/files.ts'
import type { GitRepo } from '../infrastructure/git.ts'
import { applicationGoModule } from '../infrastructure/go-module.ts'

const installTimeoutMs = 10 * 60 * 1000

async function packageVersion(name: string, parent: string) {
  const metadata: unknown = JSON.parse(
    await Bun.file(
      Bun.resolveSync(`${name}/package.json`, path.resolve(parent))
    ).text()
  )
  if (
    !metadata ||
    typeof metadata !== 'object' ||
    !('version' in metadata) ||
    typeof metadata.version !== 'string'
  )
    throw new Error('Missing installed version for ' + name)
  return metadata.version
}

export type Baseline = {
  directory: string
  dependencies: Record<string, { before: string; after: string }>
}

/** Baselines are immutable, content-addressed caches; run output never lives here. */
export async function prepareBaseline({
  sui,
  traq,
  suiRevision,
  traqRevision,
  cache
}: {
  sui: GitRepo
  traq: GitRepo
  suiRevision: string
  traqRevision: string
  cache: string
}): Promise<Baseline> {
  const lock = JSON.parse(await sui.show(suiRevision, 'package-lock.json'))
  const rendererVersion: unknown =
    lock.packages?.['node_modules/@traptitech/traq-markdown-it']?.version
  if (typeof rendererVersion !== 'string' || !rendererVersion)
    throw new Error('S-UI lockfile does not identify its Markdown renderer')
  const katex = await packageVersion('katex', packageRoot('extensions-plugin'))
  const highlight = await packageVersion(
    'highlight.js',
    packageRoot('commonmark-plugin')
  )
  const workerFiles = [
    ...new Bun.Glob('comparison/{go,go-app}/**/*.{go,json,mod}').scanSync({
      cwd: corpusRoot,
      onlyFiles: true
    })
  ]
  const key = new Bun.CryptoHasher('sha256')
    .update(
      JSON.stringify({
        suiRevision,
        traqRevision,
        rendererVersion,
        katex,
        highlight,
        worker: await fingerprintFiles(corpusRoot, workerFiles),
        repositoryRoot
      })
    )
    .digest('hex')
  const directory = path.join(cache, key)
  const dependencies = {
    katex: { before: katex, after: katex },
    'highlight.js': { before: highlight, after: highlight },
    renderer: { before: rendererVersion, after: 'candidate artifact' }
  }
  if (await Bun.file(path.join(directory, 'baseline.json')).exists())
    return { directory, dependencies }
  await mkdir(cache, { recursive: true })
  const staging = await mkdtemp(path.join(cache, '.preparing-'))
  try {
    await writeJson(path.join(staging, 'package.json'), {
      private: true,
      type: 'module',
      dependencies: {
        '@traptitech/traq-markdown-it': rendererVersion,
        katex,
        'highlight.js': highlight
      },
      overrides: { katex, 'highlight.js': highlight }
    })
    await runProcess(
      Bun.argv[0],
      ['install', '--ignore-scripts', '--no-save', '--no-progress'],
      staging,
      { timeoutMs: installTimeoutMs }
    )
    if (
      (await packageVersion('katex', staging)) !== katex ||
      (await packageVersion('highlight.js', staging)) !== highlight
    )
      throw new Error(
        'Comparison requires matching KaTeX and highlight.js versions'
      )
    const goRoot = path.join(staging, 'plain-text')
    await mkdir(path.join(goRoot, 'go-before'), { recursive: true })
    for (const name of ['parser.go', 'spoiler.go'])
      await Bun.write(
        path.join(goRoot, 'go-before', name),
        await traq.show(traqRevision, 'utils/message/' + name)
      )
    await Bun.write(
      path.join(goRoot, 'main.go'),
      await readFile(path.join(corpusRoot, 'comparison/go-app/main.go'))
    )
    const goMod = await traq.show(traqRevision, 'go.mod')
    const getVersion = (name: string) => {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const match = goMod.match(new RegExp('\\s' + escaped + '\\s+(\\S+)'))
      if (!match) throw new Error('Missing baseline dependency ' + name)
      return match[1]
    }
    const workerDirectory = path.join(goRoot, 'worker')
    await mkdir(workerDirectory)
    const workerSource = path.join(corpusRoot, 'comparison/go')
    for (const file of new Bun.Glob('*.{go,json,mod}').scanSync({
      cwd: workerSource,
      onlyFiles: true
    })) {
      if (!file.endsWith('_test.go'))
        await Bun.write(
          path.join(workerDirectory, file),
          await readFile(path.join(workerSource, file))
        )
    }
    await Bun.write(
      path.join(goRoot, 'go.mod'),
      await applicationGoModule(
        {
          'github.com/gofrs/uuid': getVersion('github.com/gofrs/uuid'),
          'github.com/json-iterator/go': getVersion(
            'github.com/json-iterator/go'
          )
        },
        './worker'
      )
    )
    await captureProcess('go', ['mod', 'tidy'], goRoot, {
      env: { ...process.env, GOWORK: 'off' },
      timeoutMs: installTimeoutMs
    })
    await writeJson(path.join(staging, 'baseline.json'), {
      key,
      suiRevision,
      traqRevision,
      dependencies
    })
    try {
      await rename(staging, directory)
    } catch (error) {
      // A concurrent preparation of the identical cache key may finish first.
      if (!(await Bun.file(path.join(directory, 'baseline.json')).exists()))
        throw error
    }
    return { directory, dependencies }
  } finally {
    await rm(staging, { recursive: true, force: true })
  }
}
