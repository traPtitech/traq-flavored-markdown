import {
  type DifferenceRow,
  type Mode,
  type ReportMetadata,
  parseDifferenceRow
} from '../../report-schema.ts'
import { type ReportData, parseReport } from '../../shared/report-data.ts'
import {
  type Progress,
  type Query,
  type QueryResult,
  normalizePage
} from './query.ts'

export { parseReport, type ReportData } from '../../shared/report-data.ts'

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

  async loadChunk(mode: Mode, index: number) {
    const key = `${mode}:${index}`
    const previous = this.chunks.get(key)
    if (previous) return previous
    const encoded = this.data.payload[mode][index]
    if (encoded === undefined) throw new Error(`Missing ${mode} chunk ${index}`)
    const task = this.decode(encoded).then(value => {
      if (!Array.isArray(value)) throw new Error('Invalid report chunk')
      const rows = value.map(parseDifferenceRow)
      const expected = Math.min(
        this.metadata.pageSize,
        this.metadata.counts[mode] - index * this.metadata.pageSize
      )
      if (rows.length !== expected || rows.some(row => row.mode !== mode))
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
    const key = JSON.stringify([query.mode, search, query.ignoreWhitespace])
    let hits = this.filters.get(key)
    signal?.throwIfAborted()
    if (hits === undefined) {
      if (!search && !query.ignoreWhitespace) hits = null
      else {
        const found: Hit[] = [],
          total = this.data.payload[query.mode].length
        for (let chunk = 0; chunk < total; chunk++) {
          const rows = search
            ? await this.loadChunk(query.mode, chunk)
            : undefined
          signal?.throwIfAborted()
          const length = Math.min(
            this.metadata.pageSize,
            this.metadata.counts[query.mode] - chunk * this.metadata.pageSize
          )
          for (let index = 0; index < length; index++) {
            if (
              query.ignoreWhitespace &&
              this.metadata.filters[query.mode][
                chunk * this.metadata.pageSize + index
              ] === '1'
            )
              continue
            if (!search || rows![index].source.toLowerCase().includes(search))
              found.push([chunk, index])
          }
          progress({ done: chunk + 1, total })
        }
        hits = found.length === this.metadata.counts[query.mode] ? null : found
      }
      this.filters.set(key, hits)
      if (this.filters.size > 4)
        this.filters.delete(this.filters.keys().next().value!)
    }
    const totalHits = hits?.length ?? this.metadata.counts[query.mode]
    const totalPages = Math.max(
      1,
      Math.ceil(totalHits / this.metadata.pageSize)
    )
    const page = normalizePage(query.page, totalPages)
    const rows: DifferenceRow[] = []
    if (totalHits) {
      if (hits === null)
        rows.push(...(await this.loadChunk(query.mode, page - 1)))
      else
        for (const [chunk, index] of hits.slice(
          (page - 1) * this.metadata.pageSize,
          page * this.metadata.pageSize
        ))
          rows.push((await this.loadChunk(query.mode, chunk))[index])
    }
    signal?.throwIfAborted()
    return { rows, totalHits, totalPages, page, filtered: hits !== null }
  }
}
