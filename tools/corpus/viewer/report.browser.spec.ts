import { gzipSync } from 'node:zlib'

import { type Page, expect, test } from '@playwright/test'

import type * as RepositoryModule from './data/repository.ts'
import { encodeClassification } from '../protocol/classification.ts'
import { type DifferenceRow, byProfile } from '../protocol/comparison.ts'
import { type ReportData, encodeFilterMasks } from '../protocol/report.ts'
import { reportDocument } from '../report/aggregate.ts'
import { classifyDifference } from '../report/classify.ts'
import { differenceFilterMask } from '../report/filter.ts'
import { fixtureLinkedImage, fixtureMetadata } from '../testing/fixtures.ts'
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

function reportFixture(
  extraRows: DifferenceRow[] = [],
  origin?: string
): ReportData {
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
        .map(row => differenceFilterMask(row, origin))
    )
  )

  const metadata = {
    ...base,
    filters,
    classifications: byProfile(profile =>
      rows
        .filter(row => row.profile === profile)
        .map(row => encodeClassification(classifyDifference(row, origin)))
        .join('')
    ),
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

test('whitespace, case and BOT exclusions are visible alongside classifications', async ({
  page
}) => {
  const data = reportFixture([
    { ...fixtureLinkedImage, index: 6, source: 'classified image' }
  ])

  await openReport(page, data)
  const filters = page.getByRole('group', { name: '差分の絞り込み' })
  await expect(filters.getByRole('checkbox')).toHaveCount(3)
  await expect(filters.getByLabel('ホワイトスペースのみを除外')).toBeVisible()

  await expect(
    filters.getByLabel('大文字・小文字の違いのみを除外')
  ).toBeVisible()

  await expect(filters.locator('xpath=ancestor::details')).toHaveCount(0)
  await expect(page.getByRole('checkbox')).toHaveCount(4)
  await page.locator('[data-category="image"]').click()
  await expect(page.locator('#rows .source')).toHaveText('classified image')
  await filters.getByLabel('ホワイトスペースのみを除外').check()
  await filters.getByLabel('大文字・小文字の違いのみを除外').check()
  await expect(page.locator('#rows .source')).toHaveText('classified image')
  await expect(page.locator('#status')).toHaveText('1 件 / 全 4 件')
})

test('BOT exclusion keeps human and unknown posts and persists across profiles', async ({
  page
}) => {
  const data = reportFixture()
  data.metadata.authors.render = 'bhu'
  data.metadata.authors.inline = 'b'

  await openReport(page, data)
  const excludeBots = page.getByLabel('BOT の投稿を除外')
  await expect(excludeBots).not.toBeChecked()
  await expect(page.locator('#rows .source')).toHaveText('Alpha')
  await page.getByRole('button', { name: '次のページ' }).click()
  await expect(page.getByLabel('ページ', { exact: true })).toHaveValue('2')

  await excludeBots.check()
  await expect(page.getByLabel('ページ', { exact: true })).toHaveValue('1')
  await expect(page.locator('#rows .source')).toHaveText('Beta')
  await expect(page.locator('#status')).toHaveText('2 件 / 全 3 件')
  await page.getByRole('button', { name: '次のページ' }).click()
  await expect(page.locator('#rows .source')).toHaveText('Gamma needle')

  await page.getByRole('button', { name: /traQ_S-UI · インライン/ }).click()
  await expect(excludeBots).toBeChecked()
  await expect(page.locator('#empty')).toBeVisible()
  await excludeBots.uncheck()
  await expect(page.locator('#rows .source')).toHaveText('Inline')
})

test('classification tree drills into mixed cases, retains unresolved changes and composes with search and profiles', async ({
  page
}) => {
  await openReport(
    page,
    reportFixture([
      { ...fixtureLinkedImage, index: 6, source: 'classified image accepted' },
      {
        ...fixtureLinkedImage,
        index: 7,
        source: 'classified image mixed',
        before: {
          kind: 'html',
          value: fixtureLinkedImage.before.value + ' old'
        },
        after: { kind: 'html', value: fixtureLinkedImage.after.value + ' new' }
      }
    ])
  )

  const tree = page.getByRole('navigation', { name: '差分の分類' })
  await tree.locator('[data-category="image"]').click()
  await expect(page.locator('#status')).toHaveText('2 件 / 全 5 件')

  await expect(page.locator('#rows .source')).toHaveText(
    'classified image accepted'
  )

  await expect(page.locator('.classification-summary')).toContainText(
    '要確認 1件'
  )

  await page.locator('#only-review').check()

  await expect(page.locator('#rows .source')).toHaveText(
    'classified image mixed'
  )

  await expect(page.locator('#rows')).toContainText('未説明の差分あり')
  await page.locator('#rows > details > summary').click()
  await expect(page.locator('#rows .comparison')).toHaveCount(0)
  await page.locator('#rows > details > summary').click()
  await expect(page.locator('#rows .comparison')).toHaveCount(1)
  await tree.locator('[data-category="image.linked"]').click()

  await expect(page.locator('.classification-summary')).toContainText(
    '外側のリンク先を優先'
  )

  await page.locator('#search').fill('accepted')
  await page.getByRole('button', { name: '検索', exact: true }).click()
  await expect(page.locator('#empty')).toBeVisible()
  await page.locator('#only-review').uncheck()

  await expect(page.locator('#rows .source')).toHaveText(
    'classified image accepted'
  )

  await page.locator('#profiles button').nth(1).click()
  await expect(page.locator('#empty')).toBeVisible()
  await tree.locator('[data-category="all"]').click()
  await expect(page.locator('#rows .source')).toHaveText('Inline')
})

test('classification layout reflows without clipping and retains child navigation on narrow screens', async ({
  page
}) => {
  await page.setViewportSize({ width: 375, height: 900 })

  await openReport(
    page,
    reportFixture([
      { ...fixtureLinkedImage, index: 6, source: 'image on mobile' }
    ])
  )

  await page.locator('[data-category="image"]').click()
  await expect(page.locator('[data-category="image.linked"]')).toBeVisible()
  await page.locator('[data-category="image.linked"]').click()
  await expect(page.locator('#rows .source')).toHaveText('image on mobile')

  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth
    )
  ).toBe(true)
})

