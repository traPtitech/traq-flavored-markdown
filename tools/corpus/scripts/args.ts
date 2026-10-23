import path from 'path'

import { repositoryRoot } from '../../../tools/workspace/paths.ts'

type Option =
  | { type: 'string'; default?: string }
  | { type: 'number'; default?: number; integer?: boolean; min?: number }
  | { type: 'boolean'; default?: boolean }
type Value<O extends Option> = O extends { type: 'number' }
  ? number
  : O extends { type: 'boolean' }
    ? boolean
    : string

// Root commands use --cwd tools/corpus, but their documented paths are root-relative.
export const resolveRepositoryPath = (value: string) =>
  path.resolve(repositoryRoot, value)

export function parseArgs<const Options extends Record<string, Option>>({
  options,
  args = Bun.argv.slice(2)
}: {
  options: Options
  args?: string[]
}) {
  const values: Record<string, string | number | boolean | undefined> =
    Object.fromEntries(
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
    const option = options[name]
    const value = inline.length
      ? inline.join('=')
      : option.type === 'boolean'
        ? 'true'
        : args[++i]
    if (value === undefined || (!inline.length && value.startsWith('--')))
      throw new Error(`Option --${name} requires a value`)
    if (option.type === 'number') {
      const number = value.trim() ? Number(value) : NaN
      if (
        !Number.isFinite(number) ||
        (option.integer && !Number.isSafeInteger(number)) ||
        (option.min !== undefined && number < option.min)
      )
        throw new Error(
          `Option --${name} requires ${option.integer ? 'an integer' : 'a number'}${option.min !== undefined ? ` >= ${option.min}` : ''}`
        )
      values[name] = number
    } else if (option.type === 'boolean') {
      if (value !== 'true' && value !== 'false')
        throw new Error(`Option --${name} requires true or false`)
      values[name] = value === 'true'
    } else values[name] = value
  }
  return {
    values: values as { [K in keyof Options]: Value<Options[K]> | undefined }
  }
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
