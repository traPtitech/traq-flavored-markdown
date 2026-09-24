import { validateImage } from '@traq-flavored-markdown/commonmark-plugin/policy'
import { escapeHtml } from '@traq-flavored-markdown/core/html'
import type { StampData } from '@traq-flavored-markdown/traq-plugin/nodes'

import type { Options } from './types.js'

function wrapWithEffects(
  html: string,
  { animations, size }: StampData['effects']
) {
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
  stamp: StampData,
  name: string,
  title: string,
  style: string
) {
  const sizeClass = stamp.effects.size === 'none' ? '' : stamp.effects.size
  const html = `<i class="emoji message-emoji ${sizeClass}" title=":${escapeHtml(title)}:" style="${escapeHtml(style)};">:${escapeHtml(name)}:</i>`
  return wrapWithEffects(html, stamp.effects)
}

function renderImage(
  stamp: StampData,
  name: string,
  title: string,
  url: string
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

function cssNumber(value: string) {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? String(number) : undefined
}

export function stampRenderer({ store, baseUrl = '' }: Options = {}) {
  const getStampImageUrl = (fileId: string) =>
    store?.generateStampHref?.(fileId) ??
    `${baseUrl}/api/v3/files/${encodeURIComponent(fileId)}`

  return (stamp: StampData): string => {
    const { kind } = stamp

    switch (kind.type) {
      case 'normal': {
        const value = store?.getStampByName?.(kind.name)
        return value
          ? renderImage(
              stamp,
              kind.name,
              value.name,
              getStampImageUrl(value.fileId)
            )
          : escapeHtml(stamp.literal)
      }
      case 'user': {
        const value = store?.getUserByName?.(kind.name)
        const label = '@' + kind.name
        return value
          ? renderImage(stamp, label, label, getStampImageUrl(value.iconFileId))
          : escapeHtml(stamp.literal)
      }
      case 'hex_color': {
        if (!Number.isInteger(kind.rgb) || kind.rgb < 0 || kind.rgb > 0xffffff)
          return escapeHtml(stamp.literal)
        const color = '#' + kind.rgb.toString(16).padStart(6, '0')
        return renderWithStyle(
          stamp,
          kind.name,
          kind.name,
          `background-color: ${color}`
        )
      }
      case 'hsl_color': {
        const hue = cssNumber(kind.hue)
        const saturation = cssNumber(kind.saturation)
        const lightness = cssNumber(kind.lightness)
        if (
          hue === undefined ||
          saturation === undefined ||
          lightness === undefined
        )
          return escapeHtml(stamp.literal)
        const color = `hsl(${hue}, ${saturation}%, ${lightness}%)`
        return renderWithStyle(
          stamp,
          kind.name,
          kind.name,
          `background-color: ${color}`
        )
      }
    }
  }
}
