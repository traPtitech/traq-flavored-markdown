import { rename, rm } from 'node:fs/promises'
import path from 'node:path'

import { expect, test } from 'bun:test'

import { repositoryRoot } from '../paths.ts'
import { withTempDirectory } from '../testing/temp-directory.ts'
import {
  type GeneratedTargets,
  checkGenerated,
  generatedChanges
} from './generated.ts'

const generatedPath = (file: string) => path.relative(repositoryRoot, file)

test('generated checks detect changed, added and removed files', () => {
  expect(
    generatedChanges(
      new Map([
        ['changed.ts', 'before'],
        ['removed.ts', 'removed']
      ]),
      new Map([
        ['added.ts', 'added'],
        ['changed.ts', 'after']
      ])
    )
  ).toEqual(['~ changed.ts', '- removed.ts', '+ added.ts'])
})

test('generated checks compare isolated generated files', async () => {
  await withTempDirectory('generated-check-', async root => {
    const directory = path.join(root, 'typescript', 'generated')
    const artifact = path.join(directory, 'artifact.ts')
    const goArtifact = path.join(root, 'go', 'generated_artifact.go')
    const targets: GeneratedTargets = {
      directories: [directory],
      files: [goArtifact]
    }
    await Bun.write(artifact, 'artifact\n')
    await Bun.write(goArtifact, 'go artifact\n')

    await checkGenerated(async () => {}, targets)

    await expect(
      checkGenerated(async () => {
        await Bun.write(artifact, 'changed artifact\n')
      }, targets)
    ).rejects.toThrow('~ ' + generatedPath(artifact))
    await Bun.write(artifact, 'artifact\n')

    await rm(goArtifact)
    await expect(
      checkGenerated(async () => {
        await Bun.write(goArtifact, 'go artifact\n')
      }, targets)
    ).rejects.toThrow('+ ' + generatedPath(goArtifact))

    const added = path.join(directory, 'added.ts')
    await expect(
      checkGenerated(async () => {
        await Bun.write(added, 'added\n')
      }, targets)
    ).rejects.toThrow('+ ' + generatedPath(added))
    await rm(added)

    const removed = path.join(directory, 'removed.ts')
    await Bun.write(removed, 'removed\n')
    await expect(
      checkGenerated(async () => {
        await rm(removed)
      }, targets)
    ).rejects.toThrow('- ' + generatedPath(removed))

    const backup = path.join(path.dirname(directory), Bun.randomUUIDv7())
    let restored = false
    await rename(directory, backup)
    try {
      await expect(
        checkGenerated(async () => {
          await rename(backup, directory)
          restored = true
        }, targets)
      ).rejects.toThrow('+ ' + generatedPath(artifact))
    } finally {
      if (!restored) await rename(backup, directory)
    }
  })
})
