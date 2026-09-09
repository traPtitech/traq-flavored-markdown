const root = new URL('../', import.meta.url)
for (const [repo, allowed] of [
  ['core', []],
  ['commonmark', ['core', 'commonmark']],
  ['trap-extension', ['core', 'commonmark', 'trap-extension']],
  ['traq', ['core', 'commonmark', 'trap-extension', 'traq']]
]) {
  const directory = new URL(`../${repo}/typescript/`, root)
  let count = 0
  for await (const relative of new Bun.Glob('**/*.ts').scan({
    cwd: Bun.fileURLToPath(directory),
    onlyFiles: true
  })) {
    if (relative.split(/[\\/]/).includes('tests')) continue
    count++
    const file = new URL(relative.replaceAll('\\', '/'), directory)
    const source = await Bun.file(file).text()
    if (source.includes('@traptitech/traq-markdown-it'))
      throw new Error(file + ': retired package dependency')
    for (const [, name] of source.matchAll(
      /from ['"]@traq-markdown-parser\/([^/'"]+)/g
    ))
      if (!allowed.includes(name))
        throw new Error(file + ': upward dependency ' + name)
    if (repo !== 'core' && /interface (?:Node|Document)\s*[<{]/.test(source))
      throw new Error(file + ': redeclared AST')
  }
  console.log(
    repo + ': ' + count + ' TypeScript modules follow owner dependencies'
  )
}
