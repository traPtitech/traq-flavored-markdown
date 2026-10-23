import { fileURLToPath } from 'node:url'

import { expect, test } from 'bun:test'
import { compile } from 'sass'

import type {
  StampAnimation,
  StampSize
} from '../../plugins/traq/typescript/src/generated/trap.js'

// This type-checked inventory ties the CSS contract to the generated Rust enums.
const effects: Record<StampAnimation, true> = {
  rotate: true,
  'rotate-inv': true,
  wiggle: true,
  parrot: true,
  zoom: true,
  inversion: true,
  turn: true,
  'turn-v': true,
  happa: true,
  pyon: true,
  flashy: true,
  pull: true,
  atsumori: true,
  stretch: true,
  'stretch-v': true,
  conga: true,
  'conga-inv': true,
  attract: true,
  ascension: true,
  shake: true,
  party: true,
  rainbow: true
}
const sizes: Record<StampSize, string> = {
  none: 'normal',
  'ex-large': 'ex-large',
  large: 'large',
  small: 'small'
}
const css = compile(
  fileURLToPath(new URL('../styles/index.scss', import.meta.url))
).css

test('every stamp effect class selects a namespaced, defined animation', () => {
  const keyframes = new Set(
    [...css.matchAll(/@keyframes ([\w-]+)/g)].map(match => match[1])
  )
  const used = new Set(
    [...css.matchAll(/animation: ([\w-]+)/g)].map(match => match[1])
  )
  expect(used).toEqual(keyframes)
  expect(keyframes.size).toBe(Object.keys(effects).length)
  for (const keyframe of keyframes)
    expect(keyframe.startsWith('tfm-stamp-')).toBe(true)
  for (const effect of Object.keys(effects))
    expect(css).toContain('.emoji-effect.' + effect)
  expect(css).toContain('.emoji-effect.conga .conga .emoji')
  expect(css).toContain('animation: tfm-stamp-conga linear 0.5s infinite')
})

test('stamp and effect wrappers share size tokens, including compact views', () => {
  for (const size of Object.values(sizes))
    expect(css).toContain('font-size: var(--tfm-stamp-' + size + '-size)')
  expect(css.match(/--tfm-stamp-normal-size: 24px/g)).toHaveLength(1)
  expect(css).toContain('--tfm-stamp-large-size: var(--tfm-stamp-normal-size)')
  expect(css).toContain(
    '--tfm-stamp-ex-large-size: var(--tfm-stamp-normal-size)'
  )
})
