import { expect, test } from 'bun:test'

import { repositoryRoot } from './paths.ts'
import { parseToolchains, readToolchains } from './toolchains.ts'

test('CI reads runtime versions, Rust components, and targets from their declarations', async () => {
  const versions = await readToolchains(repositoryRoot)
  expect(versions.bun).toBe(
    (
      await Bun.file(`${repositoryRoot}/package.json`).json()
    ).packageManager.slice(4)
  )
  expect(versions['rust-targets']).toBe('wasm32-unknown-unknown')
  expect(versions['rust-components']).toBe('clippy,rustfmt')
})

test('toolchain pins reject moving channels and missing versions', () => {
  const rust = '[toolchain]\nchannel = "1.99.1"'
  expect(() =>
    parseToolchains('bun@latest', rust, '26.12.1', {
      go: '1.27.3',
      npm: '12.2.1'
    })
  ).toThrow('Bun')
  expect(() =>
    parseToolchains('bun@1.4.3', rust.replace('1.99.1', 'stable'), '26.12.1', {
      go: '1.27.3',
      npm: '12.2.1'
    })
  ).toThrow('Rust')
  expect(() =>
    parseToolchains('bun@1.4.3', rust, '26.12.1', { npm: '12.2.1' })
  ).toThrow('Go')
})
