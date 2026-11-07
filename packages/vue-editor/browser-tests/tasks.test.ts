import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('textbox')).toBeVisible()
})

test('completes an arbitrary task payload with matching accessible option IDs', async ({
  page
}) => {
  const input = page.getByRole('textbox')
  await input.focus()
  await input.press('ControlOrMeta+A')
  await input.pressSequentially('@28')
  const list = page.getByRole('listbox', { name: 'Tasks' })
  await expect(list.getByRole('option')).toHaveCount(1)

  await expect(input).toHaveAttribute(
    'aria-controls',
    (await list.getAttribute('id')) ?? ''
  )

  await expect(input).toHaveAttribute(
    'aria-activedescendant',
    (await list.getByRole('option').getAttribute('id')) ?? ''
  )

  await list.getByRole('option').click()
  await expect(input).toBeFocused()
  await expect(page.getByTestId('stored-source')).toHaveText('[[task:28]] ')

  await expect(input.locator('.reference-token')).toHaveText(
    '#28 Review the new API'
  )

  await expect(list).toHaveCount(0)
})

test('restores a task reference through Undo after reopening its authored text', async ({
  page
}) => {
  const input = page.getByRole('textbox')
  await input.focus()
  await input.press('ControlOrMeta+A')
  await input.pressSequentially('@17')
  await input.press('Enter')
  await input.press('Backspace')
  await input.press('Backspace')
  await expect(input.locator('.reference-token')).toHaveCount(0)
  await expect(page.getByTestId('stored-source')).toHaveText('@17')
  await input.press('ControlOrMeta+z')

  await expect(input.locator('.reference-token')).toHaveText(
    '#17 Write the release notes'
  )
})

test('continues Markdown lists without host stores or application routes', async ({
  page
}) => {
  const input = page.getByRole('textbox')
  await input.focus()
  await input.press('ControlOrMeta+A')
  await input.pressSequentially('- first')
  await input.press('Enter')
  await input.pressSequentially('second')

  await expect(page.getByTestId('stored-source')).toHaveText(
    '- first\n- second'
  )
})
