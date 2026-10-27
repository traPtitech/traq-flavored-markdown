import {
  type DifferenceRow,
  type ProfileId,
  type ReportMetadata,
  filterMaskAt,
  parseDifferenceRow
} from '../../protocol/report.ts'
import { type ReportData, parseReport } from '../../protocol/report.ts'
import {
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
  private readonly filters = new Map<string, readonly Hit[] | null>()
  constructor(
    private readonly data: ReportData,
    private readonly decode = decompress
  ) {
    this.metadata = data.metadata
  }

  async loadChunk(profile: ProfileId, index: number) {
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
    const search = query.search.trim().toLowerCase()
    // Bits enumerate nonempty combinations of the six normalization options.
    const combination =
      Number(query.ignoreWhitespace) |
      (Number(query.ignoreCase) << 1) |
      (Number(query.ignoreLinkedImages) << 2) |
      (Number(query.ignoreHtmlSerialization) << 3) |
      (Number(query.ignoreKatexErrors) << 4) |
      (Number(query.ignoreLinkPolicy) << 5)
    const mask = combination ? 1n << BigInt(combination - 1) : 0n
    const key = JSON.stringify([
      query.profile,
      search,
      combination,
      query.excludeBots
    ])
    let hits = this.filters.get(key)
    signal?.throwIfAborted()
    if (hits === undefined) {
      if (!search && !mask && !query.excludeBots) hits = null
      else {
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
              filterMaskAt(
                this.metadata.filters[query.profile],
                chunk * this.metadata.pageSize + index
              ) & mask
            )
              continue
            if (!search || rows![index].source.toLowerCase().includes(search))
              found.push([chunk, index])
          }
          progress({ done: chunk + 1, total })
        }
        hits =
          found.length === this.metadata.counts[query.profile] ? null : found
      }
      this.filters.set(key, hits)
      if (this.filters.size > 4)
        this.filters.delete(this.filters.keys().next().value!)
    }
    const totalHits = hits?.length ?? this.metadata.counts[query.profile]
    const totalPages = Math.max(
      1,
      Math.ceil(totalHits / this.metadata.pageSize)
    )
    const page = normalizePage(query.page, totalPages)
    const rows: DifferenceRow[] = []
    if (totalHits) {
      if (hits === null)
        rows.push(...(await this.loadChunk(query.profile, page - 1)))
      else
        for (const [chunk, index] of hits.slice(
          (page - 1) * this.metadata.pageSize,
          page * this.metadata.pageSize
        ))
          rows.push((await this.loadChunk(query.profile, chunk))[index])
    }
    signal?.throwIfAborted()
    return { rows, totalHits, totalPages, page, filtered: hits !== null }
  }
}
