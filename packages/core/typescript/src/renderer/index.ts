import { DocumentContext } from '../document.js'
import type { DocumentSchema } from '../schema.js'
import { escapeHtml } from './html.js'
import { configuration } from './preset.js'
import type {
  Document,
  Node,
  HtmlPreset,
  RenderContext,
  RenderPlan,
  Renderer
} from './types.js'

export type {
  Node,
  Document,
  HtmlPreset,
  Renderer,
  RenderContext,
  RenderPlan,
  RenderSession,
  RenderedChild,
  Handler,
  Fallback
} from './types.js'
export { RenderPlugin } from './plugin.js'
export { PresetBuilder } from './preset.js'
export type { RegistrationHandle } from './preset.js'

export function createRenderer(
  preset: HtmlPreset,
  { schema }: { schema?: DocumentSchema } = {}
): Renderer {
  const {
    handlers,
    requiredKinds,
    fallback: renderFallback
  } = configuration(preset)

  function createSession(document: Document | DocumentContext) {
    const context = schema
      ? schema.document(document)
      : document instanceof DocumentContext
        ? document
        : new DocumentContext(document)
    for (const kind of requiredKinds)
      if (!context.hasContract(kind))
        throw new TypeError('Renderer requires a document schema for: ' + kind)

    function render(plan: RenderPlan = {}) {
      const roots = (plan.roots ?? context.document.children).map(node =>
        context.node(node)
      )
      const omitted = new Set(
        [...(plan.omittedNodes ?? [])].map(node => context.node(node))
      )
      const replacements = new Map(
        [...(plan.childText ?? [])].map(([node, text]) => {
          if (typeof text !== 'string')
            throw new TypeError('Child text must be a string')
          return [context.node(node), text] as const
        })
      )
      if (
        plan.rootSeparator !== undefined &&
        typeof plan.rootSeparator !== 'string'
      )
        throw new TypeError('Root separator must be a string')

      const fallback = (value: Node) => {
        const node = context.node(value)
        const output = renderFallback(
          escapeHtml(context.source.slice(node.span))
        )
        if (typeof output !== 'string')
          throw new TypeError('Render fallback must return an HTML string')
        return output
      }

      function renderNode(value: Node): string {
        const node = context.node(value)
        if (omitted.has(node)) return ''
        const handler = handlers.get(node.kind)
        if (!handler) return fallback(node)
        const { ancestors, index } = context.location(node)
        const renderContext: RenderContext = {
          source: context.source.text,
          ancestors,
          index,
          parent: (definition, distance = 1) => {
            const parent = ancestors.at(-distance)
            return parent && context.matches(parent, definition) ? parent : undefined
          },
          escape: escapeHtml,
          renderChildren: (join = '') => {
            const replacement = replacements.get(node)
            if (replacement !== undefined) return escapeHtml(replacement)
            const children = (node.children ?? []).filter(
              child => !omitted.has(child)
            )
            return typeof join === 'string'
              ? children.map(renderNode).join(join)
              : join(
                  Object.freeze(
                    children.map(node =>
                      Object.freeze({ node, html: renderNode(node) })
                    )
                  )
                )
          },
          renderNode,
          sourceSlice: span => context.source.slice(span),
          fallback
        }
        const output = handler(node, renderContext)
        if (typeof output !== 'string')
          throw new TypeError('Render handlers must return HTML strings')
        return output
      }

      return roots
        .filter(node => !omitted.has(node))
        .map(renderNode)
        .join(plan.rootSeparator ?? '')
    }

    return Object.freeze({ context, render })
  }

  return Object.freeze({
    createSession,
    render: (document: Document | DocumentContext, plan?: RenderPlan) =>
      createSession(document).render(plan)
  })
}
