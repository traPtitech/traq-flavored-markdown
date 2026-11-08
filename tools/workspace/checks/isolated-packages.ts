import path from 'node:path'

import { captureProcess } from '../infrastructure/process.ts'
import { withTempDirectory } from '../infrastructure/temp-directory.ts'

const optionalEntries = new Set([
  '@traq-flavored-markdown/commonmark-plugin/highlight',
  '@traq-flavored-markdown/extensions-plugin/math',
  '@traq-flavored-markdown/sdk/adapters'
])

/** Each consumer declares one public package; npm resolves its actual peer graph. */
export async function checkIsolatedPackages(
  packages: {
    name: string
    archive: string
    root: string
  }[]
) {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'

  const overrides = Object.fromEntries(
    packages.map(item => [
      item.name,
      `file:${item.archive.replaceAll('\\', '/')}`
    ])
  )

  for (const item of packages) {
    await withTempDirectory('markdown-isolated-', async directory => {
      await Bun.write(
        path.join(directory, 'package.json'),
        JSON.stringify({
          private: true,
          type: 'module',
          dependencies: { [item.name]: overrides[item.name] },
          overrides
        })
      )

      await captureProcess(
        npm,
        [
          'install',
          '--ignore-scripts',
          '--no-audit',
          '--no-fund',
          '--registry=https://registry.npmjs.org'
        ],
        directory
      )

      const manifest = await Bun.file(
        path.join(item.root, 'package.json')
      ).json()

      const entries = Object.entries(
        manifest.exports as Record<string, unknown>
      )
        .filter(
          ([, value]) => value && typeof value === 'object' && 'import' in value
        )
        .map(([entry]) => item.name + (entry === '.' ? '' : entry.slice(1)))
        .filter(entry => !optionalEntries.has(entry))

      await Bun.write(
        path.join(directory, 'consumer.mjs'),
        entries
          .map(entry => `await import(${JSON.stringify(entry)})`)
          .join('\n')
      )

      await captureProcess('node', ['consumer.mjs'], directory)

      console.log(
        `[check:package] Isolated ${item.name}: ${entries.length} entries passed`
      )
    })
  }
}
