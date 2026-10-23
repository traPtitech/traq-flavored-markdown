import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

export const withTempDirectory = async <T>(
  prefix: string,
  run: (directory: string) => Promise<T>
) => {
  const directory = await mkdtemp(path.join(tmpdir(), prefix))
  try {
    return await run(directory)
  } finally {
    // Windows may retain process working-directory handles briefly after exit.
    await rm(directory, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100
    })
  }
}
