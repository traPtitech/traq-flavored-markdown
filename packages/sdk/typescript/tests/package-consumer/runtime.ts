import { deepStrictEqual } from 'node:assert'
import { readFile } from 'node:fs/promises'
import { argv } from 'node:process'

import { createRuntime, presets } from '@traq-flavored-markdown/sdk'
import { names } from '@traq-flavored-markdown/traq-plugin/nodes'

const check = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message)
}

const readBytes = async (url: URL) => new Uint8Array(await readFile(url))

const bytes = await readBytes(
  new URL(import.meta.resolve('@traq-flavored-markdown/sdk/parser.wasm'))
)
const runtime = await createRuntime(bytes)
const parser = runtime.createParser(presets.traq.v1)
const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
const hash = [...digest]
  .map(byte => byte.toString(16).padStart(2, '0'))
  .join('')
const expectedHash = argv[2]
check(hash === expectedHash, 'Packed Wasm hash does not match the contract')
try {
  check(
    parser.parseInline(':stamp:').children[0].kind === names.Stamp,
    'Packed parser did not load the traQ preset'
  )
  const extractor = runtime.createExtractor({ origin: '' })
  deepStrictEqual(
    extractor.extract(parser.parse('**hello**')),
    {
      messageText: '**hello**',
      embedding: { candidates: [], unembeddedText: '**hello**' },
      attachments: [],
      citations: [],
      references: {
        mentions: [],
        groupMentions: [],
        channelLinks: [],
        embeddings: []
      }
    },
    'Packed extractor returned an unexpected result'
  )
} finally {
  runtime.dispose()
}
console.log('Packed TypeScript consumer passed')
