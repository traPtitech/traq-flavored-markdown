import { expect, test } from 'bun:test'

import { createApiClient } from './client.ts'
import { sampleMessages, selectChannels } from './sampling.ts'

test('sampling bounds and deduplication do not depend on a network or filesystem', async () => {
  const records = []
  for await (const record of sampleMessages(
    {
      get: async relative =>
        relative.startsWith('channels?')
          ? { public: [{ id: 'c' }] }
          : [
              { id: '1', content: 'one' },
              { id: '1', content: 'duplicate' },
              { id: '2', content: 'two' }
            ]
    },
    {
      maxMessages: 1,
      maxChannels: 1,
      channelOffset: 0,
      perChannel: 1,
      until: '2026-01-01'
    }
  ))
    records.push(record)
  expect(records).toEqual([{ id: '1', channel: 'c', source: 'one' }])
  expect(selectChannels([{ id: 'b' }, { id: 'a' }], 0, 1, id => id)[0].id).toBe(
    'a'
  )
})

test('API retries are bounded and scheduling can be injected', async () => {
  let requests = 0
  const sleeps: number[] = []
  const client = createApiClient({
    baseUrl: 'https://example.test',
    token: 'test',
    delayMs: 3,
    fetchImpl: async () =>
      ++requests === 1
        ? new Response('', { status: 503 })
        : Response.json({ okay: true }),
    sleep: async ms => {
      sleeps.push(ms)
    }
  })
  expect(await client.get('channels')).toEqual({ okay: true })
  expect(requests).toBe(2)
  expect(sleeps).toEqual([1000, 3])
})
