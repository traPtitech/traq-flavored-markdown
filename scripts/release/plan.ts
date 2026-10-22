import path from 'node:path'

import { outputIndex, readOutputIndex } from '../codegen/output-manifest.ts'
import { readGoPackageGraph, readNpmPackageGraph } from '../package-graph.ts'
import { type PackageName, packageRoot, repositoryRoot } from '../paths.ts'
import { type Version, goVersion } from './version.ts'

export type ReleasePlan = {
  version: Version
  packages: { owner: PackageName; name: string; directory: string }[]
  moduleTags: string[]
  changedFiles: string[]
  artifacts: string[]
}

export function releasePlan(
  version: Version,
  packages: ReleasePlan['packages'],
  modules: { directory: string; published: boolean }[],
  generated: string[]
): ReleasePlan {
  const moduleTags = modules
    .filter(module => module.published)
    .map(module => `${module.directory}/${version.tag}`)
  return {
    version,
    packages,
    moduleTags,
    changedFiles: [
      ...new Set([
        'package.json',
        'bun.lock',
        'go.work',
        outputIndex,
        ...packages.map(item => `${item.directory}/package.json`),
        ...modules.flatMap(module => [
          `${module.directory}/go.mod`,
          `${module.directory}/go.sum`
        ]),
        ...generated,
        'packages/sdk/go/parser.wasm'
      ])
    ].sort(),
    artifacts: packages.map(item => `${item.directory}/dist`)
  }
}

export async function loadReleasePlan(label: string, root = repositoryRoot) {
  const version = goVersion(label)
  const [{ manifests, graph }, go, generated] = await Promise.all([
    readNpmPackageGraph(root),
    readGoPackageGraph(root),
    readOutputIndex(root)
  ])
  return releasePlan(
    version,
    graph.order.map(owner => ({
      owner,
      name: manifests[owner].name,
      directory: path
        .relative(repositoryRoot, packageRoot(owner))
        .replaceAll('\\', '/')
    })),
    [...go.modules.values()].map(module => ({
      ...module,
      published: go.published.includes(module)
    })),
    generated.outputs.map(output => output.path)
  )
}

export type ReleaseAction =
  { kind: 'npm'; name: string } | { kind: 'tag'; name: string }
export type ReleaseState = {
  revision: string
  completed: ReleaseAction[]
  pending: ReleaseAction[]
}
export type ReleasePorts = {
  npmVersion(name: string, version: string): Promise<boolean>
  tagRevision(tag: string): Promise<string | undefined>
  publishPackage(name: string, version: Version): Promise<void>
  publishTag(tag: string, revision: string): Promise<void>
}

export async function inspectRelease(
  plan: ReleasePlan,
  revision: string,
  ports: Pick<ReleasePorts, 'npmVersion' | 'tagRevision'>
): Promise<ReleaseState> {
  const state: ReleaseState = { revision, completed: [], pending: [] }
  for (const item of plan.packages) {
    const action: ReleaseAction = { kind: 'npm', name: item.name }
    ;((await ports.npmVersion(item.name, plan.version.npm))
      ? state.completed
      : state.pending
    ).push(action)
  }
  for (const tag of [plan.version.tag, ...plan.moduleTags]) {
    const current = await ports.tagRevision(tag)
    if (current !== undefined && current !== revision)
      throw new Error(
        `Published tag ${tag} points to ${current}, expected ${revision}`
      )
    ;(current ? state.completed : state.pending).push({
      kind: 'tag',
      name: tag
    })
  }
  return state
}

/** Re-inspect services on every run; only missing actions are executed. */
export async function resumeRelease(
  plan: ReleasePlan,
  revision: string,
  ports: ReleasePorts,
  npmOnly = false
) {
  const state = await inspectRelease(plan, revision, ports)
  for (const action of state.pending) {
    if (action.kind === 'npm')
      await ports.publishPackage(action.name, plan.version)
    else if (!npmOnly) await ports.publishTag(action.name, revision)
  }
  return state
}