test('frontend-only reports show only measured profiles in controls and summaries', async ({
  page
}) => {
  const data = reportFixture()
  const { plainText: _unusedResult, ...results } = data.metadata.results

  const { plainText: _unusedBefore, ...before } =
    data.metadata.run.provenance.before

  await openReport(page, {
    metadata: {
      ...data.metadata,
      counts: { ...data.metadata.counts, plainText: 0 },
      filters: { ...data.metadata.filters, plainText: '' },
      authors: { ...data.metadata.authors, plainText: '' },
      classifications: { ...data.metadata.classifications, plainText: '' },
      results,
      run: {
        ...data.metadata.run,
        provenance: { ...data.metadata.run.provenance, before }
      }
    },
    payload: { ...data.payload, plainText: [] }
  })

  await expect(page.locator('#profiles button')).toHaveCount(2)
  await expect(page.locator('.result-summary tr[data-profile]')).toHaveCount(2)
  await expect(page.locator('#speed tbody tr')).toHaveCount(2)
  await expect(page.locator('#footer')).not.toContainText('プレーンテキスト')
  await page.getByLabel('ホワイトスペースのみを除外').check()
  await page.getByRole('button', { name: /S-UI · インライン/ }).click()
  await expect(page.locator('#rows .source')).toHaveText('Inline')
  await page.getByLabel('原文を検索').fill('Inline')
  await page.getByRole('button', { name: '検索', exact: true }).click()
  await expect(page.locator('#rows .source')).toHaveText('Inline')
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

test('HTML preview remains inert and isolates corpus classes from viewer styles', async ({
  page
}) => {
  const externalRequests: string[] = []

  page.on('request', request => {
    if (new URL(request.url()).hostname === 'external.test') {
      externalRequests.push(request.url())
    }
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

test('large reports validate filter masks without exhausting the browser stack', async ({
  page
}) => {
  const count = 250000
  const pageSize = 50
  const counts = byProfile(profile => (profile === 'render' ? count : 0))
  const metadata = fixtureMetadata(counts, pageSize, count)

  const chunk = gzipSync(
    JSON.stringify(
      Array.from({ length: pageSize }, (_, index) => ({
        runId: metadata.run.runId,
        index,
        profile: 'render',
        source: 'Large report row',
        before: { kind: 'html', value: '<p>before</p>' },
        after: { kind: 'html', value: '<p>after</p>' }
      }))
    )
  ).toString('base64')

  await openReport(page, {
    metadata,
    payload: byProfile(profile =>
      profile === 'render' ? Array(count / pageSize).fill(chunk) : []
    )
  })

  await expect(page.locator('#status')).toHaveText('250,000 件')
  await expect(page.locator('#rows > details')).toHaveCount(pageSize)
  await expect(page.locator('#rows .source')).toHaveText('Large report row')
  await expect(page.locator('#pages')).toHaveText('5,000')
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
      classifications: byProfile(() => ''),
      filters: byProfile(() => ''),
      authors: byProfile(() => ''),
      results: byProfile(profile => ({
        ...base.metadata.results[profile]!,
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
