import path from 'node:path'

import {
  type PackageName,
  packageNames,
  packageRoot,
  repositoryRoot
} from './paths.ts'

export type DependencyGraph<Name extends string> = {
  order: Name[]
  dependencies: ReadonlyMap<Name, ReadonlySet<Name>>
  allows(source: Name, destination: Name): boolean
}

export function dependencyGraph<Name extends string>(
  entries: Iterable<readonly [Name, Iterable<Name>]>
): DependencyGraph<Name> {
  const dependencies = new Map<Name, ReadonlySet<Name>>()
  for (const [name, required] of entries) {
    if (dependencies.has(name)) throw new Error(`Duplicate package: ${name}`)
    dependencies.set(name, new Set(required))
  }

  const order: Name[] = []
  const active = new Set<Name>()
  const visited = new Set<Name>()
  function visit(name: Name) {
    if (active.has(name))
      throw new Error(`Circular package dependency: ${name}`)
    if (visited.has(name)) return
    const required = dependencies.get(name)
    if (!required) throw new Error(`Unknown package dependency: ${name}`)
    active.add(name)
    for (const dependency of required) visit(dependency)
    active.delete(name)
    visited.add(name)
    order.push(name)
  }
  for (const name of dependencies.keys()) visit(name)

  const closure = new Map<Name, Set<Name>>()
  for (const name of order) {
    const allowed = new Set<Name>([name])
    for (const dependency of dependencies.get(name) ?? []) {
      allowed.add(dependency)
      for (const transitive of closure.get(dependency) ?? [])
        allowed.add(transitive)
    }
    closure.set(name, allowed)
  }
  return {
    order,
    dependencies,
    allows: (source, destination) =>
      closure.get(source)?.has(destination) ?? false
  }
}

