import { runRelease } from '../tools/workspace/release.ts'

await runRelease(Bun.argv.slice(2))
