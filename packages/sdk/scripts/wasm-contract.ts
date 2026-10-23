import path from 'path'

import {
  type ArtifactMetadata,
  parseArtifactMetadata
} from '../../../tools/contracts/typescript/manifest.ts'
import { sdkRoot } from '../../../tools/workspace/paths.ts'

export async function readWasmMetadata(
  bytes: Uint8Array
): Promise<ArtifactMetadata> {
  // The workspace graph generates the ABI and builds core before assembling
  // Wasm. Loading its validators at startup would require core/dist too early.
  const { abiExports } = await import('../typescript/src/generated/abi.ts')
  const requiredExports = {
    memory: 'memory',
    ...Object.fromEntries(
      Object.keys(abiExports).map(name => [name, 'function'])
    )
  }
  const module = await WebAssembly.compile(new Uint8Array(bytes).buffer)
  const exports = new Map(
    WebAssembly.Module.exports(module).map(item => [item.name, item.kind])
  )
  for (const [name, kind] of Object.entries(requiredExports)) {
    if (exports.get(name) !== kind) {
      throw new Error(`Wasm is missing the ${name} ${kind} export`)
    }
  }

  const wasm = (await WebAssembly.instantiate(module, {}))
    .exports as unknown as {
    contract_ptr: () => number
    contract_len: () => number
    memory: WebAssembly.Memory
  }
  for (const [name, signature] of Object.entries(abiExports)) {
    const exported = (wasm as unknown as Record<string, unknown>)[name]
    if (
      typeof exported !== 'function' ||
      exported.length !== signature.params.length
    )
      throw new Error(`Wasm ${name} parameter signature does not match the ABI`)
  }
  const pointer = wasm.contract_ptr()
  const length = wasm.contract_len()
  if (
    !Number.isSafeInteger(pointer) ||
    !Number.isSafeInteger(length) ||
    pointer < 0 ||
    length < 1 ||
    length > 65_536 ||
    pointer + length > wasm.memory.buffer.byteLength
  ) {
    throw new Error('Invalid Wasm contract range')
  }

  return parseArtifactMetadata(
    JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(
        new Uint8Array(wasm.memory.buffer, pointer, length)
      )
    )
  )
}

function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, entry]) => [key, sorted(entry)])
    )
  }
  return value
}

/** Check source identity and ABI without requiring host-specific Wasm bytes to match. */
export async function assertBundledWasmMatches(
  built: Uint8Array,
  bundled: Uint8Array
) {
  const [current, committed] = await Promise.all([
    readWasmMetadata(built),
    readWasmMetadata(bundled)
  ])
  if (JSON.stringify(sorted(current)) !== JSON.stringify(sorted(committed))) {
    throw new Error(
      'Bundled Go Wasm contract is out of date; run bun run build'
    )
  }
}

const compress = async (
  format: CompressionFormat,
  bytes: Uint8Array<ArrayBuffer>
) =>
  (
    await new Response(
      new Blob([bytes.buffer])
        .stream()
        .pipeThrough(new CompressionStream(format))
    ).arrayBuffer()
  ).byteLength

export async function writeWasmContract() {
  const bytes = await Bun.file(
    path.join(sdkRoot, 'dist', 'parser.wasm')
  ).bytes()
  const metadata = await readWasmMetadata(bytes)
  const contract = {
    ...metadata,
    sha256: new Bun.CryptoHasher('sha256').update(bytes).digest('hex'),
    bytes: bytes.length,
    gzipBytes: await compress('gzip', bytes),
    brotliBytes: await compress('brotli' as CompressionFormat, bytes)
  }
  await Bun.write(
    path.join(sdkRoot, 'dist', 'contract.json'),
    JSON.stringify(contract, null, 2) + '\n'
  )
  console.log(
    `Wasm contract ${contract.contractId}: ${contract.bytes} bytes, SHA-256 ${contract.sha256}`
  )
}

if (Bun.main === Bun.fileURLToPath(import.meta.url)) await writeWasmContract()
