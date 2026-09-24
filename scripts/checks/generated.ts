import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import path from 'path'

import { generateBindings } from '../generate-bindings.ts'
import { packageRoot, repositoryRoot } from '../paths.ts'
import { withTempDirectory } from '../testing/temp-directory.ts'

export type GeneratedTargets = {
  directories: string[]
  files: string[]
}

const generatedTargets: GeneratedTargets = {
  directories: [
    path.join(packageRoot('commonmark-plugin'), 'typescript', 'generated'),
    path.join(packageRoot('traq-plugin'), 'typescript', 'generated'),
    path.join(packageRoot('sdk'), 'typescript', 'generated')
  ].map(file => path.relative(repositoryRoot, file)),
  files: [
    path.join(packageRoot('commonmark-plugin'), 'go', 'generated_nodes.go'),
    path.join(
      packageRoot('commonmark-plugin'),
      'go',
      'generic',
      'generated_nodes.go'
    ),
    path.join(packageRoot('traq-plugin'), 'go', 'generated_nodes.go'),
    path.join(packageRoot('sdk'), 'go', 'generated_artifact.go'),
    path.join(packageRoot('sdk'), 'go', 'generated_nodes.go'),
    path.join(packageRoot('sdk'), 'go', 'generated_presets.go'),
    path.join(packageRoot('sdk'), 'go', 'generated_processing.go')
  ].map(file => path.relative(repositoryRoot, file))
}

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
  targets: GeneratedTargets = generatedTargets,
  sourceRoot = repositoryRoot
) {
  const source = await snapshot(sourceRoot, targets)
  await withTempDirectory('generated-check-', async outputRoot => {
    await generate(outputRoot)
    const expected = await snapshot(outputRoot, targets)
    const changes = generatedChanges(source, expected)
    if (changes.length)
      throw new Error(`Generated files are out of date:\n${changes.join('\n')}`)
  })
}

if (Bun.main === Bun.fileURLToPath(import.meta.url)) await checkGenerated()
