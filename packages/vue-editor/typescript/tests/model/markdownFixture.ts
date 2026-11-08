import { markdownServices } from '../helpers/markdown.js'
import { markdownReferenceCodec } from '../helpers/markdownReferences.js'
import { createInputEditor as create } from './fixture.js'

export { installInputEditorFixture, pressKey, readSource } from './fixture.js'

export const createInputEditor = (
  source: string,
  options: Parameters<typeof create>[1] = {}
) =>
  create(
    source,
    { markdown: markdownServices, ...options },
    markdownReferenceCodec
  )
