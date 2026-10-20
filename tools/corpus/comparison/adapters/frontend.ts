import path from 'node:path'

import { sdkRoot } from '../../../../scripts/paths.ts'
import type { Profile } from '../runner.ts'

export async function frontendAdapters(
  baselineDirectory: string,
  origin?: string
) {
  const baselinePackage = Bun.resolveSync(
    '@traptitech/traq-markdown-it',
    path.resolve(baselineDirectory)
  )
  const { traQMarkdownIt } = await import(
    Bun.pathToFileURL(baselinePackage).href
  )
  const { createRuntime, presets } = await import(
    Bun.pathToFileURL(path.join(sdkRoot, 'dist/index.js')).href
  )
  const { messageRenderers } = await import(
    Bun.pathToFileURL(path.join(sdkRoot, 'dist/renderer/index.js')).href
  )
  const href = (type: string, id: string) =>
    '#' +
    ({ user: 'u', group: 'g', channel: 'c' }[type] ?? type) +
    '-' +
    encodeURIComponent(id)
  const stampUrl = (file: string) => '/api/v3/files/' + encodeURIComponent(file)
  const store = {
    getMe: () => ({ id: 'viewer' }),
    getUser: () => undefined,
    getChannel: (id: string) => ({ id }),
    getUserGroup: () => undefined,
    getStampByName: (name: string) => ({ name, fileId: 'stamp' }),
    getUserByName: () => ({ iconFileId: 'icon' }),
    generateUserHref: (id: string) => href('user', id),
    generateUserGroupHref: (id: string) => href('group', id),
    generateChannelHref: (id: string) => href('channel', id),
    generateStampHref: stampUrl
  }
  let started = performance.now()
  const baseline = new traQMarkdownIt(store, [], origin)
  const beforeInitializationMs = performance.now() - started
  const bytes = await Bun.file(
    path.join(sdkRoot, 'dist/parser.wasm')
  ).arrayBuffer()
  started = performance.now()
  const runtime = await createRuntime(bytes)
  try {
    const parser = runtime.createParser(presets.traq.v1)
    const views = messageRenderers({
      origin,
      images: { validate: () => false },
      references: {
        resolve: (reference: { type: string; id: string }) => ({
          href: href(reference.type, reference.id),
          highlight: reference.type === 'user' && reference.id === 'viewer'
        })
      },
      stamps: {
        resolve: (stamp: { type: 'normal' | 'user'; name: string }) => ({
          url: stampUrl(stamp.type === 'normal' ? 'stamp' : 'icon'),
          title: stamp.type === 'user' ? '@' + stamp.name : stamp.name
        })
      }
    })
    const afterInitializationMs = performance.now() - started
    const output = (value: {
      renderedText: string
      embeddings?: unknown
      cards?: unknown
    }) => ({
      kind: 'html' as const,
      value: value.renderedText,
      embeddings: value.cards ?? value.embeddings
    })
    const profiles: Profile[] = [
      {
        mode: 'render',
        before: source => output(baseline.render(source)),
        after: source => output(views.standard.render(parser.parse(source)))
      },
      {
        mode: 'inline',
        before: source => output(baseline.renderInline(source)),
        after: source => output(views.condensed.render(parser.parse(source)))
      }
    ]
    return {
      profiles,
      beforeInitializationMs,
      afterInitializationMs,
      dispose: () => runtime.dispose()
    }
  } catch (error) {
    runtime.dispose()
    throw error
  }
}
