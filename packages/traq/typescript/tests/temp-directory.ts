import { $, env } from 'bun'

const tempRoot = env.TMPDIR ?? env.TEMP ?? env.TMP ?? '/tmp'

export const withTempDirectory = async <T>(
  prefix: string,
  run: (directory: string) => Promise<T>
) => {
  const directory = `${tempRoot}/${prefix}${crypto.randomUUID()}`
  await $`mkdir ${directory}`
  try {
    return await run(directory)
  } finally {
    await $`rm -rf ${directory}`
  }
}
