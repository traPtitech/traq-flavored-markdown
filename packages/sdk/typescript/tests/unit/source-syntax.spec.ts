import type { MutableNode } from '@traq-flavored-markdown/core'
import { expect, test } from 'bun:test'

import { schema } from '../../src/generated/nodes.js'
import { bindSyntax } from '../../src/runtime/syntax.js'

function document() {
  return schema.document({
    source: '😀 **x**',
    children: [
      {
        kind: 'commonmark.paragraph',
        span: { start: 0, end: 10 },
        data: {},
        children: [
          {
            kind: 'commonmark.text',
            span: { start: 0, end: 10 },
            data: { value: '😀 **x**' }
          }
        ]
      }
    ]
  })
}

function records() {
  return {
    nodes: [
      null,
      {
        content: [{ start: 7, end: 8 }],
        markers: [{ kind: 'open', spans: [{ start: 5, end: 7 }] }]
      }
    ],
    detached: []
  }
}

test('source facts are immutable and belong to exactly one document snapshot', () => {
  const context = document()
  const input = records()
  const parsed = bindSyntax(context, input)
  const node = context.document.children[0].children![0]
  expect(parsed.syntaxFor(node).source!.content).toEqual([{ start: 7, end: 8 }])
  input.nodes[1]!.content[0].end = 9
  expect(parsed.syntaxFor(node).source!.content[0].end).toBe(8)
  expect(Object.isFrozen(parsed.syntaxFor(node).source!.content)).toBe(true)

  expect(() => parsed.syntaxFor(document().document.children[0])).toThrow(
    /does not belong/
  )
})

test('malformed records and source boundaries are rejected before binding', () => {
  for (const input of [
    { nodes: [], detached: [] },
    { nodes: [null, null, null], detached: [] },
    {
      nodes: [null, { content: [{ start: 1, end: 4 }], markers: [] }],
      detached: []
    },
    {
      nodes: [null, { content: [], markers: [{ kind: 'bogus', spans: [] }] }],
      detached: []
    },
    {
      nodes: [
        null,
        { content: [], markers: [{ kind: 'prefix', spans: [], columns: 1000 }] }
      ],
      detached: []
    },
    {
      nodes: [
        null,
        {
          content: [],
          markers: [{ kind: 'prefix', spans: [], text: '\ud800' }]
        }
      ],
      detached: []
    }
  ]) {
    expect(() => bindSyntax(document(), input)).toThrow()
  }
})

test('flat records bind deeply nested ASTs without a recursive wire schema', () => {
  let root = {
    kind: 'commonmark.paragraph',
    span: { start: 0, end: 1 },
    data: {},
    children: [
      {
        kind: 'commonmark.text',
        span: { start: 0, end: 1 },
        data: { value: 'x' }
      }
    ]
  } as MutableNode

  for (let index = 0; index < 60; index++) {
    root = {
      kind: 'commonmark.blockquote',
      span: { start: 0, end: 1 },
      data: {},
      children: [root]
    }
  }

  const context = schema.document({ source: 'x', children: [root] })

  const parsed = bindSyntax(context, {
    nodes: Array(62).fill(null),
    detached: []
  })

  for (const node of context.walk()) {
    expect(parsed.syntaxFor(node).source).toBeNull()
  }
})
