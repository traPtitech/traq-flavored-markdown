import { DocumentContext } from '../document.js'
import type { DocumentSchema } from '../schema.js'
import { escapeHtml } from './html.js'
import { configuration } from './preset.js'
import type {
  HtmlPreset,
  ReadonlyDocument,
  ReadonlyNode,
  RenderContext,
  RenderPlan,
  Renderer
} from './types.js'

export type {
  ReadonlyNode,
  ReadonlyDocument,
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
    requiredContracts,
    fallback: renderFallback
  } = configuration(preset)

  function createSession(document: ReadonlyDocument | DocumentContext) {
    const context = schema
      ? schema.document(document)
      : document instanceof DocumentContext
        ? document
        : new DocumentContext(document)

    for (const [kind, definition] of requiredContracts) {
      if (!context.hasDefinition(definition)) {
        throw new TypeError('Renderer requires a document schema for: ' + kind)
      }
    }

    function render(plan: RenderPlan = {}) {
      const roots = (plan.roots ?? context.document.children).map(node =>
        context.node(node)
      )

      const omitted = new Set(
        [...(plan.omittedNodes ?? [])].map(node => context.node(node))
      )

      const replacements = new Map(
        [...(plan.childText ?? [])].map(([node, text]) => {
          if (typeof text !== 'string') {
            throw new TypeError('Child text must be a string')
          }

          return [context.node(node), text] as const
        })
      )

      if (
        plan.rootSeparator !== undefined &&
        typeof plan.rootSeparator !== 'string'
      ) {
        throw new TypeError('Root separator must be a string')
      }

      const fallback = (value: ReadonlyNode) => {
        const node = context.node(value)

        const output = renderFallback(
          escapeHtml(context.source.slice(node.span))
        )
        if (typeof output !== 'string') {
          throw new TypeError('Render fallback must return an HTML string')
        }

        return output
      }

      function renderNode(value: ReadonlyNode, insideLink = false): string {
        const node = context.node(value)
        if (omitted.has(node)) return ''

        const handler = handlers.get(node.kind)
        if (!handler) return fallback(node)

        const { ancestors, index } = context.location(node)

        const renderContext: RenderContext = {
          insideLink,
          source: context.source.text,
          ancestors,
          index,
          matches: (node, definition) => context.matches(node, definition),

          parent: (definition, distance = 1) => {
            const parent = ancestors.at(-distance)

            return parent && context.matches(parent, definition)
              ? parent
              : undefined
          },

          escape: escapeHtml,

          renderChildren: (join = '', options = {}) => {
            const replacement = replacements.get(node)
            if (replacement !== undefined) return escapeHtml(replacement)

            const children = (node.children ?? []).filter(
              child => !omitted.has(child)
            )

            const renderChild = (child: ReadonlyNode) =>
              renderNode(child, insideLink || options.insideLink === true)

            return typeof join === 'string'
              ? children.map(renderChild).join(join)
              : join(
                  Object.freeze(
                    children.map(node =>
                      Object.freeze({ node, html: renderChild(node) })
                    )
                  )
                )
          },

          renderNode: node => renderNode(node, insideLink),
          sourceSlice: span => context.source.slice(span),
          fallback
        }

        const output = handler(node, renderContext)
        if (typeof output !== 'string') {
          throw new TypeError('Render handlers must return HTML strings')
        }

        return output
      }

      return roots
        .filter(node => !omitted.has(node))
        .map(node => renderNode(node))
        .join(plan.rootSeparator ?? '')
    }

    return Object.freeze({ context, render })
  }

  return Object.freeze({
    createSession,

    render: (document: ReadonlyDocument | DocumentContext, plan?: RenderPlan) =>
      createSession(document).render(plan)
  })
}
