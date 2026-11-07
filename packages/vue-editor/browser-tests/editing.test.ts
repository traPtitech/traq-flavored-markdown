import { type EditorElement, caret, expect, test } from './support.js'

test('keeps literal math boundaries editable alongside rendered text', async ({
  page,
  input,
  load,
  selectEditorOffsets,
  modifier
}) => {
  const text = '**before** $x^2$ **after**'
  const boundary = text.indexOf('$x^2$') + '$x^2$'.length
  await load({ text, markdown: true })
  await expect(input.locator('.markdown-input-source')).toHaveText('$x^2$')
  await selectEditorOffsets(boundary)
  await input.press('ArrowLeft')
  await page.keyboard.insertText('+y')
  await expect(page.getByTestId('source')).toHaveText(
    '**before** $x^2+y$ **after**'
  )
  await input.press(`${modifier}+z`)
  await expect(page.getByTestId('source')).toHaveText(text)
  await expect
    .poll(() => caret(input))
    .toMatchObject({ head: boundary - 1, focused: true })
})

for (const direction of ['caret', 'forward', 'backward'] as const) {
  test(`restores the ${direction} DOM selection when typing before selectionchange`, async ({
    page,
    input,
    load,
    selectEditorOffsets,
    modifier
  }) => {
    const text = '**before** $x^2$ **after**'
    const start = text.indexOf('x^2')
    const end = start + 'x^2'.length
    const boundary = end + 1
    const anchor = direction === 'forward' ? start : end
    const head = direction === 'backward' ? start : end
    await load({ text, markdown: true })
    await selectEditorOffsets(boundary)

    const before = await input.evaluate(
      (element: EditorElement, { anchor, head }) => {
        const { view } = element.editor
        const from = view.domAtPos(anchor + 1)
        const to = view.domAtPos(head + 1)
        const native = getSelection()
        if (!native) throw new Error('Missing editor selection')
        native.setBaseAndExtent(from.node, from.offset, to.node, to.offset)
        const range = native.getRangeAt(0)
        const selection = {
          anchor: view.state.selection.anchor - 1,
          head: view.state.selection.head - 1
        }

        // 同じタスク内に入力を届け、selectionchange がまだ通知されていない順序を再現する。
        const event = new InputEvent('beforeinput', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertText',
          data: '+y',
          targetRanges: [
            new StaticRange({
              startContainer: range.startContainer,
              startOffset: range.startOffset,
              endContainer: range.endContainer,
              endOffset: range.endOffset
            })
          ]
        })
        element.dispatchEvent(event)
        return { selection, prevented: event.defaultPrevented }
      },
      { anchor, head }
    )

    expect(before).toEqual({
      selection: { anchor: boundary, head: boundary },
      prevented: true
    })
    const edited =
      text.slice(0, Math.min(anchor, head)) +
      '+y' +
      text.slice(Math.max(anchor, head))
    await expect(page.getByTestId('source')).toHaveText(edited)

    await input.press(`${modifier}+z`)
    await expect(page.getByTestId('source')).toHaveText(text)
    await expect
      .poll(() => caret(input))
      .toMatchObject({ anchor, head, focused: true })

    await input.press(`${modifier}+Shift+z`)
    await expect(page.getByTestId('source')).toHaveText(edited)
    const restored = Math.min(anchor, head) + '+y'.length
    await expect
      .poll(() => caret(input))
      .toMatchObject({ anchor: restored, head: restored, focused: true })
  })
}

