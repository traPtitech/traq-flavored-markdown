import path from 'path'

import { $ } from 'bun'
import { build } from 'esbuild'

import { traqRoot } from '../../scripts/paths.ts'
import { parseArgs } from './args.ts'
import { ignoreMask } from './ignore-differences.ts'
import { readLines } from './read-lines.ts'
import { rendererCss, writeMhtml } from './report-assets.ts'

const { values } = parseArgs({
  options: {
    data: { type: 'string' },
    out: { type: 'string' },
    format: { type: 'string', default: 'both' }
  }
})
if (!values.data) throw new Error('--data required')
if (!['html', 'mhtml', 'both'].includes(values.format!))
  throw new Error('Invalid format')
values.out = path.resolve(values.out ?? values.data)
await $`mkdir -p ${values.out}`

const filterMasks: Record<string, number[]> = { render: [], inline: [], notification: [] }
const chunks: Record<string, string[]> = { render: [], inline: [], notification: [] },
  pending: Record<string, string[]> = { render: [], inline: [], notification: [] },
  counts: Record<string, number> = { render: 0, inline: 0, notification: 0 }
function flush(mode: string) {
  if (!pending[mode].length) return
  chunks[mode].push(
    Bun.gzipSync(JSON.stringify(pending[mode]), { level: 9 }).toBase64()
  )
  pending[mode] = []
}

for (const file of ['sui-differences.jsonl', 'traq-differences.jsonl']) {
  for await (const line of readLines(path.join(values.data, file))) {
    if (!line) continue
    const row = JSON.parse(line)
    if (row.before === row.after && !row.error)
      throw new Error('Equal result in difference list')
    filterMasks[row.mode].push(ignoreMask(row))
    pending[row.mode].push(row)
    counts[row.mode]++
    if (pending[row.mode].length === 50) flush(row.mode)
  }
}
for (const mode of Object.keys(chunks)) flush(mode)

const sui = JSON.parse(
    await Bun.file(path.join(values.data, 'sui-summary.json')).text()
  ),
  traq = JSON.parse(
    await Bun.file(path.join(values.data, 'traq-summary.json')).text()
  ),
  revisions = JSON.parse(
    await Bun.file(path.join(values.data, 'revisions.json')).text()
  )
if (
  sui.messages !== traq.messages ||
  counts.render !== sui.modes.render.differences ||
  counts.inline !== sui.modes.inline.differences ||
  counts.notification !== traq.differences
)
  throw new Error('Report counts mismatch')
const css = await rendererCss()
if (/@import|<\/style/i.test(css)) throw new Error('Unexpected CSS content')
const custom = await Bun.file(new URL('./viewer.css', import.meta.url)).text(),
  script =
    (
      await build({
        stdin: {
          contents: "export {diffStringsRaw} from 'jest-diff'",
          resolveDir: traqRoot
        },
        bundle: true,
        write: false,
        format: 'iife',
        globalName: 'CorpusDiff',
        minify: true,
        platform: 'browser'
      })
    ).outputFiles[0].text +
    '\n' +
    (await Bun.file(new URL('./viewer.ts', import.meta.url)).text())

const filters = Object.fromEntries(
  Object.entries(filterMasks).map(([mode, flags]) => [mode, flags.join('')])
)
const metadata = {
  filters,
  messages: sui.messages,
  counts,
  sui,
  traq,
  revisions,
  generated: new Date().toISOString(),
  pageSize: 50
}
const document = [
  '<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; font-src data:; img-src data:; connect-src \'none\'; base-uri \'none\'; form-action \'none\'"><title>Markdown 差分一覧</title><style>@layer renderer {',
  css,
  '}\n@layer report {',
  custom,
  '}</style></head><body><header class="top"><div><p class="eyebrow">MASTER → RUST</p><h1>Markdown 差分一覧</h1><p id="overview"></p></div><details class="speed"><summary>速度比較（参考）</summary><div id="speed"></div></details></header><main><nav class="toolbar"><div id="modes" class="modes"></div><div class="controls"><form id="search-form"><input id="search" type="search" placeholder="原文を検索" aria-label="原文を検索"><button>検索</button></form><span id="status" aria-live="polite"></span><button id="previous" aria-label="前のページ">← 前</button><label><input id="page" type="number" min="1" value="1" aria-label="ページ番号"> / <span id="pages">1</span></label><button id="next" aria-label="次のページ">次 →</button></div></nav><table class="comparison"><colgroup><col class="source-col"><col><col></colgroup><thead><tr><th>原文</th><th>before · master</th><th>after · Rust 移行版</th></tr></thead><tbody id="rows"></tbody></table><p id="empty" hidden>該当する差分はありません。</p><footer id="footer"></footer></main><script type="application/json" id="metadata">',
  JSON.stringify(metadata).replaceAll('<', '\\u003c'),
  '</script><script type="application/json" id="payload">',
  JSON.stringify(chunks),
  '</script><script>',
  script,
  '</script></body></html>'
].join('')

if (values.format !== 'mhtml')
  await Bun.write(path.join(values.out, 'differences.html'), document)
if (values.format !== 'html')
  await writeMhtml(
    values.data,
    path.join(values.out, 'differences.mhtml'),
    css,
    custom,
    metadata
  )
const excluded = Object.fromEntries(
  Object.entries(filterMasks).map(([mode, flags]) => [
    mode,
    { whitespace: flags.filter(n => n & 1).length }
  ])
)
console.log(
  JSON.stringify({
    excluded,
    messages: metadata.messages,
    counts,
    bytes: new TextEncoder().encode(document).byteLength,
    selfContained: true
  })
)
