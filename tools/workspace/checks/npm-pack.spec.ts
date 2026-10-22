import { expect, test } from 'bun:test'

import { readNpmPack } from './npm-pack.ts'

const name = '@traq-flavored-markdown/core'
const packed = {
  name,
  filename: 'traq-flavored-markdown-core-0.1.7.tgz',
  files: [{ path: 'dist/index.js' }]
}

test('reads the npm 11 pack array', () => {
  expect(readNpmPack(JSON.stringify([packed]), name)).toEqual(packed)
})

test('selects the requested package from npm 12 pack output', () => {
  const output = {
    other: { ...packed, name: 'other', filename: 'other.tgz' },
    [name]: packed
  }
  expect(readNpmPack(JSON.stringify(output), name)).toEqual(packed)
})

test('rejects missing packages and incomplete pack metadata', () => {
  for (const output of [
    [],
    {},
    null,
    { [name]: { ...packed, name: 'other' } },
    { [name]: { ...packed, filename: null } },
    { [name]: { ...packed, files: [{}] } }
  ])
    expect(() => readNpmPack(JSON.stringify(output), name)).toThrow(
      'npm pack did not return a valid package'
    )
})
