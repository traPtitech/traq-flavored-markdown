import { buildWorkspace } from './build/workspace.ts'

const args = Bun.argv.slice(2)
if (args.length > 1 || (args.length === 1 && args[0] !== '--check-generated')) {
  throw new Error('usage: bun scripts/build.ts [--check-generated]')
}
await buildWorkspace({ check: args[0] === '--check-generated' })
