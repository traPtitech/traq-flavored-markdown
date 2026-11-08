import { appendFile } from 'node:fs/promises'

import { captureProcess } from '../infrastructure/process.ts'
import { repositoryRoot } from '../paths.ts'
import { verifyReleaseSource } from './ci.ts'

const required = (name: string) => {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

const revision = required('RELEASE_SOURCE_SHA')

const head = (
  await captureProcess('git', ['rev-parse', 'HEAD'], repositoryRoot)
).trim()
if (head !== revision) {
  throw new Error('Checkout differs from the release source')
}

const url = await verifyReleaseSource(
  {
    repository: required('GITHUB_REPOSITORY'),
    branch: required('DEFAULT_BRANCH'),
    revision
  },
  required('GITHUB_TOKEN')
)

console.log(`Release source: ${revision}; CI: ${url}`)

if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(
    process.env.GITHUB_STEP_SUMMARY,
    `Release source: \`${revision}\` ([successful CI](${url})).\n`
  )
}
