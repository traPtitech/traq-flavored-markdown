import { cp } from 'node:fs/promises'
import path from 'node:path'

import { expect, test } from 'bun:test'

import { withTempDirectory } from '../infrastructure/temp-directory.ts'
import { repositoryRoot } from '../paths.ts'

test('build modules load before workspace packages have been built', async () => {
  await withTempDirectory('build-bootstrap-', async root => {
    // Copy sources without installed workspace links or existing dist artifacts.
    for (const directory of [
      'tools/workspace',
      'tools/contracts',
      'packages/sdk/scripts',
      'packages/sdk/typescript/src/generated'
    ])
      await cp(
        path.join(repositoryRoot, directory),
        path.join(root, directory),
        { recursive: true }
      )

    const child = Bun.spawn(
      [
        Bun.argv[0],
        '--no-install',
        '--eval',
        `
          import assert from 'node:assert/strict'
          const { buildWorkspace } = await import('./tools/workspace/build/workspace.ts')
          const { assembleSdk } = await import('./packages/sdk/scripts/build.ts')
          assert.equal(typeof buildWorkspace, 'function')
          assert.equal(typeof assembleSdk, 'function')
        `
      ],
      { cwd: root, stdout: 'pipe', stderr: 'pipe' }
    )
    const [exitCode, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text()
    ])
    expect({ exitCode, stdout, stderr }).toEqual({
      exitCode: 0,
      stdout: '',
      stderr: ''
    })
  })
})
