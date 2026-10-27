import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const result = spawnSync(
  'cargo',
  ['clippy', '--locked', '--workspace', '--all-targets', '--all-features'],
  {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    stdio: 'inherit',
    // Cargo 1.97+ enforces warnings without changing compiler flags and caches.
    env: { ...process.env, CARGO_BUILD_WARNINGS: 'deny' }
  }
)
if (result.error) throw result.error
process.exit(result.status ?? 1)
