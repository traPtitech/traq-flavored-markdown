import path from 'node:path'

import { expect, test } from 'bun:test'

import { withTempDirectory } from '../../workspace/infrastructure/temp-directory.ts'
import {
  OutputManifest,
  applyOutputManifest,
  readOutputIndex
} from '../io/output-manifest.ts'

test('output replacement removes retired managed files and preserves user files', async () => {
  await withTempDirectory('manifest-test-', async root => {
    await Bun.write(path.join(root, 'notes.txt'), 'user content')

    await applyOutputManifest(
      root,
      new OutputManifest().add('core', 'generated/old.txt', 'old')
    )

    await applyOutputManifest(
      root,
      new OutputManifest().add('core', 'generated/new.txt', 'new')
    )

    expect(await Bun.file(path.join(root, 'generated/old.txt')).exists()).toBe(
      false
    )

    expect(await Bun.file(path.join(root, 'generated/new.txt')).text()).toBe(
      'new'
    )

    expect(await Bun.file(path.join(root, 'notes.txt')).text()).toBe(
      'user content'
    )

    expect((await readOutputIndex(root)).outputs).toEqual([
      { owner: 'core', path: 'generated/new.txt' }
    ])
  })
})

test('output manifest rejects duplicate and escaping paths', () => {
  const plan = new OutputManifest().add('core', 'x.txt', 'x')
  expect(() => plan.add('core', 'x.txt', 'y')).toThrow('Duplicate')
  expect(() => plan.add('core', '../outside.txt', 'x')).toThrow('Invalid')
  expect(() => plan.add('sdk', 'X.txt', 'x')).toThrow('Duplicate')
})

test('ownership conflicts fail before changing any selected output', async () => {
  await withTempDirectory('manifest-conflict-', async root => {
    await applyOutputManifest(
      root,
      new OutputManifest().add('core', 'shared.txt', 'owned')
    )

    const plan = new OutputManifest()
      .add('sdk', 'new.txt', 'new')
      .add('sdk', 'shared.txt', 'replacement')

    await expect(applyOutputManifest(root, plan)).rejects.toThrow(
      'ownership conflict'
    )

    expect(await Bun.file(path.join(root, 'shared.txt')).text()).toBe('owned')
    expect(await Bun.file(path.join(root, 'new.txt')).exists()).toBe(false)

    expect((await readOutputIndex(root)).outputs).toEqual([
      { owner: 'core', path: 'shared.txt' }
    ])
  })
})

test('formatting failure preserves the previous complete output set', async () => {
  await withTempDirectory('manifest-format-', async root => {
    await applyOutputManifest(
      root,
      new OutputManifest().add('core', 'old.txt', 'old')
    )

    await expect(
      applyOutputManifest(
        root,
        new OutputManifest()
          .add('core', 'first.txt', 'first')
          .add('core', 'invalid.ts', 'export const =')
      )
    ).rejects.toThrow()

    expect(await Bun.file(path.join(root, 'old.txt')).text()).toBe('old')
    expect(await Bun.file(path.join(root, 'first.txt')).exists()).toBe(false)
  })
})

test('an empty selected owner retires its outputs and snapshots cannot mutate plans', async () => {
  await withTempDirectory('manifest-empty-', async root => {
    const plan = new OutputManifest().add('core', 'old.txt', 'old')
    const snapshot = plan.outputs as Map<string, unknown>
    snapshot.clear()
    expect(plan.outputs.size).toBe(1)
    await applyOutputManifest(root, plan)
    await applyOutputManifest(root, new OutputManifest().own('core'))
    expect(await Bun.file(path.join(root, 'old.txt')).exists()).toBe(false)
  })
})
