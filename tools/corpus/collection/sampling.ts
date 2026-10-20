import type { ApiClient } from './client.ts'

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
  channels: unknown[],
  offset: number,
  count: number,
  rank = (id: string) => new Bun.CryptoHasher('sha256').update(id).digest('hex')
) {
  return channels
    .flatMap(value =>
      value &&
      typeof value === 'object' &&
      typeof (value as { id?: unknown }).id === 'string'
        ? [
            {
              id: (value as { id: string }).id,
              rank: rank((value as { id: string }).id)
            }
          ]
        : []
    )
    .sort((a, b) => a.rank.localeCompare(b.rank, 'en'))
    .slice(offset, offset + count)
}

/** Sampling yields records; it has no knowledge of persistence or anonymization. */
export async function* sampleMessages(
  client: ApiClient,
  options: SampleOptions,
  progress: (value: SampleProgress) => void = () => undefined
) {
  const list = (await client.get('channels?include-dm=false')) as {
    public?: unknown[]
  } | null
  if (!list || !Array.isArray(list.public))
    throw new Error('Could not read public channel list')
  const state = {
    availableChannels: list.public.length,
    sampledChannels: 0,
    inaccessibleChannels: 0
  }
  const seen = new Set<string>()
  let count = 0
  progress(state)
  for (const channel of selectChannels(
    list.public,
    options.channelOffset,
    options.maxChannels
  )) {
    if (count >= options.maxMessages) break
    let sampled = 0,
      offset = 0
    while (sampled < options.perChannel && count < options.maxMessages) {
      const limit = Math.min(
        200,
        options.perChannel - sampled,
        options.maxMessages - count
      )
      const query = new URLSearchParams({
        limit: String(limit),
        offset: String(offset),
        until: options.until,
        order: 'desc'
      })
      const messages = await client.get(
        `channels/${encodeURIComponent(channel.id)}/messages?${query}`
      )
      if (messages === null) {
        state.inaccessibleChannels++
        break
      }
      if (!Array.isArray(messages))
        throw new Error('Invalid message response shape (body omitted)')
      for (const message of messages) {
        if (
          !message ||
          typeof message.id !== 'string' ||
          typeof message.content !== 'string'
        )
          throw new Error('Invalid message fields (body omitted)')
        if (seen.has(message.id)) continue
        if (count >= options.maxMessages || sampled >= options.perChannel) break
        seen.add(message.id)
        sampled++
        count++
        yield {
          id: message.id as string,
          channel: channel.id,
          source: message.content as string
        }
      }
      offset += messages.length
      if (messages.length < limit) break
    }
    state.sampledChannels++
    progress({ ...state })
  }
}

export function observeSource(
  source: string,
  lengths: Record<string, number>,
  contains: Record<string, number>
) {
  const bytes = new TextEncoder().encode(source).byteLength
  const bucket =
    bytes < 100
      ? '<100'
      : bytes < 1000
        ? '<1000'
        : bytes < 10000
          ? '<10000'
          : '>=10000'
  lengths[bucket] = (lengths[bucket] ?? 0) + 1
  for (const [name, pattern] of Object.entries({
    json: /!\{/,
    fence: /```|~~~/,
    math: /\$/,
    table: /\|.+\|/,
    reference: /^ {0,3}\[[^\]]+\]:/m,
    stamp: /:[\w@]/,
    url: /https?:\/\//,
    quote: /^ {0,3}>/m,
    list: /^\s*(?:[-+*]|\d+[.)]) /m
  }))
    if (pattern.test(source)) contains[name] = (contains[name] ?? 0) + 1
  return bytes
}
