import * as rendering from '@traq-markdown-engine/sdk/renderer'
import { renderer } from '@traq-markdown-engine/core/renderer'
import { createRuntime, presets } from '@traq-markdown-engine/sdk'

const parserWasmUrl = new URL(
  import.meta.resolve('@traq-markdown-engine/sdk/parser.wasm')
)
const runtime = await createRuntime(await Bun.file(parserWasmUrl).bytes())
try {
  const parser = runtime.createParser(presets.traq.v1)
  const view = renderer(rendering.html())

  console.log(
    view.render(
      parser.parse('**Hello** ==Markdown== $x^2$ !!secret!! :0xff0000:')
    )
  )
} finally {
  runtime.dispose()
}
