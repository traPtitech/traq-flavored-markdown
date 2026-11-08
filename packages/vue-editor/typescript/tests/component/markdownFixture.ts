import { markdownServices } from '../helpers/markdown.js'
import { markdownReferenceCodec } from '../helpers/markdownReferences.js'
import { makeInput as make } from './fixture.js'

export * from './fixture.js'

export const makeInput = (options: Parameters<typeof make>[0] = {}) =>
  make({
    ...options,
    adapter: {
      markdown: markdownServices,
      references: markdownReferenceCodec,
      ...options.adapter
    }
  })
