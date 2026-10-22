import os from 'os'
import path from 'path'

import { $ } from 'bun'

import {
  cargoTargetDirectory,
  repositoryRoot
} from '../../../tools/workspace/paths.ts'
import { semanticContractId } from './contract-identity.ts'

export { semanticContractId } from './contract-identity.ts'

export const sdkTargetDirectory = cargoTargetDirectory
export const nodeContractsDirectory = () =>
  path.join(sdkTargetDirectory(), 'node-contracts')

const cargo = (extraEnv: Record<string, string> = {}) =>
  $.cwd(repositoryRoot).env({
    ...Bun.env,
    CARGO_TARGET_DIR: sdkTargetDirectory(),
    ...extraEnv
  })

async function wasmRustFlags() {
  const shadowedFlags = [
    'RUSTFLAGS',
    'CARGO_BUILD_RUSTFLAGS',
    'CARGO_TARGET_WASM32_UNKNOWN_UNKNOWN_RUSTFLAGS'
  ].filter(name => Bun.env[name])
  if (shadowedFlags.length > 0) {
    throw new Error(
      `Wasm build cannot preserve ${shadowedFlags.join(', ')} alongside path remapping; use CARGO_ENCODED_RUSTFLAGS instead`
    )
  }

  const configFile = Bun.file(
    path.join(repositoryRoot, '.cargo', 'config.toml')
  )
  const config = (
    (await configFile.exists()) ? Bun.TOML.parse(await configFile.text()) : {}
  ) as { target?: Record<string, { rustflags?: unknown }> }
  const targetFlags = config.target?.['wasm32-unknown-unknown']?.rustflags ?? []
  if (
    !Array.isArray(targetFlags) ||
    !targetFlags.every(flag => typeof flag === 'string')
  ) {
    throw new Error('Missing Wasm linker flags in .cargo/config.toml')
  }

  // Rust embeds file!() paths in panic locations. Remap both separator forms:
  // rustc treats each --remap-path-prefix as a literal string replacement.
  const home = os.homedir()
  const roots = [
    [home, '/home'],
    [path.resolve(Bun.env.CARGO_HOME ?? path.join(home, '.cargo')), '/cargo'],
    [
      path.resolve(Bun.env.RUSTUP_HOME ?? path.join(home, '.rustup')),
      '/rustup'
    ],
    [repositoryRoot, '/workspace']
  ] as const
  const remaps = roots.flatMap(([source, destination]) =>
    [...new Set([source, source.replaceAll('\\', '/')])].map(
      prefix => `--remap-path-prefix=${prefix}=${destination}`
    )
  )

  // Preserve user target flags alongside remapping. The crate's build script
  // derives the linker memory limit from its native artifact limits.
  return [
    ...targetFlags,
    ...(Bun.env.CARGO_ENCODED_RUSTFLAGS
      ? Bun.env.CARGO_ENCODED_RUSTFLAGS.split('\x1f')
      : []),
    ...remaps
  ].join('\x1f')
}

export function assertNoHostPaths(bytes: Uint8Array) {
  const binary = new TextDecoder('latin1').decode(bytes)
  const home = os.homedir()
  if (
    [home, home.replaceAll('\\', '/')].some(prefix =>
      binary.includes(prefix)
    ) ||
    /[A-Za-z]:[\\/]Users[\\/]/i.test(binary)
  ) {
    throw new Error('Wasm contains an absolute host home path')
  }
}

export async function buildWasm() {
  const manifest = await Bun.file(
    path.join(nodeContractsDirectory(), 'contracts.json')
  ).json()
  if (
    typeof manifest.contractId !== 'string' ||
    manifest.contractId !== semanticContractId(manifest)
  )
    throw new Error('Export current node contracts before building Wasm')
  await cargo({
    CARGO_ENCODED_RUSTFLAGS: await wasmRustFlags(),
    MARKDOWN_CONTRACT_ID: manifest.contractId
  })`cargo build --locked --release --target wasm32-unknown-unknown -p traq-markdown-wasm`
  const wasm = path.join(
    sdkTargetDirectory(),
    'wasm32-unknown-unknown',
    'release',
    'traq_markdown_wasm.wasm'
  )
  assertNoHostPaths(await Bun.file(wasm).bytes())
  const { readWasmMetadata } = await import('./wasm-contract.ts')
  const metadata = await readWasmMetadata(await Bun.file(wasm).bytes())
  if (
    metadata.contractId !== manifest.contractId ||
    metadata.provenance.sourceFingerprint !==
      manifest.provenance?.sourceFingerprint
  )
    throw new Error(
      'Rust sources changed since contract export; regenerate bindings before assembling Wasm'
    )
  return wasm
}

export async function exportNodeContracts() {
  const contracts = nodeContractsDirectory()
  await cargo()`cargo run --locked --release -p traq-markdown-wasm --features contracts --bin export-node-contracts -- ${contracts}`
  const file = path.join(contracts, 'contracts.json')
  const manifest = await Bun.file(file).json()
  manifest.contractId = semanticContractId(manifest)
  await Bun.write(file, JSON.stringify(manifest, null, 2) + '\n')
  return contracts
}
