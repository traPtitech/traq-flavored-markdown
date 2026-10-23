import { writeFile } from 'node:fs/promises'
import path from 'node:path'

import { type Fetch, createApiClient } from './client.ts'
import { observeSource, sampleMessages } from './sampling.ts'
import { createJsonlSink } from './sink.ts'

export async function collect({
  baseUrl,
  token,
  output,
  maxMessages = 100000,
  maxChannels = 10000,
  channelOffset = 0,
  perChannel = 2000,
  delayMs = 300,
  until = new Date().toISOString(),
  fetchImpl = fetch,
  progress = (_value: unknown) => undefined
}: {
  baseUrl: string
  token: string
  output: string
  maxMessages?: number
  maxChannels?: number
  channelOffset?: number
  perChannel?: number
  delayMs?: number
  until?: string
  fetchImpl?: Fetch
  progress?: (value: unknown) => void
}) {
  for (const count of [maxMessages, maxChannels, perChannel])
    if (!Number.isSafeInteger(count) || count <= 0)
      throw new Error('Sampling bounds must be positive integers')
  if (!Number.isSafeInteger(channelOffset) || channelOffset < 0)
    throw new Error('Invalid channel offset')
  if (
    !Number.isFinite(delayMs) ||
    delayMs < 0 ||
    !Number.isFinite(Date.parse(until))
  )
    throw new Error('Invalid delay or date')
  const salt = crypto.getRandomValues(new Uint8Array(32))
  const anonymous = (id: string) =>
    new Bun.CryptoHasher('sha256', salt).update(id).digest('hex').slice(0, 24)
  const report = {
    format: 1,
    status: 'running',
    fetchedAt: new Date().toISOString(),
    until,
    maxMessages,
    maxChannels,
    perChannel,
    requests: 0,
    sampledChannels: 0,
    inaccessibleChannels: 0,
    messages: 0,
    bytes: 0,
    lengths: {} as Record<string, number>,
    contains: {} as Record<string, number>,
    rawText: true,
    channelOffset,
    availableChannels: 0
  }
  const client = createApiClient({
    baseUrl,
    token,
    delayMs,
    fetchImpl,
    requested: () => report.requests++
  })
  const sink = await createJsonlSink(path.join(output, 'messages.jsonl'))
  try {
    for await (const message of sampleMessages(
      client,
      { maxMessages, maxChannels, channelOffset, perChannel, until },
      state => {
        Object.assign(report, state)
        if (state.sampledChannels > 0 && state.sampledChannels % 10 === 0)
          progress({
            channels: report.sampledChannels,
            messages: report.messages,
            requests: report.requests
          })
      }
    )) {
      await sink.write({
        id: anonymous(message.id),
        channel: anonymous(message.channel),
        source: message.source,
        syntaxVersion: 1
      })
      report.messages++
      report.bytes += observeSource(
        message.source,
        report.lengths,
        report.contains
      )
    }
    report.status = 'complete'
    return report
  } catch (error) {
    report.status = 'failed'
    throw error
  } finally {
    await sink.close()
    await writeFile(
      path.join(output, 'manifest.json'),
      JSON.stringify(report, null, 2) + '\n',
      { mode: 0o600 }
    )
  }
}
