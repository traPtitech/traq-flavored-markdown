import { attributes, escapeHtml } from '@traq-flavored-markdown/core/html'
import hljs from 'highlight.js'

import defaultSubset from './languages.js'

const noHighlightRe = /^(no-?highlight|plain|text)$/i

export const createHighlightFunc =
  (preClass: string, withCaption = true, useSubsetForAuto = true) =>
  (code: string, lang: string) => {
    const pre = '<pre' + attributes([['class', preClass]]) + '>'
    let langName
    let citeTag = ''

    if (withCaption) {
      const [_langName, langCaption] = lang.split(':')
      langName = _langName ?? ''

      if (langCaption) {
        citeTag = `<cite>${escapeHtml(langCaption)}</cite>`
      }
    } else {
      langName = lang
    }

    let codeHtml: string
    if (hljs.getLanguage(langName)) {
      const result = hljs.highlight(code, { language: langName })
      codeHtml = `<code class="lang-${result.language}">${result.value}</code>`
    } else if (noHighlightRe.test(langName)) {
      codeHtml = `<code>${escapeHtml(code)}</code>`
    } else {
      const result = hljs.highlightAuto(
        code,
        useSubsetForAuto ? defaultSubset : undefined
      )
      codeHtml = `<code class="lang-${result.language}">${result.value}</code>`
    }

    return { kind: 'block' as const, html: `${pre}${citeTag}${codeHtml}</pre>` }
  }