export type NpmManifest = {
  name: string
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

export function npmPackageGraph(
  manifests: Record<PackageName, NpmManifest>
): DependencyGraph<PackageName> {
  const names = new Map<string, PackageName>()
  for (const owner of packageNames) {
    const name = manifests[owner]?.name
    if (!name) throw new Error(`Missing package manifest: ${owner}`)
    if (names.has(name)) throw new Error(`Duplicate npm package name: ${name}`)
    names.set(name, owner)
  }
  const graph = dependencyGraph(
    packageNames.map(
      owner =>
        [
          owner,
          Object.keys(manifests[owner].peerDependencies ?? {}).flatMap(name => {
            const dependency = names.get(name)
            if (dependency) return [dependency]
            if (name.startsWith('@traq-flavored-markdown/'))
              throw new Error(`Unknown workspace peer: ${name}`)
            return []
          })
        ] as const
    )
  )
  // The workspace layout is the independent ownership boundary. Manifests may
  // add or remove peers within that direction, but cannot redefine the layers.
  const rank = new Map(packageNames.map((name, index) => [name, index]))
  for (const owner of packageNames) {
    const declared = graph.dependencies.get(owner)!
    for (const dependency of declared)
      if (rank.get(dependency)! >= rank.get(owner)!)
        throw new Error(`${owner}: upward npm dependency ${dependency}`)
    if (
      packageNames.some(
        dependency =>
          dependency !== owner &&
          graph.allows(owner, dependency) &&
          !declared.has(dependency)
      )
    )
      throw new Error(
        `${owner} peer dependencies do not match the package graph`
      )
    for (const name of Object.keys(manifests[owner].dependencies ?? {}))
      if (names.has(name) || name.startsWith('@traq-flavored-markdown/'))
        throw new Error(`${owner}: internal packages must be peer dependencies`)
  }
  return graph
}

export async function readNpmPackageGraph(root = repositoryRoot) {
  const manifests = Object.fromEntries(
    await Promise.all(
      packageNames.map(
        async name =>
          [
            name,
            (await Bun.file(
              path.join(
                root,
                path.relative(repositoryRoot, packageRoot(name)),
                'package.json'
              )
            ).json()) as NpmManifest
          ] as const
      )
    )
  ) as Record<PackageName, NpmManifest>
  return { manifests, graph: npmPackageGraph(manifests) }
}

export function packageOwner(directory: string): PackageName | undefined {
  for (const name of packageNames) {
    const relative = path.relative(packageRoot(name), directory)
    if (
      relative === '' ||
      (relative !== '..' &&
        !relative.startsWith('..' + path.sep) &&
        !path.isAbsolute(relative))
    )
      return name
  }
}

export type GoMod = {
  Module: { Path: string }
  Require: { Path: string; Version: string }[] | null
  Replace: unknown[] | null
}

export type GoModule = {
  owner: PackageName
  directory: string
  path: string
  manifest: GoMod
  published: boolean
}

export type GoPackageGraph = {
  modules: ReadonlyMap<string, GoModule>
  graph: DependencyGraph<string>
  published: GoModule[]
  example: GoModule
}

const goDirectory = (name: PackageName) =>
  path
    .relative(repositoryRoot, path.join(packageRoot(name), 'go'))
    .replaceAll('\\', '/')

async function readGoMod(root: string, directory: string): Promise<GoMod> {
  const process = Bun.spawn(['go', 'mod', 'edit', '-json'], {
    cwd: path.join(root, directory),
    env: { ...Bun.env, GOWORK: 'off' },
    stdout: 'pipe',
    stderr: 'pipe'
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited
  ])
  if (exitCode !== 0)
    throw new Error(`${directory}: go mod edit -json: ${stderr.trim()}`)
  return JSON.parse(stdout) as GoMod
}

export async function readGoPackageGraph(
  root = repositoryRoot
): Promise<GoPackageGraph> {
  const directories = [
    ...packageNames.map(owner => ({
      owner,
      directory: goDirectory(owner),
      published: true
    })),
    {
      owner: 'sdk' as const,
      directory: 'packages/sdk/examples/go',
      published: false
    }
  ]
  const modules = new Map<string, GoModule>()
  for (const { owner, directory, published } of directories) {
    const manifest = await readGoMod(root, directory)
    modules.set(directory, {
      owner,
      directory,
      path: manifest.Module.Path,
      manifest,
      published
    })
  }
  const core = modules.get(goDirectory('core'))!
  const suffix = '/' + core.directory
  if (!core.path.endsWith(suffix))
    throw new Error(`${core.directory}: unexpected Go module path`)
  const repository = core.path.slice(0, -suffix.length)
  const byPath = new Map(
    [...modules.values()].map(module => [module.path, module])
  )
  if (byPath.size !== modules.size) throw new Error('Duplicate Go module path')
  for (const module of modules.values())
    if (
      module.path !==
      (module.published
        ? `${repository}/${module.directory}`
        : 'traq-markdown-example')
    )
      throw new Error(`${module.directory}: unexpected Go module path`)

  const rank = new Map(packageNames.map((name, index) => [name, index]))
  const graph = dependencyGraph(
    [...modules.values()].map(
      module =>
        [
          module.directory,
          (module.manifest.Require ?? []).flatMap(requirement => {
            const dependency = byPath.get(requirement.Path)
            if (dependency) {
              if (module.published && !dependency.published)
                throw new Error(
                  `${module.directory}: published module depends on example`
                )
              if (rank.get(dependency.owner)! > rank.get(module.owner)!)
                throw new Error(
                  `${module.directory}: upward Go dependency ${dependency.directory}`
                )
              return [dependency.directory]
            }
            if (requirement.Path.startsWith(`${repository}/packages/`))
              throw new Error(
                `Unknown Go package dependency: ${requirement.Path}`
              )
            return []
          })
        ] as const
    )
  )
  const published = graph.order
    .map(directory => modules.get(directory)!)
    .filter(module => module.published)
  return {
    modules,
    graph,
    published,
    example: modules.get('packages/sdk/examples/go')!
  }
}

export function validateGoOwnership(
  go: GoPackageGraph,
  npm: DependencyGraph<PackageName>
) {
  for (const module of go.modules.values())
    for (const directory of go.graph.dependencies.get(module.directory) ?? []) {
      const dependency = go.modules.get(directory)!
      if (!npm.allows(module.owner, dependency.owner))
        throw new Error(
          `${module.directory}: upward Go dependency ${dependency.directory}`
        )
    }
}
