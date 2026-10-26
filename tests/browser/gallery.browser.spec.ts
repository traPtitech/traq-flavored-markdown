import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/tests/browser/fixtures/gallery.html')
  await expect(page.locator('#status')).toHaveText('Ready')
})

test('real browser applies plugin layout, spoiler and stamp styles', async ({
  page
}) => {
  await expect(page.locator('#blocks h1')).toHaveText('Heading')
  await expect(page.locator('#blocks li')).toHaveCount(2)
  await expect(page.locator('#blocks blockquote')).toHaveText('quoted')
  await expect(page.locator('#table th')).toHaveCount(2)
  await expect(page.locator('#table td').last()).toHaveCSS(
    'text-align',
    'right'
  )
  await expect(page.locator('#table tbody tr').last()).toHaveCSS(
    'background-color',
    'rgb(246, 248, 250)'
  )
  await expect(page.locator('#blocks h5')).toHaveCSS('transform', 'none')
  await expect(page.locator('#blocks h6')).toHaveCSS('transform', 'none')
  await expect(page.locator('#inline strong').first()).toHaveCSS(
    'font-weight',
    '700'
  )
  const spoiler = page.locator('#inline .spoiler')
  await expect(spoiler).toHaveCSS('color', 'rgba(0, 0, 0, 0)')
  await expect(spoiler.locator('strong')).toHaveCSS('visibility', 'hidden')
  await spoiler.evaluate(element => element.setAttribute('shown', ''))
  await expect(spoiler.locator('strong')).toHaveCSS('visibility', 'visible')
  await expect(page.locator('#inline .emoji')).toHaveCSS(
    'background-color',
    'rgb(255, 0, 0)'
  )
  await expect(page.locator('#inline .emoji')).toHaveCSS(
    'display',
    'inline-block'
  )
  await expect(page.locator('#image img')).toHaveAttribute('alt', 'alternative')
  await expect(page.locator('#image img')).toHaveJSProperty('naturalWidth', 8)
})

test('optional math and highlighting adapters work with the published browser modules', async ({
  page
}) => {
  await expect(page.locator('#math .katex')).toBeVisible()
  await expect(page.locator('#math .katex')).toHaveCSS(
    'font-family',
    /KaTeX_Main/
  )
  await expect(page.locator('#math pre code .hljs-keyword')).toHaveText('const')
  await expect(page.locator('#condensed')).toHaveText('hello')
  await expect(page.locator('#cards')).toHaveText('file')
})

test('safe rendering and explicit drafts preserve the owned document', async ({
  page
}) => {
  await expect(page.locator('#safe img')).toHaveCount(0)
  await expect(page.locator('#safe a[href^="javascript:"]')).toHaveCount(0)
  await expect(page.locator('body')).not.toHaveAttribute('data-injected')
  await expect(
    page.locator('#safe a[href="https://example.test"]')
  ).toHaveAttribute('rel', /noopener/)
  await page.getByRole('button', { name: 'Edit draft' }).click()
  await expect(page.locator('#edited')).toHaveText('modified')
  await expect(page.locator('#original')).toHaveText('original')
})
