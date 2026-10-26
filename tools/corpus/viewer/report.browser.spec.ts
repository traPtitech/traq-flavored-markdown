import { gzipSync } from 'node:zlib'

import { type Page, expect, test } from '@playwright/test'

import type * as RepositoryModule from './data/repository.ts'
import { type DifferenceRow, byProfile } from '../protocol/comparison.ts'
import { type ReportData, encodeFilterMasks } from '../protocol/report.ts'
import { reportDocument } from '../report/aggregate.ts'
import { differenceFilterMask } from '../report/filter.ts'
import {
  fixtureHtmlSerialization,
  fixtureKatexError,
  fixtureLinkedImage,
  fixtureMetadata
} from '../testing/fixtures.ts'
import type { ReportRepository } from './data/repository.ts'

type QueryProbe = {
  release?: () => void
  started: boolean
  aborted: boolean
  settled: boolean
}
type ProbeWindow = typeof globalThis & { queryProbe: QueryProbe }

const route = '/tools/corpus/viewer/index.html'
const malicious =
  '<script>globalThis.previewExecuted = true</script><img src="https://external.test/image" onerror="globalThis.previewExecuted = true" alt="placeholder"><a href="https://external.test/link" onclick="globalThis.previewExecuted = true">inert link</a><iframe src="https://external.test/frame"></iframe><svg onload="globalThis.previewExecuted = true"><image href="https://external.test/svg-image" /></svg><div class="toolbar" style="background-image:url(https://external.test/css)">isolated class</div>'

function reportFixture(extraRows: DifferenceRow[] = []): ReportData {
  const rows: DifferenceRow[] = [
    {
      runId: 'synthetic-run',
      index: 0,
      profile: 'render',
      source: 'Alpha',
      before: { kind: 'html', value: '<p>alpha </p>' },
      after: { kind: 'html', value: '<p>alpha</p>' }
    },
    {
      runId: 'synthetic-run',
      index: 1,
      profile: 'render',
      source: 'Beta',
      before: { kind: 'html', value: 'same' },
      after: { kind: 'error', value: 'same' }
    },
    {
      runId: 'synthetic-run',
      index: 2,
      profile: 'render',
      source: 'Gamma needle',
      before: { kind: 'html', value: '<p>before</p>' },
      after: { kind: 'html', value: malicious }
    },
    {
      runId: 'synthetic-run',
      index: 3,
      profile: 'inline',
      source: 'Inline',
      before: { kind: 'html', value: 'before' },
      after: { kind: 'html', value: 'after' }
    },
    {
      runId: 'synthetic-run',
      index: 4,
      profile: 'plainText',
      source: 'Plain',
      before: { kind: 'text', value: 'before' },
      after: { kind: 'text', value: 'after' }
    },
    ...extraRows
  ]
  const counts = byProfile(
    profile => rows.filter(row => row.profile === profile).length
  )
  const base = fixtureMetadata(counts, 1, 6 + extraRows.length)
  const filters = byProfile(profile =>
    encodeFilterMasks(
      rows
        .filter(row => row.profile === profile)
        .map(row => differenceFilterMask(row))
    )
  )
  const metadata = {
    ...base,
    filters,
    results: {
      ...base.results,
      render: {
        ...base.results.render,
        beforeErrors: 1,
        afterErrors: 2,
        actualWarmups: 1
      },
      plainText: { ...base.results.plainText, embeddingDifferences: 1 }
    }
  }
  return {
    metadata,
    payload: byProfile(profile =>
      rows
        .filter(row => row.profile === profile)
        .map(row => gzipSync(JSON.stringify([row])).toString('base64'))
    )
  }
}

async function openReport(page: Page, data = reportFixture()) {
  await page.route(`**${route}`, async intercepted => {
    const response = await intercepted.fetch()
    await intercepted.fulfill({
      response,
      body: reportDocument(await response.text(), data.metadata, data.payload)
    })
  })
  await page.goto(route)
}

