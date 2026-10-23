import { gzipSync } from 'node:zlib'

import { type Page, expect, test } from '@playwright/test'

import type * as RepositoryModule from './data/repository.ts'
import { type DifferenceRow, byProfile } from '../protocol/comparison.ts'
import type { ReportData } from '../protocol/report.ts'
import { reportDocument } from '../report/aggregate.ts'
import { isWhitespaceOnlyDifference } from '../report/filter.ts'
import { fixtureMetadata } from '../testing/fixtures.ts'
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

function reportFixture(): ReportData {
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
    }
  ]
  const counts = byProfile(
    profile => rows.filter(row => row.profile === profile).length
  )
  const base = fixtureMetadata(counts, 1, 6)
  const filters = byProfile(profile =>
    rows
      .filter(row => row.profile === profile)
      .map(row => Number(isWhitespaceOnlyDifference(row)))
      .join('')
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
