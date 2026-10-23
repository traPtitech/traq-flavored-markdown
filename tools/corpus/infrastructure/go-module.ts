import path from 'node:path'

import { readGoPackageGraph } from '../../workspace/package-graph.ts'
import { corpusRoot, repositoryRoot } from '../../workspace/paths.ts'

export const workerModule =
  'github.com/traPtitech/traq-flavored-markdown/tools/corpus/comparison/go'

/** Only the application adapter depends on the SDK and the selected legacy parser. */
export async function applicationGoModule(
  requirements: Record<string, string> = {},
  workerDirectory = path.join(corpusRoot, 'comparison/go')
) {
  const { published } = await readGoPackageGraph()
  const sdk = published.find(module => module.owner === 'sdk')
  if (!sdk) throw new Error('Missing Go SDK workspace module')
  const replacement = (module: string, folder: string) =>
    `replace ${module} => ${JSON.stringify(folder.replaceAll('\\', '/'))}`
  return [
    'module corpuscomparison',
    'go 1.26.0',
    'require (',
    ...Object.entries({
      ...requirements,
      [sdk.path]: 'v0.0.0',
      [workerModule]: 'v0.0.0'
    }).map(([module, version]) => ` ${module} ${version}`),
    ')',
    ...published.map(module =>
      replacement(module.path, path.join(repositoryRoot, module.directory))
    ),
    replacement(workerModule, workerDirectory),
    ''
  ].join('\n')
}
