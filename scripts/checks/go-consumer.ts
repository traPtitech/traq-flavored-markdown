import path from 'node:path'

import { repositoryRoot } from '../paths.ts'
import { goReleaseModules } from '../release-go.ts'
import { withTempDirectory } from '../testing/temp-directory.ts'

const repository = 'github.com/uni-kakurenbo/traq-flavored-markdown'
const sdk = `${repository}/packages/sdk/go`

async function go(directory: string, args: string[], remote: boolean) {
  const process = Bun.spawn(['go', ...args], {
    cwd: directory,
    env: {
      ...Bun.env,
      GOWORK: 'off',
      GOCACHE:
        Bun.env.GOCACHE ??
        path.join(repositoryRoot, 'target', 'go-consumer-cache'),
      ...(remote ? { GOPROXY: 'direct' } : {})
    },
    stdout: 'pipe',
    stderr: 'pipe'
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited
  ])
  if (exitCode !== 0)
    throw new Error(`go ${args.join(' ')} failed:\n${stdout}${stderr}`)
  return stdout
}

export async function checkGoConsumer(version: string, remote = false) {
  if (!/^v(?:0|1)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(version))
    throw new Error(
      'usage: bun scripts/checks/go-consumer.ts v<version> [--remote]'
    )
  await withTempDirectory('markdown-go-consumer-', async directory => {
    const replacements = remote
      ? ''
      : `\nreplace (\n${goReleaseModules
          .map(
            module =>
              `  ${repository}/${module.directory} => ${path.join(repositoryRoot, module.directory).replaceAll('\\', '/')}`
          )
          .join('\n')}\n)\n`
    await Bun.write(
      path.join(directory, 'go.mod'),
      `module example.com/markdown-go-consumer\n\ngo 1.26.0\n\nrequire ${sdk} ${version}\n${replacements}`
    )
    await Bun.write(
      path.join(directory, 'consumer_test.go'),
      `package consumer

import (
  "context"
  "testing"

  markdown "${sdk}"
)

func TestBundledRuntime(t *testing.T) {
  ctx := context.Background()
  runtime, err := markdown.NewBundledRuntime(ctx)
  if err != nil { t.Fatal(err) }
  defer runtime.Close(ctx)
  parser, err := runtime.NewParser(ctx, markdown.PresetTraqV1)
  if err != nil { t.Fatal(err) }
  defer parser.Close(ctx)
  document, err := parser.Parse(ctx, "**outside workspace**")
  if err != nil { t.Fatal(err) }
  if document == nil || len(document.Children) == 0 { t.Fatal("empty document") }
}
`
    )
    await go(directory, ['mod', 'tidy'], remote)
    if (remote) {
      const resolved = await go(
        directory,
        ['list', '-m', '-f', '{{.Path}}@{{.Version}}', 'all'],
        true
      )
      for (const module of goReleaseModules)
        if (!resolved.includes(`${repository}/${module.directory}@${version}`))
          throw new Error(
            `${module.directory}: Go consumer resolved wrong version`
          )
    }
    await go(directory, ['test', '-count=1', './...'], remote)
  })
  console.log(
    `External Go consumer passed with GOWORK=off (${remote ? 'published tags' : 'local release candidate'})`
  )
}

if (Bun.main === Bun.fileURLToPath(import.meta.url)) {
  const [version, flag, ...rest] = Bun.argv.slice(2)
  if (rest.length || (flag && flag !== '--remote'))
    throw new Error(
      'usage: bun scripts/checks/go-consumer.ts [v<version> [--remote]]'
    )
  const releaseVersion =
    version ??
    `v${(await Bun.file(path.join(repositoryRoot, 'package.json')).json()).version}`
  await checkGoConsumer(releaseVersion, flag === '--remote')
}
