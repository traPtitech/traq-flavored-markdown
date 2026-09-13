import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import path from 'path'

import { generateBindings } from '../generate-bindings.ts'
import { packageRoot, repositoryRoot } from '../paths.ts'

export type GeneratedTargets = {
  directories: string[]
  files: string[]
}

const generatedTargets: GeneratedTargets = {
  directories: [
    path.join(packageRoot('commonmark'), 'typescript', 'generated'),
    path.join(packageRoot('trap-extension'), 'typescript', 'generated'),
    path.join(packageRoot('traq'), 'typescript', 'generated')
  ],
  files: [
    path.join(packageRoot('commonmark'), 'go', 'generated_nodes.go'),
    path.join(packageRoot('commonmark'), 'go', 'generic', 'generated_nodes.go'),
    path.join(packageRoot('trap-extension'), 'go', 'generated_nodes.go'),
    path.join(packageRoot('traq'), 'go', 'generated_artifact.go'),
    path.join(packageRoot('traq'), 'go', 'generated_nodes.go'),
    path.join(packageRoot('traq'), 'go', 'generated_presets.go'),
    path.join(packageRoot('traq'), 'go', 'generated_processing.go')
  ]
}

const hasDirectory = async (directory: string) => {
  try {
    return (await stat(directory)).isDirectory()
  } catch (error) {
    if ((error as { code?: string }).code === 'ENOENT') return false
    throw error
  }
}

const snapshot = async ({
  directories,
  files: targetFiles
}: GeneratedTargets) => {
  const snapshotFiles = new Map<string, string>()
  // Retain content hashes, not file-backed strings, across generator rewrites.
  const capture = async (file: string) => {
    try {
      const hash = createHash('sha256')
      for await (const chunk of createReadStream(file)) hash.update(chunk)
      snapshotFiles.set(path.relative(repositoryRoot, file), hash.digest('hex'))
    } catch (error) {
      if ((error as { code?: string }).code !== 'ENOENT') throw error
    }
  }
  for (const file of targetFiles) await capture(file)
  for (const directory of directories)
    if (await hasDirectory(directory))
      for await (const relative of new Bun.Glob('**/*').scan({
        cwd: directory,
        onlyFiles: true
      })) {
        const file = path.join(directory, relative)
        await capture(file)
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
  generate: () => Promise<void> = generateBindings,
  targets: GeneratedTargets = generatedTargets
) {
  const before = await snapshot(targets)
  await generate()
  const after = await snapshot(targets)
  const changes = generatedChanges(before, after)
  if (changes.length)
    throw new Error(`Generated files are out of date:\n${changes.join('\n')}`)
}

if (Bun.main === Bun.fileURLToPath(import.meta.url)) await checkGenerated()
