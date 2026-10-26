import {
  definitions as commonDefinitions,
  names as commonNames
} from '@traq-flavored-markdown/commonmark-plugin/nodes'
import {
  definitions,
  names
} from '@traq-flavored-markdown/extensions-plugin/nodes'
import { createHtmlRenderer } from '@traq-flavored-markdown/sdk/renderer'
import { expect, test } from 'bun:test'

import { parser } from './setup.js'

test('table rows and cells participate in ancestry, handler replacement and render plans', () => {
  const document = parser.parse('| head |\n| - |\n| body |')
  const table = document.document.children[0]
  const header = table.children![0]
  const body = table.children![1]
  const cell = header.children![0]
  const ancestry: string[][] = []
  const view = createHtmlRenderer({
    configurePlugins: plugins => ({
      ...plugins,
      common: plugins.common.withReplacedHandler(
        commonDefinitions.Text,
        (node, ctx) => {
          ancestry.push(ctx.ancestors.map(parent => parent.kind))
          return ctx.escape(node.data.value)
        }
      ),
      extensions: plugins.extensions.withReplacedHandler(
        definitions.Row,
        (_node, ctx) => '<tr class="custom">' + ctx.renderChildren() + '</tr>\n'
      )
    })
  })
  expect(view.render(document)).toContain('<tr class="custom">')
  expect(ancestry[0]).toEqual([names.Table, header.kind, names.Cell])
  expect(
    view.render(document, { omittedNodes: new Set([body]) })
  ).not.toContain('>body<')
  expect(
    view.render(document, { childText: new Map([[cell, '<replacement>']]) })
  ).toContain('<th>&lt;replacement&gt;</th>')
  expect(cell.children![0].kind).toBe(commonNames.Text)
})
