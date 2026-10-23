import { expect, test } from 'bun:test'

import {
  type ReleasePorts,
  inspectRelease,
  releasePlan,
  resumeRelease
} from './plan.ts'
import { goVersion, parseVersion } from './version.ts'

test('release resume checks remote state and only completes missing actions', async () => {
  const plan = releasePlan(
    parseVersion('v1.2.3-rc.1'),
    [
      { owner: 'core', name: 'core', directory: 'packages/core' },
      { owner: 'sdk', name: 'sdk', directory: 'packages/sdk' }
    ],
    [{ directory: 'packages/core/go', published: true }],
    ['generated.ts']
  )
  const events: string[] = []
  const ports: ReleasePorts = {
    npmVersion: async name => name === 'core',
    tagRevision: async tag => (tag === 'v1.2.3-rc.1' ? 'abc' : undefined),
    publishPackage: async name => {
      events.push('npm:' + name)
    },
    publishTag: async tag => {
      events.push('tag:' + tag)
    }
  }
  await resumeRelease(plan, 'abc', ports)
  expect(events).toEqual(['npm:sdk', 'tag:packages/core/go/v1.2.3-rc.1'])
  expect(plan.changedFiles).toContain('generated.ts')
  await expect(inspectRelease(plan, 'wrong', ports)).rejects.toThrow(
    'expected wrong'
  )
})

test('all release consumers use the same prerelease grammar', () => {
  expect(goVersion('v1.2.3-rc.1').npm).toBe('1.2.3-rc.1')
  for (const invalid of ['v1.2.3-01', 'v01.2.3', 'v1.2.3+build'])
    expect(() => parseVersion(invalid)).toThrow()
})