test('BOT switch uses account metadata, retains unknown authors and composes with other controls', async ({
  page
}) => {
  const data = reportFixture()
  data.metadata = {
    ...data.metadata,
    authors: { render: 'hbu', inline: 'b', plainText: 'h' }
  }
  await openReport(page, data)
  await expect(page.locator('#rows .source')).toHaveText('Alpha')
  await page.getByRole('button', { name: '次のページ' }).click()
  await expect(page.locator('#rows .source')).toHaveText('Beta')
  await expect(page.locator('#author-status')).toHaveText(
    'BOT 1 件 / 投稿者不明 1 件（除外対象外）'
  )
  await page.getByLabel('BOTの投稿を除外').check()
  await expect(page.getByLabel('ページ', { exact: true })).toHaveValue('1')
  await expect(page.locator('#rows .source')).toHaveText('Alpha')
  await expect(page.locator('#status')).toHaveText('2 件 / 全 3 件')
  for (const label of [
    'ホワイトスペースのみを除外',
    '大文字・小文字の違いのみを除外',
    'リンク付き画像の表示差分を除外',
    'HTMLの表記差分のみを除外'
  ])
    await page.getByLabel(label).check()
  await expect(page.locator('#rows .source')).toHaveText('Gamma needle')
  await expect(page.locator('#status')).toHaveText('1 件 / 全 3 件')
  await page.getByLabel('原文を検索').fill('Beta')
  await page.getByRole('button', { name: '検索', exact: true }).click()
  await expect(page.locator('#empty')).toBeVisible()
  await page.getByLabel('BOTの投稿を除外').uncheck()
  await expect(page.locator('#rows .source')).toHaveText('Beta')
  await page.getByLabel('BOTの投稿を除外').check()
  await page.locator('#profiles button').nth(1).click()
  await expect(page.getByLabel('BOTの投稿を除外')).toBeChecked()
  await expect(page.locator('#status')).toHaveText('0 件 / 全 1 件')
  await page.locator('#profiles button').nth(2).click()
  await expect(page.locator('#rows .source')).toHaveText('Plain')
})

test('reports without account metadata omit the BOT switch and its status', async ({
  page
}) => {
  await openReport(page)
  await expect(page.getByLabel('BOTの投稿を除外')).toHaveCount(0)
  await expect(page.locator('#author-status')).toHaveCount(0)
  await expect(page.locator('#status')).toHaveText('3 件')
})

test('BOT controls remain reachable when another profile has known authors', async ({
  page
}) => {
  const data = reportFixture()
  data.metadata = {
    ...data.metadata,
    authors: { render: 'uuu', inline: 'b', plainText: 'u' }
  }
  await openReport(page, data)
  await expect(page.getByLabel('BOTの投稿を除外')).toBeVisible()
  await page.getByLabel('BOTの投稿を除外').check()
  await expect(page.locator('#status')).toHaveText('3 件')
  await page.locator('#profiles button').nth(1).click()
  await expect(page.locator('#empty')).toBeVisible()
  await page.locator('#profiles button').nth(2).click()
  await expect(page.getByLabel('BOTの投稿を除外')).toBeChecked()
  await page.getByLabel('BOTの投稿を除外').uncheck()
  await expect(page.locator('#rows .source')).toHaveText('Plain')
})

