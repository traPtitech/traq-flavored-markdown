import { diffStringsRaw } from 'jest-diff'

export function outputDiff(before: string, after: string) {
  let parts: [number, string][]
  let coarse = false

  if (before.length + after.length <= 12000) {
    parts = diffStringsRaw(before, after, true).map(part => [part[0], part[1]])
  } else {
    coarse = true
    let start = 0
    let end = 0
    while (
      start < Math.min(before.length, after.length) &&
      before[start] === after[start]
    ) {
      start++
    }
    while (
      end < Math.min(before.length, after.length) - start &&
      before[before.length - end - 1] === after[after.length - end - 1]
    ) {
      end++
    }
    parts = [
      [0, before.slice(0, start)],
      [-1, before.slice(start, before.length - end)],
      [1, after.slice(start, after.length - end)],
      [0, before.slice(before.length - end)]
    ]
  }

  return { parts, coarse }
}
