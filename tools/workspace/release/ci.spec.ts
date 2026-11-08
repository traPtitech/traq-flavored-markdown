import { expect, test } from 'bun:test'

import { verifyReleaseSource } from './ci.ts'

const source = { repository: 'owner/repo', branch: 'main', revision: 'abc' }

const success = {
  head_sha: 'abc',
  head_branch: 'main',
  event: 'push',
  status: 'completed',
  conclusion: 'success',
  html_url: 'https://example.test/run'
}

test('release CI checks the pinned source and leaves failed or pending runs visible', async () => {
  const request = async (url: string) => {
    const query = new URL(String(url)).searchParams
    expect(query.get('head_sha')).toBe('abc')
    expect(query.has('status')).toBe(false)
    return Response.json({ workflow_runs: [success] })
  }

  expect(await verifyReleaseSource(source, 'token', request)).toBe(
    success.html_url
  )

  for (const run of [
    undefined,
    { ...success, head_sha: 'other' },
    { ...success, head_branch: 'other' },
    { ...success, event: 'pull_request' },
    { ...success, status: 'in_progress' },
    { ...success, conclusion: 'failure' },
    { ...success, conclusion: 'cancelled' }
  ]) {
    const request = async () =>
      Response.json({ workflow_runs: run ? [run] : [] })

    await expect(verifyReleaseSource(source, 'token', request)).rejects.toThrow(
      'requires successful CI'
    )
  }
})