test('KaTeX-only checkbox composes with search and other filters while retaining real changes', async ({
  page
}) => {
  const data = reportFixture([
    { ...fixtureKatexError, index: 6 },
    {
      ...fixtureKatexError,
      index: 7,
      source: 'KaTeX and outside case',
      before: {
        kind: 'html',
        value: '<p>OUTSIDE</p>' + fixtureKatexError.before.value
      },
      after: {
        kind: 'html',
        value: '<p>outside</p>' + fixtureKatexError.after.value
      }
    },
    {
      ...fixtureKatexError,
      index: 8,
      source: 'KaTeX newly fails',
      before: {
        kind: 'html',
        value: '<p class="katex-block"><span class="katex">success</span></p>'
      }
    },
    {
      ...fixtureKatexError,
      index: 9,
      source: 'KaTeX and outside content',
      before: {
        kind: 'html',
        value: '<p>before</p>' + fixtureKatexError.before.value
      },
      after: {
        kind: 'html',
        value: '<p>after</p>' + fixtureKatexError.after.value
      }
    }
  ])
  await openReport(page, data)
  await expect(page.locator('#status')).toHaveText('7 件')
  await page.getByRole('button', { name: '次のページ' }).click()
  await page.getByLabel('KaTeXエラー部分のみの差分を除外').check()
  await expect(page.getByLabel('ページ', { exact: true })).toHaveValue('1')
  await expect(page.locator('#status')).toHaveText('6 件 / 全 7 件')
  await page.getByLabel('原文を検索').fill('KaTeX')
  await page.getByRole('button', { name: '検索', exact: true }).click()
  await expect(page.locator('#status')).toHaveText('3 件 / 全 7 件')
  await page.getByLabel('大文字・小文字の違いのみを除外').check()
  await expect(page.locator('#status')).toHaveText('2 件 / 全 7 件')
  await expect(page.locator('#rows .source')).toHaveText('KaTeX newly fails')
  await page.getByRole('button', { name: '次のページ' }).click()
  await expect(page.locator('#rows .source')).toHaveText(
    'KaTeX and outside content'
  )
  await page.getByLabel('KaTeXエラー部分のみの差分を除外').uncheck()
  await expect(page.locator('#status')).toHaveText('4 件 / 全 7 件')
  await page.locator('#profiles button').nth(2).click()
  await expect(page.locator('#rows .source')).toHaveText('Plain')
})

test('link policy checkbox composes with search, profiles and all output filters', async ({
  page
}) => {
  const url = 'https://trap.jp'
  const link = `<a href="${url}">${url}</a>`
  await openReport(
    page,
    reportFixture([
      {
        runId: 'synthetic-run',
        index: 5,
        profile: 'render',
        source: 'Link policy only ' + url,
        before: { kind: 'html', value: `<p>${link}</p>` },
        after: { kind: 'html', value: `<p>${url}</p>` }
      },
      {
        runId: 'synthetic-run',
        index: 6,
        profile: 'render',
        source: 'Link policy case ' + url,
        before: { kind: 'html', value: `<p>HELLO ${link}</p>` },
        after: { kind: 'html', value: `<p>hello ${url}</p>` }
      },
      {
        runId: 'synthetic-run',
        index: 7,
        profile: 'render',
        source: 'Link policy other ' + url,
        before: { kind: 'html', value: `<p>before ${link}</p>` },
        after: { kind: 'html', value: `<p>after ${url}</p>` }
      },
      {
        runId: 'synthetic-run',
        index: 8,
        profile: 'render',
        source: 'Link policy failure ' + url,
        before: { kind: 'error', value: 'before' },
        after: { kind: 'error', value: 'after' }
      }
    ])
  )
  await expect(page.locator('#status')).toHaveText('7 件')
  const policy = page.getByLabel('リンク仕様変更による差分を除外')
  await expect(policy).not.toBeChecked()
  await page.getByRole('button', { name: '次のページ' }).click()
  await policy.check()
  await expect(page.getByLabel('ページ', { exact: true })).toHaveValue('1')
  await expect(page.locator('#status')).toHaveText('6 件 / 全 7 件')
  await page.getByLabel('原文を検索').fill('Link policy')
  await page.getByLabel('原文を検索').press('Enter')
  await expect(page.locator('#status')).toHaveText('3 件 / 全 7 件')
  for (const label of [
    '大文字・小文字の違いのみを除外',
    'ホワイトスペースのみを除外',
    'リンク付き画像の表示差分を除外',
    'HTMLの表記差分のみを除外',
    'KaTeXエラー部分のみの差分を除外'
  ])
    await page.getByLabel(label).check()
  await expect(page.locator('#status')).toHaveText('2 件 / 全 7 件')
  await expect(page.locator('#rows .source')).toHaveText(
    'Link policy other ' + url
  )
  await page.getByRole('button', { name: '次のページ' }).click()
  await expect(page.locator('#rows .source')).toHaveText(
    'Link policy failure ' + url
  )
  await page.locator('#profiles button').nth(2).click()
  await expect(policy).toBeChecked()
  await expect(page.locator('#status')).toHaveText('1 件')
  await page.locator('#profiles button').first().click()
  await page.getByLabel('原文を検索').fill('Link policy')
  await page.getByLabel('原文を検索').press('Enter')
  await expect(page.locator('#status')).toHaveText('2 件 / 全 7 件')
  await policy.uncheck()
  await expect(page.locator('#status')).toHaveText('4 件 / 全 7 件')
})

