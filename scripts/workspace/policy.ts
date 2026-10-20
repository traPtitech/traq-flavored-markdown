import { dependencyGraph } from '../package-graph.ts'
import {
  type PackageName,
  allowsOwner,
  crateRestrictions
} from './descriptor.ts'

export type WorkspaceModule = {
  name: string
  owner: PackageName
  dependencies: readonly string[]
}

/** Check actual module edges and transitive capabilities against explicit policy. */
export function validateModules(
  modules: readonly WorkspaceModule[],
  checkCapabilities = true
) {
  const byName = new Map(modules.map(module => [module.name, module]))
  const graph = dependencyGraph(
    modules.map(
      module =>
        [
          module.name,
          module.dependencies.filter(dependency => byName.has(dependency))
        ] as const
    )
  )
  for (const module of modules) {
    for (const name of graph.dependencies.get(module.name) ?? []) {
      const destination = byName.get(name)!
      if (!allowsOwner(module.owner, destination.owner)) {
        throw new Error(`${module.name}: disallowed owner dependency ${name}`)
      }
    }
    for (const forbidden of checkCapabilities
      ? (crateRestrictions[module.name] ?? [])
      : []) {
      if (graph.allows(module.name, forbidden)) {
        throw new Error(
          `${module.name}: disallowed capability dependency ${forbidden}`
        )
      }
    }
  }
  return graph
}

export function validateCapabilities(
  name: string,
  dependencies: ReadonlySet<string>
) {
  for (const forbidden of crateRestrictions[name] ?? [])
    if (dependencies.has(forbidden))
      throw new Error(`${name}: disallowed capability dependency ${forbidden}`)
}
