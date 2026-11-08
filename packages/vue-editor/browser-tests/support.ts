import { type Locator, test as base, expect } from '@playwright/test'
import type { CDPSession } from '@playwright/test'
import type { Editor } from '@tiptap/core'

import type { Draft } from './harness/types.js'

export type EditorElement = HTMLElement & { editor: Editor }

export const test = base.extend<{
  cdp: CDPSession
  input: Locator
  load: (draft: Draft) => Promise<void>
  selectEditorOffsets: (anchor: number, head?: number) => Promise<void>
  modifier: 'Meta' | 'Control'
}>({
  modifier: async ({ page }, use) => {
    await use(
      (await page.evaluate(() => /Mac|iPhone|iPad/.test(navigator.platform)))
        ? 'Meta'
        : 'Control'
    )
  },

  cdp: async ({ page }, use) => {
    const session = await page.context().newCDPSession(page)

    try {
      await use(session)
    } finally {
      await session.detach()
    }
  },

  page: async ({ page }, use) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto('/browser-tests/harness/')
    await page.waitForFunction(() => !!window.editorHarness)
    await page.evaluate(() => window.editorHarness.ready)
    await use(page)
    expect(errors).toEqual([])
  },

  input: async ({ page }, use) => {
    await use(page.getByRole('textbox').or(page.getByRole('combobox')))
  },

  load: async ({ page, input }, use) => {
    await use(async draft => {
      await page.evaluate(draft => window.editorHarness.load(draft), draft)
      await expect(input).toBeVisible()

      await expect(page.getByTestId('source')).toHaveJSProperty(
        'textContent',
        draft.text
      )
    })
  },

  selectEditorOffsets: async ({ input }, use) => {
    await use(async (anchor, head = anchor) => {
      await input.focus()

      await input.evaluate(
        (element: EditorElement, { anchor, head }) => {
          const { view } = element.editor
          const from = view.domAtPos(anchor + 1)
          const to = view.domAtPos(head + 1)

          getSelection()?.setBaseAndExtent(
            from.node,
            from.offset,
            to.node,
            to.offset
          )

          element.ownerDocument.dispatchEvent(new Event('selectionchange'))
        },
        { anchor, head }
      )

      await expect
        .poll(() =>
          input.evaluate((element: EditorElement) => ({
            anchor: element.editor.state.selection.anchor - 1,
            head: element.editor.state.selection.head - 1
          }))
        )
        .toEqual({ anchor, head })
    })
  }
})

export { expect }

export const caret = (input: Locator) =>
  input.evaluate((element: EditorElement) => {
    const selection = getSelection()
    const { view } = element.editor

    return {
      anchor: selection?.anchorNode
        ? view.posAtDOM(selection.anchorNode, selection.anchorOffset) - 1
        : null,
      head: selection?.focusNode
        ? view.posAtDOM(selection.focusNode, selection.focusOffset) - 1
        : null,
      composing: view.composing,
      focused: document.activeElement === element
    }
  })