test('real gzip data drives pagination, filters, search, profiles and error summaries', async ({
  page
}) => {
  await openReport(page)
  await expect(page.locator('#rows .source')).toHaveText('Alpha')
  await expect(page.locator('#pages')).toHaveText('3')
  await expect(
    page.locator('.result-summary [data-profile="render"] td')
  ).toHaveText(['3', '1', '2', '0'])
  await page.getByRole('button', { name: '次のページ' }).click()
  await expect(page.locator('#rows .source')).toHaveText('Beta')
  await expect(page.locator('.output-error')).toContainText('実行エラー')
  await page.getByLabel('表示形式').selectOption('raw')
  await expect(page.locator('.output-error')).toHaveText('実行エラー')
  await page.getByLabel('ホワイトスペースのみを除外').check()
  await expect(page.getByLabel('ページ', { exact: true })).toHaveValue('1')
  await expect(page.locator('#rows .source')).toHaveText('Beta')
  await expect(page.locator('#pages')).toHaveText('2')
  await page.getByLabel('原文を検索').fill('needle')
  await page.getByRole('button', { name: '検索', exact: true }).click()
  await expect(page.locator('#rows .source')).toHaveText('Gamma needle')
  await expect(page.locator('#status')).toHaveText('1 件 / 全 3 件')
  await page.getByLabel('ページ', { exact: true }).fill('999')
  await expect(page.getByLabel('ページ', { exact: true })).toHaveValue('1')
  await page.getByRole('button', { name: /traQ_S-UI · インライン/ }).click()
  await expect(page.getByLabel('原文を検索')).toHaveValue('')
  await expect(page.locator('#rows .source')).toHaveText('Inline')
  await expect(page.getByLabel('ホワイトスペースのみを除外')).toBeChecked()
  await page.getByRole('button', { name: /traQ · プレーンテキスト/ }).click()
  await expect(page.locator('#rows .source')).toHaveText('Plain')
  await page.getByText('速度比較（参考）', { exact: true }).click()
  await expect(page.locator('#speed')).toContainText('ウォームアップ実施: 1 件')
})

