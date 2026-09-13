import path from 'node:path'

import { expect, test } from 'bun:test'

import { packageRoot } from './paths.ts'
import { parseRelease, validateRelease } from './release.ts'

test('release selectors choose the matching stable or prerelease dist-tag', () => {
  const stable = parseRelease(['core@1.2.3'])
  expect(stable).toEqual({
    name: 'core',
    version: '1.2.3',
    tag: 'latest',
    mode: 'dry-run'
  })
  expect(parseRelease(['sdk@1.2.3-rc.1', '--publish'])).toEqual({
    name: 'sdk',
    version: '1.2.3-rc.1',
    tag: 'next',
    mode: 'publish'
  })
})

test('release validation requires the current package manifest', async () => {
  const manifest = (await Bun.file(
    path.join(packageRoot('core'), 'package.json')
  ).json()) as { version: string }
  const current = parseRelease([`core@${manifest.version}`])
  await expect(validateRelease(current)).resolves.toBeUndefined()

  const differentVersion = manifest.version === '0.0.0' ? '0.0.1' : '0.0.0'
  await expect(
    validateRelease({ ...current, version: differentVersion })
  ).rejects.toThrow('release selector does not match core manifest')
})

test('release selectors reject invalid input', () => {
  for (const selector of [
    'unknown@0.1.0',
    'core@01.1.0',
    'core@0.1',
    'core@0.1.0-beta.01',
    'core@0.1.0+build.7',
    'core@0.1.0@next',
    'toString@0.1.0'
  ])
    expect(() => parseRelease([selector])).toThrow('usage:')
  expect(() => parseRelease([])).toThrow('usage:')
  expect(() => parseRelease(['core@0.1.0', '--invalid'])).toThrow('usage:')
  expect(() => parseRelease(['core@0.1.0', '--check', '--publish'])).toThrow(
    'usage:'
  )
})
