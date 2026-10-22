import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import path from 'path'

import { outputIndex, readOutputIndex } from '../codegen/output-manifest.ts'
import { generateBindings } from '../generate-bindings.ts'
import { repositoryRoot } from '../paths.ts'
import { withTempDirectory } from '../testing/temp-directory.ts'

export type GeneratedTargets = {
  directories: string[]
  files: string[]
}

const indexedTargets = async (root: string): Promise<GeneratedTargets> => ({
  directories: [],
  files: [
    outputIndex,
    ...(await readOutputIndex(root)).outputs.map(output => output.path)
  ]
})

const hasDirectory = async (directory: string) => {
  try {
    return (await stat(directory)).isDirectory()
  } catch (error) {
    if ((error as { code?: string }).code === 'ENOENT') return false
    throw error
  }
}

const snapshot = async (
  root: string,
  { directories, files: targetFiles }: GeneratedTargets
) => {
  const snapshotFiles = new Map<string, string>()
  const capture = async (relative: string) => {
    try {
      const hash = createHash('sha256')
      for await (const chunk of createReadStream(path.join(root, relative)))
        hash.update(chunk)
      snapshotFiles.set(relative, hash.digest('hex'))
    } catch (error) {
      if ((error as { code?: string }).code !== 'ENOENT') throw error
    }
  }
  for (const file of targetFiles) await capture(file)
  for (const directory of directories) {
    const absolute = path.join(root, directory)
    if (await hasDirectory(absolute))
      for await (const relative of new Bun.Glob('**/*').scan({
        cwd: absolute,
        onlyFiles: true
      })) {
        await capture(path.join(directory, relative))
      }
  }
  return snapshotFiles
}

export const generatedChanges = (
  before: ReadonlyMap<string, string>,
  after: ReadonlyMap<string, string>
) =>
  [...new Set([...before.keys(), ...after.keys()])]
    .filter(file => before.get(file) !== after.get(file))
    .map(file =>
      !before.has(file)
        ? '+ ' + file
        : !after.has(file)
          ? '- ' + file
          : '~ ' + file
    )

export async function checkGenerated(
  generate: (outputRoot: string) => Promise<void> = outputRoot =>
    generateBindings(undefined, undefined, outputRoot),
  targets?: GeneratedTargets,
  sourceRoot = repositoryRoot
) {
  const source = await snapshot(
    sourceRoot,
    targets ?? (await indexedTargets(sourceRoot))
  )
  await withTempDirectory('generated-check-', async outputRoot => {
    await generate(outputRoot)
    const expected = await snapshot(
      outputRoot,
      targets ?? (await indexedTargets(outputRoot))
    )
    const changes = generatedChanges(source, expected)
    if (changes.length)
      throw new Error(`Generated files are out of date:\n${changes.join('\n')}`)
  })
}

if (Bun.main === Bun.fileURLToPath(import.meta.url)) await checkGenerated()
