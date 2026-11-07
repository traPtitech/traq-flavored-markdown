import { describe, expect, it, vi } from 'vitest'

import { markdownPreviewKey } from '../../src/internal/markdown/previewState.js'
import {
  focus,
  getEditor,
  installReferenceInputFixture,
  lastValue,
  makeInput,
  press
} from './fixture.js'

installReferenceInputFixture()

describe('reference input composition deletions', () => {
  it.each([
    { markdown: false, clause: false, finish: false },
    { markdown: true, clause: false, finish: false },
    { markdown: false, clause: true, finish: false },
    { markdown: true, clause: true, finish: false },
    { markdown: false, clause: false, finish: true },
    { markdown: true, clause: false, finish: true }
  ])(
    'preserves selected IME text during Backspace with Markdown $markdown, clause $clause, and pending confirmation $finish',
    async ({ markdown, clause, finish }) => {
      const prefix = 'before '
      const composition = 'あああああｄｓｓｓｓｓｓっさああ'
      const wrapper = await makeInput({ source: prefix + composition })
      await wrapper.setProps({ markdown })
      await focus(wrapper)
      const editor = getEditor(wrapper)

      editor.commands.setTextSelection(
        clause
          ? {
              from: prefix.length + composition.indexOf('ｄ') + 1,
              to: prefix.length + composition.indexOf('っ') + 1
            }
          : {
              from: prefix.length + composition.length + 1,
              to: prefix.length + 1
            }
      )

      const element = editor.view.dom

      element.dispatchEvent(
        new CompositionEvent('compositionstart', { bubbles: true })
      )

      try {
        const text = element.querySelector('p')?.lastChild

        if (!(text instanceof Text)) throw new Error('Missing composition text')

        press(wrapper, 'Backspace', { isComposing: true })

        const next =
          prefix + (clause ? composition.slice(1) : composition.slice(0, -1))

        text.data = next
        document.getSelection()?.collapse(text, text.length)

        if (finish) {
          element.dispatchEvent(
            new CompositionEvent('compositionend', { bubbles: true })
          )
        }

        await vi.waitFor(() => {
          expect(lastValue(wrapper)).toBe(next)
        })

        expect(editor.view.composing).toBe(!finish)
        expect(editor.state.selection.head).toBe(next.length + 1)
        expect(wrapper.emitted('keydown')).toBeUndefined()
      } finally {
        if (!finish) {
          element.dispatchEvent(
            new CompositionEvent('compositionend', { bubbles: true })
          )
        }
      }
    }
  )
})

it('protects composition Enter from submission and suggestion selection', async () => {
  const wrapper = await makeInput()
  await focus(wrapper)

  wrapper.vm.element?.dispatchEvent(
    new CompositionEvent('compositionstart', { bubbles: true })
  )

  press(wrapper, 'Enter', { isComposing: true })

  expect(wrapper.emitted('keydown')).toBeUndefined()
  expect(lastValue(wrapper)).toBeUndefined()

  wrapper.vm.element?.dispatchEvent(
    new CompositionEvent('compositionend', { bubbles: true })
  )
})

it('keeps Markdown visible until the final composition text has been read from the DOM', async () => {
  const wrapper = await makeInput({ source: '**first** and input' })
  await wrapper.setProps({ markdown: true })
  await focus(wrapper)

  const editor = getEditor(wrapper)

  editor.commands.setTextSelection(editor.state.doc.content.size - 1)
  const element = editor.view.dom
  const strong = element.querySelector('.markdown-input-strong')
  const text = element.querySelector('p')?.lastChild

  if (!(text instanceof Text)) throw new Error('Expected text at the caret')

  element.dispatchEvent(
    new CompositionEvent('compositionstart', { bubbles: true })
  )

  expect(element.querySelector('.markdown-input-strong')).toBe(strong)

  text.appendData('日本語')
  document.getSelection()?.collapse(text, text.length)

  element.dispatchEvent(
    new CompositionEvent('compositionend', { bubbles: true, data: '日本語' })
  )

  expect(markdownPreviewKey.getState(editor.state)?.composing).toBe(true)
  expect(element.querySelector('.markdown-input-strong')).toBe(strong)

  await vi.waitFor(() => {
    expect(markdownPreviewKey.getState(editor.state)?.composing).toBe(false)
    expect(lastValue(wrapper)).toBe('**first** and input日本語')
  })

  expect(editor.state.selection.head).toBe(
    '**first** and input日本語'.length + 1
  )

  expect(element.querySelector('.markdown-input-strong')?.textContent).toBe(
    'first'
  )
})
