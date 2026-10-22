import { mkdir, open } from 'node:fs/promises'
import path from 'node:path'

import { encodeRecord } from '../shared/protocol.ts'

export async function createJsonlSink(file: string) {
  await mkdir(path.dirname(file), { recursive: true })
  const handle = await open(file, 'wx', 0o600)
  return {
    write: (record: unknown) => handle.write(encodeRecord(record)),
    close: () => handle.close()
  }
}
