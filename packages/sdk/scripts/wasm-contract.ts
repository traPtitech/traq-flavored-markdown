import path from 'path'

import { sdkRoot } from '../../../scripts/paths.ts'

type WasmMetadata = {
  buildId: string
  limits: { inputBytes: number; outputBytes: number; memoryBytes: number }
  presets: Record<string, unknown>
}

const requiredExports = {
  memory: 'memory',
  input_ptr: 'function',
  output_ptr: 'function',
  configure: 'function',
  parse: 'function',
  configure_extractor: 'function',
  extract: 'function',
  configure_renderer: 'function',
  render: 'function',
  contract_ptr: 'function',
  contract_len: 'function'
} as const

export async function readWasmMetadata(
  bytes: Uint8Array
): Promise<WasmMetadata> {
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

  const metadata = JSON.parse(
    new TextDecoder('utf-8', { fatal: true }).decode(
      new Uint8Array(wasm.memory.buffer, pointer, length)
    )
  ) as WasmMetadata
  if (
    !metadata ||
    typeof metadata !== 'object' ||
    typeof metadata.buildId !== 'string' ||
    !metadata.limits ||
    !Number.isSafeInteger(metadata.limits.inputBytes) ||
    !Number.isSafeInteger(metadata.limits.outputBytes) ||
    !Number.isSafeInteger(metadata.limits.memoryBytes) ||
    !metadata.presets ||
    typeof metadata.presets !== 'object'
  ) {
    throw new Error('Invalid Wasm contract')
  }
  return metadata
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
    `Wasm build ${contract.buildId}: ${contract.bytes} bytes, SHA-256 ${contract.sha256}`
  )
}

if (Bun.main === Bun.fileURLToPath(import.meta.url)) await writeWasmContract()
