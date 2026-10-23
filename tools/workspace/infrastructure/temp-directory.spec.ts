import { access, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { expect, test } from 'bun:test'

import { withTempDirectory } from './temp-directory.ts'

test('temporary directory cleanup survives failed operations and nested files', async () => {
  let created = ''
  const result = withTempDirectory('temporary-lifecycle-', async directory => {
    created = directory
    const nested = path.join(directory, 'nested')
    await mkdir(nested)
    await writeFile(path.join(nested, 'content.txt'), 'fixture')
    throw new Error('operation failed')
  })
  await expect(result).rejects.toThrow('operation failed')
  await expect(access(created)).rejects.toThrow()
})
