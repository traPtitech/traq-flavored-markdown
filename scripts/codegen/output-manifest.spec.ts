import path from 'node:path'

import { expect, test } from 'bun:test'

import { withTempDirectory } from '../testing/temp-directory.ts'
import {
  OutputManifest,
  applyOutputManifest,
  readOutputIndex
} from './output-manifest.ts'

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
})
