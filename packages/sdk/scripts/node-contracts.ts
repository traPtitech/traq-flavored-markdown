import path from 'path'

import { $ } from 'bun'

import { cargoTargetDirectory, repositoryRoot } from '../../../scripts/paths.ts'

export const sdkTargetDirectory = cargoTargetDirectory
export const nodeContractsDirectory = () =>
  path.join(sdkTargetDirectory(), 'node-contracts')

const cargo = () =>
  $.cwd(repositoryRoot).env({
    ...Bun.env,
    CARGO_TARGET_DIR: sdkTargetDirectory()
  })

export async function buildWasm() {
  await cargo()`cargo build --locked --release --target wasm32-unknown-unknown -p traq-markdown-wasm`
  return path.join(
    sdkTargetDirectory(),
    'wasm32-unknown-unknown',
    'release',
    'traq_markdown_wasm.wasm'
  )
}

export async function exportNodeContracts() {
  const contracts = nodeContractsDirectory()
  await cargo()`cargo run --locked --release -p traq-markdown-wasm --features contracts --bin export-node-contracts -- ${contracts}`
  return contracts
}