test('case filtering composes with whitespace, search and pagination', async ({
  page
}) => {
  await openReport(
    page,
    reportFixture([
      {
        runId: 'synthetic-run',
        index: 5,
        profile: 'render',
        source: 'OnlyCase',
        before: { kind: 'html', value: '<p class="ABC">Hello</p>' },
        after: { kind: 'html', value: '<p class="abc">hello</p>' }
      },
      {
        runId: 'synthetic-run',
        index: 6,
        profile: 'render',
        source: 'MixedCase',
        before: { kind: 'html', value: '<p>A b</p>' },
        after: { kind: 'html', value: '<p>ab</p>' }
      }
    ])
  )
  const ignoreCase = page.getByLabel('大文字・小文字の違いのみを除外')
  await expect(ignoreCase).not.toBeChecked()
  await expect(page.locator('#pages')).toHaveText('5')
  await page.getByRole('button', { name: '次のページ' }).click()
  await expect(page.locator('#rows .source')).toHaveText('Beta')
  await ignoreCase.check()
  await expect(page.getByLabel('ページ', { exact: true })).toHaveValue('1')
  await expect(page.locator('#rows .source')).toHaveText('Alpha')
  await expect(page.locator('#pages')).toHaveText('4')
  await page.getByLabel('ホワイトスペースのみを除外').check()
  await expect(page.locator('#rows .source')).toHaveText('Beta')
  await expect(page.locator('.output-error')).toContainText('実行エラー')
  await expect(page.locator('#pages')).toHaveText('2')
  await page.getByLabel('原文を検索').fill('MixedCase')
  await page.getByRole('button', { name: '検索', exact: true }).click()
  await expect(page.locator('#empty')).toBeVisible()
  await page.getByLabel('ホワイトスペースのみを除外').uncheck()
  await expect(page.locator('#rows .source')).toHaveText('MixedCase')
  await page.getByLabel('原文を検索').fill('OnlyCase')
  await page.getByRole('button', { name: '検索', exact: true }).click()
  await expect(page.locator('#empty')).toBeVisible()
  await ignoreCase.uncheck()
  await expect(page.locator('#rows .source')).toHaveText('OnlyCase')
  await ignoreCase.check()
  await expect(page.locator('#empty')).toBeVisible()
  await page.getByRole('button', { name: /traQ · プレーンテキスト/ }).click()
  await expect(ignoreCase).toBeChecked()
  await expect(page.locator('#rows .source')).toHaveText('Plain')
})

test('linked-image checkbox composes with whitespace, case and search while retaining mixed changes and errors', async ({
  page
}) => {
  await openReport(
    page,
    reportFixture([
      { ...fixtureLinkedImage, index: 5, source: 'Linked image' },
      {
        ...fixtureLinkedImage,
        index: 6,
        source: 'Mixed image',
        after: {
          kind: 'html',
          value: fixtureLinkedImage.after.value + '<p>different</p>'
        }
      },
      {
        ...fixtureLinkedImage,
        index: 7,
        source: 'Case space image',
        before: {
          kind: 'html',
          value: fixtureLinkedImage.before.value.replace('>badge<', '>BAD GE<')
        }
      }
    ])
  )
  const images = page.getByLabel('リンク付き画像の表示差分を除外')
  await expect(images).not.toBeChecked()
  await expect(page.locator('#pages')).toHaveText('6')
  await page.getByRole('button', { name: '次のページ' }).click()
  await images.check()
  await expect(page.getByLabel('ページ', { exact: true })).toHaveValue('1')
  await expect(page.locator('#pages')).toHaveText('5')
  await page.getByLabel('原文を検索').fill('Linked image')
  await page.getByRole('button', { name: '検索', exact: true }).click()
  await expect(page.locator('#empty')).toBeVisible()
  await images.uncheck()
  await expect(page.locator('#rows .source')).toHaveText('Linked image')
  await images.check()
  await page.getByLabel('原文を検索').fill('Mixed image')
  await page.getByRole('button', { name: '検索', exact: true }).click()
  await expect(page.locator('#rows .source')).toHaveText('Mixed image')
  await page.getByLabel('原文を検索').fill('Case space image')
  await page.getByRole('button', { name: '検索', exact: true }).click()
  await expect(page.locator('#rows .source')).toHaveText('Case space image')
  await page.getByLabel('大文字・小文字の違いのみを除外').check()
  await expect(page.locator('#rows .source')).toHaveText('Case space image')
  await page.getByLabel('ホワイトスペースのみを除外').check()
  await expect(page.locator('#empty')).toBeVisible()
  await page.getByLabel('原文を検索').fill('Beta')
  await page.getByRole('button', { name: '検索', exact: true }).click()
  await expect(page.locator('.output-error')).toContainText('実行エラー')
  await page.getByRole('button', { name: /traQ · プレーンテキスト/ }).click()
  await expect(images).toBeChecked()
  await expect(page.locator('#rows .source')).toHaveText('Plain')
})

