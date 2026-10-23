import { $ } from 'bun'

import { assembleSdk } from '../../../packages/sdk/scripts/build.ts'
import { checkGeneratedOwner } from '../checks/generated.ts'
import { generateBindings } from '../generate.ts'
import { readNpmPackageGraph } from '../package-graph.ts'
import { type PackageName, packageRoot } from '../paths.ts'
import { cleanBuildOutput } from './outputs.ts'
import { type Task, runTasks } from './tasks.ts'

/** Contract generation is an artifact prerequisite, scoped to the requested graph. */
export function workspaceTasks(
  graph: {
    order: readonly PackageName[]
    dependencies: ReadonlyMap<PackageName, ReadonlySet<PackageName>>
  },
  actions: {
    contracts: (name: PackageName) => Promise<unknown>
    build: (name: PackageName) => Promise<unknown>
  }
) {
  const tasks = new Map<string, Task>()
  for (const name of graph.order) {
    tasks.set(`contracts:${name}`, {
      dependencies: [],
      run: () => actions.contracts(name)
    })
    tasks.set(`build:${name}`, {
      dependencies: [
        `contracts:${name}`,
        ...[...(graph.dependencies.get(name) ?? [])].map(
          dependency => `build:${dependency}`
        )
      ],
      run: () => actions.build(name)
    })
  }
  return tasks
}

export async function buildWorkspace({
  check = false,
  packages
}: { check?: boolean; packages?: PackageName[] } = {}) {
  const { graph } = await readNpmPackageGraph()
  const tasks = workspaceTasks(graph, {
    contracts: name =>
      check ? checkGeneratedOwner(name) : generateBindings(name),
    build: async name => {
      if (name === 'sdk') return assembleSdk({ checkGenerated: check })
      const root = packageRoot(name)
      await cleanBuildOutput(root)
      await $.cwd(root)`${Bun.argv[0]} run build`
    }
  })
  await runTasks(
    tasks,
    (packages ?? graph.order).map(name => `build:${name}`)
  )
}
