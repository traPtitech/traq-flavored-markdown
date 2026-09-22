import { readFile } from 'node:fs/promises'

import * as rendering from '@traq-flavored-markdown/sdk/renderer'
import { plugin } from '@traq-flavored-markdown/commonmark-plugin/renderer'
import { PresetBuilder, renderer } from '@traq-flavored-markdown/core/renderer'
import { createRuntime, presets } from '@traq-flavored-markdown/sdk'

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

const css = await readFile(
  new URL(import.meta.resolve('@traq-flavored-markdown/sdk/index.css')),
  'utf8'
)
check(
  css.includes('.markdown-body') && css.includes('.emoji'),
  'Packed CSS is missing expected selectors'
)
const runtime = await createRuntime(
  await readFile(
    new URL(import.meta.resolve('@traq-flavored-markdown/sdk/parser.wasm'))
  )
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
