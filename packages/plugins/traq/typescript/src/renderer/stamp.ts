import type { DeepReadonly } from '@traq-flavored-markdown/core'
import { validateImage as defaultImagePolicy } from '@traq-flavored-markdown/core/html'
import { escapeHtml } from '@traq-flavored-markdown/core/html'
import type { Stamp as MutableStamp } from '@traq-flavored-markdown/traq-plugin/nodes'

import type { HtmlRendererOptions } from './types.js'

type Stamp = DeepReadonly<MutableStamp>

function wrapWithEffects(html: string, { animations, size }: Stamp['effects']) {
  const sizeClass = size === 'none' ? '' : size
  const opening = animations
    .map(
      (effect, index) =>
        `<span class="emoji-effect ${effect}${index === 0 && sizeClass ? ` ${sizeClass}` : ''}">`
    )
    .join('')

  return opening + html + '</span>'.repeat(animations.length)
}

function renderWithStyle(
  stamp: Stamp,
  name: string,
  title: string,
  style: string
) {
  const sizeClass = stamp.effects.size === 'none' ? '' : stamp.effects.size
  const html = `<i class="emoji message-emoji ${sizeClass}" title=":${escapeHtml(title)}:" style="${escapeHtml(style)};">:${escapeHtml(name)}:</i>`
  return wrapWithEffects(html, stamp.effects)
}

function renderImage(
  stamp: Stamp,
  name: string,
  title: string,
  url: string,
  validateImage: (destination: string) => boolean
) {
  if (!validateImage(url)) return escapeHtml(stamp.literal)

  const safeUrl = url.replace(
    /[\s"'()\\]/g,
    character => '%' + character.charCodeAt(0).toString(16).toUpperCase()
  )
  return renderWithStyle(
    stamp,
    name,
    title,
    'background-image: url(' + safeUrl + ')'
  )
}

export function stampRenderer({
  resolveStamp,
  validateStampImage = defaultImagePolicy
}: HtmlRendererOptions = {}) {
  return (stamp: Stamp): string => {
    const { kind } = stamp

    switch (kind.type) {
      case 'normal':
      case 'user': {
        const value = resolveStamp?.(kind)
        const label = (kind.type === 'user' ? '@' : '') + kind.name
        return value
          ? renderImage(
              stamp,
              label,
              value.title ?? label,
              value.url,
              validateStampImage
            )
          : escapeHtml(stamp.literal)
      }
      case 'hex_color': {
        const digits = kind.rgb.toString(16).padStart(6, '0')
        const color = '#' + digits
        const label = '0x' + digits
        return renderWithStyle(
          stamp,
          label,
          label,
          `background-color: ${color}`
        )
      }
      case 'hsl_color': {
        const color = `hsl(${kind.hue}, ${kind.saturation}%, ${kind.lightness}%)`
        return renderWithStyle(
          stamp,
          color,
          color,
          `background-color: ${color}`
        )
      }
    }
  }
}
