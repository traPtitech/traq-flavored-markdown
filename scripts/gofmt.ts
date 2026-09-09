import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const ignored = new Set(['node_modules', 'target'])

function goFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return ignored.has(entry.name) ? [] : goFiles(path)
    return entry.isFile() && entry.name.endsWith('.go') ? [path] : []
  })
}

const check = process.argv.length === 3 && process.argv[2] === '--check'
if (!check && process.argv.length !== 2) {
  throw new Error('usage: bun scripts/gofmt.ts [--check]')
}

const result = spawnSync(
  'gofmt',
  [check ? '-l' : '-w', ...goFiles(join(root, 'packages'))],
  {
    encoding: 'utf8'
  }
)
if (result.error) throw result.error
if (result.status !== 0) process.exit(result.status ?? 1)

if (check && result.stdout.trim()) {
  console.error(result.stdout.trim())
  console.error('Run bun run format:go to fix these files.')
  process.exitCode = 1
}
