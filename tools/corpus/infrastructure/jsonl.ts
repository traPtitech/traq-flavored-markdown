import { mkdir, open } from 'node:fs/promises'
import path from 'node:path'

import { parseDifferenceRow, parseSource } from '../protocol/comparison.ts'

export { parseSource }
export const parseDifferenceLine = (line: string) =>
  parseDifferenceRow(JSON.parse(line))
export const encodeRecord = (value: unknown) => JSON.stringify(value) + '\n'

/** JSONL delimiters are LF; U+2028 and U+2029 can occur inside JSON strings. */
export async function* readLines(file: string) {
  let pending = ''
  const decoder = new TextDecoder()
  for await (const chunk of Bun.file(file).stream()) {
    pending += decoder.decode(chunk, { stream: true })
    let start = 0,
      end: number
    while ((end = pending.indexOf('\n', start)) !== -1) {
      const line = pending.slice(start, end).replace(/\r$/, '')
      if (line) yield line
      start = end + 1
    }
    pending = pending.slice(start)
  }
  pending += decoder.decode()
  if (pending) yield pending.replace(/\r$/, '')
}

export async function* readSources(file: string) {
  for await (const line of readLines(file)) yield parseSource(line)
}

export async function createJsonlSink(file: string) {
  await mkdir(path.dirname(file), { recursive: true })
  const handle = await open(file, 'wx', 0o600)
  let closed = false
  const close = async () => {
    if (closed) return
    closed = true
    await handle.close()
  }
  return {
    write: (record: unknown) => handle.writeFile(encodeRecord(record)),
    close,
    [Symbol.asyncDispose]: close
  }
}
