import path from 'path'

import { repositoryRoot } from '../../../scripts/paths.ts'

type Option = { default?: string; type?: string }

// Root commands use --cwd tools/corpus, but their documented paths are root-relative.
export const resolveRepositoryPath = (value: string) =>
  path.resolve(repositoryRoot, value)

export function parseArgs({
  options = {},
  args = Bun.argv.slice(2)
}: {
  options?: Record<string, Option>
  args?: string[]
} = {}) {
  const values = Object.fromEntries(
    Object.entries(options)
      .filter(([, option]) => option.default !== undefined)
      .map(([name, option]) => [name, option.default])
  )
  for (let i = 0; i < args.length; i++) {
    const argument = args[i]
    if (!argument.startsWith('--'))
      throw new Error(`Unknown argument: ${argument}`)
    const [name, ...inline] = argument.slice(2).split('=')
    if (!name || !options[name]) throw new Error(`Unknown argument: --${name}`)
    const value = inline.length ? inline.join('=') : args[++i]
    if (value === undefined || (!inline.length && value.startsWith('--')))
      throw new Error(`Option --${name} requires a value`)
    values[name] = value
  }
  return { values }
}

export function parseEnv(source: string) {
  const values: Record<string, string> = {}
  for (const [index, line] of source.split(/\r?\n/).entries()) {
    const value = line.trim()
    if (!value || value.startsWith('#')) continue
    const match = value.match(
      /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/
    )
    if (!match)
      throw new Error(`Invalid environment entry on line ${index + 1}`)
    let parsed = match[2]
    if (parsed.startsWith('"') || parsed.startsWith("'")) {
      const quote = parsed[0]
      if (!parsed.endsWith(quote))
        throw new Error(`Invalid environment entry on line ${index + 1}`)
      parsed = parsed.slice(1, -1)
      if (quote === '"') parsed = JSON.parse('"' + parsed + '"')
    } else {
      parsed = parsed.replace(/\s+#.*$/, '').trim()
    }
    values[match[1]] = parsed
  }
  return values
}
