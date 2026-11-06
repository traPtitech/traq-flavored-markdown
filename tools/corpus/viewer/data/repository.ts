import {
  type Classification,
  classificationAt,
  classificationKeys,
  classificationMemberships,
  matchesClassification,
  needsReview
} from '../../protocol/classification.ts'
import {
  type DifferenceRow,
  type ProfileId,
  type ReportMetadata,
  filterMaskAt,
  parseDifferenceRow
} from '../../protocol/report.ts'
import { type ReportData, parseReport } from '../../protocol/report.ts'
import {
  type ClassificationCounts,
  type Progress,
  type Query,
  type QueryResult,
  normalizePage
} from './query.ts'

export { parseReport, type ReportData } from '../../protocol/report.ts'

type Hit = readonly [number, number]

export function readEmbeddedReport(
  document: Pick<Document, 'getElementById'>
): ReportData {
  const read = (id: string) =>
    JSON.parse(document.getElementById(id)?.textContent ?? 'null')
  return parseReport(read('metadata'), read('payload'))
}

async function decompress(encoded: string): Promise<unknown> {
  const bytes = Uint8Array.from(atob(encoded), character =>
    character.charCodeAt(0)
  )
  return JSON.parse(
    await new Response(
      new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
    ).text()
  )
}

export class ReportRepository {
  readonly metadata: ReportMetadata
  private readonly chunks = new Map<string, Promise<DifferenceRow[]>>()
  private readonly filters = new Map<
    string,
    { hits: readonly Hit[] | null; counts: ClassificationCounts }
  >()
  private readonly classifications = new Map<ProfileId, Classification[]>()
  constructor(
    private readonly data: ReportData,
    private readonly decode = decompress
  ) {
    this.metadata = data.metadata
  }

  private classification(profile: ProfileId, index: number) {
    let values = this.classifications.get(profile)
    if (!values) {
      values = Array.from({ length: this.metadata.counts[profile] }, (_, i) =>
        classificationAt(this.metadata.classifications[profile], i)
      )
      this.classifications.set(profile, values)
    }
    return values[index]
  }

  async loadChunk(profile: ProfileId, index: number) {
    if (!this.metadata.results[profile])
      throw new Error('Profile was not compared: ' + profile)
    const key = `${profile}:${index}`
    const previous = this.chunks.get(key)
    if (previous) return previous
    const encoded = this.data.payload[profile][index]
    if (encoded === undefined)
      throw new Error(`Missing ${profile} chunk ${index}`)
    const task = this.decode(encoded).then(value => {
      if (!Array.isArray(value)) throw new Error('Invalid report chunk')
      const rows = value.map(parseDifferenceRow)
      const expected = Math.min(
        this.metadata.pageSize,
        this.metadata.counts[profile] - index * this.metadata.pageSize
      )
      if (
        rows.length !== expected ||
        rows.some(
          row =>
            row.profile !== profile || row.runId !== this.metadata.run.runId
        )
      )
        throw new Error('Report chunk does not match metadata')
      return rows
    })
    this.chunks.set(key, task)
    if (this.chunks.size > 10)
      this.chunks.delete(this.chunks.keys().next().value!)
    try {
      return await task
    } catch (error) {
      this.chunks.delete(key)
      throw error
    }
  }

  async query(
    query: Query,
    signal?: AbortSignal,
    progress: (value: Progress) => void = () => undefined
  ): Promise<QueryResult> {
    if (!this.metadata.results[query.profile])
      throw new Error('Profile was not compared: ' + query.profile)
    const search = query.search.trim().toLowerCase()
    // Bits enumerate nonempty combinations of the seven normalization options.
    const combination =
      Number(query.ignoreWhitespace) |
      (Number(query.ignoreCase) << 1) |
      (Number(query.ignoreLinkedImages) << 2) |
      (Number(query.ignoreHtmlSerialization) << 3) |
      (Number(query.ignoreKatexErrors) << 4) |
      (Number(query.ignoreLinkPolicy) << 5) |
      (Number(query.ignoreNestedLinks) << 6)
    const mask = combination ? 1n << BigInt(combination - 1) : 0n
    const key = JSON.stringify([
      query.profile,
      search,
      combination,
      query.excludeBots,
      query.category ?? 'all',
      Boolean(query.onlyReview)
    ])
    let cached = this.filters.get(key)
    signal?.throwIfAborted()
    if (cached === undefined) {
      const counts: ClassificationCounts = Object.fromEntries(
        classificationKeys.map(id => [id, { total: 0, review: 0 }])
      )
      const found: Hit[] = [],
        total = this.data.payload[query.profile].length
      for (let chunk = 0; chunk < total; chunk++) {
        const rows = search
          ? await this.loadChunk(query.profile, chunk)
          : undefined
        signal?.throwIfAborted()
        const length = Math.min(
          this.metadata.pageSize,
          this.metadata.counts[query.profile] - chunk * this.metadata.pageSize
        )
        for (let index = 0; index < length; index++) {
          if (
            query.excludeBots &&
            this.metadata.authors[query.profile][
              chunk * this.metadata.pageSize + index
            ] === 'b'
          )
            continue
          if (
            mask &&
            filterMaskAt(
              this.metadata.filters[query.profile],
              chunk * this.metadata.pageSize + index
            ) & mask
          )
            continue
          if (search && !rows![index].source.toLowerCase().includes(search))
            continue
          const value = this.classification(
            query.profile,
            chunk * this.metadata.pageSize + index
          )
          const review = needsReview(value)
          if (query.onlyReview && !review) continue
          const memberships = classificationMemberships(value)
          for (const id of memberships) {
            counts[id].total++
            if (review) counts[id].review++
          }
          if (matchesClassification(value, query.category ?? 'all'))
            found.push([chunk, index])
        }
        progress({ done: chunk + 1, total })
      }
      cached = {
        hits:
          found.length === this.metadata.counts[query.profile] ? null : found,
        counts
      }
      this.filters.set(key, cached)
      if (this.filters.size > 4)
        this.filters.delete(this.filters.keys().next().value!)
    }
    const { hits, counts: classificationCounts } = cached
    const totalHits = hits?.length ?? this.metadata.counts[query.profile]
    const totalPages = Math.max(
      1,
      Math.ceil(totalHits / this.metadata.pageSize)
    )
    const page = normalizePage(query.page, totalPages)
    const rows: DifferenceRow[] = []
    const classifications: Classification[] = []
    if (totalHits) {
      if (hits === null) {
        rows.push(...(await this.loadChunk(query.profile, page - 1)))
        classifications.push(
          ...rows.map((_, index) =>
            this.classification(
              query.profile,
              (page - 1) * this.metadata.pageSize + index
            )
          )
        )
      } else
        for (const [chunk, index] of hits.slice(
          (page - 1) * this.metadata.pageSize,
          page * this.metadata.pageSize
        )) {
          rows.push((await this.loadChunk(query.profile, chunk))[index])
          classifications.push(
            this.classification(
              query.profile,
              chunk * this.metadata.pageSize + index
            )
          )
        }
    }
    signal?.throwIfAborted()
    return {
      rows,
      classifications,
      classificationCounts,
      totalHits,
      totalPages,
      page,
      filtered: hits !== null
    }
  }
}
