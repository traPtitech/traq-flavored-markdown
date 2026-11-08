export type ReleaseSource = {
  repository: string
  branch: string
  revision: string
}

type WorkflowRun = {
  head_sha: string
  head_branch: string
  event: string
  status: string
  conclusion: string | null
  html_url: string
}

/** Query the latest run without a success filter so failed reruns stay visible. */
export async function verifyReleaseSource(
  source: ReleaseSource,
  token: string,
  request: (url: string, init: RequestInit) => Promise<Response> = fetch
) {
  const query = new URLSearchParams({
    head_sha: source.revision,
    branch: source.branch,
    event: 'push',
    per_page: '1'
  })

  const response = await request(
    `https://api.github.com/repos/${source.repository}/actions/workflows/ci.yml/runs?${query}`,
    {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28'
      }
    }
  )

  if (!response.ok) {
    throw new Error(`Cannot verify release CI: HTTP ${response.status}`)
  }

  const result = (await response.json()) as { workflow_runs?: WorkflowRun[] }
  const run = result.workflow_runs?.[0]

  if (
    !run ||
    run.head_sha !== source.revision ||
    run.head_branch !== source.branch ||
    run.event !== 'push' ||
    run.status !== 'completed' ||
    run.conclusion !== 'success'
  ) {
    throw new Error(
      `Release source ${source.revision} requires successful CI on ${source.branch}`
    )
  }

  return run.html_url
}
