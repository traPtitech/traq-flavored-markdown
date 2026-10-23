import path from 'node:path'

import { repositoryRoot } from '../../../tools/workspace/paths.ts'
import { collect } from '../collection/collect.ts'
import { parseArgs, parseEnv, resolveRepositoryPath } from './args.ts'

export { collect } from '../collection/collect.ts'

if (Bun.main === Bun.fileURLToPath(import.meta.url)) {
  try {
    const { values } = parseArgs({
      options: {
        'env-file': { type: 'string' },
        'base-url': { type: 'string' },
        'token-file': { type: 'string' },
        out: { type: 'string' },
        'max-messages': {
          type: 'number',
          default: 100000,
          integer: true,
          min: 1
        },
        'max-channels': {
          type: 'number',
          default: 10000,
          integer: true,
          min: 1
        },
        'channel-offset': { type: 'number', default: 0, integer: true, min: 0 },
        'per-channel': { type: 'number', default: 2000, integer: true, min: 1 },
        until: { type: 'string' }
      }
    })
    let config: Record<string, string> = {}
    if (values['env-file']) {
      try {
        config = parseEnv(
          await Bun.file(resolveRepositoryPath(values['env-file'])).text()
        )
      } catch {
        throw new Error('Could not read env file')
      }
    }
    const baseUrl = values['base-url'] ?? config['TRAQ_API_BASE_URL']
    if (!baseUrl || !(values['token-file'] || config['BOT_ACCESS_TOKEN']))
      throw new Error(
        'API base URL and token file, or --env-file with TRAQ_API_BASE_URL/BOT_ACCESS_TOKEN, are required'
      )
    const privateRoot = path.join(repositoryRoot, '.private', 'corpora')
    const output = resolveRepositoryPath(
      values.out ??
        path.join(
          privateRoot,
          new Date().toISOString().replaceAll(/[:.]/g, '-')
        )
    )
    const relative = path.relative(privateRoot, output)
    if (relative.startsWith('..') || path.isAbsolute(relative))
      throw new Error('Corpus output must stay inside .private/corpora')
    let token
    try {
      token = values['token-file']
        ? (
            await Bun.file(resolveRepositoryPath(values['token-file'])).text()
          ).trim()
        : config['BOT_ACCESS_TOKEN'].trim()
    } catch {
      throw new Error('Could not read token file')
    }
    const report = await collect({
      baseUrl,
      token,
      output,
      maxMessages: values['max-messages'],
      maxChannels: values['max-channels'],
      channelOffset: values['channel-offset'],
      perChannel: values['per-channel'],
      ...(values.until && { until: values.until }),
      progress: value => console.log(JSON.stringify(value))
    })
    console.log(JSON.stringify({ output, ...report }, null, 2))
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    throw error
  }
}
