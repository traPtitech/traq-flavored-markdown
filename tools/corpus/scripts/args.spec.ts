import path from 'path'

import { expect, test } from 'bun:test'

import { repositoryRoot } from '../../../scripts/paths.ts'
import { parseArgs, resolveRepositoryPath } from './args.ts'

test('corpus command paths stay repository-relative through --cwd', () => {
  const sample = path.join(repositoryRoot, '.private', 'corpora', 'sample')
  expect(resolveRepositoryPath('.private/corpora/sample')).toBe(sample)
  expect(resolveRepositoryPath(sample)).toBe(sample)
})

test('corpus arguments validate numeric bounds and explicit boolean values', () => {
  const options = {
    max: { type: 'number', integer: true, min: 1, default: 100 },
    verbose: { type: 'boolean' }
  } as const
  expect(
    parseArgs({ options, args: ['--max=20', '--verbose=false'] }).values
  ).toEqual({ max: 20, verbose: false })
  for (const value of ['NaN', 'Infinity', '0', '-2', '1.5', ''])
    expect(() => parseArgs({ options, args: [`--max=${value}`] })).toThrow(
      'Option --max'
    )
  expect(() => parseArgs({ options, args: ['--verbose=maybe'] })).toThrow(
    'true or false'
  )
  expect(() => parseArgs({ options, args: ['--max'] })).toThrow(
    'requires a value'
  )
  expect(() => parseArgs({ options, args: ['--unknown'] })).toThrow(
    'Unknown argument'
  )
})