for (const markdown of [false, true]) {
  test.describe(`Markdown ${markdown}`, () => {
    test('shows a placeholder only for an empty document, including undo/redo', async ({
      page,
      input,
      load,
      selectEditorOffsets,
      modifier
    }) => {
      await load({ text: '', markdown })
      await expect(input).toHaveAttribute('data-is-empty', 'true')

      for (const text of ['text\n', '\n', ' ', '**bold**\n']) {
        await load({ text, markdown })

        await expect(page.getByTestId('source')).toHaveJSProperty(
          'textContent',
          text
        )
        await expect(input).toHaveAttribute('data-is-empty', 'false')
        await expect
          .poll(() =>
            input.evaluate(
              element => getComputedStyle(element, '::before').content
            )
          )
          .toBe('none')
      }

      await load({ text: 'typed', markdown })
      await selectEditorOffsets(5)
      await input.press('Enter')

      await expect(page.getByTestId('source')).toHaveJSProperty(
        'textContent',
        'typed\n'
      )
      await expect(input).toHaveAttribute('data-is-empty', 'false')

      await load({ text: '**bold**\n', markdown })
      await input.focus()
      await input.press(`${modifier}+a`)
      await input.press('Backspace')
      await expect(input).toHaveAttribute('data-is-empty', 'true')
      await input.press(`${modifier}+z`)

      await expect(page.getByTestId('source')).toHaveJSProperty(
        'textContent',
        '**bold**\n'
      )
      await expect(input).toHaveAttribute('data-is-empty', 'false')
      await input.press(`${modifier}+Shift+z`)

      await expect(page.getByTestId('source')).toHaveJSProperty(
        'textContent',
        ''
      )
      await expect(input).toHaveAttribute('data-is-empty', 'true')
    })

    test('edits plain source through rendered delimiters and retains focus', async ({
      page,
      input,
      load,
      selectEditorOffsets
    }) => {
      const text = '**aaa** [bbb](https://example.test) $x^2$'
      await load({ text, markdown })
      await selectEditorOffsets(7)
      await input.press('ArrowLeft')
      await expect
        .poll(() => caret(input))
        .toMatchObject({ head: 6, focused: true })
      await input.press('Backspace')
      await expect(page.getByTestId('source')).toHaveJSProperty(
        'textContent',
        '**aaa* [bbb](https://example.test) $x^2$'
      )
      await expect(input).toBeFocused()
      await input.press('x')
      await expect(page.getByTestId('source')).toHaveJSProperty(
        'textContent',
        '**aaax* [bbb](https://example.test) $x^2$'
      )
    })
  })
}

test('indents a selection, outdents it, and undoes without losing focus', async ({
  page,
  input,
  load,
  selectEditorOffsets,
  modifier
}) => {
  await load({ text: 'aaa\nbbb', markdown: true })
  await selectEditorOffsets(0, 7)
  await input.press('Tab')

  await expect(page.getByTestId('source')).toHaveJSProperty(
    'textContent',
    '  aaa\n  bbb'
  )

  await input.press('Shift+Tab')

  await expect(page.getByTestId('source')).toHaveJSProperty(
    'textContent',
    'aaa\nbbb'
  )

  await input.press(`${modifier}+z`)

  await expect(page.getByTestId('source')).toHaveJSProperty(
    'textContent',
    '  aaa\n  bbb'
  )
  await expect(input).toBeFocused()
})

test('formats table cell contents while leaving syntax and math guides unstyled', async ({
  page,
  input,
  load
}) => {
  const text = '| a | b |\n| --- | --- |\n| **bold** | _italic_ $x^2$ |'
  await load({ text, markdown: true })
  await expect(input.locator('.markdown-input-strong')).toHaveText('bold')
  await expect(input.locator('.markdown-input-emphasis')).toHaveText('italic')

  const styles = await input
    .locator('.markdown-input-syntax')
    .evaluateAll(elements =>
      elements.map(element => {
        const style = getComputedStyle(element)

        return {
          weight: style.fontWeight,
          font: style.fontStyle,
          decoration: style.textDecorationLine
        }
      })
    )

  expect(styles.length).toBeGreaterThan(0)
  expect(
    styles.every(
      style =>
        style.weight === '400' &&
        style.font === 'normal' &&
        style.decoration === 'none'
    )
  ).toBe(true)
  await expect(page.getByTestId('source')).toHaveJSProperty('textContent', text)
})
