import { $ } from 'bun'

const root = new URL('../', import.meta.url)
const rootPath = Bun.fileURLToPath(root)
const configuredTarget = Bun.env.CARGO_TARGET_DIR
const target = (() => {
  const directory = configuredTarget
    ? /^(?:[A-Za-z]:[\\/]|[\\/]{1,2})/.test(configuredTarget)
      ? Bun.pathToFileURL(configuredTarget)
      : new URL(configuredTarget, root)
    : new URL('target/', root)
  if (!directory.pathname.endsWith('/')) directory.pathname += '/'
  return directory
})()
const targetPath = Bun.fileURLToPath(target)
const contracts = new URL('node-contracts/', target)
const cargo = $.cwd(rootPath).env({
  ...Bun.env,
  CARGO_TARGET_DIR: targetPath
})
const bun = Bun.argv[0]

await cargo`cargo build --locked --release --target wasm32-unknown-unknown -p traq-markdown-wasm`

await cargo`cargo run --locked --release -p traq-markdown-wasm --features contracts --bin export-node-contracts -- ${Bun.fileURLToPath(contracts)}`

const dist = Bun.fileURLToPath(new URL('dist/', root))
await $`rm -rf ${dist}`
await $`mkdir -p ${dist}`
await Bun.write(
  new URL('dist/parser.wasm', root),
  Bun.file(
    new URL('wasm32-unknown-unknown/release/traq_markdown_wasm.wasm', target)
  )
)

await $.cwd(
  rootPath
)`${bun} ${Bun.fileURLToPath(new URL('../../../scripts/generate-bindings.ts', import.meta.url))} traq ${Bun.fileURLToPath(contracts)}`
await $.cwd(
  rootPath
)`${bun} node_modules/typescript/bin/tsc -p typescript/tsconfig.build.json`
await $.cwd(rootPath)`${bun} scripts/contract.ts`

await $.cwd(
  rootPath
)`${bun} node_modules/sass/sass.js --no-source-map styles/index.scss dist/index.css`
