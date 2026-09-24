import path from 'path'

import { $ } from 'bun'

import { repositoryRoot } from '../paths.ts'

export const readManifest = <T>(directory: string) =>
  Bun.file(path.join(directory, 'contracts.json')).json() as Promise<T>

export const runCommand = (command: string[], cwd = repositoryRoot) =>
  $`${command[0]} ${command.slice(1)}`.cwd(cwd)

export async function writeFiles(
  root: string,
  files: Map<string, string>,
  ...prefix: string[]
) {
  const paths: string[] = []
  for (const [name, source] of files) {
    const output = path.join(root, ...prefix, name)
    await Bun.write(output, source)
    paths.push(output)
  }
  return paths
}

export async function formatTypescript(paths: string[]) {
  if (!paths.length) return
  await runCommand([
    Bun.argv[0],
    'run',
    'prettier',
    '--write',
    '--config',
    path.join(repositoryRoot, 'prettier.config.ts'),
    '--ignore-path',
    path.join(repositoryRoot, '.gitignore'),
    ...paths
  ])
}
