import path from 'node:path'

import { expect, test } from 'bun:test'

import { withTempDirectory } from '../testing/temp-directory.ts'
import { cleanBuildOutput } from './outputs.ts'

test('TypeScript cleanup retires moved modules while retaining assembly artifacts', async () => {
  await withTempDirectory('build-outputs-', async root => {
    await cleanBuildOutput(root, 'typescript')
    for (const file of [
      'generated/old.js',
      'generated/old.d.ts',
      'old.js.map',
      'parser.wasm',
      'index.css',
      'contract.json'
    ])
      await Bun.write(path.join(root, 'dist', file), 'fixture')
    await cleanBuildOutput(root, 'typescript')
    expect(
      await Bun.file(path.join(root, 'dist/generated/old.js')).exists()
    ).toBe(false)
    expect(
      await Bun.file(path.join(root, 'dist/generated/old.d.ts')).exists()
    ).toBe(false)
    for (const file of ['parser.wasm', 'index.css', 'contract.json'])
      expect(await Bun.file(path.join(root, 'dist', file)).text()).toBe(
        'fixture'
      )
  })
})
