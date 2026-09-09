import { createRuntime, presets } from '@traq-markdown-parser/traq'

const parserWasmUrl = new URL(
  import.meta.resolve('@traq-markdown-parser/traq/parser.wasm')
)
const wasmBytes = await Bun.file(parserWasmUrl).bytes()
const runtime = await createRuntime(wasmBytes)
try {
  const parser = runtime.createParser(presets.traq.v1)
  console.log(JSON.stringify(parser.parse('**hello** :stamp: $x$'), null, 2))
  console.log(JSON.stringify(parser.parseInline('$x$'), null, 2))

  const extractor = runtime.createExtractor({
    origin: 'https://q.example.test'
  })

  console.log(
    JSON.stringify(
      extractor.extract(parser.parse('**hello** !!secret!!')),
      null,
      2
    )
  )
} finally {
  runtime.dispose()
}
