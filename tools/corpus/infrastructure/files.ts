import { mkdir, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

export async function sha256(file: string) {
  const hash = new Bun.CryptoHasher('sha256')
  for await (const chunk of Bun.file(file).stream()) hash.update(chunk)
  return hash.digest('hex')
}

export async function fingerprintFiles(root: string, files: readonly string[]) {
  const hash = new Bun.CryptoHasher('sha256')
  for (const file of [...files].sort()) {
    hash.update(file.replaceAll('\\', '/') + '\0')
    hash.update(await sha256(path.join(root, file)))
  }
  return hash.digest('hex')
}

export async function writeJson(file: string, value: unknown) {
  await mkdir(path.dirname(file), { recursive: true })
  const temporary = file + '.' + crypto.randomUUID() + '.tmp'
  await writeFile(temporary, JSON.stringify(value, null, 2) + '\n', {
    mode: 0o600
  })
  await rename(temporary, file)
}
