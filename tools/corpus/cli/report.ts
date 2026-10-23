import { mkdir } from 'node:fs/promises'
import path from 'node:path'

import { corpusRoot } from '../../workspace/paths.ts'
import { resolveRepositoryPath } from '../infrastructure/paths.ts'
import { buildReport } from '../report/build.ts'
import { parseArgs } from './args.ts'
import { printJson } from './output.ts'

const { values } = parseArgs({
  options: { data: { type: 'string' }, out: { type: 'string' } }
})
if (!values.data) throw new Error('--data required')
const data = resolveRepositoryPath(values.data)
const output = resolveRepositoryPath(values.out ?? values.data)
const template = Bun.file(path.join(corpusRoot, 'dist/index.html'))
if (!(await template.exists()))
  throw new Error('Build the report viewer first: bun run build:corpus')
const report = await buildReport(data, await template.text())
await mkdir(output, { recursive: true })
await Bun.write(path.join(output, 'differences.html'), report.html)
printJson({
  runId: report.metadata.run.runId,
  messages: report.metadata.messages,
  counts: report.metadata.counts,
  excluded: report.excluded,
  bytes: new TextEncoder().encode(report.html).byteLength,
  selfContained: true
})
