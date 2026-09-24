import * as rendering from '@traq-flavored-markdown/sdk/renderer'
import { createRuntime, presets } from '@traq-flavored-markdown/sdk'

const parserWasmUrl = new URL(
  import.meta.resolve('@traq-flavored-markdown/sdk/parser.wasm')
)
const runtime = await createRuntime(await Bun.file(parserWasmUrl).bytes())
try {
  const parser = runtime.createParser(presets.traq.v1)
  const view = rendering.html()

  console.log(
    view.render(
      parser.parse('**Hello** ==Markdown== $x^2$ !!secret!! :0xff0000:')
    )
  )
} finally {
  runtime.dispose()
}
