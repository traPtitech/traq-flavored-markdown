import { createHighlighter } from '@traq-flavored-markdown/commonmark-plugin/highlight'
import { math } from '@traq-flavored-markdown/extensions-plugin/math'

import type { Options } from './traq.js'

const highlight = createHighlighter({ preClass: 'traq-code traq-lang' })
const condensedMath = (tex: string) =>
  math(tex, false, {
    maxSize: 1,
    macros: {
      '\\Huge': '',
      '\\huge': '',
      '\\LARGE': '',
      '\\Large': '',
      '\\large': ''
    }
  })

/** Heavy adapters are selected only by the default presentation entry point. */
export function withDefaultAdapters(options: Options = {}): Options {
  const customMath = options.math?.render
  return {
    ...options,
    code: { highlight: options.code?.highlight ?? highlight },
    math: {
      render: customMath ?? math,
      renderCondensed:
        options.math?.renderCondensed ??
        (customMath ? tex => customMath(tex, false) : condensedMath)
    }
  }
}
