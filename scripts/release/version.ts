export type Version = Readonly<{
  npm: string
  tag: string
  major: number
  distTag: 'latest' | 'next'
}>

/** One release grammar for npm, Go module tags, and external consumer checks. */
export function parseVersion(input: string, requireTag = false): Version {
  if (requireTag && !input.startsWith('v'))
    throw new Error('Expected a v-prefixed release version')
  const npm = input.startsWith('v') ? input.slice(1) : input
  const match =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/.exec(
      npm
    )
  if (!match || match[4]?.split('.').some(part => /^0\d+$/.test(part)))
    throw new Error('Invalid release version: ' + input)
  return Object.freeze({
    npm,
    tag: `v${npm}`,
    major: Number(match[1]),
    distTag: match[4] ? 'next' : 'latest'
  })
}

export function goVersion(input: string) {
  const version = parseVersion(input, true)
  if (version.major > 1)
    throw new Error(
      'Go modules require a versioned module path for major versions above 1'
    )
  return version
}
