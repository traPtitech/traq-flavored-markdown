import { $ } from 'bun'

import { assembleSdk } from '../../../packages/sdk/scripts/build.ts'
import { generateBindings } from '../../contracts/generate.ts'
import { checkGenerated } from '../checks/generated.ts'
import { readNpmPackageGraph } from '../package-graph.ts'
import { type PackageName, packageRoot } from '../paths.ts'
import { cleanBuildOutput } from './outputs.ts'
import { type Task, runTasks } from './tasks.ts'

export async function buildWorkspace({
  check = false,
  packages
}: { check?: boolean; packages?: PackageName[] } = {}) {
  const { graph } = await readNpmPackageGraph()
  const tasks = new Map<string, Task>()
  tasks.set('contracts', {
    dependencies: [],
    run: () => (check ? checkGenerated() : generateBindings())
  })
  for (const name of graph.order)
    tasks.set(`build:${name}`, {
      dependencies: [
        'contracts',
        ...[...(graph.dependencies.get(name) ?? [])].map(
          dependency => `build:${dependency}`
        )
      ],
      run: async () => {
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
