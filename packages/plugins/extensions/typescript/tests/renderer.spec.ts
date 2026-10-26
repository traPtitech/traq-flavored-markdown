import type {
  ReadonlyDocument,
  ReadonlyNode
} from '@traq-flavored-markdown/core'
import { defineNode } from '@traq-flavored-markdown/core'
import { PluginDeclaration } from '@traq-flavored-markdown/core/definitions'
import {
  PresetBuilder,
  RenderPlugin,
  createRenderer
} from '@traq-flavored-markdown/core/renderer'
import {
  definitions,
  names,
  schema
} from '@traq-flavored-markdown/extensions-plugin/nodes'
import { expect, test } from 'bun:test'

import { plugin } from '../src/renderer/index.js'

function document(): ReadonlyDocument {
  const cell = (start: number): ReadonlyNode => ({
    kind: names.Cell,
    data: {},
    span: { start, end: start + 4 },
    children: [{ kind: 'text', data: {}, span: { start, end: start + 4 } }]
  })
  return {
    source: 'headbody',
    children: [
      {
        kind: names.Table,
        data: { alignments: ['right'] },
        span: { start: 0, end: 8 },
        children: [
          {
            kind: names.HeaderRow,
            data: {},
            span: { start: 0, end: 4 },
            children: [cell(0)]
          },
          {
            kind: names.Row,
            data: {},
            span: { start: 4, end: 8 },
            children: [cell(4)]
          }
        ]
      }
    ]
  }
}

test('table nodes share dispatch, ancestry, column alignment and node-bound plans', () => {
  const input = document()
  const table = input.children[0]
  const [header, body] = table.children!
  const cell = header.children![0]
  const ancestry: string[][] = []
  const textDefinition = defineNode('text', () => true, {
    role: 'inline',
    children: { kind: 'leaf' }
  })
  const text = new RenderPlugin(new PluginDeclaration('test-text')).withHandler(
    textDefinition,
    (node, ctx) => {
      ancestry.push(ctx.ancestors.map(node => node.kind))
      return ctx.sourceSlice(node.span)
    }
  )
  const extensions = plugin().withReplacedHandler(
    definitions.Row,
    (_node, ctx) => '<tr class="custom">' + ctx.renderChildren() + '</tr>\n'
  )
  const view = createRenderer(
    new PresetBuilder().add(extensions).add(text).build(),
    { schema: schema.extend([textDefinition]) }
  )
  expect(view.render(input)).toContain('<th style="text-align:right">head</th>')
  expect(view.render(input)).toContain('<tr class="custom">')
  expect(ancestry[0]).toEqual([names.Table, names.HeaderRow, names.Cell])
  expect(view.render(input, { omittedNodes: new Set([body]) })).not.toContain(
    '<tbody>'
  )
  expect(
    view.render(input, { childText: new Map([[cell, '<replacement>']]) })
  ).toContain('>&lt;replacement&gt;</th>')
  expect(
    view.render(input, { childText: new Map([[table, '<whole table>']]) })
  ).toBe('<table>\n&lt;whole table&gt;</table>\n')
})

test('custom math adapters are optional and missing adapters preserve escaped source', () => {
  const input = {
    source: '$<x>$',
    children: [
      {
        kind: names.InlineMath,
        data: { tex: '<x>' },
        span: { start: 0, end: 5 }
      }
    ]
  }
  expect(
    createRenderer(new PresetBuilder().add(plugin()).build(), {
      schema
    }).render(input)
  ).toBe('$&lt;x&gt;$')
  const seen: unknown[][] = []
  const custom = plugin({
    math: (tex, displayMode) => {
      seen.push([tex, displayMode])
      return '<math />'
    }
  })
  expect(
    createRenderer(new PresetBuilder().add(custom).build(), { schema }).render(
      input
    )
  ).toBe('<math />')
  expect(seen).toEqual([['<x>', false]])
})
