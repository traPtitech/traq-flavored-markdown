export function observeSource(
  source: string,
  lengths: Record<string, number>,
  contains: Record<string, number>
) {
  const bytes = new TextEncoder().encode(source).byteLength
  const bucket =
    bytes < 100
      ? '<100'
      : bytes < 1000
        ? '<1000'
        : bytes < 10000
          ? '<10000'
          : '>=10000'
  lengths[bucket] = (lengths[bucket] ?? 0) + 1
  for (const [name, pattern] of Object.entries({
    json: /!\{/,
    fence: /```|~~~/,
    math: /\$/,
    table: /\|.+\|/,
    reference: /^ {0,3}\[[^\]]+\]:/m,
    stamp: /:[\w@]/,
    url: /https?:\/\//,
    quote: /^ {0,3}>/m,
    list: /^\s*(?:[-+*]|\d+[.)]) /m
  }))
    if (pattern.test(source)) contains[name] = (contains[name] ?? 0) + 1
  return bytes
}
