import os from 'os'
import path from 'path'

import { $ } from 'bun'

import { cargoTargetDirectory, repositoryRoot } from '../../../scripts/paths.ts'

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

  const config = Bun.TOML.parse(
    await Bun.file(path.join(repositoryRoot, '.cargo', 'config.toml')).text()
  ) as { target?: Record<string, { rustflags?: unknown }> }
  const targetFlags = config.target?.['wasm32-unknown-unknown']?.rustflags
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

  // CARGO_ENCODED_RUSTFLAGS overrides target rustflags, so retain the memory
  // linker limit from Cargo's config alongside the remapping flags.
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
  await cargo({
    CARGO_ENCODED_RUSTFLAGS: await wasmRustFlags()
  })`cargo build --locked --release --target wasm32-unknown-unknown -p traq-markdown-wasm`
  const wasm = path.join(
    sdkTargetDirectory(),
    'wasm32-unknown-unknown',
    'release',
    'traq_markdown_wasm.wasm'
  )
  assertNoHostPaths(await Bun.file(wasm).bytes())
  return wasm
}

export async function exportNodeContracts() {
  const contracts = nodeContractsDirectory()
  await cargo()`cargo run --locked --release -p traq-markdown-wasm --features contracts --bin export-node-contracts -- ${contracts}`
  return contracts
}
