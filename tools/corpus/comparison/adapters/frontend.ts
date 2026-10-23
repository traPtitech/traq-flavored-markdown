import path from 'node:path'

import type * as CandidateAdapters from '../../../../packages/sdk/typescript/src/adapters/index.ts'
import type * as CandidateSDK from '../../../../packages/sdk/typescript/src/index.ts'
import type * as CandidateRenderer from '../../../../packages/sdk/typescript/src/renderer/index.ts'
import type { ComparisonPlan } from '../../protocol/comparison.ts'
import type { Profile } from '../runner.ts'

export async function frontendAdapters({
  baselineDirectory,
  origin,
  wasm,
  candidateDirectory
}: Pick<
  ComparisonPlan,
  'baselineDirectory' | 'origin' | 'wasm' | 'candidateDirectory'
>) {
  const baselinePackage = Bun.resolveSync(
    '@traptitech/traq-markdown-it',
    path.resolve(baselineDirectory)
  )
  const {
    traQMarkdownIt
  }: {
    traQMarkdownIt: new (
      store: unknown,
      domains: string[],
      origin: string
    ) => {
      render(source: string): { renderedText: string; embeddings?: unknown }
      renderInline(source: string): {
        renderedText: string
        embeddings?: unknown
      }
    }
  } = await import(Bun.pathToFileURL(baselinePackage).href)
  const { createRuntime, presets }: typeof CandidateSDK = await import(
    Bun.pathToFileURL(path.join(candidateDirectory, 'index.js')).href
  )
  const { messageRenderers }: typeof CandidateRenderer = await import(
    Bun.pathToFileURL(path.join(candidateDirectory, 'renderer/index.js')).href
  )
  const { withDefaultAdapters }: typeof CandidateAdapters = await import(
    Bun.pathToFileURL(path.join(candidateDirectory, 'adapters/index.js')).href
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
  const bytes = new Uint8Array(await Bun.file(wasm).arrayBuffer())
  started = performance.now()
  const runtime = await createRuntime(bytes)
  try {
    const parser = runtime.createParser(presets.traq.v1)
    const views = messageRenderers({
      origin,
      ...withDefaultAdapters({
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
    })
    const afterInitializationMs = performance.now() - started
    const baselineOutput = (value: {
      renderedText: string
      embeddings?: unknown
    }) => ({
      outcome: { kind: 'html' as const, value: value.renderedText },
      embeddings: value.embeddings
    })
    const candidateOutput = (value: { html: string; cards?: unknown }) => ({
      outcome: { kind: 'html' as const, value: value.html },
      embeddings: value.cards
    })
    const profiles: Profile[] = [
      {
        id: 'render',
        before: source => baselineOutput(baseline.render(source)),
        after: source =>
          candidateOutput(views.standard.render(parser.parse(source)))
      },
      {
        id: 'inline',
        before: source => baselineOutput(baseline.renderInline(source)),
        after: source =>
          candidateOutput(views.condensed.render(parser.parse(source)))
      }
    ]
    return {
      profiles,
      beforeInitializationMs,
      afterInitializationMs,
      [Symbol.dispose]: () => runtime.dispose()
    }
  } catch (error) {
    runtime.dispose()
    throw error
  }
}
