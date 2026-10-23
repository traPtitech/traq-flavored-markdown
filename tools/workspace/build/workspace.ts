import { $ } from 'bun'

import { buildSdkWasm } from '../../../packages/sdk/scripts/build.ts'
import { writeWasmContract } from '../../../packages/sdk/scripts/wasm-contract.ts'
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
    prepare: (name: PackageName) => Promise<unknown>
    typescript: (name: PackageName) => Promise<unknown>
    styles: (name: PackageName) => Promise<unknown>
    wasm: () => Promise<unknown>
    metadata: () => Promise<unknown>
  },
  styles: ReadonlySet<PackageName> = new Set(['sdk'])
) {
  const tasks = new Map<string, Task>()
  for (const name of graph.order) {
    tasks.set(`contracts:${name}`, {
      dependencies: [],
      run: () => actions.contracts(name)
    })
    tasks.set(`prepare:${name}`, {
      dependencies: [],
      run: () => actions.prepare(name)
    })
    tasks.set(`typescript:${name}`, {
      dependencies: [
        `contracts:${name}`,
        `prepare:${name}`,
        ...[...(graph.dependencies.get(name) ?? [])].map(
          dependency => `typescript:${dependency}`
        )
      ],
      run: () => actions.typescript(name)
    })
    tasks.set(`build:${name}`, {
      dependencies: [
        `typescript:${name}`,
        ...[...(graph.dependencies.get(name) ?? [])].map(
          dependency => `build:${dependency}`
        ),
        ...(styles.has(name) ? [`styles:${name}`] : []),
        ...(name === 'sdk' ? ['metadata:sdk'] : [])
      ],
      run: async () => {}
    })
    if (styles.has(name))
      tasks.set(`styles:${name}`, {
        dependencies: [`prepare:${name}`],
        run: () => actions.styles(name)
      })
  }
  tasks.set('wasm:sdk', {
    dependencies: ['contracts:sdk', 'prepare:sdk', 'typescript:core'],
    run: actions.wasm
  })
  tasks.set('metadata:sdk', {
    dependencies: ['wasm:sdk'],
    run: actions.metadata
  })
  return tasks
}

export async function buildWorkspace({
  check = false,
  packages
}: { check?: boolean; packages?: PackageName[] } = {}) {
  const { graph, manifests } = await readNpmPackageGraph()
  const styles = new Set(
    graph.order.filter(name => manifests[name].scripts?.['build:styles'])
  )
  const tasks = workspaceTasks(
    graph,
    {
      contracts: name =>
        check ? checkGeneratedOwner(name) : generateBindings(name),
      prepare: name => cleanBuildOutput(packageRoot(name)),
      typescript: async name => {
        const root = packageRoot(name)
        await $.cwd(
          root
        )`${Bun.argv[0]} run ${manifests[name].scripts?.['build:ts'] ? 'build:ts' : 'build'}`
      },
      styles: name => $.cwd(packageRoot(name))`${Bun.argv[0]} run build:styles`,
      wasm: () => buildSdkWasm({ checkGenerated: check }),
      metadata: writeWasmContract
    },
    styles
  )
  await runTasks(
    tasks,
    (packages ?? graph.order).map(name => `build:${name}`)
  )
}
