import { mkdir } from 'node:fs/promises'
import path from 'path'

import { $ } from 'bun'

import { cleanBuildOutput } from '../../../tools/workspace/build/outputs.ts'
import { sdkRoot } from '../../../tools/workspace/paths.ts'
import { assertNoHostPaths, buildWasm } from './node-contracts.ts'
import { assertBundledWasmMatches, writeWasmContract } from './wasm-contract.ts'

/** Artifact assembly task; the workspace task graph supplies its contract dependency. */
export async function assembleSdk({ checkGenerated = false } = {}) {
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
  await cleanBuildOutput(sdkRoot)
  await mkdir(dist, { recursive: true })
  await Bun.write(path.join(dist, 'parser.wasm'), bytes)

  const bun = Bun.argv[0]
  await $.cwd(sdkRoot)`${bun} run build:ts`
  await $.cwd(sdkRoot)`${bun} run build:renderer`
  await writeWasmContract()
}

if (Bun.main === Bun.fileURLToPath(import.meta.url)) {
  const { buildWorkspace } =
    await import('../../../tools/workspace/build/workspace.ts')
  await buildWorkspace({ packages: ['sdk'] })
}
