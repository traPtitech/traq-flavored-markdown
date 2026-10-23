import { rm, stat } from 'node:fs/promises'
import path from 'node:path'

/** Full builds replace dist; TypeScript-only builds retain Wasm, CSS and metadata. */
export async function cleanBuildOutput(
  root: string,
  mode: 'all' | 'typescript' = 'all'
) {
  const directory = path.resolve(root, 'dist')
  if (path.dirname(directory) !== path.resolve(root))
    throw new Error('Invalid package output directory')
  if (mode === 'all') {
    await rm(directory, { recursive: true, force: true })
    return
  }
  try {
    if (!(await stat(directory)).isDirectory())
      throw new Error('Package dist is not a directory')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
    throw error
  }
  for await (const relative of new Bun.Glob('**/*').scan({
    cwd: directory,
    onlyFiles: true,
    followSymlinks: false
  })) {
    if (!/(?:\.[cm]?js|\.d\.[cm]?ts)(?:\.map)?$/.test(relative)) continue
    const output = path.resolve(directory, relative)
    if (!output.startsWith(directory + path.sep))
      throw new Error('TypeScript output escapes dist')
    await rm(output, { force: true })
  }
}
