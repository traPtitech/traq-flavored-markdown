import path from 'path'

import { traqRoot } from '../paths.ts'

const compress = async (format, bytes) =>
  (
    await new Response(
      new Blob([bytes]).stream().pipeThrough(new CompressionStream(format))
    ).arrayBuffer()
  ).byteLength

export async function writeWasmContract() {
  const bytes = await Bun.file(
    path.join(traqRoot, 'dist', 'parser.wasm')
  ).bytes()
  const { instance } = await WebAssembly.instantiate(bytes, {})
  const wasm = instance.exports as unknown as {
    contract_ptr: () => number
    contract_len: () => number
    memory: WebAssembly.Memory
  }
  const pointer = wasm.contract_ptr()
  const length = wasm.contract_len()
  const metadata = JSON.parse(
    new TextDecoder().decode(
      new Uint8Array(wasm.memory.buffer, pointer, length)
    )
  )
  const contract = {
    ...metadata,
    sha256: new Bun.CryptoHasher('sha256').update(bytes).digest('hex'),
    bytes: bytes.length,
    gzipBytes: await compress('gzip', bytes),
    brotliBytes: await compress('brotli', bytes)
  }
  await Bun.write(
    path.join(traqRoot, 'dist', 'contract.json'),
    JSON.stringify(contract, null, 2) + '\n'
  )
  console.log(
    `Wasm ABI ${contract.abiVersion} / AST ${contract.astVersion}: ${contract.bytes} bytes, SHA-256 ${contract.sha256}`
  )
}

if (Bun.main === Bun.fileURLToPath(import.meta.url)) await writeWasmContract()
