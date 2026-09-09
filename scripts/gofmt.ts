import { $ } from 'bun'

const packagesRoot = Bun.fileURLToPath(new URL('../packages/', import.meta.url))
const args = Bun.argv.slice(2)
const check = args.length === 1 && args[0] === '--check'
if (!check && args.length !== 0) {
  throw new Error('usage: bun scripts/gofmt.ts [--check]')
}

const goFilePaths = [
  ...new Bun.Glob('**/*.go').scanSync({
    cwd: packagesRoot,
    onlyFiles: true,
    dot: true
  })
].filter(file => !/(?:^|\/)(?:node_modules|target)\//.test(file))
const result = await $`gofmt ${check ? '-l' : '-w'} ${goFilePaths}`
  .cwd(packagesRoot)
  .nothrow()
  .quiet()
if (result.exitCode !== 0) {
  throw new Error(`gofmt failed (exited with ${result.exitCode})`)
}

const output = result.text()
if (check && output.trim()) {
  console.error(output.trim())
  console.error('Run bun run format:go to fix these files.')
  throw new Error('Go files are not formatted')
}
