type PackedPackage = {
  name: string
  filename: string
  files: { path: string }[]
}

/** npm 11 returns an array; npm 12 keys pack results by package name. */
export function readNpmPack(output: string, name: string): PackedPackage {
  const parsed = JSON.parse(output) as
    PackedPackage[] | Record<string, PackedPackage>
  const packed = Array.isArray(parsed)
    ? parsed.find(result => result?.name === name)
    : parsed?.[name]
  if (
    !packed ||
    packed.name !== name ||
    typeof packed.filename !== 'string' ||
    !Array.isArray(packed.files) ||
    packed.files.some(file => typeof file?.path !== 'string')
  )
    throw new Error(`npm pack did not return a valid package for ${name}`)
  return packed
}
