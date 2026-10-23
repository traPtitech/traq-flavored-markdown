import path from 'node:path'

import { $ } from 'bun'
import { expect, test } from 'bun:test'

import { withTempDirectory } from '../infrastructure/temp-directory.ts'
import {
  type GeneratedTargets,
  checkGenerated,
  generatedChanges
} from './generated.ts'

test('owner checks ignore unrelated artifacts while detecting added and retired owned outputs', async () => {
  await withTempDirectory('generated-owner-', async root => {
    const write = async (directory: string, files: string[]) => {
      await Bun.write(
        path.join(directory, '.generated-outputs.json'),
        JSON.stringify({
          version: 1,
          outputs: files.map(file => ({
            owner: file.startsWith('core') ? 'core' : 'sdk',
            path: file
          }))
        })
      )
      for (const file of files)
        await Bun.write(path.join(directory, file), file)
    }
    await write(root, ['core.ts', 'sdk.ts'])
    await checkGenerated(
      output => write(output, ['core.ts']),
      undefined,
      root,
      'core'
    )
    await expect(
      checkGenerated(
        output => write(output, ['core-new.ts']),
        undefined,
        root,
        'core'
      )
    ).rejects.toThrow('- core.ts')
    await expect(
      checkGenerated(
        output => write(output, ['core.ts', 'core-new.ts']),
        undefined,
        root,
        'core'
      )
    ).rejects.toThrow('+ core-new.ts')
  })
})

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

test('generated checks compare isolated files without modifying the source', async () => {
  await withTempDirectory('generated-source-', async root => {
    const directory = path.join('typescript', 'src', 'generated')
    const artifact = path.join(directory, 'artifact.ts')
    const goArtifact = path.join('go', 'generated_artifact.go')
    const targets: GeneratedTargets = {
      directories: [directory],
      files: [goArtifact]
    }
    await Bun.write(path.join(root, artifact), 'artifact\n')
    await Bun.write(path.join(root, goArtifact), 'go artifact\n')

    const writeExpected = async (
      outputRoot: string,
      artifactContent = 'artifact\n'
    ) => {
      await Bun.write(path.join(outputRoot, artifact), artifactContent)
      await Bun.write(path.join(outputRoot, goArtifact), 'go artifact\n')
    }

    await checkGenerated(writeExpected, targets, root)

    await expect(
      checkGenerated(
        outputRoot => writeExpected(outputRoot, 'changed artifact\n'),
        targets,
        root
      )
    ).rejects.toThrow('~ ' + artifact)
    expect(await Bun.file(path.join(root, artifact)).text()).toBe('artifact\n')

    const added = path.join(directory, 'added.ts')
    await expect(
      checkGenerated(
        async outputRoot => {
          await writeExpected(outputRoot)
          await Bun.write(path.join(outputRoot, added), 'added\n')
        },
        targets,
        root
      )
    ).rejects.toThrow('+ ' + added)
    expect(await Bun.file(path.join(root, added)).exists()).toBe(false)

    await expect(
      checkGenerated(
        async outputRoot => {
          await Bun.write(path.join(outputRoot, goArtifact), 'go artifact\n')
        },
        targets,
        root
      )
    ).rejects.toThrow('- ' + artifact)
    expect(await Bun.file(path.join(root, artifact)).text()).toBe('artifact\n')
  })
})

test('snapshots compare output formatted by another process', async () => {
  await withTempDirectory('generated-format-', async root => {
    const artifact = 'artifact.ts'
    await Bun.write(path.join(root, artifact), '// original\n'.repeat(4096))
    await expect(
      checkGenerated(
        async outputRoot => {
          await $`${Bun.argv[0]} -e ${'require("node:fs").writeFileSync(process.argv.at(-1), "// formatted\\n")'} ${path.join(outputRoot, artifact)}`.quiet()
        },
        { directories: [], files: [artifact] },
        root
      )
    ).rejects.toThrow('~ ' + artifact)
    expect(await Bun.file(path.join(root, artifact)).text()).toBe(
      '// original\n'.repeat(4096)
    )
  })
})
