const keywords = new Set(
  'break default func interface select case defer go map struct chan else goto package switch const fallthrough if range type continue for import return var'.split(
    ' '
  )
)

export function goIdentifier(name: string) {
  if (
    !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ||
    keywords.has(name) ||
    name === '_'
  ) {
    throw new Error('Invalid Go identifier: ' + name)
  }

  return name
}

export class GoNames {
  readonly #names = new Set<string>()

  constructor(readonly scope: string) {}

  add(name: string) {
    goIdentifier(name)

    if (this.#names.has(name)) {
      throw new Error(`Conflicting Go identifier ${name} in ${this.scope}`)
    }

    this.#names.add(name)
    return name
  }
}

const initialisms: Readonly<Record<string, string>> = {
  id: 'ID',
  url: 'URL',
  urls: 'URLs',
  html: 'HTML',
  json: 'JSON',
  utf8: 'UTF8'
}

export const fieldName = (name: string) =>
  goIdentifier(
    name
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .split('_')
      .filter(Boolean)
      .map(
        part =>
          initialisms[part.toLowerCase()] ??
          part[0].toUpperCase() + part.slice(1)
      )
      .join('')
  )

export const enumName = (value: string) =>
  (({
    '*': 'Asterisk',
    '-': 'Dash',
    '+': 'Plus',
    '.': 'Period',
    ')': 'Parenthesis'
  })[value] ??
    value
      .split(/[^A-Za-z0-9]+/)
      .filter(Boolean)
      .map(part => part[0].toUpperCase() + part.slice(1))
      .join('')) ||
  'Empty'
