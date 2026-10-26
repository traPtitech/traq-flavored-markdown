import { expect, test } from 'bun:test'

import type { MessagePage } from './gateway.ts'
import {
  type SampleProgress,
  sampleMessages,
  selectChannels
} from './sampling.ts'

test('sampling deduplicates across actual pages and caps the inspected window', async () => {
  const pages: MessagePage[] = []
  const progress: SampleProgress[] = []
  const records = []
  for await (const record of sampleMessages(
    {
      publicChannels: async () => [{ id: 'c' }],
      messages: async (_channel, page) => {
        pages.push(page)
        return page.offset === 0
          ? Array.from({ length: 200 }, (_, id) => ({
              id: String(id),
              content: String(id)
            }))
          : [
              { id: '0', content: 'duplicate' },
              { id: '200', content: 'last', isBot: false }
            ]
      }
    },
    {
      maxMessages: 300,
      maxChannels: 1,
      channelOffset: 0,
      perChannel: 202,
      until: '2026-01-01'
    },
    state => progress.push(state)
  ))
    records.push(record)
  expect(pages.map(page => [page.limit, page.offset])).toEqual([
    [200, 0],
    [2, 200]
  ])
  expect(records).toHaveLength(201)
  expect(records[200]).toEqual({
    id: '200',
    channel: 'c',
    source: 'last',
    isBot: false
  })
  expect(progress[0].sampledChannels).toBe(0)
  expect(progress[1].sampledChannels).toBe(1)
  expect(
    selectChannels([{ id: 'b' }, { id: 'a' }, { id: 'a' }], 0, 2, id => id).map(
      channel => channel.id
    )
  ).toEqual(['a', 'b'])
})

test('inaccessible channels are counted and message bounds stop further requests', async () => {
  const channels = selectChannels([{ id: 'a' }, { id: 'b' }, { id: 'c' }], 0, 3)
  const requested: string[] = []
  const progress: SampleProgress[] = []
  const records = []
  for await (const record of sampleMessages(
    {
      publicChannels: async () => channels,
      messages: async channel => {
        requested.push(channel)
        return channel === channels[0].id
          ? null
          : [{ id: 'one', content: 'one' }]
      }
    },
    {
      maxMessages: 1,
      maxChannels: 3,
      channelOffset: 0,
      perChannel: 10,
      until: '2026-01-01'
    },
    state => progress.push(state)
  ))
    records.push(record)
  expect(requested).toHaveLength(2)
  expect(records).toHaveLength(1)
  expect(progress.at(-1)).toEqual({
    availableChannels: 3,
    sampledChannels: 2,
    inaccessibleChannels: 1
  })
})