test('HTML spelling checkbox composes with all filters and keeps text changes and errors', async ({
  page
}) => {
  await openReport(
    page,
    reportFixture([
      { ...fixtureHtmlSerialization, index: 5, source: 'Only HTML spelling' },
      {
        ...fixtureHtmlSerialization,
        index: 6,
        source: 'Mixed HTML spelling',
        after: {
          kind: 'html',
          value: fixtureHtmlSerialization.after.value + '<br>'
        }
      },
      {
        ...fixtureLinkedImage,
        index: 7,
        source: 'All image filters',
        before: {
          kind: 'html',
          value: `[!<a href="https://images.example.test/badge.svg">BA DGE&#039;S</a>](<a title='page' href='https://example.test/docs'>https://example.test/docs</a>)`
        },
        after: {
          kind: 'html',
          value: `<a href="https://example.test/docs" title="page">!badge's</a>`
        }
      }
    ])
  )
  const spelling = page.getByLabel('HTMLの表記差分のみを除外')
  await expect(spelling).not.toBeChecked()
  await expect(page.locator('#pages')).toHaveText('6')
  await page.getByRole('button', { name: '次のページ' }).click()
  await spelling.check()
  await expect(page.getByLabel('ページ', { exact: true })).toHaveValue('1')
  await expect(page.locator('#pages')).toHaveText('5')
  for (const [search, hidden] of [
    ['Only HTML spelling', true],
    ['Mixed HTML spelling', false],
    ['All image filters', false]
  ] as const) {
    await page.getByLabel('原文を検索').fill(search)
    await page.getByRole('button', { name: '検索', exact: true }).click()
    if (hidden) await expect(page.locator('#empty')).toBeVisible()
    else await expect(page.locator('#rows .source')).toHaveText(search)
  }
  await page.getByLabel('リンク付き画像の表示差分を除外').check()
  await page.getByLabel('大文字・小文字の違いのみを除外').check()
  await expect(page.locator('#rows .source')).toHaveText('All image filters')
  await page.getByLabel('ホワイトスペースのみを除外').check()
  await expect(page.locator('#empty')).toBeVisible()
  await spelling.uncheck()
  await expect(page.locator('#rows .source')).toHaveText('All image filters')
  await spelling.check()
  await page.getByLabel('原文を検索').fill('Beta')
  await page.getByRole('button', { name: '検索', exact: true }).click()
  await expect(page.locator('.output-error')).toContainText('実行エラー')
  await page.getByRole('button', { name: /traQ · プレーンテキスト/ }).click()
  await expect(spelling).toBeChecked()
  await expect(page.locator('#rows .source')).toHaveText('Plain')
})

test('HTML preview remains inert and isolates corpus classes from viewer styles', async ({
  page
}) => {
  const externalRequests: string[] = []
  page.on('request', request => {
    if (new URL(request.url()).hostname === 'external.test')
      externalRequests.push(request.url())
  })
  await page.route('https://external.test/**', intercepted =>
    intercepted.abort()
  )
  await openReport(page)
  await page.getByLabel('原文を検索').fill('Gamma')
  await page.getByRole('button', { name: '検索', exact: true }).click()
  const previews = page.locator('.markdown-body')
  await expect(previews.nth(1)).toContainText('[画像: placeholder]')
  await expect(previews.nth(1).locator('.r-link')).toHaveText('inert link')
  await expect(
    previews.locator(
      'a, img, script, iframe, image, [href], [src], [onclick], [onload], [onerror], .toolbar'
    )
  ).toHaveCount(0)
  await expect(previews.nth(1).locator('.preview-toolbar')).toHaveCSS(
    'position',
    'static'
  )
  await previews.nth(1).locator('.r-link').click()
  expect(await page.evaluate(() => 'previewExecuted' in globalThis)).toBe(false)
  expect(externalRequests).toEqual([])
})

