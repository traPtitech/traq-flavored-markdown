import path from 'path'

import { $ } from 'bun'

import { sdkRoot } from '../../../scripts/paths.ts'
import { generateSdk } from './generate-bindings.ts'
import { buildWasm } from './node-contracts.ts'
import { writeWasmContract } from './wasm-contract.ts'

export async function buildSdk({ bindingsReady = false } = {}) {
  if (!bindingsReady) await generateSdk()
  const dist = path.join(sdkRoot, 'dist')
  const wasm = await buildWasm()
  await $`rm -rf ${dist}`
  await $`mkdir -p ${dist}`
  await Bun.write(path.join(dist, 'parser.wasm'), Bun.file(wasm))

  const bun = Bun.argv[0]
  await $.cwd(sdkRoot)`${bun} run build:ts`
  await $.cwd(sdkRoot)`${bun} run build:renderer`
  await writeWasmContract()
}

if (Bun.main === Bun.fileURLToPath(import.meta.url)) await buildSdk()
