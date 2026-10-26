import type { ApiClient } from './client.ts'

export type Channel = { id: string }
export type Message = { id: string; content: string }
export type MessagePage = { limit: number; offset: number; until: string }
export type MessageGateway = {
  publicChannels(): Promise<readonly Channel[]>
  messages(
    channelId: string,
    page: MessagePage
  ): Promise<readonly Message[] | null>
}

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const identifier = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0

/** The API boundary validates transport data before it reaches sampling. */
export function createMessageGateway(client: ApiClient): MessageGateway {
  return {
    async publicChannels() {
      const response = await client.get('channels?include-dm=false')
      if (!record(response) || !Array.isArray(response.public))
        throw new Error('Could not read public channel list (body omitted)')
      return response.public.map((channel: unknown) => {
        if (!record(channel) || !identifier(channel.id))
          throw new Error('Invalid channel fields (body omitted)')
        return { id: channel.id }
      })
    },
    async messages(channelId, page) {
      const query = new URLSearchParams({
        limit: String(page.limit),
        offset: String(page.offset),
        until: page.until,
        order: 'desc'
      })
      const response = await client.get(
        `channels/${encodeURIComponent(channelId)}/messages?${query}`
      )
      if (response === null) return null
      if (!Array.isArray(response) || response.length > page.limit)
        throw new Error('Invalid message response shape (body omitted)')
      return response.map((message: unknown) => {
        if (
          !record(message) ||
          !identifier(message.id) ||
          typeof message.content !== 'string'
        )
          throw new Error('Invalid message fields (body omitted)')
        return { id: message.id, content: message.content }
      })
    }
  }
}
