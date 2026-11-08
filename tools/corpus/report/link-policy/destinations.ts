import punycode from 'punycode/punycode.js'

const { toASCII } = punycode

export const bareEmailPattern =
  /^(?:mailto:)?[a-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i

export function completedDomain(value: string, strict = true) {
  if (/[\s<>]/.test(value)) return false

  const authority = value.replace(/^\/\//, '').split(/[/?#]/, 1)[0]
  if (authority.includes('@') || !/^[^:]+(?::[0-9]{1,5})?$/.test(authority)) {
    return false
  }

  try {
    const url = new URL(
      value.startsWith('//') ? 'https:' + value : 'https://' + value
    )

    return (
      url.hostname.includes('.') &&
      (!strict ||
        url.hostname
          .split('.')
          .every(part => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(part)))
    )
  } catch {
    return false
  }
}

export function bareLink(value: string) {
  if (/^(?:https?|ftp):\/\//i.test(value)) return true
  if (bareEmailPattern.test(value)) return true
  if (!value.startsWith('//')) return false

  try {
    const url = new URL('https:' + value)
    return url.hostname.startsWith('[') || completedDomain(value)
  } catch {
    return false
  }
}

export function automaticDestination(
  href: string,
  label: string,
  forceHttps = false,
  before = false
) {
  let targets: string[]

  if (forceHttps) {
    targets = [label.startsWith('//') ? 'https:' + label : 'https://' + label]
  } else if (
    label.startsWith('//') &&
    (bareLink(label) || (before && completedDomain(label, false)))
  ) {
    targets = ['https:' + label]
  } else if (/^mailto:/i.test(label)) targets = [label]
  else if (bareEmailPattern.test(label)) {
    targets = [
      'mailto:' + label,
      ...(before && completedDomain(label, false)
        ? ['http://' + label, 'https://' + label]
        : [])
    ]
  } else if (completedDomain(label, !before)) {
    targets = ['http://' + label, 'https://' + label]
  } else if (/^[a-z][a-z0-9+.-]*:/i.test(label)) targets = [label]
  else targets = []

  try {
    const actual = new URL(href.startsWith('//') ? 'https:' + href : href)

    return (
      ['http:', 'https:', 'ftp:', 'mailto:'].includes(actual.protocol) &&
      targets.some(target => {
        try {
          const encoded = encodeURI(target).replace(/%25([0-9a-f]{2})/gi, '%$1')

          const equivalent = (value: string) =>
            new URL(value).href.replace(/%[0-9a-f]{2}/gi, escape =>
              escape.toUpperCase()
            ) ===
            actual.href.replace(/%[0-9a-f]{2}/gi, escape =>
              escape.toUpperCase()
            )

          return equivalent(target) || equivalent(encoded)
        } catch {
          return false
        }
      })
    )
  } catch {
    return false
  }
}

/** The old renderer used raw Punycode rather than WHATWG host validation. */
export function legacyBareDestination(href: string, label: string) {
  if (/[\s<>]/.test(label)) return false

  try {
    let expected: string

    if (/^mailto:/i.test(href)) {
      const parts = /^([^@]+)@([^@]+\.[^@]+)$/.exec(label)
      if (!parts || !/[^\p{ASCII}]/u.test(label)) return false

      expected = 'mailto:' + parts[1] + '@' + toASCII(parts[2])
    } else {
      const scheme =
        /^(https?):\/\//i.exec(href)?.[1] ??
        (href.startsWith('//') ? 'https' : undefined)
      if (!scheme || /^[a-z][a-z0-9+.-]*:/i.test(label)) return false

      const raw = label.replace(/^\/\//, '')
      const end = raw.search(/[/?#]/)
      const authority = end < 0 ? raw : raw.slice(0, end)
      const match = /^([^:@]+)(?::([0-9]{1,5}))?$/.exec(authority)
      if (
        !match ||
        !match[1].includes('.') ||
        match[1].split('.').some(part => !part || part.length > 63) ||
        (match[2] && Number(match[2]) > 65535)
      ) {
        return false
      }

      expected =
        scheme +
        '://' +
        toASCII(match[1]) +
        (match[2] ? ':' + match[2] : '') +
        (end < 0 ? '' : raw.slice(end))
    }

    const canonical = (value: string) =>
      value
        .replace(
          /^(https?:\/\/)([^/?#]+)/i,
          (_all, scheme: string, authority: string) =>
            scheme.toLowerCase() + authority.toLowerCase()
        )
        .replace(/%[0-9a-f]{2}/gi, escape => escape.toUpperCase())

    const encoded = encodeURI(expected).replace(/%25([0-9a-f]{2})/gi, '%$1')

    return (
      canonical(encoded) ===
      canonical(href.startsWith('//') ? 'https:' + href : href)
    )
  } catch {
    return false
  }
}

export function resourceLabel(value: string, origin?: string) {
  if (!origin) return undefined
  if (value.startsWith('//')) value = 'https:' + value

  const path = value.startsWith(origin.replace(/\/+$/, '') + '/')
    ? value.slice(origin.replace(/\/+$/, '').length)
    : ''

  const match =
    /^\/(files|messages)\/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}(?:[?#][^\s<>]*)?$/i.exec(
      path
    )

  return match
    ? match[1].toLowerCase() === 'files'
      ? '添付ファイル'
      : '引用メッセージ'
    : undefined
}
