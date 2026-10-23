import { definitions } from '@traq-flavored-markdown/commonmark-plugin/nodes'
import type { RenderPlugin } from '@traq-flavored-markdown/core/renderer'

/** Give empty quotes a visible line without adding synthetic syntax nodes. */
export function configureSpacing(common: RenderPlugin, xhtmlOut: boolean) {
  return common.withReplacedHandler(
    definitions.Blockquote,
    (_node, context) => {
      const content = context.renderChildren(children =>
        children.length
          ? children.map(child => child.html).join('')
          : xhtmlOut
            ? '<br />\n'
            : '<br>\n'
      )
      return '<blockquote>\n' + content + '</blockquote>\n'
    }
  )
}
