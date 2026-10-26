import type { Channel, MessageGateway } from './gateway.ts'

export type SampleOptions = {
  maxMessages: number
  maxChannels: number
  channelOffset: number
  perChannel: number
  until: string
}
export type SampleProgress = {
  availableChannels: number
  sampledChannels: number
  inaccessibleChannels: number
}
export function selectChannels(
  channels: readonly Channel[],
  offset: number,
  count: number,
  rank = (id: string) => new Bun.CryptoHasher('sha256').update(id).digest('hex')
) {
  return [...new Set(channels.map(channel => channel.id))]
    .map(id => ({ id, rank: rank(id) }))
    .sort((a, b) => a.rank.localeCompare(b.rank, 'en'))
    .slice(offset, offset + count)
}

/** Sampling yields records; it has no knowledge of persistence or anonymization. */
export async function* sampleMessages(
  gateway: MessageGateway,
  options: SampleOptions,
  progress: (value: SampleProgress) => void = () => undefined
) {
  const channels = await gateway.publicChannels()
  const state = {
    availableChannels: new Set(channels.map(channel => channel.id)).size,
    sampledChannels: 0,
    inaccessibleChannels: 0
  }
  const seen = new Set<string>()
  let count = 0
  progress({ ...state })
  for (const channel of selectChannels(
    channels,
    options.channelOffset,
    options.maxChannels
  )) {
    if (count >= options.maxMessages) break
    let offset = 0
    // Bound the inspected window as well as unique records: repeated API pages
    // must not make collection unbounded when every record is a duplicate.
    while (offset < options.perChannel && count < options.maxMessages) {
      const limit = Math.min(
        200,
        options.perChannel - offset,
        options.maxMessages - count
      )
      const messages = await gateway.messages(channel.id, {
        limit,
        offset,
        until: options.until
      })
      if (messages === null) {
        state.inaccessibleChannels++
        break
      }
      for (const message of messages) {
        if (seen.has(message.id)) continue
        if (count >= options.maxMessages) break
        seen.add(message.id)
        count++
        yield {
          id: message.id,
          channel: channel.id,
          source: message.content,
          ...(message.isBot === undefined ? {} : { isBot: message.isBot })
        }
      }
      offset += messages.length
      if (messages.length < limit) break
    }
    state.sampledChannels++
    progress({ ...state })
  }
}
