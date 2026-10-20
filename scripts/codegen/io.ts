import path from 'path'

import { $ } from 'bun'

import { repositoryRoot } from '../paths.ts'

export const readManifest = <T>(directory: string) =>
  Bun.file(path.join(directory, 'contracts.json')).json() as Promise<T>

export const runCommand = (command: string[], cwd = repositoryRoot) =>
  $`${command[0]} ${command.slice(1)}`.cwd(cwd)