test('bootstrap distinguishes missing data, invalid data and unsupported browsers', async ({
  page
}) => {
  await page.goto(route)
  await expect(page.locator('[data-reason="missing-data"]')).toBeVisible()
  await page.route(`**${route}`, async intercepted => {
    const response = await intercepted.fetch()
    await intercepted.fulfill({
      response,
      body: (await response.text())
        .replace('id="metadata"></script>', 'id="metadata">{broken</script>')
        .replace('id="payload"></script>', 'id="payload">{}</script>')
    })
  })
  await page.reload()
  await expect(page.locator('[data-reason="invalid-data"]')).toBeVisible()
  await page.unroute(`**${route}`)
  await page.addInitScript(() =>
    Object.defineProperty(globalThis, 'DecompressionStream', {
      value: undefined
    })
  )
  await openReport(page)
  await expect(
    page.locator('[data-reason="unsupported-browser"]')
  ).toBeVisible()
})

test('chunk failures are visible and equal failures remain visible with zero output differences', async ({
  page
}) => {
  const data = reportFixture()
  data.payload.render[0] = 'broken'
  await openReport(page, data)
  await expect(page.locator('#status')).toHaveAttribute('role', 'alert')
  await expect(page.locator('#status')).toContainText('読込エラー')
  const base = reportFixture()
  const empty = {
    metadata: {
      ...base.metadata,
      counts: byProfile(() => 0),
      filters: byProfile(() => ''),
      authors: byProfile(() => ''),
      results: byProfile(profile => ({
        ...base.metadata.results[profile],
        differences: 0
      }))
    },
    payload: byProfile(() => [])
  }
  await page.unroute(`**${route}`)
  await openReport(page, empty)
  await expect(page.locator('#empty')).toBeVisible()
  await expect(
    page.locator('.result-summary [data-profile="render"] td')
  ).toHaveText(['0', '1', '2', '0'])
})

test('replaced queries are cancelled and late responses cannot replace the current rows', async ({
  page
}) => {
  await openReport(page)
  await expect(page.locator('#rows .source')).toHaveText('Alpha')
  await page.evaluate(async () => {
    const modulePath = '/tools/corpus/viewer/data/repository.ts'
    const { ReportRepository } = (await import(
      modulePath
    )) as typeof RepositoryModule
    const original = ReportRepository.prototype.query
    const probe: QueryProbe = { started: false, aborted: false, settled: false }
    ;(globalThis as ProbeWindow).queryProbe = probe
    ReportRepository.prototype.query = async function (
      ...args: Parameters<ReportRepository['query']>
    ) {
      const [query, signal] = args
      if (query.search !== 'Alpha') return original.apply(this, args)
      probe.started = true
      signal?.addEventListener(
        'abort',
        () => {
          probe.aborted = true
        },
        { once: true }
      )
      await new Promise<void>(resolve => {
        probe.release = resolve
      })
      // Simulate a decoder that finishes after cancellation. The hook must
      // discard this result even if a dependency ignores its abort signal.
      const result = await original.call(this, query)
      probe.settled = true
      return result
    }
  })
  await page.getByLabel('原文を検索').fill('Alpha')
  await page.getByRole('button', { name: '検索', exact: true }).click()
  await expect
    .poll(() =>
      page.evaluate(() => (globalThis as ProbeWindow).queryProbe.started)
    )
    .toBe(true)
  await page.getByLabel('原文を検索').fill('Beta')
  await page.getByRole('button', { name: '検索', exact: true }).click()
  await expect(page.locator('#rows .source')).toHaveText('Beta')
  expect(
    await page.evaluate(() => (globalThis as ProbeWindow).queryProbe.aborted)
  ).toBe(true)
  await page.evaluate(() => (globalThis as ProbeWindow).queryProbe.release?.())
  await expect
    .poll(() =>
      page.evaluate(() => (globalThis as ProbeWindow).queryProbe.settled)
    )
    .toBe(true)
  await expect(page.locator('#rows .source')).toHaveText('Beta')
})
