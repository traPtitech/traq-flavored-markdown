const escapes: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;'
}

export const escapeHtml = (text: string) =>
  text.replace(/[&<>"]/g, c => escapes[c])

export function attributes(values: Iterable<readonly [string, string]>) {
  return Array.from(values, ([name, value]) => {
    if (!/^[a-zA-Z_:][a-zA-Z0-9_.:-]*$/.test(name))
      throw new TypeError('Invalid HTML attribute name: ' + name)

    return ' ' + name + '="' + escapeHtml(value) + '"'
  }).join('')
}
