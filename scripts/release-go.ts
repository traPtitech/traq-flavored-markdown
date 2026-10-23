import { runGoRelease } from '../tools/workspace/release-go.ts'

await runGoRelease(Bun.argv.slice(2))
