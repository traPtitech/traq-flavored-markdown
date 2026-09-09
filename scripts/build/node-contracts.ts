import path from 'path'

import { $ } from 'bun'

import { cargoTargetDirectory, traqRoot } from '../paths.ts'

export const traqTargetDirectory = () => cargoTargetDirectory(traqRoot)
export const nodeContractsDirectory = () =>
  path.join(traqTargetDirectory(), 'node-contracts')

const cargo = () =>
  $.cwd(traqRoot).env({
    ...Bun.env,
    CARGO_TARGET_DIR: traqTargetDirectory()
  })

export async function buildWasm() {
  await cargo()`cargo build --locked --release --target wasm32-unknown-unknown -p traq-markdown-wasm`
  return path.join(
    traqTargetDirectory(),
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
