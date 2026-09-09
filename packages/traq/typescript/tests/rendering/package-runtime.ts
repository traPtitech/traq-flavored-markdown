import * as rendering from '@traq-markdown-parser/traq/renderer'
import { plugin } from '@traq-markdown-parser/commonmark/renderer'
import { PresetBuilder, renderer } from '@traq-markdown-parser/core/renderer'
import { createRuntime, presets } from '@traq-markdown-parser/traq'
import { file } from 'bun'

const check = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message)
}

let missingPackageError: unknown
try {
  import.meta.resolve('markdown-it')
} catch (error) {
  missingPackageError = error
}
check(
  (missingPackageError as { code?: unknown })?.code === 'ERR_MODULE_NOT_FOUND',
  'markdown-it unexpectedly escaped into the packed package'
)

const css = await file(
  new URL(import.meta.resolve('@traq-markdown-parser/traq/index.css'))
).text()
check(
  css.includes('.markdown-body') && css.includes('.emoji'),
  'Packed CSS is missing expected selectors'
)
const runtime = await createRuntime(
  await file(
    new URL(import.meta.resolve('@traq-markdown-parser/traq/parser.wasm'))
  ).bytes()
)
try {
  const parser = runtime.createParser(presets.traq.v1)
  const document = parser.parse('**package** $x$ !!hidden!! :0xff0000:')
  const output = renderer(rendering.html()).render(document)
  for (const text of [
    '<strong>package</strong>',
    'katex',
    'spoiler',
    'background-color: #ff0000'
  ])
    check(output.includes(text), text)
  const messages = rendering.messageRenderers({
    origin: 'https://q.example.test'
  })
  const message = parser.parse(
    'hello\nhttps://q.example.test/files/00000000-0000-0000-0000-000000000001'
  )
  check(
    messages.condensed.render(message).renderedText === 'hello',
    'Packed condensed renderer changed the message text'
  )
  check(
    messages.standard.render(message).embeddings[0].type === 'file',
    'Packed standard renderer did not extract the file embedding'
  )
  const custom = renderer(new PresetBuilder().add(plugin()).build())
  check(
    custom.render(parser.parseInline('**shared declaration**')) ===
      '<strong>shared declaration</strong>',
    'Packed shared renderer did not preserve CommonMark strong text'
  )
} finally {
  runtime.dispose()
}
console.log(
  'Packed renderer consumer: declarations, HTML, CSS, and Wasm integration passed'
)
