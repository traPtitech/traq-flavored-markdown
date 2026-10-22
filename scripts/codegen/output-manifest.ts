import { mkdir, readFile, rename, rm } from 'node:fs/promises'
import path from 'node:path'

import { type PackageName, repositoryRoot } from '../paths.ts'
import { withTempDirectory } from '../testing/temp-directory.ts'

export const outputIndex = '.generated-outputs.json'
export type Output = { owner: PackageName; path: string; source: string }
type OutputIndex = { version: 1; outputs: Omit<Output, 'source'>[] }

/** A complete, deterministic set of generated sources for the selected owners. */
export class OutputManifest {
  readonly outputs = new Map<string, Output>()
  readonly owners = new Set<PackageName>()

  add(owner: PackageName, relative: string, source: string) {
    const normalized = relative.replaceAll('\\', '/')
    if (
      path.isAbsolute(normalized) ||
      normalized.split('/').some(part => part === '..' || !part)
    )
      throw new Error('Invalid generated output path: ' + relative)
    if (this.outputs.has(normalized))
      throw new Error('Duplicate generated output: ' + normalized)
    this.outputs.set(normalized, { owner, path: normalized, source })
    this.owners.add(owner)
    return this
  }

  merge(other: OutputManifest) {
    for (const output of other.outputs.values())
      this.add(output.owner, output.path, output.source)
    for (const owner of other.owners) this.owners.add(owner)
    return this
  }
}

export async function readOutputIndex(root: string): Promise<OutputIndex> {
  try {
    const index = JSON.parse(
      await readFile(path.join(root, outputIndex), 'utf8')
    ) as OutputIndex
    if (index.version !== 1 || !Array.isArray(index.outputs))
      throw new Error('Invalid generated output index')
    return index
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      return { version: 1, outputs: [] }
    throw error
  }
}

function destination(root: string, relative: string) {
  const result = path.resolve(root, relative)
  if (!result.startsWith(path.resolve(root) + path.sep))
    throw new Error('Generated output escapes workspace: ' + relative)
  return result
}

/** Format in memory/staging, then replace only files recorded as generator-owned. */
export async function applyOutputManifest(
  root: string,
  manifest: OutputManifest
) {
  const previous = await readOutputIndex(root)
  const outputs = [...manifest.outputs.values()].sort((a, b) =>
    a.path.localeCompare(b.path, 'en')
  )
  const prettier = await import('prettier')
  const config = await prettier.resolveConfig(
    path.join(repositoryRoot, 'prettier.config.ts')
  )
  await withTempDirectory('generated-output-', async staging => {
    for (const output of outputs) {
      let source = output.source
      if (output.path.endsWith('.ts'))
        source = await prettier.format(source, {
          ...config,
          parser: 'typescript'
        })
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
    if (manifest.owners.has(output.owner) && !manifest.outputs.has(output.path))
      await rm(destination(root, output.path), { force: true })
  }
  const retained = previous.outputs.filter(
    output => !manifest.owners.has(output.owner)
  )
  const index: OutputIndex = {
    version: 1,
    outputs: [
      ...retained,
      ...outputs.map(({ owner, path }) => ({ owner, path }))
    ].sort((a, b) => a.path.localeCompare(b.path, 'en'))
  }
  await Bun.write(
    path.join(root, outputIndex),
    JSON.stringify(index, null, 2) + '\n'
  )
  return outputs.map(output => destination(root, output.path))
}
