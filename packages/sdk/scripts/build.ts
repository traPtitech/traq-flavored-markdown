import path from 'path'

import { $ } from 'bun'

import { sdkRoot } from '../../../scripts/paths.ts'
import { generateSdk } from './generate-bindings.ts'
import { buildWasm } from './node-contracts.ts'
import { writeWasmContract } from './wasm-contract.ts'

export async function buildSdk({
  bindingsReady = false,
  checkGenerated = false
} = {}) {
  if (!bindingsReady) await generateSdk()
  const dist = path.join(sdkRoot, 'dist')
  const bundledWasm = path.join(sdkRoot, 'go', 'parser.wasm')
  const wasm = await buildWasm()
  const bytes = await Bun.file(wasm).bytes()
  if (checkGenerated) {
    const committed = Bun.file(bundledWasm)
    if (
      !(await committed.exists()) ||
      new Bun.CryptoHasher('sha256').update(bytes).digest('hex') !==
        new Bun.CryptoHasher('sha256')
          .update(await committed.bytes())
          .digest('hex')
    )
      throw new Error('Bundled Go Wasm is out of date; run bun run build')
  } else {
    await Bun.write(bundledWasm, bytes)
  }
  await $`rm -rf ${dist}`
  await $`mkdir -p ${dist}`
  await Bun.write(path.join(dist, 'parser.wasm'), bytes)

  const bun = Bun.argv[0]
  await $.cwd(sdkRoot)`${bun} run build:ts`
  await $.cwd(sdkRoot)`${bun} run build:renderer`
  await writeWasmContract()
}

if (Bun.main === Bun.fileURLToPath(import.meta.url)) await buildSdk()
