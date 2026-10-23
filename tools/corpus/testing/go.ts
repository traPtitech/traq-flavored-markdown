import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { runProcess } from '../../workspace/infrastructure/process.ts'
import { corpusRoot, sdkRoot } from '../../workspace/paths.ts'
import { runFrontend } from '../comparison/frontend-worker.ts'
import { createRun, executeRun } from '../comparison/run.ts'
import { sha256 } from '../infrastructure/files.ts'
import { applicationGoModule } from '../infrastructure/go-module.ts'
import { generateProtocol } from '../protocol/generate.ts'
import { buildReport } from '../report/build.ts'
import { fixturePlan } from './fixtures.ts'

await generateProtocol(true)
const env = { ...process.env, GOWORK: 'off' }
await runProcess(
  'go',
  ['test', './...'],
  path.join(corpusRoot, 'comparison/go'),
  { env }
)

// Compile and execute the real SDK adapters with local, deterministic legacy shims.
const directory = await mkdtemp(path.join(os.tmpdir(), 'corpus-integration-'))
try {
  const baseline = path.join(directory, 'baseline')
  const goRoot = path.join(baseline, 'plain-text')
  await mkdir(path.join(goRoot, 'go-before'), { recursive: true })
  await Bun.write(
    path.join(goRoot, 'main.go'),
    await readFile(path.join(corpusRoot, 'comparison/go-app/main.go'))
  )
  await Bun.write(path.join(goRoot, 'go.mod'), await applicationGoModule())
  await Bun.write(
    path.join(goRoot, 'go-before/parser.go'),
    'package message\nfunc SetOrigin(string) {}\ntype Parsed string\nfunc Parse(source string) Parsed { return Parsed(source) }\nfunc (source Parsed) NotificationText() string { return string(source) }\n'
  )
  const packageDirectory = path.join(
    baseline,
    'node_modules/@traptitech/traq-markdown-it'
  )
  await mkdir(packageDirectory, { recursive: true })
  await Bun.write(
    path.join(packageDirectory, 'package.json'),
    '{"name":"@traptitech/traq-markdown-it","type":"module","exports":"./index.js"}'
  )
  await Bun.write(
    path.join(packageDirectory, 'index.js'),
    'export class traQMarkdownIt { render(source) { return {renderedText: source, embeddings: []} } renderInline(source) { return this.render(source) } }'
  )
  const corpus = path.join(directory, 'input.jsonl')
  await Bun.write(
    corpus,
    ['plain', '**bold**', ':stamp:']
      .map(source => JSON.stringify({ source }))
      .join('\n') + '\n'
  )
  const plan = await createRun(
    fixturePlan({
      corpus,
      corpusSha256: await sha256(corpus),
      output: path.join(directory, 'run'),
      baselineDirectory: baseline,
      candidateDirectory: path.join(sdkRoot, 'dist'),
      wasm: path.join(sdkRoot, 'dist/parser.wasm')
    })
  )
  await runProcess('go', ['mod', 'tidy'], goRoot, { env })
  await executeRun(plan, {
    frontend: async current => {
      await runFrontend(current)
    },
    plainText: () =>
      runProcess(
        'go',
        ['run', '.', '-plan', path.join(plan.output, 'run.json')],
        goRoot,
        { env }
      )
  })
  const report = await buildReport(
    plan.output,
    '<script type="application/json" id="metadata"></script><script type="application/json" id="payload"></script>'
  )
  if (
    report.metadata.messages !== 3 ||
    report.metadata.results.render.afterErrors !== 0 ||
    report.metadata.results.plainText.afterErrors !== 0
  )
    throw new Error('Synthetic SDK integration failed')
  process.stdout.write(
    'PASS Go protocol, both SDK adapters, complete run manifest, and report assembly\n'
  )
} finally {
  await rm(directory, { recursive: true, force: true })
}
