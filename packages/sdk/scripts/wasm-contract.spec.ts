import path from 'path'

import { expect, test } from 'bun:test'

import { sdkRoot } from '../../../scripts/paths.ts'
import { assertNoHostPaths } from './node-contracts.ts'
import { assertBundledWasmMatches, readWasmMetadata } from './wasm-contract.ts'

test('bundled Wasm does not expose a Windows user path', async () => {
  const wasm = await Bun.file(path.join(sdkRoot, 'go', 'parser.wasm')).bytes()
  expect(() => assertNoHostPaths(wasm)).not.toThrow()
  expect(() =>
    assertNoHostPaths(new TextEncoder().encode('C:\\Users\\someone\\.cargo'))
  ).toThrow('absolute host home path')
})

test('bundled Wasm check accepts different bytes with the same contract and ABI', async () => {
  const wasm = await Bun.file(path.join(sdkRoot, 'go', 'parser.wasm')).bytes()
  // A custom section changes the binary hash without changing executable code.
  const withCustomSection = new Uint8Array(wasm.length + 8)
  withCustomSection.set(wasm)
  withCustomSection.set([0, 6, 4, 104, 111, 115, 116, 1], wasm.length)

  expect(withCustomSection.length).not.toBe(wasm.length)
  await expect(
    assertBundledWasmMatches(wasm, withCustomSection)
  ).resolves.toBeUndefined()
})

test('bundled Wasm check rejects a stale build ID', async () => {
  const wasm = await Bun.file(path.join(sdkRoot, 'go', 'parser.wasm')).bytes()
  const buildId = (await readWasmMetadata(wasm)).buildId
  const stale = new Uint8Array(wasm)
  const index = Buffer.from(stale).indexOf(buildId)
  expect(index).toBeGreaterThanOrEqual(0)
  stale.set(new TextEncoder().encode('0'.repeat(buildId.length)), index)

  expect((await readWasmMetadata(stale)).buildId).not.toBe(buildId)
  await expect(assertBundledWasmMatches(wasm, stale)).rejects.toThrow(
    'Bundled Go Wasm contract is out of date'
  )
})
