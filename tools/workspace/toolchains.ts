import { appendFile, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export function parseToolchains(
  packageManager: string,
  rust: string,
  node: string,
  versions: Record<string, unknown>
) {
  const pinned = (name: string, value: unknown) => {
    if (typeof value !== 'string' || !/^\d+\.\d+\.\d+$/.test(value))
      throw new Error(`${name} must declare an exact stable version`)
    return value
  }
  const rustList = (name: string) => {
    const value = new RegExp(`^${name}\\s*=\\s*(\\[[^\\n]+\\])`, 'm').exec(
      rust
    )?.[1]
    const entries: unknown = value ? JSON.parse(value) : []
    if (
      !Array.isArray(entries) ||
      entries.some(entry => typeof entry !== 'string')
    )
      throw new Error(`Invalid Rust ${name}`)
    return entries.join(',')
  }
  return {
    bun: pinned('Bun', /^bun@(.+)$/.exec(packageManager)?.[1]),
    node: pinned('Node', node.trim()),
    go: pinned('Go', versions.go),
    npm: pinned('npm', versions.npm),
    rust: pinned('Rust', /^channel\s*=\s*"([^"]+)"/m.exec(rust)?.[1]),
    'rust-targets': rustList('targets'),
    'rust-components': rustList('components')
  }
}

export async function readToolchains(root: string) {
  const read = (name: string) => readFile(path.join(root, name), 'utf8')
  const [manifest, rust, node, versions] = await Promise.all([
    read('package.json'),
    read('rust-toolchain.toml'),
    read('.node-version'),
    read('.github/toolchains.json')
  ])
  return parseToolchains(
    JSON.parse(manifest).packageManager,
    rust,
    node,
    JSON.parse(versions)
  )
}

if (import.meta.main) {
  const root = fileURLToPath(new URL('../../', import.meta.url))
  const toolchains = await readToolchains(root)
  if (process.env.GITHUB_OUTPUT)
    await appendFile(
      process.env.GITHUB_OUTPUT,
      Object.entries(toolchains)
        .map(([name, version]) => `${name}=${version}\n`)
        .join('')
    )
  else console.log(JSON.stringify(toolchains, null, 2))
}
