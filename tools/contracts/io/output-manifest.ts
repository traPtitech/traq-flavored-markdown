import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { withTempDirectory } from '../../workspace/infrastructure/temp-directory.ts'
import {
  type PackageName,
  packageNames,
  repositoryRoot
} from '../../workspace/paths.ts'

export const outputIndex = '.generated-outputs.json'

export type Output = Readonly<{
  owner: PackageName
  path: string
  source: string
}>

type OutputIndex = { version: 1; outputs: Omit<Output, 'source'>[] }

function outputPath(relative: string): string {
  const normalized = relative.replaceAll('\\', '/')
  if (
    path.isAbsolute(normalized) ||
    /[:\0]/.test(normalized) ||
    normalized.split('/').some(part => part === '..' || part === '.' || !part)
  ) {
    throw new Error('Invalid generated output path: ' + relative)
  }

  return normalized
}

/** A complete, deterministic set of generated sources for the selected owners. */
export class OutputManifest {
  readonly #outputs = new Map<string, Output>()
  readonly #owners = new Set<PackageName>()

  get outputs(): ReadonlyMap<string, Output> {
    return new Map(this.#outputs)
  }

  get owners(): ReadonlySet<PackageName> {
    return new Set(this.#owners)
  }

  own(owner: PackageName) {
    if (!packageNames.includes(owner)) {
      throw new Error('Unknown output owner: ' + owner)
    }

    this.#owners.add(owner)
    return this
  }

  add(owner: PackageName, relative: string, source: string) {
    const normalized = outputPath(relative)

    if (
      [...this.#outputs.keys()].some(
        existing => existing.toLowerCase() === normalized.toLowerCase()
      )
    ) {
      throw new Error('Duplicate generated output: ' + normalized)
    }

    this.own(owner)

    this.#outputs.set(
      normalized,
      Object.freeze({ owner, path: normalized, source })
    )

    return this
  }

  merge(other: OutputManifest) {
    for (const output of other.outputs.values()) {
      this.add(output.owner, output.path, output.source)
    }

    for (const owner of other.owners) this.own(owner)
    return this
  }
}

export async function readOutputIndex(root: string): Promise<OutputIndex> {
  try {
    const index = JSON.parse(
      await readFile(path.join(root, outputIndex), 'utf8')
    ) as OutputIndex
    if (index.version !== 1 || !Array.isArray(index.outputs)) {
      throw new Error('Invalid generated output index')
    }

    const paths = new Set<string>()

    for (const output of index.outputs) {
      if (
        !output ||
        !packageNames.includes(output.owner) ||
        typeof output.path !== 'string'
      ) {
        throw new Error('Invalid generated output owner or path')
      }

      const normalized = outputPath(output.path)
      if (normalized !== output.path || paths.has(normalized.toLowerCase())) {
        throw new Error('Duplicate or noncanonical generated output path')
      }

      paths.add(normalized.toLowerCase())
    }

    return index
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { version: 1, outputs: [] }
    }

    throw error
  }
}

function destination(root: string, relative: string) {
  const result = path.resolve(root, relative)
  if (!result.startsWith(path.resolve(root) + path.sep)) {
    throw new Error('Generated output escapes workspace: ' + relative)
  }

  return result
}

/** Format in memory/staging, then replace only files recorded as generator-owned. */
export async function applyOutputManifest(
  root: string,
  manifest: OutputManifest
) {
  const previous = await readOutputIndex(root)
  const owned = manifest.owners
  const planned = manifest.outputs

  const outputs = [...planned.values()].sort((a, b) =>
    a.path.localeCompare(b.path, 'en')
  )

  const previousOwners = new Map(
    previous.outputs.map(output => [output.path.toLowerCase(), output])
  )

  for (const output of outputs) {
    const previous = previousOwners.get(output.path.toLowerCase())
    if (
      previous &&
      (previous.owner !== output.owner || previous.path !== output.path)
    ) {
      throw new Error('Generated output ownership conflict: ' + output.path)
    }
  }

  const prettier = await import('prettier')

  const config = await prettier.resolveConfig(
    path.join(repositoryRoot, 'prettier.config.ts')
  )

  await withTempDirectory('generated-output-', async staging => {
    for (const output of outputs) {
      let source = output.source

      if (output.path.endsWith('.ts')) {
        source = await prettier.format(source, {
          ...config,
          parser: 'typescript'
        })
      }

      if (output.path.endsWith('.go')) {
        const formatter = Bun.spawn(['gofmt'], {
          stdin: new Blob([source]),
          stdout: 'pipe',
          stderr: 'pipe'
        })

        const [formatted, errors, status] = await Promise.all([
          new Response(formatter.stdout).text(),
          new Response(formatter.stderr).text(),
          formatter.exited
        ])
        if (status !== 0) throw new Error(`gofmt ${output.path}: ${errors}`)

        source = formatted
      }

      await Bun.write(destination(staging, output.path), source)
    }

    for (const output of outputs) {
      const target = destination(root, output.path)
      await mkdir(path.dirname(target), { recursive: true })

      // Rename atomically on a volume; temp storage may be on another volume.
      try {
        await rename(destination(staging, output.path), target)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error

        await Bun.write(target, Bun.file(destination(staging, output.path)))
      }
    }
  })

  for (const output of previous.outputs) {
    if (owned.has(output.owner) && !planned.has(output.path)) {
      await rm(destination(root, output.path), { force: true })
    }
  }

  const retained = previous.outputs.filter(output => !owned.has(output.owner))

  const index: OutputIndex = {
    version: 1,
    outputs: [
      ...retained,
      ...outputs.map(({ owner, path }) => ({ owner, path }))
    ].sort((a, b) => a.path.localeCompare(b.path, 'en'))
  }

  await writeFile(
    path.join(root, outputIndex),
    JSON.stringify(index, null, 2) + '\n'
  )

  return outputs.map(output => destination(root, output.path))
}
