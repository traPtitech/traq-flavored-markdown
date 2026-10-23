import path from 'node:path'

import { repositoryRoot } from '../../workspace/paths.ts'

/** Command paths remain repository-relative when root scripts delegate via --cwd. */
export const resolveRepositoryPath = (value: string) =>
  path.resolve(repositoryRoot, value)
