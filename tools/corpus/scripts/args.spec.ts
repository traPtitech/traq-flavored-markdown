import path from 'path'

import { expect, test } from 'bun:test'

import { repositoryRoot } from '../../../scripts/paths.ts'
import { resolveRepositoryPath } from './args.ts'

test('corpus command paths stay repository-relative through --cwd', () => {
  const sample = path.join(repositoryRoot, '.private', 'corpora', 'sample')
  expect(resolveRepositoryPath('.private/corpora/sample')).toBe(sample)
  expect(resolveRepositoryPath(sample)).toBe(sample)
})
