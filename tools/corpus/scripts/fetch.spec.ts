import path from 'path'

import { $ } from 'bun'
import { expect, test } from 'bun:test'

import { collect } from './fetch.ts'

test('corpus collection respects bounds, credentials, and no-overwrite behavior', async () => {
  const directory = path.join(
    Bun.env.TEMP ?? Bun.env.TMPDIR ?? '.',
    `traq-corpus-check-${crypto.randomUUID()}`
  )
  await $`mkdir -p ${directory}`
  try {
    const calls: string[] = [],
      logs: unknown[] = []
    const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === 'string'
          ? new URL(input)
          : input instanceof URL
            ? input
            : new URL((input as Request).url)
      calls.push(url.toString())
      expect(init?.method).toBe('GET')
      expect(init?.redirect).toBe('error')
      expect((init?.headers as Record<string, string>)?.Authorization).toBe(
        'Bearer test-token'
      )
      if (url.pathname.endsWith('/channels'))
        return Response.json({
          public: [{ id: 'channel-a' }],
          dm: [{ id: 'private-dm' }]
        })
      expect(url.toString()).not.toContain('private-dm')
      expect(url.searchParams.get('limit')).toBe('2')
      return Response.json([
        { id: 'a', userId: 'author', content: '**private text**' },
        { id: 'b', content: '`code`' }
      ])
    }
    const result = await collect({
      baseUrl: 'https://traq.example/',
      token: 'test-token',
      output: directory,
      maxMessages: 2,
      perChannel: 5,
      delayMs: 0,
      fetchImpl: fetchImpl as typeof fetch,
      progress: x => {
        logs.push(x)
      }
    })
    expect(result.messages).toBe(2)
    expect(calls.length).toBe(2)
    const saved = (
      await Bun.file(path.join(directory, 'messages.jsonl')).text()
    )
      .trim()
      .split('\n')
      .map(line => JSON.parse(line))
    expect(saved[0].source).toBe('**private text**')
    expect(saved[0].id).not.toBe('a')
    expect(saved[0].userId).toBeUndefined()
    expect(JSON.stringify(result)).not.toContain('private text')
    expect(JSON.stringify(logs)).not.toContain('test-token')
    await expect(
      collect({
        baseUrl: 'https://traq.example/',
        token: 'test-token',
        output: directory,
        fetchImpl: fetchImpl as typeof fetch
      })
    ).rejects.toMatchObject({ code: 'EEXIST' })
    console.log(
      'PASS read-only sampling, bounds, credential handling, raw local corpus, no overwrite'
    )
  } finally {
    await $`rm -rf ${directory}`
  }
})
