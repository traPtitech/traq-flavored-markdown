import type { Document, Node } from '@traq-flavored-markdown/core'
import { defineNode } from '@traq-flavored-markdown/core'
import { PluginDeclaration } from '@traq-flavored-markdown/core/definitions'
import {
  PresetBuilder,
  RenderPlugin,
  renderer
} from '@traq-flavored-markdown/core/renderer'
import { expect, test } from 'bun:test'

import { definitions, names } from '../generated/nodes.js'
import { plugin } from '../renderer/index.js'

function document(): Document {
  const cell = (start: number): Node => ({
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
  const text = new RenderPlugin(new PluginDeclaration('test-text')).on(
    defineNode('text', () => true, {
      role: 'inline',
      children: { kind: 'leaf' }
    }),
    (node, ctx) => {
      ancestry.push(ctx.ancestors.map(node => node.kind))
      return ctx.sourceSlice(node.span)
    }
  )
  const extensions = plugin().replace(
    definitions.Row,
    (_node, ctx) => '<tr class="custom">' + ctx.renderChildren() + '</tr>\n'
  )
  const view = renderer(new PresetBuilder().add(extensions).add(text).build())
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
    renderer(new PresetBuilder().add(plugin()).build()).render(input)
  ).toBe('$&lt;x&gt;$')
  const seen: unknown[][] = []
  const custom = plugin({
    math: (tex, displayMode) => {
      seen.push([tex, displayMode])
      return '<math />'
    }
  })
  expect(renderer(new PresetBuilder().add(custom).build()).render(input)).toBe(
    '<math />'
  )
  expect(seen).toEqual([['<x>', false]])
})
