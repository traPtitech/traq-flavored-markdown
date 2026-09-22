import path from 'node:path'

import { repositoryRoot } from './paths.ts'

const repository = 'github.com/uni-kakurenbo/traq-flavored-markdown'
const modules = [
  { directory: 'packages/core/go', dependencies: [] },
  {
    directory: 'packages/plugins/commonmark/go',
    dependencies: ['packages/core/go']
  },
  {
    directory: 'packages/plugins/traq/go',
    dependencies: ['packages/core/go']
  },
  {
    directory: 'packages/sdk/go',
    dependencies: [
      'packages/core/go',
      'packages/plugins/commonmark/go',
      'packages/plugins/traq/go'
    ]
  }
] as const
export const goReleaseModules = modules
const example = {
  directory: 'packages/sdk/examples/go',
  dependencies: modules.map(module => module.directory)
}
const modulePath = (directory: string) => `${repository}/${directory}`
const goModules = [...modules, example]

type GoMod = {
  Module: { Path: string }
  Require: { Path: string; Version: string }[] | null
  Replace: unknown[] | null
}
type GoWork = {
  Use: { DiskPath: string }[] | null
  Replace:
    | {
        Old: { Path: string; Version?: string }
        New: { Path: string; Version?: string }
      }[]
    | null
}

const internal = (name: string) =>
  modules.some(module => modulePath(module.directory) === name)

export const goReleaseTags = (version: string) =>
  modules.map(module => `${module.directory}/${version}`)

export function validateGoMod(
  manifest: GoMod,
  directory: string,
  dependencies: readonly string[],
  version: string
) {
  const expectedModule =
    directory === example.directory
      ? 'traq-markdown-example'
      : modulePath(directory)
  if (manifest.Module.Path !== expectedModule)
    throw new Error(`${directory}: unexpected Go module path`)
  if (manifest.Replace?.length)
    throw new Error(
      `${directory}: module-local replacements prevent distribution`
    )
  const actual = (manifest.Require ?? []).filter(requirement =>
    internal(requirement.Path)
  )
  if (
    actual.length !== dependencies.length ||
    dependencies.some(
      dependency =>
        !actual.some(
          requirement =>
            requirement.Path === modulePath(dependency) &&
            requirement.Version === version
        )
    )
  )
    throw new Error(`${directory}: Go dependencies do not match ${version}`)
}

export function validateGoWork(workspace: GoWork, version: string) {
  const used = (workspace.Use ?? []).map(item => item.DiskPath)
  if (
    used.length !== goModules.length ||
    goModules.some(module => !used.includes(`./${module.directory}`))
  )
    throw new Error('go.work must use all local modules')
  const replacements = (workspace.Replace ?? []).filter(item =>
    internal(item.Old.Path)
  )
  if (
    replacements.length !== modules.length ||
    modules.some(
      module =>
        !replacements.some(
          replacement =>
            replacement.Old.Path === modulePath(module.directory) &&
            replacement.Old.Version === version &&
            replacement.New.Path === `./${module.directory}` &&
            !replacement.New.Version
        )
    )
  )
    throw new Error(`go.work replacements do not match ${version}`)
}

async function go(cwd: string, args: string[], workspaceOff = false) {
  const process = Bun.spawn(['go', ...args], {
    cwd,
    env: { ...Bun.env, ...(workspaceOff ? { GOWORK: 'off' } : {}) },
    stdout: 'pipe',
    stderr: 'pipe'
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited
  ])
  if (exitCode !== 0) throw new Error(`go ${args.join(' ')}: ${stderr.trim()}`)
  return stdout
}

const readModule = async (root: string, directory: string) =>
  JSON.parse(
    await go(path.join(root, directory), ['mod', 'edit', '-json'], true)
  ) as GoMod
const readWork = async (root: string) =>
  JSON.parse(await go(root, ['work', 'edit', '-json'])) as GoWork

export async function runGoRelease(
  args: string[],
  root: string = repositoryRoot
) {
  const [version, mode, ...rest] = args
  if (
    !version ||
    !/^v(?:0|1)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/.test(
      version
    ) ||
    !['--prepare', '--check', '--tags'].includes(mode ?? '') ||
    rest.length
  )
    throw new Error(
      'usage: bun scripts/release-go.ts v<0-or-1>.<minor>.<patch> [--prepare|--check|--tags]'
    )
  if (mode === '--tags') {
    console.log(goReleaseTags(version).join('\n'))
    return
  }
  if (mode === '--prepare') {
    for (const module of goModules) {
      const requirements = module.dependencies.map(
        dependency => `-require=${modulePath(dependency)}@${version}`
      )
      if (requirements.length)
        await go(
          path.join(root, module.directory),
          ['mod', 'edit', ...requirements],
          true
        )
      const sum = Bun.file(path.join(root, module.directory, 'go.sum'))
      if (await sum.exists()) {
        const original = await sum.text()
        const retained = original
          .split('\n')
          .filter(line => {
            const [name, sumVersion] = line.split(' ')
            return (
              !internal(name) ||
              sumVersion === version ||
              sumVersion === `${version}/go.mod`
            )
          })
          .join('\n')
        if (retained !== original) await Bun.write(sum, retained)
      }
    }
    const workspace = await readWork(root)
    const edits = (workspace.Replace ?? [])
      .filter(item => internal(item.Old.Path))
      .map(
        item =>
          `-dropreplace=${item.Old.Path}${item.Old.Version ? `@${item.Old.Version}` : ''}`
      )
    edits.push(
      ...modules.map(
        module =>
          `-replace=${modulePath(module.directory)}@${version}=./${module.directory}`
      )
    )
    await go(root, ['work', 'edit', ...edits])
  }
  for (const module of goModules)
    validateGoMod(
      await readModule(root, module.directory),
      module.directory,
      module.dependencies,
      version
    )
  validateGoWork(await readWork(root), version)
  console.log(`Go module dependencies and workspace match ${version}`)
}

if (Bun.main === Bun.fileURLToPath(import.meta.url))
  await runGoRelease(Bun.argv.slice(2))
