import path from 'node:path'

import { generateSdk } from '../../packages/sdk/scripts/generate-bindings.ts'
import { OutputManifest } from '../contracts/io/output-manifest.ts'
import { type ContractPackage, nodeGroups } from '../contracts/model/groups.ts'
import {
  generateContracts,
  generateCoreContracts
} from './generation/contracts.ts'
import { readNpmPackageGraph } from './package-graph.ts'
import { type PackageName, packageNames, repositoryRoot } from './paths.ts'

const contractPackages = new Set<string>(
  Object.values(nodeGroups).map(group => group.owner)
)

/** Each target owns a complete output set; orchestration never belongs to the compiler. */
export async function generateBindings(
  packageName?: PackageName,
  input?: string,
  outputRoot = repositoryRoot
) {
  if (packageName === 'core') return generateCoreContracts(outputRoot)
  if (packageName === 'sdk')
    return generateSdk(input ? path.resolve(input) : undefined, outputRoot)
  if (packageName && contractPackages.has(packageName))
    return generateContracts(packageName as ContractPackage, outputRoot)
  if (packageName) throw new Error('Unknown generation target: ' + packageName)
  const plan = new OutputManifest()
  const { graph } = await readNpmPackageGraph()
  for (const owner of graph.order)
    plan.merge(await generateBindings(owner, undefined, outputRoot))
  return plan
}

export async function main() {
  const [owner, input, ...rest] = Bun.argv.slice(2)
  if (
    rest.length ||
    (owner !== undefined && !packageNames.includes(owner as PackageName)) ||
    (input !== undefined && owner !== 'sdk')
  )
    throw new Error(
      'usage: bun scripts/generate-bindings.ts [core|commonmark-plugin|extensions-plugin|traq-plugin|sdk] [contracts-dir]'
    )
  await generateBindings(owner as PackageName | undefined, input)
}

if (import.meta.main) await main()
