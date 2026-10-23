import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { expect, test } from 'bun:test'

import { collect } from './collect.ts'

test('corpus collection respects bounds, credentials, and no-overwrite behavior', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'traq-corpus-check-'))
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
      fetchImpl,
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
        fetchImpl
      })
    ).rejects.toMatchObject({ code: 'EEXIST' })
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('failed collection records its status and preserves the original error', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'traq-corpus-failure-'))
  try {
    await expect(
      collect({
        baseUrl: 'https://traq.example/',
        token: 'test-token',
        output: directory,
        delayMs: 0,
        fetchImpl: async () => Response.json({ public: [null] })
      })
    ).rejects.toThrow('Invalid channel fields')
    const manifest = await Bun.file(
      path.join(directory, 'manifest.json')
    ).json()
    expect(manifest.status).toBe('failed')
    expect(manifest.messages).toBe(0)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
