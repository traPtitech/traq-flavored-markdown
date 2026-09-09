import path from 'path'

import { $ } from 'bun'

import { generateTraq } from '../generate-bindings.ts'
import { traqRoot } from '../paths.ts'
import { buildWasm, exportNodeContracts } from './node-contracts.ts'
import { writeWasmContract } from './wasm-contract.ts'

export async function buildTraq() {
  const dist = path.join(traqRoot, 'dist')
  const wasm = await buildWasm()
  await $`rm -rf ${dist}`
  await $`mkdir -p ${dist}`
  await Bun.write(path.join(dist, 'parser.wasm'), Bun.file(wasm))
  await generateTraq(await exportNodeContracts())

  const bun = Bun.argv[0]
  await $.cwd(traqRoot)`${bun} run build:ts`
  await $.cwd(traqRoot)`${bun} run build:renderer`
  await writeWasmContract()
}

if (Bun.main === Bun.fileURLToPath(import.meta.url)) await buildTraq()
