import { expect, test } from 'bun:test'

import { repositoryRoot } from '../paths.ts'

type Manifest = {
  workspaces?: string[]
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  overrides?: Record<string, string>
}

const manifest: Manifest = await Bun.file(
  new URL('../../package.json', import.meta.url)
).json()
const { install } = Bun.TOML.parse(
  await Bun.file(new URL('../../bunfig.toml', import.meta.url)).text()
) as {
  install: {
    ignoreScripts: boolean
    minimumReleaseAge: number
    minimumReleaseAgeExcludes: string[]
  }
}

test('installation keeps script blocking and the seven-day age gate', () => {
  expect(install.ignoreScripts).toBe(true)
  expect(install.minimumReleaseAge).toBeGreaterThanOrEqual(604800)
})

test('every release-age exemption has a matching exact override', async () => {
  const overrides = manifest.overrides ?? {}
  for (const name of install.minimumReleaseAgeExcludes)
    expect(overrides[name]).toMatch(/^\d+\.\d+\.\d+$/)

  for (const workspace of ['.', ...(manifest.workspaces ?? [])]) {
    const files = new Bun.Glob(`${workspace}/package.json`).scan({
      cwd: repositoryRoot,
      absolute: true,
      onlyFiles: true
    })
    for await (const file of files) {
      const pkg: Manifest = await Bun.file(file).json()
      const dependencies = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
        ...pkg.optionalDependencies
      }
      for (const name of install.minimumReleaseAgeExcludes)
        if (dependencies[name]) expect(overrides[name]).toBe(dependencies[name])
    }
  }
})
