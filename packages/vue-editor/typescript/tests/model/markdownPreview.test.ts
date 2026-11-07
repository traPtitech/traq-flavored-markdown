import { closeHistory, undo } from '@tiptap/pm/history'
import { describe, expect, it } from 'vitest'

import { markdownPreviewKey } from '../../src/internal/markdown/preview.js'
import { encodeReference } from '../helpers/references.js'
import { installInputEditorFixture, readSource as source } from './fixture.js'
import { configure, create } from './previewFixture.js'

installInputEditorFixture()

describe('Markdown lifecycle', () => {
  it('reuses unchanged decorations and defers analysis until composition ends', () => {
    const editor = create('**bold** plain')
    configure(editor, { enabled: true, focused: true })
    const initial = markdownPreviewKey.getState(editor.state)
    editor.commands.setTextSelection(11)

    expect(markdownPreviewKey.getState(editor.state)?.decorations).toBe(
      initial?.decorations
    )

    configure(editor, { composing: true })
    editor.commands.insertContent('new ')

    expect(markdownPreviewKey.getState(editor.state)?.formats).toBe(
      initial?.formats
    )

    configure(editor, { composing: false })

    expect(markdownPreviewKey.getState(editor.state)?.formats).not.toBe(
      initial?.formats
    )
    expect(
      editor.view.dom.querySelector('.markdown-input-strong')?.textContent
    ).toBe('bold')
  })

  it('updates automatic link styling while editing and undoing without changing source or selection', () => {
    const editor = create('URL: https://')
    configure(editor, { enabled: true, focused: true })
    editor.commands.setTextSelection(editor.state.doc.content.size - 1)
    editor.commands.insertContent('example.com')

    expect(
      editor.view.dom.querySelector('.markdown-input-link')?.textContent
    ).toBe('https://example.com')
    expect(editor.view.dom.querySelector('a')).toBeNull()
    expect(source(editor)).toBe('URL: https://example.com')
    expect(editor.state.selection.head).toBe(
      'URL: https://example.com'.length + 1
    )

    editor.view.dispatch(closeHistory(editor.state.tr))

    editor.commands.deleteRange({
      from: 'URL: https://'.length + 1,
      to: editor.state.selection.head
    })

    expect(editor.view.dom.querySelector('.markdown-input-link')).toBeNull()
    expect(source(editor)).toBe('URL: https://')

    undo(editor.state, editor.view.dispatch)

    expect(source(editor)).toBe('URL: https://example.com')
    expect(
      editor.view.dom.querySelector('.markdown-input-link')?.textContent
    ).toBe('https://example.com')

    const selection = editor.state.selection.toJSON()
    configure(editor, { enabled: false })

    expect(editor.view.dom.querySelector('.markdown-input-link')).toBeNull()
    expect(editor.state.selection.toJSON()).toEqual(selection)
    expect(source(editor)).toBe('URL: https://example.com')
  })

  it('waits until composition ends before styling a newly recognized domain', () => {
    const editor = create('https://')
    configure(editor, { enabled: true, focused: true })
    editor.commands.setTextSelection(editor.state.doc.content.size - 1)
    configure(editor, { composing: true })
    editor.commands.insertContent('example.com')

    expect(editor.view.dom.querySelector('.markdown-input-link')).toBeNull()

    const selection = editor.state.selection.toJSON()
    configure(editor, { composing: false })

    expect(
      editor.view.dom.querySelector('.markdown-input-link')?.textContent
    ).toBe('https://example.com')
    expect(editor.state.selection.toJSON()).toEqual(selection)
    expect(source(editor)).toBe('https://example.com')
  })

  it('preserves Markdown, references, selection, and Undo when toggled', () => {
    const reference = encodeReference({
      key: 'original-id',
      label: '@alice'
    })

    const original = `**hello ${reference}**`
    const editor = create(original)
    editor.commands.setTextSelection(4)
    editor.commands.insertContent('new')
    const before = source(editor)
    const selection = editor.state.selection.toJSON()
    configure(editor, { enabled: true })

    expect(source(editor)).toBe(before)
    expect(editor.state.selection.toJSON()).toEqual(selection)

    expect(editor.view.dom.querySelector('.reference-token')?.textContent).toBe(
      '@alice'
    )

    configure(editor, { enabled: false })

    expect(editor.view.dom.querySelector('.markdown-input-strong')).toBeNull()
    expect(source(editor)).toBe(before)

    undo(editor.state, editor.view.dispatch)

    expect(source(editor)).toBe(original)
  })

  it.each([
    [1, '日本語:x: and **second**'],
    [4, ':x:日本語 and **second**']
  ])(
    'keeps the caret at source position %s without inserting its anchor into the source',
    (position, after) => {
      const original = ':x: and **second**'
      const editor = create(original)
      configure(editor, { enabled: true, focused: true })
      editor.commands.setTextSelection(position)

      const anchor = editor.view.dom.querySelector(
        '.markdown-input-caret-anchor'
      )

      expect(anchor?.textContent).toBe('\u200B')
      expect(anchor?.getAttribute('aria-hidden')).toBe('true')
      expect(source(editor)).toBe(original)
      expect(editor.state.selection.head).toBe(position)

      configure(editor, { composing: true })

      expect(
        editor.view.dom.querySelector('.markdown-input-caret-anchor')
      ).toBe(anchor)

      editor.commands.insertContent('日本語')
      configure(editor, { composing: false })

      expect(source(editor)).toBe(after)
      expect(editor.state.selection.head).toBe(position + 3)

      undo(editor.state, editor.view.dispatch)

      expect(source(editor)).toBe(original)

      configure(editor, { focused: false })

      expect(
        editor.view.dom.querySelector('.markdown-input-caret-anchor')
      ).toBeNull()
    }
  )

  it.each(['before', 'inside', 'after'])(
    'preserves surrounding Markdown while composing %s a formatted range',
    location => {
      const original = 'plain **first** and [second](url) tail'

      const position =
        location === 'before'
          ? 3
          : location === 'inside'
            ? 11
            : original.length + 1

      const editor = create(original)
      configure(editor, { enabled: true, focused: true })
      editor.commands.setTextSelection(position)

      const guides = [
        ...editor.view.dom.querySelectorAll('.markdown-input-syntax')
      ]

      const syntax = guides.map(node => node.textContent)
      const link = editor.view.dom.querySelector('.markdown-input-link')
      configure(editor, { composing: true })

      expect(editor.view.dom.querySelector('.markdown-input-link')).toBe(link)

      expect([
        ...editor.view.dom.querySelectorAll('.markdown-input-syntax')
      ]).toEqual(guides)

      for (const text of ['に', '日本語']) {
        const from = position
        const to = editor.state.selection.head
        editor.view.dispatch(editor.state.tr.insertText(text, from, to))

        expect(source(editor)).toBe(
          original.slice(0, position - 1) + text + original.slice(position - 1)
        )

        expect(editor.state.selection.head).toBe(position + text.length)

        const current = [
          ...editor.view.dom.querySelectorAll('.markdown-input-syntax')
        ]

        expect(current).toHaveLength(guides.length)

        expect(current.map(node => node.textContent)).toEqual(syntax)

        expect(
          editor.view.dom.querySelector('.markdown-input-link')?.textContent
        ).toBe('second')
      }

      configure(editor, { composing: false })

      expect(editor.state.selection.head).toBe(position + 3)
      expect(
        editor.view.dom.querySelector('.markdown-input-link')?.textContent
      ).toBe('second')
    }
  )

  it.each(['**aaa**', '[aaa](aaa)'])(
    'keeps guides visible when composition starts after %s',
    text => {
      const original = `${text} and **other**`
      const editor = create(original)
      configure(editor, { enabled: true, focused: true })
      editor.commands.setTextSelection(text.length + 1)
      configure(editor, { composing: true })

      expect(source(editor)).toBe(original)
      expect(editor.state.selection.head).toBe(text.length + 1)

      expect(
        [...editor.view.dom.querySelectorAll('.markdown-input-syntax')].map(
          node => node.textContent
        )
      ).toEqual(
        text.startsWith('**')
          ? ['**', '**', '**', '**']
          : ['[', '](aaa)', '**', '**']
      )

      expect(
        editor.view.dom.querySelectorAll('.markdown-input-hidden')
      ).toHaveLength(0)

      editor.commands.insertContent('日本語')
      configure(editor, { composing: false })

      expect(source(editor)).toBe(`${text}日本語 and **other**`)
      expect(editor.state.selection.head).toBe(text.length + 4)
    }
  )

  it('waits until composition ends before rendering newly completed Markdown', () => {
    const editor = create('**first** and **new')
    configure(editor, { enabled: true, focused: true })
    editor.commands.setTextSelection(editor.state.doc.content.size - 1)
    configure(editor, { composing: true })
    editor.commands.insertContent('**')

    expect(
      editor.view.dom.querySelectorAll('.markdown-input-strong')
    ).toHaveLength(1)

    expect(source(editor)).toBe('**first** and **new**')

    configure(editor, { composing: false })

    expect(
      editor.view.dom.querySelectorAll('.markdown-input-strong')
    ).toHaveLength(2)

    expect(source(editor)).toBe('**first** and **new**')
  })

  it('does not enable Markdown rendering for a search input', () => {
    const editor = create('**search**', false)

    expect(markdownPreviewKey.getState(editor.state)).toBeUndefined()

    configure(editor, { enabled: true })

    expect(editor.view.dom.querySelector('.markdown-input-strong')).toBeNull()
  })

  it('retains a clicked widget source until the unfocused editor receives focus', () => {
    const editor = create(':traq:')
    configure(editor, { enabled: true, focused: false })
    editor.commands.setTextSelection(1)
    expect(
      editor.view.dom.querySelector('.markdown-input-rendered')
    ).not.toBeNull()
    editor.view.dispatch(
      editor.state.tr.setMeta(markdownPreviewKey, {
        revealed: [{ from: 0, to: 6 }]
      })
    )
    configure(editor, { focused: true })
    expect(editor.view.dom.querySelector('.markdown-input-rendered')).toBeNull()
    expect(source(editor)).toBe(':traq:')
  })
})
