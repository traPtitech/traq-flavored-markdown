import { mkdir } from 'node:fs/promises'
import path from 'path'

import { sdkRoot } from '../../../tools/workspace/paths.ts'
import { assertNoHostPaths, buildWasm } from './node-contracts.ts'
import { assertBundledWasmMatches } from './wasm-contract.ts'

/** Produce Wasm after the graph has prepared dist and the current contracts. */
export async function buildSdkWasm({ checkGenerated = false } = {}) {
  const dist = path.join(sdkRoot, 'dist')
  const bundledWasm = path.join(sdkRoot, 'go', 'parser.wasm')
  const wasm = await buildWasm()
  const bytes = await Bun.file(wasm).bytes()
  if (checkGenerated) {
    const committed = Bun.file(bundledWasm)
    if (!(await committed.exists())) {
      throw new Error('Bundled Go Wasm is missing; run bun run build')
    }
    const bundled = await committed.bytes()
    assertNoHostPaths(bundled)
    await assertBundledWasmMatches(bytes, bundled)
  } else {
    await Bun.write(bundledWasm, bytes)
  }
  await mkdir(dist, { recursive: true })
  await Bun.write(path.join(dist, 'parser.wasm'), bytes)
}

if (Bun.main === Bun.fileURLToPath(import.meta.url)) {
  const { buildWorkspace } =
    await import('../../../tools/workspace/build/workspace.ts')
  await buildWorkspace({ packages: ['sdk'] })
}
