import path from 'node:path'

import { readGoPackageGraph } from '../package-graph.ts'
import { repositoryRoot } from '../paths.ts'

const { graph, modules } = await readGoPackageGraph()
for (const directory of graph.order) {
  const module = modules.get(directory)!
  const process = Bun.spawn(['go', 'test', '-count=1', './...'], {
    cwd: path.join(repositoryRoot, module.directory),
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit'
  })
  if ((await process.exited) !== 0)
    throw new Error(`Go tests failed: ${module.directory}`)
}
