import path from 'path'

export async function declarations(input: string, names: Iterable<string>) {
  const types = new Map<string, string>()
  const declaration = async (name: string): Promise<void> => {
    if (types.has(name)) return
    const source = await Bun.file(path.join(input, name + '.ts')).text()
    types.set(
      name,
      source
        .replace(/\r\n?/g, '\n')
        .replace(/^\/\/[^\n]*\n/gm, '')
        .replace(/^import type .*;\n/gm, '')
        .replace(/[ \t]+$/gm, '')
        .trim()
    )
    for (const match of source.matchAll(/from ["']\.\/([^"']+)\.js["']/g))
      await declaration(match[1])
  }

  for (const name of names) await declaration(name)
  return types
}
