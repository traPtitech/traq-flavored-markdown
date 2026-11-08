import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/tests/browser/fixtures/gallery.html')
  await expect(page.locator('#status')).toHaveText('Ready')
})

test('SDK styles stay within the Markdown roots', async ({ page }) => {
  await page.locator('#host-content').evaluate(element => {
    ;(element as HTMLElement).style.setProperty(
      '--tfm-mark-background-color',
      'red'
    )
  })

  await expect(page.locator('#host-content mark')).toHaveCSS(
    'background-color',
    'rgb(255, 255, 0)'
  )

  await expect(page.locator('#host-content .emoji')).toHaveCSS(
    'display',
    'inline'
  )

  await expect(page.locator('#host-content .spoiler strong')).toHaveCSS(
    'visibility',
    'visible'
  )
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

test('RGB and RGBA stamps apply their parsed alpha values in the browser', async ({
  page
}) => {
  const stamps = page.locator('#colors .emoji')

  const colors = [
    'ff0000',
    'ff000088',
    'ff0000',
    'ff000080',
    'ff000000',
    'ff0000ff'
  ]

  await expect(stamps).toHaveCount(colors.length)

  for (const [index, color] of colors.entries()) {
    await expect(stamps.nth(index)).toHaveAttribute(
      'style',
      `background-color: #${color};`
    )
  }

  // CSSOM may serialize 0x80 alpha as either 0.5 or 0.502. Compare pixels.
  const pixels = await stamps.evaluateAll(elements => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas unavailable')

    return elements.map(element => {
      context.clearRect(0, 0, 1, 1)
      context.fillStyle = getComputedStyle(element).backgroundColor
      context.fillRect(0, 0, 1, 1)
      return Array.from(context.getImageData(0, 0, 1, 1).data)
    })
  })

  expect(pixels).toEqual([
    [255, 0, 0, 255],
    [255, 0, 0, 136],
    [255, 0, 0, 255],
    [255, 0, 0, 128],
    [0, 0, 0, 0],
    [255, 0, 0, 255]
  ])
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
  await expect(page.locator('#condensed a')).toHaveCount(0)
  await expect(page.locator('#cards')).toHaveText('file')
})

test('fallback image labels keep formatting and reference names in one link', async ({
  page
}) => {
  await expect(page.locator('#fallback strong')).toHaveText('important')
  await expect(page.locator('#fallback code')).toHaveText('code')
  await expect(page.locator('#fallback')).toContainText('#general')
  await expect(page.locator('#fallback')).not.toContainText('"type"')
  await expect(page.locator('#fallback a')).toHaveCount(1)

  await expect(page.locator('#fallback a')).toHaveAttribute(
    'href',
    'https://example.test/no.png'
  )
})

test('URL boundaries keep surrounding prose and explicit punctuation in browser link targets', async ({
  page
}) => {
  const links = page.locator('#links')
  await expect(links).toContainText('hogehoge(https://example.test/a)fugafuga')

  await expect(links).toContainText(
    'hogehoge(https://en.wikipedia.org/wiki/Function_(mathematics))fugafuga'
  )

  expect(
    await links
      .locator('a')
      .evaluateAll(elements =>
        elements.map(element => (element as HTMLAnchorElement).href)
      )
  ).toEqual([
    'https://example.test/a',
    'https://example.test/tail_',
    'https://example.test/tail-',
    'https://example.test/~user/page',
    'https://example.test/a',
    'https://example.test/a(b)~_-',
    'https://example.test/a_',
    'https://en.wikipedia.org/wiki/Function_(mathematics)',
    'https://example.test/a(b(c))',
    'https://example.test/a'
  ])

  await expect(links.locator('s a')).toHaveText('https://example.test/a')
  await expect(links.locator('em a')).toHaveText('https://example.test/a_')
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
