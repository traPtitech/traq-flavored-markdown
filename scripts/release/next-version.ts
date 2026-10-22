import { appendFile } from 'node:fs/promises'
import path from 'node:path'

import { repositoryRoot } from '../paths.ts'
import { incrementVersion } from './version.ts'

const component = Bun.argv[2] ?? process.env.RELEASE_TYPE
if (!component || Bun.argv.length > 3)
  throw new Error('usage: next-version.ts <major|minor|patch>')
const manifest = await Bun.file(
  path.join(repositoryRoot, 'package.json')
).json()
const version = incrementVersion(manifest.version, component)
if (process.env.GITHUB_ENV)
  await appendFile(
    process.env.GITHUB_ENV,
    `RELEASE_VERSION=${version.npm}\nRELEASE_TAG=${version.tag}\n`
  )
else console.log(version.tag)
