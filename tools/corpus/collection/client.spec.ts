import { expect, test } from 'bun:test'

import { createApiClient } from './client.ts'
import { createMessageGateway } from './gateway.ts'

test('API retries exhaust their fixed budget with injected scheduling', async () => {
  let requests = 0
  const sleeps: number[] = []
  const client = createApiClient({
    baseUrl: 'https://example.test',
    token: 'test',
    delayMs: 3,
    fetchImpl: async () => {
      requests++
      return new Response('', { status: 503 })
    },
    sleep: async ms => {
      sleeps.push(ms)
    }
  })
  await expect(client.get('channels')).rejects.toThrow('HTTP 503')
  expect(requests).toBe(4)
  expect(sleeps).toEqual([1000, 3, 2000, 3, 4000, 3])
})

test('gateway rejects malformed fields and oversized pages without including bodies', async () => {
  for (const body of [{ public: [null] }, { public: [{ id: 3 }] }, null]) {
    const gateway = createMessageGateway({ get: async () => body })
    await expect(gateway.publicChannels()).rejects.toThrow('body omitted')
  }
  for (const body of [
    [{ id: 'one', content: null }],
    [{ id: '', content: 'secret' }],
    [
      { id: '1', content: 'one' },
      { id: '2', content: 'two' }
    ]
  ]) {
    const gateway = createMessageGateway({ get: async () => body })
    await expect(
      gateway.messages('channel', { limit: 1, offset: 0, until: '2026-01-01' })
    ).rejects.toThrow('body omitted')
  }
})

test('gateway snapshots bot categories once and retains unknown accounts without guessing', async () => {
  for (const users of [
    [
      { id: 'bot', bot: true },
      { id: 'human', bot: false }
    ],
    null
  ]) {
    const calls: string[] = []
    const gateway = createMessageGateway({
      get: async endpoint => {
        calls.push(endpoint)
        return endpoint.startsWith('users?')
          ? users
          : [
              { id: 'a', userId: 'bot', content: 'Hello' },
              { id: 'b', userId: 'human', content: 'BOT says hello' },
              { id: 'c', userId: 'missing', content: 'BOT' }
            ]
      }
    })
    for (let offset = 0; offset < 2; offset++) {
      const rows = await gateway.messages('channel', {
        limit: 3,
        offset,
        until: '2026-01-01'
      })
      expect(rows?.map(row => row.isBot)).toEqual(
        users ? [true, false, undefined] : [undefined, undefined, undefined]
      )
      expect(rows?.some(row => 'userId' in row)).toBe(false)
    }
    expect(
      calls.filter(endpoint => endpoint.startsWith('users?'))
    ).toHaveLength(1)
  }
})
