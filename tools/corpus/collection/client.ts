export type ApiClient = { get(relative: string): Promise<unknown> }
export type Fetch = (
  ...args: Parameters<typeof fetch>
) => ReturnType<typeof fetch>

/** Read-only client; errors intentionally omit credentials and response bodies. */
export function createApiClient({
  baseUrl,
  token,
  delayMs = 300,
  fetchImpl = fetch,
  sleep = (ms: number) => Bun.sleep(ms),
  requested = () => undefined
}: {
  baseUrl: string
  token: string
  delayMs?: number
  fetchImpl?: Fetch
  sleep?: (ms: number) => Promise<unknown>
  requested?: () => void
}): ApiClient {
  const base = new URL(baseUrl)
  if (
    base.protocol !== 'https:' &&
    !(
      base.protocol === 'http:' &&
      ['127.0.0.1', 'localhost'].includes(base.hostname)
    )
  )
    throw new Error('HTTPS is required')
  if (base.username || base.password || base.search || base.hash)
    throw new Error(
      'Provide a base URL without credentials, query, or fragment'
    )
  base.pathname =
    base.pathname.replace(/\/$/, '').replace(/\/api\/v3$/, '') + '/api/v3/'
  if (!/^[\x21-\x7e]+$/.test(token))
    throw new Error('Invalid token file format')
  let requests = 0
  return {
    async get(relative) {
      const url = new URL(relative, base)
      if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname))
        throw new Error('Request escaped API origin')
      for (let attempt = 0; attempt < 4; attempt++) {
        if (requests++) await sleep(delayMs)
        requested()
        let response: Response
        try {
          response = await fetchImpl(url, {
            method: 'GET',
            redirect: 'error',
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/json'
            },
            signal: AbortSignal.timeout(20000)
          })
        } catch {
          if (attempt < 3) {
            await sleep(1000 * 2 ** attempt)
            continue
          }
          throw new Error(
            'API connection failed (credentials and response omitted)'
          )
        }
        if ([429, 502, 503, 504].includes(response.status) && attempt < 3) {
          const retry = Math.min(
            30000,
            Math.max(
              1000,
              Number(response.headers.get('retry-after') ?? 0) * 1000 ||
                1000 * 2 ** attempt
            )
          )
          await response.body?.cancel()
          await sleep(retry)
          continue
        }
        if ([403, 404].includes(response.status)) {
          await response.body?.cancel()
          return null
        }
        if (!response.ok) {
          await response.body?.cancel()
          throw new Error(`API returned HTTP ${response.status} (body omitted)`)
        }
        try {
          return await response.json()
        } catch {
          throw new Error('API returned invalid JSON (body omitted)')
        }
      }
      throw new Error('API retry limit exceeded')
    }
  }
}
