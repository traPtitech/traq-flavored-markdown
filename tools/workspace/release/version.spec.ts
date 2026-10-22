import { expect, test } from 'bun:test'

import { incrementVersion } from './version.ts'

test('stable release increments preserve the shared version grammar', () => {
  expect(incrementVersion('v1.2.3', 'patch').tag).toBe('v1.2.4')
  expect(incrementVersion('1.2.3', 'minor').npm).toBe('1.3.0')
  expect(incrementVersion('1.2.3', 'major').npm).toBe('2.0.0')
  expect(incrementVersion('1.2.9007199254740991', 'patch').npm).toBe(
    '1.2.9007199254740992'
  )
  expect(() => incrementVersion('1.2.3-rc.1', 'patch')).toThrow('stable')
  expect(() => incrementVersion('01.2.3', 'patch')).toThrow('Invalid')
  expect(() => incrementVersion('1.2.3', 'rc')).toThrow('component')
})
