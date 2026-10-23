import path from 'node:path'

import { captureProcess } from '../infrastructure/process.ts'
import { withTempDirectory } from '../infrastructure/temp-directory.ts'
import { readGoPackageGraph } from '../package-graph.ts'
import { repositoryRoot } from '../paths.ts'
import { goVersion } from '../release/version.ts'

async function go(directory: string, args: string[], remote: boolean) {
  return captureProcess('go', args, directory, {
    env: {
      ...Bun.env,
      GOWORK: 'off',
      ...(remote ? { GOPROXY: 'direct' } : {})
    }
  })
}

export async function checkGoConsumer(version: string, remote = false) {
  goVersion(version)
  const { published } = await readGoPackageGraph()
  const sdk = published.find(module => module.owner === 'sdk')!.path
  await withTempDirectory('markdown-go-consumer-', async directory => {
    const replacements = remote
      ? ''
      : `\nreplace (\n${published
          .map(
            module =>
              `  ${module.path} => ${path.join(repositoryRoot, module.directory).replaceAll('\\', '/')}`
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
  parser, err := runtime.NewParser(ctx, markdown.GrammarTraqV1)
  if err != nil { t.Fatal(err) }
  defer parser.Close(ctx)
  document, err := parser.Parse(ctx, "**outside workspace**")
  if err != nil { t.Fatal(err) }
  if document == nil || len(document.Children()) == 0 { t.Fatal("empty document") }
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
      for (const module of published)
        if (!resolved.includes(`${module.path}@${version}`))
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

export async function main() {
  const [version, flag, ...rest] = Bun.argv.slice(2)
  if (rest.length || (flag && flag !== '--remote'))
    throw new Error(
      'usage: bun tools/workspace/checks/go-consumer.ts [v<version> [--remote]]'
    )
  const releaseVersion =
    version ??
    `v${(await Bun.file(path.join(repositoryRoot, 'package.json')).json()).version}`
  await checkGoConsumer(releaseVersion, flag === '--remote')
}

if (Bun.main === Bun.fileURLToPath(import.meta.url)) await main()
