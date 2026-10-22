import path from 'path'

import { $ } from 'bun'

import { repositoryRoot } from '../paths.ts'

export const readManifest = async <T>(
  directory: string,
  parse: (value: unknown) => T
): Promise<T> =>
  parse(await Bun.file(path.join(directory, 'contracts.json')).json())

export const runCommand = (command: string[], cwd = repositoryRoot) =>
  $`${command[0]} ${command.slice(1)}`.cwd(cwd)
