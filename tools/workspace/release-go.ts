import path from 'node:path'

import { captureProcess } from './infrastructure/process.ts'
import {
  type GoModule,
  type GoPackageGraph,
  readGoPackageGraph,
  validateGoOwnership
} from './package-graph.ts'
import { repositoryRoot } from './paths.ts'
import { goVersion } from './release/version.ts'

type GoWork = {
  Use: { DiskPath: string }[] | null
  Replace:
    | {
        Old: { Path: string; Version?: string }
        New: { Path: string; Version?: string }
      }[]
    | null
}

async function releaseGraph(root: string) {
  const go = await readGoPackageGraph(root)
  validateGoOwnership(go)
  return go
}

export const goReleaseTags = async (version: string, root = repositoryRoot) =>
  (await releaseGraph(root)).published.map(
    module => `${module.directory}/${version}`
  )

export function validateGoMod(
  module: GoModule,
  graph: GoPackageGraph,
  version: string
) {
  if (module.manifest.Replace?.length)
    throw new Error(
      `${module.directory}: module-local replacements prevent distribution`
    )
  const internal = new Set([...graph.modules.values()].map(item => item.path))
  if (
    (module.manifest.Require ?? []).some(
      requirement =>
        internal.has(requirement.Path) && requirement.Version !== version
    )
  )
    throw new Error(
      `${module.directory}: Go dependencies do not match ${version}`
    )
}

export function validateGoWork(
  workspace: GoWork,
  graph: GoPackageGraph,
  version: string
) {
  const used = (workspace.Use ?? []).map(item => item.DiskPath)
  if (
    used.length !== graph.modules.size ||
    [...graph.modules.values()].some(
      module => !used.includes(`./${module.directory}`)
    )
  )
    throw new Error('go.work must use all local modules')
  const internal = new Set(graph.published.map(module => module.path))
  const replacements = (workspace.Replace ?? []).filter(item =>
    internal.has(item.Old.Path)
  )
  if (
    replacements.length !== graph.published.length ||
    graph.published.some(
      module =>
        !replacements.some(
          replacement =>
            replacement.Old.Path === module.path &&
            replacement.Old.Version === version &&
            replacement.New.Path === `./${module.directory}` &&
            !replacement.New.Version
        )
    )
  )
    throw new Error(`go.work replacements do not match ${version}`)
}

async function go(cwd: string, args: string[], workspaceOff = false) {
  return captureProcess('go', args, cwd, {
    env: { ...Bun.env, ...(workspaceOff ? { GOWORK: 'off' } : {}) }
  })
}

const readWork = async (root: string) =>
  JSON.parse(await go(root, ['work', 'edit', '-json'])) as GoWork

export async function runGoRelease(args: string[], root = repositoryRoot) {
  const [version, mode, ...rest] = args
  if (
    !version ||
    !['--prepare', '--check', '--tags'].includes(mode ?? '') ||
    rest.length
  )
    throw new Error(
      'usage: bun tools/workspace/release-go.ts v<0-or-1>.<minor>.<patch> [--prepare|--check|--tags]'
    )

  goVersion(version)

  let graph = await releaseGraph(root)
  if (mode === '--tags') {
    console.log(
      graph.published.map(module => `${module.directory}/${version}`).join('\n')
    )
    return
  }
  if (mode === '--prepare') {
    const internal = new Set(
      [...graph.modules.values()].map(module => module.path)
    )
    for (const module of graph.modules.values()) {
      const requirements = (module.manifest.Require ?? [])
        .filter(requirement => internal.has(requirement.Path))
        .map(requirement => `-require=${requirement.Path}@${version}`)
      if (requirements.length)
        await go(
          path.join(root, module.directory),
          ['mod', 'edit', ...requirements],
          true
        )
      const sum = Bun.file(path.join(root, module.directory, 'go.sum'))
      if (await sum.exists()) {
        const original = await sum.text()
        const retained = original
          .split('\n')
          .filter(line => {
            const [name, sumVersion] = line.split(' ')
            return (
              !internal.has(name) ||
              sumVersion === version ||
              sumVersion === `${version}/go.mod`
            )
          })
          .join('\n')
        if (retained !== original) await Bun.write(sum, retained)
      }
    }
    const workspace = await readWork(root)
    const edits = (workspace.Replace ?? [])
      .filter(item => internal.has(item.Old.Path))
      .map(
        item =>
          `-dropreplace=${item.Old.Path}${item.Old.Version ? `@${item.Old.Version}` : ''}`
      )
    edits.push(
      ...graph.published.map(
        module => `-replace=${module.path}@${version}=./${module.directory}`
      )
    )
    await go(root, ['work', 'edit', ...edits])
    graph = await releaseGraph(root)
  }
  for (const module of graph.modules.values())
    validateGoMod(module, graph, version)
  validateGoWork(await readWork(root), graph, version)
  console.log(`Go module dependencies and workspace match ${version}`)
}

if (Bun.main === Bun.fileURLToPath(import.meta.url))
  await runGoRelease(Bun.argv.slice(2))
