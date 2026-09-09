import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { gzipSync, brotliCompressSync } from "node:zlib";
const bytes = await readFile(new URL("../dist/parser.wasm", import.meta.url));
const { instance } = await WebAssembly.instantiate(bytes, {});
const wasm = instance.exports;
const pointer = wasm.contract_ptr();
const length = wasm.contract_len();
const metadata = JSON.parse(
  new TextDecoder().decode(new Uint8Array(wasm.memory.buffer, pointer, length)),
);
const contract = {
  ...metadata,
  sha256: createHash("sha256").update(bytes).digest("hex"),
  bytes: bytes.length,
  gzipBytes: gzipSync(bytes).length,
  brotliBytes: brotliCompressSync(bytes).length,
};
await writeFile(
  new URL("../dist/contract.json", import.meta.url),
  JSON.stringify(contract, null, 2) + "\n",
);
console.log(
  `Wasm ABI ${contract.abiVersion} / AST ${contract.astVersion}: ${contract.bytes} bytes, SHA-256 ${contract.sha256}`,
);
